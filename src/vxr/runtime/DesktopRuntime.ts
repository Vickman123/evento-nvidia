import type { XRApp } from '../XRApp.js';
import type { XRRuntime } from './XRRuntime.js';

/**
 * Desktop runtime implementation for standard PC, Mac, and mobile browser environments.
 * Drives mouse/touch pointer interactions and OrbitControls.
 */
export class DesktopRuntime implements XRRuntime {
  public readonly id = 'desktop' as const;
  public readonly isVRSupported = false;
  private app: XRApp | null = null;

  public async init(app: XRApp): Promise<void> {
    this.app = app;
    // Desktop runtime leaves controls active by default
    if (this.app.controls) {
      this.app.controls.enabled = true;
    }
  }

  public update(_delta: number, _elapsed: number): void {
    if (this.app?.controls && this.app.controls.enabled) {
      this.app.controls.update();
    }
  }

  public dispose(): void {
    this.app = null;
  }
}
