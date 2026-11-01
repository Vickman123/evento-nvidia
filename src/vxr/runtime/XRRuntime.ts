import type { XRApp } from '../XRApp.js';

export type XRRuntimeMode = 'auto' | 'desktop' | 'webxr';

/**
 * Strategy interface for runtime execution environments in VXR.
 * Enables clean separation between Desktop fallback (OrbitControls/pointer)
 * and immersive WebXR (6DoF controllers, VR compositor, Quest framerate negotiation).
 */
export interface XRRuntime {
  /** Identifier of the runtime strategy */
  readonly id: 'desktop' | 'webxr';

  /** Whether the current environment supports WebXR immersive VR */
  readonly isVRSupported: boolean;

  /** Initializes the runtime with the host XRApp instance */
  init(app: XRApp): Promise<void>;

  /** Frame update hook invoked during animation loop */
  update(delta: number, elapsed: number): void;

  /** Cleans up listeners, controls and DOM elements */
  dispose(): void;
}
