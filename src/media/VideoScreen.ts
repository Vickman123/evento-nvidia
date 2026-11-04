import * as THREE from 'three';
import gsap from 'gsap';
import type { ExperienceConfigData } from '../experience/ExperienceConfig.js';

/**
 * Pantalla virtual cinematográfica 16:9 para la experiencia UNAM - PC PUMA.
 * Integra marco arquitectónico institucional (azul noche y ribete dorado),
 * textura de video por hardware (THREE.VideoTexture) a máximos FPS nativos sin pérdida,
 * indicador HUD de pausa interactiva con gatillo
 * y un indicador HUD de progreso para reinicio mediante pulsación sostenida del botón [A].
 */
export class VideoScreen {
  public readonly group: THREE.Group;
  public readonly screenMesh: THREE.Mesh;
  public readonly frameMesh: THREE.Mesh;
  private screenMaterial: THREE.MeshBasicMaterial;
  private videoTexture: THREE.VideoTexture | null = null;
  private standbyTexture: THREE.CanvasTexture;
  private videoElement: HTMLVideoElement | null = null;
  private config: ExperienceConfigData;

  // Estado y Overlay de Pausa (Gatillo)
  private isPaused: boolean = false;
  private pauseOverlayGroup: THREE.Group;
  private pauseOverlayMesh: THREE.Mesh;
  private pauseTexture: THREE.CanvasTexture;

  // Indicador visual de reinicio (Hold botón [A] por 4 segundos)
  private restartHUDGroup: THREE.Group;
  private restartProgressBar: THREE.Mesh;
  private restartHUDCanvas: HTMLCanvasElement;
  private restartHUDCtx: CanvasRenderingContext2D;
  private restartHUDTexture: THREE.CanvasTexture;
  private restartHUDMesh: THREE.Mesh;

