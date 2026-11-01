/**
 * Runtime capability detection utilities for WebXR and Meta Quest.
 *
 * NOTE: Hardware capabilities (e.g. 90Hz/120Hz, GPU performance, actual physical headset)
 * can ONLY be definitively verified in runtime, not statically.
 */

export interface QuestRuntimeCapabilities {
  isWebXRSupported: boolean;
  isQuestBrowser: boolean;
  supportsImmersiveVR: boolean;
  supportedFrameRates: number[];
  supportsTargetFrameRate: boolean;
  supportsHandTracking: boolean;
  webgl2Available: boolean;
}

/**
 * Evaluates WebXR and Quest-specific capabilities in the current browser environment.
 * Does NOT rely solely on user-agent; inspects navigator.xr and WebGL context where possible.
 */
export async function detectQuestCapabilities(): Promise<QuestRuntimeCapabilities> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isQuestBrowser = /OculusBrowser|Quest/i.test(ua);

  let webgl2Available = false;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      webgl2Available = !!gl;
    } catch {
      webgl2Available = false;
    }
  }

  const isWebXRSupported = typeof navigator !== 'undefined' && 'xr' in navigator && !!navigator.xr;

  let supportsImmersiveVR = false;
  if (isWebXRSupported && navigator.xr) {
    try {
      supportsImmersiveVR = await navigator.xr.isSessionSupported('immersive-vr');
    } catch {
      supportsImmersiveVR = false;
    }
  }

  return {
    isWebXRSupported,
    isQuestBrowser,
    supportsImmersiveVR,
    supportedFrameRates: [],
    supportsTargetFrameRate: false,
    supportsHandTracking: false,
    webgl2Available,
  };
}

/**
 * Negotiates an optimal target frame rate (e.g. 90Hz or 72Hz) on an active WebXR session.
 * Safely checks session.supportedFrameRates and session.updateTargetFrameRate.
 *
 * @param session Active XRSession
 * @param preferredRate Desired rate in Hz (default: 90)
 * @returns The actual applied rate, or null if negotiation is unsupported
 */
export async function negotiateFrameRate(
  session: any,
  preferredRate: number = 90
): Promise<number | null> {
  if (!session || typeof session.updateTargetFrameRate !== 'function') {
    return null;
  }

  try {
    const supported: Float32Array | number[] = session.supportedFrameRates;
    if (supported && supported.length > 0) {
      const rates = Array.from(supported).sort((a, b) => b - a);
      // Pick preferred rate if available, or closest suitable rate
      const targetRate = rates.includes(preferredRate)
        ? preferredRate
        : rates.find((r) => r <= preferredRate) || rates[rates.length - 1];

      await session.updateTargetFrameRate(targetRate);
      return targetRate;
    } else {
      await session.updateTargetFrameRate(preferredRate);
      return preferredRate;
    }
  } catch (err) {
    console.warn('[VXR] Target frame rate negotiation not available or rejected:', err);
    return null;
  }
}
