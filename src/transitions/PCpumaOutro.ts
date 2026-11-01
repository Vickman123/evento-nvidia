import * as THREE from 'three';
import gsap from 'gsap';
import type { XRApp } from '../vxr/XRApp.js';

/**
 * Escena y panel 3D del Cierre Institucional PC PUMA (ESTADO 6 y 7).
 * Presenta el lema oficial:
 * "PC PUMA — Tecnología para transformar el aprendizaje."
 * Y el botón tridimensional interactivo "VOLVER A COMENZAR" con cuenta regresiva automática.
 */
export class PCpumaOutro {
  public readonly group: THREE.Group;
  public restartButtonMesh: THREE.Mesh;
  private outroCanvas: HTMLCanvasElement;
  private outroCtx: CanvasRenderingContext2D;
  private outroTexture: THREE.CanvasTexture;
  private outroScreenMesh: THREE.Mesh;
  private app: XRApp;
  private onRestartCallback: (() => void) | null = null;
  private remainingSeconds: number = 10;
  private countdownTimer: number | null = null;

  constructor(app: XRApp) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'VXR_PC_PUMA_Outro';
    this.group.position.set(0, 1.8, -3.2);
    this.group.visible = false;

    // 1. Canvas 2D de alta resolución para renderizado nítido en Meta Quest
    this.outroCanvas = document.createElement('canvas');
    this.outroCanvas.width = 1536;
    this.outroCanvas.height = 864;
    this.outroCtx = this.outroCanvas.getContext('2d')!;

    this.outroTexture = new THREE.CanvasTexture(this.outroCanvas);
    this.outroTexture.minFilter = THREE.LinearFilter;
    this.outroTexture.magFilter = THREE.LinearFilter;

