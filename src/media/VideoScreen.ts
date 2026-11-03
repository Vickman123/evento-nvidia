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
  private videoCanvas: HTMLCanvasElement;
  private videoCtx: CanvasRenderingContext2D;
  private screenTexture: THREE.CanvasTexture;
  private videoElement: HTMLVideoElement | null = null;
  private lastVideoTime: number = -1;
  private config: ExperienceConfigData;

  constructor(config: ExperienceConfigData) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = 'VXR_Cinema_Screen';

    // Posición inicial: 4.2m frente al usuario ubicado en el centro de la plaza (Z = 6)
    this.group.position.set(0, config.videoScreenHeightAboveGround, 6 - config.videoScreenDistance);
    this.group.scale.set(0.001, 0.001, 0.001); // Oculta inicialmente
    this.group.visible = false;

    // 1. Canvas 2D ultra-optimizado (640x360 coincidente con la resolución nativa del video).
    // Evita transferencias masivas de texturas y reduce drásticamente el consumo térmico en Meta Quest.
    this.videoCanvas = document.createElement('canvas');
    this.videoCanvas.width = 640;
    this.videoCanvas.height = 360;
    this.videoCtx = this.videoCanvas.getContext('2d', { willReadFrequently: false })!;

    // Dibujar pantalla de espera inicial en el canvas
    this.renderStandbyOnCanvas();

    this.screenTexture = new THREE.CanvasTexture(this.videoCanvas);
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.LinearFilter;
    this.screenTexture.generateMipmaps = false;
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;

    // 2. Malla de la pantalla (16:9 cinematográfica, nítida y sin recorte)
    const width = config.videoScreenWidth;
    const height = config.videoScreenHeight;

    const screenGeo = new THREE.PlaneGeometry(width, height);

    this.screenMaterial = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      toneMapped: false, // Asegura máxima luminosidad y colores vivos sin oscurecimiento de tone mapping
    });
    this.screenMesh = new THREE.Mesh(screenGeo, this.screenMaterial);
    this.screenMesh.name = 'Screen_Display_Surface';
    this.screenMesh.position.set(0, 0, 0.01);
    this.group.add(this.screenMesh);

    // 3. Marco arquitectónico institucional (Azul UNAM con ribete dorado detrás de la pantalla)
    const frameDepth = 0.12;
    const frameGeo = new THREE.BoxGeometry(width + 0.28, height + 0.28, frameDepth);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x00172d, // Azul noche UNAM
      roughness: 0.35,
      metalness: 0.7,
    });
    this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.frameMesh.position.set(0, 0, -frameDepth / 2);
    this.group.add(this.frameMesh);

    // Ribete dorado perimetral luminoso
    const edgesGeo = new THREE.EdgesGeometry(frameGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0xd4af37, // Dorado universitario
      linewidth: 2,
    });
    const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
    edgesMesh.position.set(0, 0, 0.005);
    this.group.add(edgesMesh);

    // Rótulo inferior integrado en el marco
    const bannerMesh = this.createFrameBanner(width);
    bannerMesh.position.set(0, -height / 2 - 0.2, 0.05);
    this.group.add(bannerMesh);
  }

  private renderStandbyOnCanvas(): void {
    const ctx = this.videoCtx;
    const w = this.videoCanvas.width;
    const h = this.videoCanvas.height;

    // Fondo azul degradado tecnológico
    const grad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#0a2540');
    grad.addColorStop(1, '#001122');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Patrón sutil de cuadrícula tecnológica
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Escudo / Rótulo Central
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSIDAD NACIONAL AUTÓNOMA DE MÉXICO', w / 2, h / 2 - 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
    ctx.fillText('PC PUMA', w / 2, h / 2 + 10);

    ctx.fillStyle = '#00F0FF';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.fillText('Tecnología para transformar el aprendizaje', w / 2, h / 2 + 55);
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
   * Conecta un elemento de video HTML5 a la superficie 3D mediante el canvas de decodificación directa.
   */
  public attachVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.lastVideoTime = -1;
  }

  /**
   * Actualización continua ejecutada en el bucle WebGL/WebXR.
   * Sólo redibuja si el tiempo de reproducción avanzó (30 FPS en lugar de 90 FPS),
   * reduciendo en un 66% el uso del bus de memoria y manteniendo las gafas frías.
   */
  public update(): void {
    if (this.videoElement && this.videoCtx) {
      if (this.videoElement.readyState >= 2 && !this.videoElement.paused) {
        const currentTime = this.videoElement.currentTime;
        if (currentTime !== this.lastVideoTime) {
          this.lastVideoTime = currentTime;
          try {
            this.videoCtx.drawImage(
              this.videoElement,
              0,
              0,
              this.videoCanvas.width,
              this.videoCanvas.height
            );
            this.screenTexture.needsUpdate = true;
          } catch (e) {
            // Captura silenciosa de errores transitorios
          }
        }
      }
    }
  }

  /**
   * Libera la referencia al video y restablece la imagen de standby.
   */
  public detachVideo(): void {
    this.videoElement = null;
    this.lastVideoTime = -1;
    this.renderStandbyOnCanvas();
    this.screenTexture.needsUpdate = true;
  }

  /**
   * Posiciona la pantalla exactamente frente a la mirada actual del usuario en VR o Desktop,
   * orientándola perpendicularmente para una visualización 100% nítida, cómoda y cinematográfica.
   * Acepta un XRApp (para consultar app.activeCamera en WebXR) o un THREE.Camera.
   */
  public placeInFrontOf(cameraOrApp: THREE.Camera | { activeCamera: THREE.Camera }, distance: number = 3.5, heightOffset: number = 0.15): void {
    this.group.visible = true;
    this.group.scale.set(1, 1, 1);

    const camera = 'activeCamera' in cameraOrApp ? cameraOrApp.activeCamera : cameraOrApp;

    const camWorldPos = new THREE.Vector3();
    camera.getWorldPosition(camWorldPos);

    const camWorldDir = new THREE.Vector3();
    camera.getWorldDirection(camWorldDir);
    camWorldDir.y = 0; // Mantener en el plano horizontal para no inclinar la pantalla
    if (camWorldDir.lengthSq() < 0.001) {
      camWorldDir.set(0, 0, -1);
    } else {
      camWorldDir.normalize();
    }

    const screenPos = camWorldPos.clone().add(camWorldDir.clone().multiplyScalar(distance));
    screenPos.y = Math.max(1.4, camWorldPos.y + heightOffset);
    this.group.position.copy(screenPos);

    // Orientar de frente al usuario: en Three.js lookAt ya apunta la cara frontal (+Z) directamente a la cámara
    this.group.lookAt(camWorldPos.x, screenPos.y, camWorldPos.z);
    this.group.updateMatrixWorld(true);
  }

  /**
   * Transición de entrada cinematográfica: visible y al tamaño definitivo desde el primer milisegundo,
   * sin retrasos, escalamientos extraños o necesidad de gatillo.
   */
  public animateIn(_duration: number = 0.6): Promise<void> {
    this.group.visible = true;
    this.group.scale.set(1, 1, 1);
    gsap.killTweensOf(this.group.scale);
    return Promise.resolve();
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
    const targetZ = 6 - this.config.videoScreenDistance;
    this.group.position.set(0, this.config.videoScreenHeightAboveGround, targetZ);
    this.group.visible = false;
    this.detachVideo();
  }

  public dispose(): void {
    this.reset();
    this.screenTexture.dispose();
    this.screenMaterial.dispose();
    this.screenMesh.geometry.dispose();
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.group.clear();
  }
}
