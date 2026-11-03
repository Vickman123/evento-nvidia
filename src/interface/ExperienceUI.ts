import * as THREE from 'three';
import gsap from 'gsap';
import type { XRApp } from '../vxr/XRApp.js';

/**
 * Interfaz 3D flotante (HUD inmersivo) para el visitante dentro del visor.
 * Proporciona información discreta durante la fase de exploración sin obstaculizar la visión:
 * - Cartela de ubicación ("Ciudad Universitaria — Las Islas").
 * - Instrucción sutil de giro 360°.
 * - Indicador de progreso de tiempo restante.
 */
export class ExperienceUI {
  public readonly group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private hudMesh: THREE.Mesh;
  private app: XRApp;
  private remainingSeconds: number = 0;
  private totalSeconds: number = 35;
  private isVisible: boolean = false;

  constructor(app: XRApp) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'VXR_InVR_HUD';

    // Posicionada discretamente en el campo de visión inferior-frontal (frente a Z = 6)
    this.group.position.set(0, 1.15, 6 - 2.4);
    this.group.rotation.x = -0.15; // Inclinación ergonómica hacia los ojos del usuario
    this.group.scale.set(0.001, 0.001, 0.001);
    this.group.visible = false;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 320;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geo = new THREE.PlaneGeometry(1.6, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    this.hudMesh = new THREE.Mesh(geo, mat);
    this.hudMesh.renderOrder = 1000;
    this.group.add(this.hudMesh);

    this.render();
    this.app.scene.nativeScene.add(this.group);
  }

  private render(): void {
    const ctx = this.ctx;
    const w = 1024;
    const h = 320;

    ctx.clearRect(0, 0, w, h);

    // Fondo pastilla translúcida tecnológica
    ctx.save();
    ctx.fillStyle = 'rgba(0, 23, 45, 0.82)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 4;

    const radius = 32;
    ctx.beginPath();
    ctx.roundRect(16, 16, w - 32, h - 32, radius);
    ctx.fill();
    ctx.stroke();

    // Rótulo de ubicación
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CIUDAD UNIVERSITARIA  •  UNAM', w / 2, 85);

    // Instrucción de exploración
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText('Explora el entorno en 360°', w / 2, 145);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Gira tu cabeza libremente para contemplar Las Islas, Biblioteca y Rectoría', w / 2, 195);

    // Barra de tiempo restante de exploración
    const barWidth = 600;
    const barHeight = 10;
    const barX = (w - barWidth) / 2;
    const barY = 245;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 5);
    ctx.fill();

    const progress = Math.max(0, Math.min(1, this.remainingSeconds / (this.totalSeconds || 1)));
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth * progress, barHeight, 5);
    ctx.fill();

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  public showExplorationHUD(totalSeconds: number): void {
    this.totalSeconds = totalSeconds;
    this.remainingSeconds = totalSeconds;
    this.render();
    this.group.visible = true;
    this.isVisible = true;

    gsap.killTweensOf(this.group.scale);
    gsap.to(this.group.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.2,
      ease: 'back.out(1.4)',
    });
  }

  public updateTime(remaining: number): void {
    if (!this.isVisible) return;
    this.remainingSeconds = remaining;
    this.render();
  }

  public hideHUD(): Promise<void> {
    this.isVisible = false;
    this.group.visible = false;
    this.group.scale.set(0.001, 0.001, 0.001);
    gsap.killTweensOf(this.group.scale);
    return Promise.resolve();
  }

  public reset(): void {
    this.isVisible = false;
    gsap.killTweensOf(this.group.scale);
    this.group.scale.set(0.001, 0.001, 0.001);
    this.group.visible = false;
  }

  public dispose(): void {
    this.reset();
    this.texture.dispose();
    this.hudMesh.geometry.dispose();
    (this.hudMesh.material as THREE.Material).dispose();
    this.app.scene.nativeScene.remove(this.group);
    this.group.clear();
  }
}
