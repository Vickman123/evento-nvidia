import * as THREE from 'three';

export interface XRPortalOptions {
  /** Target experience destination URL */
  url: string;
  /** Experience title to display */
  title: string;
  /** Category or mode tag (e.g. 'Simulation', 'Arcade FPS') */
  category?: string;
  /** Platform compatibility badge (e.g. 'QUEST 3S / PC') */
  badge?: string;
  /** Primary accent color (Hex string or numeric) */
  color?: string | number;
  /** Emissive Three.js color */
  emissiveColor?: number;
  /** Icon/Emoji representation */
  icon?: string;
  /** Physical position in world coordinates [x, y, z] */
  position?: [number, number, number];
  /** Rotation around Y axis in radians */
  rotationY?: number;
  /** Micro-artifact 3D floating shape: 'crystal' | 'laptop' | 'cube' | 'torus' */
  artifactType?: 'crystal' | 'laptop' | 'cube' | 'torus';
  /** Whether the portal is locked or in development */
  isUpcoming?: boolean;
}

/**
 * XRPortal represents a standalone sci-fi teleportation monolith with emissive bevels,
 * custom glass textures, floating procedural 3D artifacts, and a safe WebXR exit-to-navigate protocol.
 */
export class XRPortal {
  public readonly group: THREE.Group;
  public readonly options: XRPortalOptions;
  public readonly artifact: THREE.Group;
  public readonly screenMesh: THREE.Mesh;
  public readonly frameMesh: THREE.Mesh;

  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;

  constructor(options: XRPortalOptions) {
    this.options = {
      position: [0, 1.6, -5],
      rotationY: 0,
      color: 0x00f0ff,
      emissiveColor: 0x00f0ff,
      icon: '🌐',
      artifactType: 'crystal',
      isUpcoming: false,
      ...options,
    };

    this.group = new THREE.Group();
    this.group.name = `VXR_Portal_${this.options.title}`;
    const [x, y, z] = this.options.position!;
    this.group.position.set(x, y, z);
    this.group.rotation.y = this.options.rotationY ?? 0;

    const accentColor = new THREE.Color(this.options.color);

    // 1. Monolith Frame
    const frameGeo = new THREE.BoxGeometry(1.56, 2.15, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x08101d,
      roughness: 0.28,
      metalness: 0.8,
    });
    this.frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.group.add(this.frameMesh);

    // Luminous Bevel Edges
    const frameEdges = new THREE.EdgesGeometry(frameGeo);
    const frameLineMat = new THREE.LineBasicMaterial({
      color: accentColor,
      linewidth: 3,
    });
    const frameLines = new THREE.LineSegments(frameEdges, frameLineMat);
    this.group.add(frameLines);

    // 2. High-contrast Screen Texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 700;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.drawPortalTexture();

    const planeGeo = new THREE.PlaneGeometry(1.48, 2.06);
    const planeMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.98,
      side: THREE.FrontSide,
    });
    this.screenMesh = new THREE.Mesh(planeGeo, planeMat);
    this.screenMesh.position.z = 0.045;
    this.group.add(this.screenMesh);

    // 3. Architectural Pedestal Base
    const pedestalGeo = new THREE.BoxGeometry(0.9, 0.35, 0.65);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0a1424,
      roughness: 0.35,
      metalness: 0.75,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -1.18, 0);
    this.group.add(pedestal);

    // Neon Line on Pedestal
    const ledStripeGeo = new THREE.BoxGeometry(0.92, 0.03, 0.04);
    const ledStripeMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const ledStripe = new THREE.Mesh(ledStripeGeo, ledStripeMat);
    ledStripe.position.set(0, -1.02, 0.33);
    this.group.add(ledStripe);

    // 4. Floating 3D Holographic Artifact
    this.artifact = this.createArtifact(this.options.artifactType || 'crystal', accentColor);
    this.artifact.position.set(0, 1.45, 0.05);
    this.group.add(this.artifact);

    // UserData for Interaction and Raycasting
    this.screenMesh.userData = {
      isVXRPortal: true,
      portalInstance: this,
      url: this.options.url,
      title: this.options.title,
    };
  }

  private drawPortalTexture(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 700);
    grad.addColorStop(0, '#040d1a');
    grad.addColorStop(1, '#02070f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 700);

    // Bevel frame
    const hex = typeof this.options.color === 'string' ? this.options.color : '#00f0ff';
    ctx.strokeStyle = hex;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 680);

    // Badge
    ctx.fillStyle = hex;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.options.badge || 'WEBXR 6DOF', 256, 65);

    // Central Icon
    ctx.font = '100px sans-serif';
    ctx.fillText(this.options.icon || '🌐', 256, 260);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(this.options.title, 256, 380);

    // Category
    if (this.options.category) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px monospace';
      ctx.fillText(this.options.category, 256, 420);
    }

    // Enter prompt CTA button
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.fillRect(50, 560, 412, 70);
    ctx.strokeStyle = hex;
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 560, 412, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('ACCEDER AL PORTAL ➔', 256, 605);

    this.texture.needsUpdate = true;
  }

  private createArtifact(type: string, color: THREE.Color): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });

    if (type === 'crystal') {
      const geo = new THREE.OctahedronGeometry(0.22, 0);
      group.add(new THREE.Mesh(geo, mat));
    } else if (type === 'cube') {
      const geo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
      group.add(new THREE.Mesh(geo, mat));
    } else {
      const geo = new THREE.TorusGeometry(0.2, 0.04, 16, 32);
      group.add(new THREE.Mesh(geo, mat));
    }

    return group;
  }

  /**
   * Updates animations per frame (floating artifacts rotation).
   */
  public update(delta: number, elapsed: number): void {
    if (this.artifact) {
      this.artifact.rotation.y += delta * 0.9;
      this.artifact.position.y = 1.45 + Math.sin(elapsed * 1.5) * 0.04;
    }
  }

  /**
   * Safely redirects the browser to the portal's target URL,
   * properly terminating active WebXR sessions first to avoid headset hang-ups.
   */
  public navigate(renderer?: THREE.WebGLRenderer): void {
    if (renderer && renderer.xr && renderer.xr.isPresenting) {
      const session = renderer.xr.getSession();
      if (session) {
        session.end().finally(() => {
          window.location.href = this.options.url;
        });
        return;
      }
    }
    window.location.href = this.options.url;
  }

  public dispose(): void {
    this.texture.dispose();
    (this.screenMesh.material as THREE.Material).dispose();
    this.screenMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.frameMesh.geometry.dispose();
  }
}