    // 2. Malla del panel de cierre
    const screenGeo = new THREE.PlaneGeometry(3.6, 2.025);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.outroTexture,
      transparent: true,
      opacity: 0.98,
      side: THREE.FrontSide,
    });
    this.outroScreenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.group.add(this.outroScreenMesh);

    // Marco elegante con brillo dorado y azul
    const frameGeo = new THREE.BoxGeometry(3.75, 2.18, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x070e1a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = -0.05;
    this.group.add(frame);

    const goldEdgeGeo = new THREE.EdgesGeometry(frameGeo);
    const goldEdgeMat = new THREE.LineBasicMaterial({ color: 0xd4af37, linewidth: 2 });
    const goldEdge = new THREE.LineSegments(goldEdgeGeo, goldEdgeMat);
    goldEdge.position.z = -0.04;
    this.group.add(goldEdge);

    // 3. Botón 3D "VOLVER A COMENZAR" interactivo
    const btnGeo = new THREE.BoxGeometry(1.6, 0.38, 0.12);
    const btnMat = new THREE.MeshStandardMaterial({
      color: 0x002b7a, // Azul UNAM
      roughness: 0.4,
      metalness: 0.6,
      emissive: 0x00172d,
    });
    this.restartButtonMesh = new THREE.Mesh(btnGeo, btnMat);
    this.restartButtonMesh.position.set(0, -0.65, 0.08);
    this.restartButtonMesh.name = 'VXR_Restart_Button_3D';
    this.group.add(this.restartButtonMesh);

    // Rótulo del botón
    const btnLabelCanvas = document.createElement('canvas');
    btnLabelCanvas.width = 512;
    btnLabelCanvas.height = 128;
    const btnCtx = btnLabelCanvas.getContext('2d')!;
    btnCtx.fillStyle = '#002B7A';
    btnCtx.fillRect(0, 0, 512, 128);
    btnCtx.strokeStyle = '#D4AF37';
    btnCtx.lineWidth = 8;
    btnCtx.strokeRect(4, 4, 504, 120);
    btnCtx.fillStyle = '#FFFFFF';
    btnCtx.font = 'bold 36px system-ui, sans-serif';
    btnCtx.textAlign = 'center';
    btnCtx.fillText('↺  VOLVER A COMENZAR', 256, 76);

    const btnTex = new THREE.CanvasTexture(btnLabelCanvas);
    const labelMat = new THREE.MeshBasicMaterial({ map: btnTex, transparent: true });
    const labelGeo = new THREE.PlaneGeometry(1.58, 0.36);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.z = 0.065;
    this.restartButtonMesh.add(labelMesh);

    // Dibujar pantalla inicial
    this.renderCanvas();

    // Añadir al grafo de la escena
    this.app.scene.nativeScene.add(this.group);
  }

  private renderCanvas(): void {
    const ctx = this.outroCtx;
    const w = 1536;
    const h = 864;

    // Fondo degradado azul UNAM oscuro y elegante
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#001428');
    grad.addColorStop(0.5, '#071A30');
    grad.addColorStop(1, '#020B16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Borde institucional dorado
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    // Cabecera institucional
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSIDAD NACIONAL AUTÓNOMA DE MÉXICO', w / 2, 110);

    // Marca PC PUMA
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 84px system-ui, -apple-system, sans-serif';
    ctx.fillText('PC PUMA', w / 2, 230);

    // Línea divisoria cian y dorada
    const lineGrad = ctx.createLinearGradient(w / 2 - 300, 0, w / 2 + 300, 0);
    lineGrad.addColorStop(0, 'rgba(212, 175, 55, 0.1)');
    lineGrad.addColorStop(0.5, '#00F0FF');
    lineGrad.addColorStop(1, 'rgba(212, 175, 55, 0.1)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(w / 2 - 320, 265, 640, 6);

    // Lema oficial PC PUMA
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '500 46px system-ui, -apple-system, sans-serif';
    ctx.fillText('Tecnología para transformar el aprendizaje.', w / 2, 350);

    // Mensaje de despedida
    ctx.fillStyle = '#94A3B8';
    ctx.font = '400 32px system-ui, -apple-system, sans-serif';
    ctx.fillText('Gracias por vivir esta experiencia inmersiva', w / 2, 440);

    // Indicador de reinicio automático
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`Reinicio automático en ${this.remainingSeconds}s...`, w / 2, 530);

    // Crédito institucional
    ctx.fillStyle = '#64748B';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Powered by VXR Core  •  WebXR for Meta Quest', w / 2, 800);

    this.outroTexture.needsUpdate = true;
  }

  /**
   * Muestra la pantalla de cierre e inicia la cuenta regresiva de reinicio.
   */
  public show(autoResetSeconds: number = 10): Promise<void> {
    return new Promise((resolve) => {
      this.remainingSeconds = autoResetSeconds;
      this.renderCanvas();
      this.group.visible = true;

      this.group.scale.set(0.1, 0.1, 0.1);
      gsap.to(this.group.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.5,
        ease: 'power3.out',
        onComplete: () => {
          this.startCountdown();
          resolve();
        },
      });
    });
  }

  private startCountdown(): void {
    this.stopCountdown();

    this.countdownTimer = window.setInterval(() => {
      this.remainingSeconds--;
      this.renderCanvas();

      if (this.remainingSeconds <= 0) {
        this.stopCountdown();
        if (this.onRestartCallback) {
          this.onRestartCallback();
        }
      }
    }, 1000);
  }

  public stopCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  public hide(): Promise<void> {
    this.stopCountdown();
    return new Promise((resolve) => {
      gsap.to(this.group.scale, {
        x: 0.001,
        y: 0.001,
        z: 0.001,
        duration: 1.0,
        ease: 'power2.in',
        onComplete: () => {
          this.group.visible = false;
          resolve();
        },
      });
    });
  }

  public onRestart(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  public reset(): void {
    this.stopCountdown();
    this.group.scale.set(0.001, 0.001, 0.001);
    this.group.visible = false;
  }

  public dispose(): void {
    this.reset();
    this.outroTexture.dispose();
    this.outroScreenMesh.geometry.dispose();
    (this.outroScreenMesh.material as THREE.Material).dispose();
    this.restartButtonMesh.geometry.dispose();
    (this.restartButtonMesh.material as THREE.Material).dispose();
    this.app.scene.nativeScene.remove(this.group);
    this.group.clear();
  }
}
