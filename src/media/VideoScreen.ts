import * as THREE from 'three';
import gsap from 'gsap';
import type { ExperienceConfigData } from '../experience/ExperienceConfig.js';

/**
 * Pantalla virtual cinematográfica 16:9 para la experiencia UNAM - PC PUMA.
 * Dispone de marco arquitectónico biselado institucional (azul noche y dorado),
 * soporte para superficie curva o plana y animación cinematográfica de aparición.
 */
export class VideoScreen {
  public readonly group: THREE.Group;
  public readonly screenMesh: THREE.Mesh;
  public readonly frameMesh: THREE.Mesh;
  private screenMaterial: THREE.MeshBasicMaterial;
  private videoTexture: THREE.VideoTexture | null = null;
  private standbyTexture: THREE.CanvasTexture;
  private config: ExperienceConfigData;

  constructor(config: ExperienceConfigData) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = 'VXR_Cinema_Screen';

    // Posición inicial: frente al usuario en Las Islas
    this.group.position.set(0, config.videoScreenHeightAboveGround, -config.videoScreenDistance);
    this.group.scale.set(0.001, 0.001, 0.001); // Oculta inicialmente
    this.group.visible = false;

    // 1. Textura inicial de espera / standby institucional
    this.standbyTexture = this.createStandbyTexture();

    // 2. Malla de la pantalla (16:9, plana o sutilmente curva para inmersión VR)
    const isCurved = config.videoScreenMode === 'curved';
    const width = config.videoScreenWidth;
    const height = config.videoScreenHeight;
    const curveRadius = 6.0;

    const screenGeo = isCurved
      ? new THREE.CylinderGeometry(
          curveRadius,
          curveRadius,
          height,
          48,
          1,
          true,
          -width / (2 * curveRadius) + Math.PI / 2,
          width / curveRadius
        )
      : new THREE.PlaneGeometry(width, height);

    // Ajustar orientación si es cilíndrica
    if (isCurved) {
      screenGeo.rotateY(Math.PI);
    }

    this.screenMaterial = new THREE.MeshBasicMaterial({
      map: this.standbyTexture,
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.99,
    });
    this.screenMesh = new THREE.Mesh(screenGeo, this.screenMaterial);
    this.screenMesh.name = 'Screen_Display_Surface';
    this.group.add(this.screenMesh);

    // 3. Marco arquitectónico institucional (Azul UNAM con ribete dorado)
    const frameDepth = 0.12;
    const frameGeo = new THREE.BoxGeometry(width + 0.28, height + 0.28, frameDepth);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x00172d, // Azul noche UNAM
      roughness: 0.35,
      metalness: 0.7,
    });
    this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.frameMesh.position.z = -0.07;
    this.group.add(this.frameMesh);

    // Ribete dorado perimetral luminoso
    const edgesGeo = new THREE.EdgesGeometry(frameGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xd4af37, // Dorado universitario
      linewidth: 2,
    });
    const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
    edgesMesh.position.z = -0.06;
    this.group.add(edgesMesh);

    // Rótulo inferior integrado en el marco
    const bannerMesh = this.createFrameBanner(width);
    bannerMesh.position.set(0, -height / 2 - 0.2, 0.05);
    this.group.add(bannerMesh);
  }

  private createStandbyTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    // Fondo azul degradado tecnológico
    const grad = ctx.createRadialGradient(960, 540, 100, 960, 540, 900);
    grad.addColorStop(0, '#0a2540');
    grad.addColorStop(1, '#001122');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);

    // Patrón sutil de cuadrícula tecnológica
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1920; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1080);
      ctx.stroke();
    }
    for (let y = 0; y < 1080; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }

    // Escudo / Rótulo Central
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSIDAD NACIONAL AUTÓNOMA DE MÉXICO', 960, 480);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
    ctx.fillText('PC PUMA', 960, 580);

    ctx.fillStyle = '#00F0FF';
    ctx.font = '36px system-ui, -apple-system, sans-serif';
    ctx.fillText('Tecnología para transformar el aprendizaje', 960, 660);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  private createFrameBanner(width: number): THREE.Mesh {
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 128;
    const ctx = bannerCanvas.getContext('2d')!;

    ctx.fillStyle = '#070E1A';
    ctx.fillRect(0, 0, 1024, 128);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNAM IMMERSIVE EXPERIENCE  •  PC PUMA', 512, 76);

    const tex = new THREE.CanvasTexture(bannerCanvas);
    const geo = new THREE.PlaneGeometry(width * 0.75, 0.28);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * Conecta un elemento de video HTML5 a la superficie 3D mediante THREE.VideoTexture.
   */
  public attachVideo(video: HTMLVideoElement): void {
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }

    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.generateMipmaps = false;
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    this.screenMaterial.map = this.videoTexture;
    this.screenMaterial.needsUpdate = true;
  }

  /**
   * Libera la textura de video y restablece la imagen de standby.
   */
  public detachVideo(): void {
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.screenMaterial.map = this.standbyTexture;
    this.screenMaterial.needsUpdate = true;
  }

  /**
   * Transición de entrada cinematográfica (fade-in y escalado suave).
   */
  public animateIn(duration: number = 2.0): Promise<void> {
    return new Promise((resolve) => {
      this.group.visible = true;
      gsap.killTweensOf(this.group.scale);
      gsap.killTweensOf(this.group.position);

      this.group.scale.set(0.1, 0.1, 0.1);
      this.group.position.y = this.config.videoScreenHeightAboveGround - 0.5;

      gsap.to(this.group.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration,
        ease: 'power3.out',
      });

      gsap.to(this.group.position, {
        y: this.config.videoScreenHeightAboveGround,
        duration,
        ease: 'power3.out',
        onComplete: () => resolve(),
      });
    });
  }

  /**
   * Transición de salida cinematográfica.
   */
  public animateOut(duration: number = 1.5): Promise<void> {
    return new Promise((resolve) => {
      gsap.killTweensOf(this.group.scale);
      gsap.to(this.group.scale, {
        x: 0.001,
        y: 0.001,
        z: 0.001,
        duration,
        ease: 'power2.in',
        onComplete: () => {
          this.group.visible = false;
          resolve();
        },
      });
    });
  }

  public reset(): void {
    gsap.killTweensOf(this.group.scale);
    gsap.killTweensOf(this.group.position);
    this.group.scale.set(0.001, 0.001, 0.001);
    this.group.position.set(0, this.config.videoScreenHeightAboveGround, -this.config.videoScreenDistance);
    this.group.visible = false;
    this.detachVideo();
  }

  public dispose(): void {
    this.reset();
    this.standbyTexture.dispose();
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.screenMaterial.dispose();
    this.screenMesh.geometry.dispose();
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.group.clear();
  }
}
