import type { XRApp } from '../vxr/XRApp.js';

export interface PerformanceStats {
  fps: number;
  deltaMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export class PerformanceMonitor {
  private app: XRApp;
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private currentFPS: number = 72;
  private stats: PerformanceStats = {
    fps: 72,
    deltaMs: 13.8,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };

  constructor(app: XRApp) {
    this.app = app;
  }

  public update(): PerformanceStats {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 500) {
      this.currentFPS = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = now;

      const info = this.app.renderer.nativeRenderer.info;
      this.stats = {
        fps: this.currentFPS,
        deltaMs: Math.round((1000 / (this.currentFPS || 1)) * 10) / 10,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
    }

    return this.stats;
  }

  public getStats(): PerformanceStats {
    return this.stats;
  }
}