  constructor(config: ExperienceConfigData) {
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = 'VXR_Cinema_Screen';

    // Posición inicial: exactamente a 3.5m frente al spawn de la plaza peatonal (Z = 6)
    // El usuario está en X=0, Z=6 mirando hacia -Z.
    // La pantalla se inicializa exactamente en X=0, Y=1.75, Z=2.5 mirando a Z=6.
    const initialZ = 6 - config.videoScreenDistance;
    const initialY = config.videoScreenHeightAboveGround;
    this.group.position.set(0, initialY, initialZ);
    this.group.lookAt(0, initialY, 6);
    this.group.scale.set(0.001, 0.001, 0.001); // Oculta inicialmente
    this.group.visible = false;

    // 1. Textura inicial de espera / standby institucional
    this.standbyTexture = this.createStandbyTexture();

    // 2. Malla de la pantalla (16:9 cinematográfica, nítida y sin recorte)
    const width = config.videoScreenWidth;
    const height = config.videoScreenHeight;

    const screenGeo = new THREE.PlaneGeometry(width, height);

    this.screenMaterial = new THREE.MeshBasicMaterial({
      map: this.standbyTexture,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1.0,
      toneMapped: false, // Máxima luminosidad y colores puros
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

    // 4. Cartel / Overlay visual de PAUSA en el centro de la pantalla
    this.pauseOverlayGroup = new THREE.Group();
    this.pauseOverlayGroup.position.set(0, 0, 0.06);
    this.pauseOverlayGroup.visible = false;

    const pauseCanvas = document.createElement('canvas');
    pauseCanvas.width = 1024;
    pauseCanvas.height = 512;
    const pctx = pauseCanvas.getContext('2d')!;

    // Fondo oscuro redondeado
    pctx.fillStyle = 'rgba(2, 13, 28, 0.88)';
    pctx.beginPath();
    pctx.roundRect(160, 40, 704, 432, 28);
    pctx.fill();

    // Borde perimetral dorado
    pctx.strokeStyle = '#D4AF37';
    pctx.lineWidth = 6;
    pctx.beginPath();
    pctx.roundRect(160, 40, 704, 432, 28);
    pctx.stroke();

    // Icono de pausa: dos barras verticales doradas
    pctx.fillStyle = '#D4AF37';
    pctx.fillRect(440, 110, 45, 130);
    pctx.fillRect(539, 110, 45, 130);

    // Título de PAUSA
    pctx.fillStyle = '#FFFFFF';
    pctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('PAUSA', 512, 315);

    // Subtítulo con indicación para reanudar
    pctx.fillStyle = '#00F0FF';
    pctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    pctx.fillText('Presiona el gatillo para continuar ▶', 512, 395);

    this.pauseTexture = new THREE.CanvasTexture(pauseCanvas);
    this.pauseTexture.minFilter = THREE.LinearFilter;
    this.pauseTexture.magFilter = THREE.LinearFilter;

    const pauseGeo = new THREE.PlaneGeometry(width * 0.45, height * 0.45);
    const pauseMat = new THREE.MeshBasicMaterial({
      map: this.pauseTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.pauseOverlayMesh = new THREE.Mesh(pauseGeo, pauseMat);
    this.pauseOverlayGroup.add(this.pauseOverlayMesh);
    this.group.add(this.pauseOverlayGroup);

    // 5. Indicador HUD flotante para reinicio con botón [A] (sostenido 4 segundos)
    this.restartHUDGroup = new THREE.Group();
    this.restartHUDGroup.position.set(0, -height / 2 - 0.44, 0.08);
    this.restartHUDGroup.visible = false;

    // Fondo del indicador HUD
    const hudBgGeo = new THREE.PlaneGeometry(width * 0.75, 0.22);
    const hudBgMat = new THREE.MeshBasicMaterial({
      color: 0x020d1c,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    });
    const hudBg = new THREE.Mesh(hudBgGeo, hudBgMat);
    this.restartHUDGroup.add(hudBg);

    // Borde exterior del HUD en dorado
    const hudEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 0.75, 0.22, 0.01)),
      new THREE.LineBasicMaterial({ color: 0xd4af37 })
    );
    this.restartHUDGroup.add(hudEdges);

    // Pista de la barra de progreso (fondo oscuro)
    const trackWidth = width * 0.68;
    const trackGeo = new THREE.PlaneGeometry(trackWidth, 0.035);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x16283d, side: THREE.DoubleSide });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, -0.045, 0.004);
    this.restartHUDGroup.add(trackMesh);

    // Barra de progreso dorada (origen en el borde izquierdo para escalar con scale.x)
    const barGeo = new THREE.PlaneGeometry(trackWidth, 0.035);
    barGeo.translate(trackWidth / 2, 0, 0);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
    this.restartProgressBar = new THREE.Mesh(barGeo, barMat);
    this.restartProgressBar.position.set(-trackWidth / 2, -0.045, 0.008);
    this.restartProgressBar.scale.x = 0.0001;
    this.restartHUDGroup.add(this.restartProgressBar);

    // Rótulo de texto del indicador
    this.restartHUDCanvas = document.createElement('canvas');
    this.restartHUDCanvas.width = 1024;
    this.restartHUDCanvas.height = 128;
    this.restartHUDCtx = this.restartHUDCanvas.getContext('2d')!;

    this.restartHUDTexture = new THREE.CanvasTexture(this.restartHUDCanvas);
    this.restartHUDTexture.minFilter = THREE.LinearFilter;
    this.restartHUDTexture.magFilter = THREE.LinearFilter;
    const textGeo = new THREE.PlaneGeometry(trackWidth, 0.11);
    const textMat = new THREE.MeshBasicMaterial({
      map: this.restartHUDTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.restartHUDMesh = new THREE.Mesh(textGeo, textMat);
    this.restartHUDMesh.position.set(0, 0.04, 0.008);
    this.restartHUDGroup.add(this.restartHUDMesh);

    this.group.add(this.restartHUDGroup);
  }

  private createStandbyTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    // Fondo azul degradado tecnológico
    const grad = ctx.createRadialGradient(640, 360, 80, 640, 360, 640);
    grad.addColorStop(0, '#0a2540');
    grad.addColorStop(1, '#001122');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Patrón sutil de cuadrícula tecnológica
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }

    // Escudo / Rótulo Central
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSIDAD NACIONAL AUTÓNOMA DE MÉXICO', 640, 300);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
    ctx.fillText('PC PUMA', 640, 390);

    ctx.fillStyle = '#00F0FF';
    ctx.font = '28px system-ui, -apple-system, sans-serif';
    ctx.fillText('Tecnología para transformar el aprendizaje', 640, 460);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
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
   * Conecta un elemento de video HTML5 directamente a la superficie 3D mediante THREE.VideoTexture.
   * Utiliza la ruta de hardware zero-copy de WebGL en Meta Quest para reproducción fluida a 30/60 FPS.
   */
  public attachVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
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
    this.screenMaterial.side = THREE.DoubleSide;
    this.screenMaterial.needsUpdate = true;
  }

  /**
   * Actualización continua por fotograma ejecutada en el bucle WebGL/WebXR.
   * Fuerza el refresco de la textura directamente desde el decodificador multimedia por hardware.
   */
  public update(): void {
    if (this.videoTexture && this.videoElement) {
      if (this.videoElement.readyState >= 2 && !this.videoElement.paused) {
        this.videoTexture.needsUpdate = true;
      }
    }
  }

  /**
   * Activa o desactiva la visualización del overlay de Pausa.
   */
  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.pauseOverlayGroup.visible = paused;
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Actualiza el indicador visual de progreso de reinicio cuando el usuario mantiene presionado el botón [A].
   * @param progress Valor normalizado de 0.0 a 1.0
   * @param secondsRemaining Segundos restantes para completar los 4 segundos
   */
  public setRestartHoldProgress(progress: number, secondsRemaining: number): void {
    if (progress <= 0.001) {
      this.restartHUDGroup.visible = false;
      this.restartProgressBar.scale.x = 0.0001;
      return;
    }

    this.restartHUDGroup.visible = true;
    this.restartProgressBar.scale.x = Math.max(0.0001, Math.min(1.0, progress));

    const ctx = this.restartHUDCtx;
    ctx.clearRect(0, 0, 1024, 128);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `Reiniciando video en ${secondsRemaining.toFixed(1)}s... (Mantén [A] presionado)`,
      512,
      64
    );

    this.restartHUDTexture.needsUpdate = true;
  }

  /**
   * Libera la textura de video y restablece la imagen institucional de standby.
   */
  public detachVideo(): void {
    this.videoElement = null;
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.screenMaterial.map = this.standbyTexture;
    this.screenMaterial.side = THREE.DoubleSide;
    this.screenMaterial.needsUpdate = true;
    this.setPaused(false);
  }

  /**
   * Posiciona la pantalla exactamente frente a la mirada actual del usuario en VR o Desktop,
   * orientándola perpendicularmente para una visualización 100% nítida, cómoda y cinematográfica.
   * Evita cualquier caída o desplazamiento hacia las escaleras de la biblioteca.
   */
  public placeInFrontOf(
    cameraOrApp: THREE.Camera | { activeCamera: THREE.Camera; camera?: THREE.Camera },
    distance: number = 3.5,
    heightOffset: number = 0.15
  ): void {
    this.group.visible = true;
    this.group.scale.set(1, 1, 1);

    // Preferir la cámara con jerarquía en el grafo de escena para incluir transforms del rig
    const camera =
      'camera' in cameraOrApp && cameraOrApp.camera
        ? cameraOrApp.camera
        : 'activeCamera' in cameraOrApp
        ? cameraOrApp.activeCamera
        : cameraOrApp;

    const camWorldPos = new THREE.Vector3();
    const camWorldDir = new THREE.Vector3();

    camera.getWorldPosition(camWorldPos);
    camera.getWorldDirection(camWorldDir);
    camWorldDir.y = 0; // Mantener en el plano horizontal para no inclinar la pantalla

    // Si la posición de la cámara aún no está inicializada o se encuentra en (0, 0, 0),
    // anclar canónicamente en el centro de la plaza peatonal (0, 1.6, 6) mirando al norte (0, 0, -1)
    if (camWorldPos.lengthSq() < 0.1 || camWorldPos.z < 2.0) {
      camWorldPos.set(0, 1.6, 6);
    }
    if (camWorldDir.lengthSq() < 0.01) {
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
    const targetY = this.config.videoScreenHeightAboveGround;
    this.group.position.set(0, targetY, targetZ);
    this.group.lookAt(0, targetY, 6);
    this.group.visible = false;
    this.setPaused(false);
    this.setRestartHoldProgress(0, 0);
    this.detachVideo();
  }

  public dispose(): void {
    this.reset();
    this.standbyTexture.dispose();
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.pauseTexture.dispose();
    this.pauseOverlayMesh.geometry.dispose();
    (this.pauseOverlayMesh.material as THREE.Material).dispose();
    this.restartHUDTexture.dispose();
    this.screenMaterial.dispose();
    this.screenMesh.geometry.dispose();
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.group.clear();
  }
}
