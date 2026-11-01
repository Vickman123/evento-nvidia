import type { XRApp } from '../XRApp.js';
import type { XRRuntime } from './XRRuntime.js';
import { negotiateFrameRate } from './questDetection.js';

export interface WebXRRuntimeOptions {
  /** Target frame rate in Hz to request in Meta Quest Browser (default: 90) */
  targetFrameRate?: number;
  /** Whether to apply Quest-specific compositor optimizations like pixel ratio clamp */
  questOptimization?: boolean;
}

/**
 * WebXR runtime implementation for Meta Quest Browser and immersive VR headsets.
 * Manages 6DoF controllers, framerate negotiation, and adaptive rendering parameters.
 */
export class WebXRRuntime implements XRRuntime {
  public readonly id = 'webxr' as const;
  public isVRSupported = false;
  private app: XRApp | null = null;
  private options: WebXRRuntimeOptions;
  private cleanupSessionListener: (() => void) | null = null;
  private previousPixelRatio: number = 1.0;

  constructor(options: WebXRRuntimeOptions = {}) {
    this.options = {
      targetFrameRate: options.targetFrameRate ?? 90,
      questOptimization: options.questOptimization ?? true,
    };
  }

  public async init(app: XRApp): Promise<void> {
    this.app = app;
    this.isVRSupported = await app.session.checkVRSupport();

    // Hook session state changes to adaptively configure rendering & framerate
    this.cleanupSessionListener = app.session.onStateChange((active, session) => {
      this.handleSessionTransition(active, session);
    });
  }

  private handleSessionTransition(active: boolean, session: any): void {
    if (!this.app) return;

    if (active && session) {
      // 1. Disable OrbitControls during immersive presentation
      if (this.app.controls) {
        this.app.controls.enabled = false;
      }

      // 2. Store desktop pixel ratio and apply Quest-optimized ratio
      if (this.options.questOptimization) {
        this.previousPixelRatio = this.app.nativeRenderer.getPixelRatio();
        // Clamping pixel ratio between 1.0 and 1.25 prevents GPU thermal throttling on Quest 2/3
        this.app.nativeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1.0, 1.25));
      }

      // 3. Negotiate target frame rate safely (e.g. 90Hz)
      negotiateFrameRate(session, this.options.targetFrameRate).then((appliedRate) => {
        if (appliedRate) {
          console.info(`[VXR WebXRRuntime] Target frame rate set to ${appliedRate}Hz`);
        }
      });
    } else {
      // Restore desktop controls and pixel ratio
      if (this.app.controls) {
        this.app.controls.enabled = true;
      }
      if (this.options.questOptimization) {
        this.app.nativeRenderer.setPixelRatio(this.previousPixelRatio);
      }
    }
  }

  public update(_delta: number, _elapsed: number): void {
    // Controller laser updates are driven via Three.js XR animation loop
    if (this.app?.controls && this.app.controls.enabled) {
      this.app.controls.update();
    }
  }

  public dispose(): void {
    if (this.cleanupSessionListener) {
      this.cleanupSessionListener();
      this.cleanupSessionListener = null;
    }
    this.app = null;
  }
}
