import * as THREE from 'three';
import type { XRDisplayScreenOptions, XRMediaItem, XRCanvasHotspot } from './types.js';

/**
 * XRDisplayScreen provides dynamic, interactive 3D billboards and widescreen cinema panels
 * capable of rendering dynamic canvas UIs, high-resolution photo galleries, and video streams.
 * Includes automatic aspect-ratio fitting, UV raycast hotspots, next/prev navigation,
 * and seamless WebXR controller integration.
 */
export class XRDisplayScreen {
  public readonly group: THREE.Group;
  public readonly screenMesh: THREE.Mesh;
  public readonly frameMesh: THREE.Mesh;
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly texture: THREE.CanvasTexture;

  private options: Required<Omit<XRDisplayScreenOptions, 'onDraw' | 'items'>> & {
    onDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number, activeItem?: XRMediaItem) => void;
  };
  private items: XRMediaItem[] = [];
  private currentIndex: number = 0;
  private autoTimer: number | null = null;
  private hotspots: XRCanvasHotspot[] = [];
  private loadedImages: Map<string, HTMLImageElement> = new Map();
  private activeVideoElement: HTMLVideoElement | null = null;
  private videoTexture: THREE.VideoTexture | null = null;
  private isVideoMode: boolean = false;

  constructor(options: XRDisplayScreenOptions = {}) {
    this.options = {
      width: options.width ?? 4.0,
      height: options.height ?? 2.25,
      resolutionWidth: options.resolutionWidth ?? 1920,
      resolutionHeight: options.resolutionHeight ?? 1080,
      frameColor: options.frameColor ?? 0x08111d,
      accentColor: options.accentColor ?? 0x00f0ff,
      hasBase: options.hasBase ?? true,
      theme: options.theme ?? 'cyber-dark',
      autoCycle: options.autoCycle ?? false,
      cycleInterval: options.cycleInterval ?? 7.0,
      curved: options.curved ?? false,
      curveRadius: options.curveRadius ?? 5.0,
      videoLoop: options.videoLoop ?? true,
      videoMuted: options.videoMuted ?? true,
      onDraw: options.onDraw,
    };

    if (options.items && options.items.length > 0) {
      this.items = [...options.items];
    }

    this.group = new THREE.Group();
    this.group.name = 'VXR_DisplayScreen';

    // 1. Create HTML Canvas & Texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.options.resolutionWidth;
    this.canvas.height = this.options.resolutionHeight;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('[XRDisplayScreen] Could not initialize 2D canvas context.');
    }
    this.ctx = ctx;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    // 2. Build Physical Screen Geometry
    const screenGeo = this.options.curved
      ? new THREE.CylinderGeometry(
          this.options.curveRadius,
          this.options.curveRadius,
          this.options.height,
          64,
          1,
          true,
          -this.options.width / (2 * this.options.curveRadius),
          this.options.width / this.options.curveRadius
        )
      : new THREE.PlaneGeometry(this.options.width, this.options.height);

    const screenMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.98,
      side: THREE.FrontSide,
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.z = 0.05;
    this.group.add(this.screenMesh);

    // 3. Build Architectural Beveled Frame
    const frameDepth = 0.12;
    const frameGeo = new THREE.BoxGeometry(
      this.options.width + 0.22,
      this.options.height + 0.22,
      frameDepth
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.options.frameColor),
      roughness: 0.32,
      metalness: 0.82,
    });
    this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.group.add(this.frameMesh);

    // Luminous Bevel Edges
    const edgesGeo = new THREE.EdgesGeometry(frameGeo);
    const edgesMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.options.accentColor),
      linewidth: 2,
    });
    const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
    this.group.add(edgesMesh);

    // 4. Optional Architectural Floor Pedestal Base
    if (this.options.hasBase) {
      const baseGeo = new THREE.BoxGeometry(
        this.options.width + 0.3,
        0.28,
        0.75
      );
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x091424,
        roughness: 0.4,
        metalness: 0.7,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.set(0, -this.options.height / 2 - 0.2, 0.15);
      this.group.add(baseMesh);

      // Neon Accent Stripe on base
      const stripeGeo = new THREE.BoxGeometry(this.options.width + 0.32, 0.03, 0.04);
      const stripeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.options.accentColor),
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0, -this.options.height / 2 - 0.08, 0.53);
      this.group.add(stripe);
    }

    // Configure standard UserData for Raycaster detection
    this.screenMesh.userData = {
      isVXRScreen: true,
      instance: this,
    };

    // Register Default Nav Hotspots
    this.setupDefaultHotspots();

    // Initial Render
    this.render();

    if (this.options.autoCycle) {
      this.startAutoCycle();
    }
  }

  /**
   * Sets the media items playlist and redraws the display.
   */
  public setItems(items: XRMediaItem[]): void {
    this.items = [...items];
    this.currentIndex = 0;
    this.render();
  }

  /**
   * Navigates to a specific media index or cycles forward/backward.
   */
  public setIndex(index: number): void {
    if (this.items.length === 0) return;
    this.currentIndex = (index + this.items.length) % this.items.length;
    this.render();
  }

  public next(): void {
    this.setIndex(this.currentIndex + 1);
  }

  public prev(): void {
    this.setIndex(this.currentIndex - 1);
  }

  /**
   * Loads and plays a video directly onto this 3D screen.
   */
  public setVideo(url: string, autoplay: boolean = true): HTMLVideoElement {
    this.cleanActiveVideo();

    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.loop = this.options.videoLoop;
    video.muted = this.options.videoMuted;
    video.playsInline = true;

    this.activeVideoElement = video;
    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;

    // Apply video texture directly to screen mesh material
    const screenMat = this.screenMesh.material as THREE.MeshBasicMaterial;
    screenMat.map = this.videoTexture;
    screenMat.needsUpdate = true;
    this.isVideoMode = true;

    if (autoplay) {
      video.play().catch(e => {
        console.warn('[XRDisplayScreen] Video autoplay prevented:', e);
      });
    }

    return video;
  }

  /**
   * Pauses active video playback or resumes it.
   */
  public toggleVideoPlay(): boolean {
    if (!this.activeVideoElement) return false;
    if (this.activeVideoElement.paused) {
      this.activeVideoElement.play();
      return true;
    } else {
      this.activeVideoElement.pause();
      return false;
    }
  }

  /**
   * Registers an interactive hotspot region (UV 0..1 coordinates).
   */
  public registerHotspot(hotspot: XRCanvasHotspot): void {
    this.hotspots.push(hotspot);
  }

  /**
   * Handles a raycast UV hit from desktop mouse or Meta Quest controller.
   * @param uv UV coordinate vector (from 0 to 1)
   */
  public handleUVClick(uv: THREE.Vector2): boolean {
    if (!uv) return false;

    for (const hotspot of this.hotspots) {
      const [uMin, vMin, uMax, vMax] = hotspot.bounds;
      if (uv.x >= uMin && uv.x <= uMax && uv.y >= vMin && uv.y <= vMax) {
        if (hotspot.onClick) {
          hotspot.onClick(hotspot);
          return true;
        }
      }
    }

    // Default: Click left 25% goes prev, right 25% goes next
    if (uv.x < 0.22) {
      this.prev();
      return true;
    } else if (uv.x > 0.78) {
      this.next();
      return true;
    }

    return false;
  }

  /**
   * Starts automatic slide cycling.
   */
  public startAutoCycle(): void {
    this.stopAutoCycle();
    this.autoTimer = window.setInterval(() => {
      this.next();
    }, this.options.cycleInterval * 1000);
  }

  /**
   * Stops automatic slide cycling.
   */
  public stopAutoCycle(): void {
    if (this.autoTimer !== null) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  /**
   * Redraws the 2D canvas texture.
   */
  public render(): void {
    if (this.isVideoMode) {
      // Revert to canvas texture if switching from video mode
      const screenMat = this.screenMesh.material as THREE.MeshBasicMaterial;
      screenMat.map = this.texture;
      screenMat.needsUpdate = true;
      this.isVideoMode = false;
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const current = this.items[this.currentIndex];
    const total = this.items.length;

    // 1. Draw Background Theme
    ctx.clearRect(0, 0, w, h);
    if (this.options.theme === 'cyber-dark') {
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#030a16');
      bgGrad.addColorStop(0.5, '#07152b');
      bgGrad.addColorStop(1, '#020712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (this.options.theme === 'neon-slate') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
    }

    // Top Header Bar
    ctx.fillStyle = typeof this.options.accentColor === 'string' ? this.options.accentColor : '#00f0ff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('// VXR DISPLAY // INTERACTIVE SCREEN', 60, 75);

    if (total > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`ITEM ${this.currentIndex + 1} DE ${total}`, w - 60, 75);
    }

    // Separator line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 95);
    ctx.lineTo(w - 60, 95);
    ctx.stroke();

    // 2. Viewport Area (Fitting images, graphics)
    const vpX = 60;
    const vpY = 115;
    const vpW = w - 120;
    const vpH = h - 210;

    // Draw Active Item if present
    if (current && current.src) {
      this.drawImageFit(current.src, vpX, vpY, vpW, vpH, current);
    } else {
      // Placeholder / Icon view
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fillRect(vpX, vpY, vpW, vpH);

      if (current?.icon) {
        ctx.font = '160px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(current.icon, vpX + vpW / 2, vpY + vpH / 2 + 50);
      }
    }

    // 3. Navigation Controls Bar
    if (total > 1) {
      // Left arrow
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fillRect(vpX + 16, vpY + (vpH - 110) / 2, 90, 110);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('◀', vpX + 61, vpY + (vpH - 110) / 2 + 75);

      // Right arrow
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fillRect(vpX + vpW - 106, vpY + (vpH - 110) / 2, 90, 110);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('▶', vpX + vpW - 61, vpY + (vpH - 110) / 2 + 75);

      // Bottom pagination dots
      const dotSpacing = 38;
      const dotsStartX = (w - (total - 1) * dotSpacing) / 2;
      for (let i = 0; i < total; i++) {
        const dotX = dotsStartX + i * dotSpacing;
        const isCur = i === this.currentIndex;
        ctx.beginPath();
        ctx.arc(dotX, h - 50, isCur ? 12 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isCur ? '#00f0ff' : 'rgba(255, 255, 255, 0.35)';
        ctx.fill();
      }
    }

    // 4. Custom onDraw hook if provided
    if (this.options.onDraw) {
      this.options.onDraw(ctx, w, h, current);
    }

    this.texture.needsUpdate = true;
  }

  private drawImageFit(
    src: string,
    x: number,
    y: number,
    w: number,
    h: number,
    item: XRMediaItem
  ): void {
    let img = this.loadedImages.get(src);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      img.onload = () => {
        this.loadedImages.set(src, img!);
        this.render();
      };
      this.loadedImages.set(src, img);
      return;
    }

    if (!img.complete || img.naturalWidth === 0) return;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = w / h;
    let dw: number, dh: number, dx: number, dy: number;

    if (imgAspect > boxAspect) {
      dw = w - 20;
      dh = dw / imgAspect;
      dx = x + 10;
      dy = y + (h - dh) / 2;
    } else {
      dh = h - 20;
      dw = dh * imgAspect;
      dx = x + (w - dw) / 2;
      dy = y + 10;
    }

    this.ctx.save();
    this.ctx.shadowColor =
      typeof item.accentColor === 'string'
        ? item.accentColor
        : '#00f0ff';
    this.ctx.shadowBlur = 15;
    this.ctx.drawImage(img, dx, dy, dw, dh);
    this.ctx.restore();
  }

  private setupDefaultHotspots(): void {
    // Left navigation area (UV x between 0 and 0.2)
    this.registerHotspot({
      id: 'btn-prev',
      bounds: [0, 0, 0.2, 1],
      label: 'Previous Slide',
      onClick: () => this.prev(),
    });

    // Right navigation area (UV x between 0.8 and 1.0)
    this.registerHotspot({
      id: 'btn-next',
      bounds: [0.8, 0, 1.0, 1],
      label: 'Next Slide',
      onClick: () => this.next(),
    });
  }

  private cleanActiveVideo(): void {
    if (this.activeVideoElement) {
      this.activeVideoElement.pause();
      this.activeVideoElement.src = '';
      this.activeVideoElement.load();
      this.activeVideoElement = null;
    }
    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
  }

  /**
   * Disposes all Three.js resources and video/texture allocations.
   */
  public dispose(): void {
    this.stopAutoCycle();
    this.cleanActiveVideo();
    this.texture.dispose();
    (this.screenMesh.material as THREE.Material).dispose();
    this.screenMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.frameMesh.geometry.dispose();
    this.loadedImages.clear();
  }
}
