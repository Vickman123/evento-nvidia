import * as THREE from 'three';
import type { XRExhibitOptions } from './types.js';

/**
 * XRExhibit generates an interactive 3D museum pod / showcase pedestal with an
 * automated information display screen, procedural canvas typography, and
 * inspectable 3D exhibit object.
 */
export class XRExhibit {
  public readonly id: string;
  public readonly title: string;
  public readonly category: string;
  public readonly description: string;
  public readonly specs: string[];
  public readonly themeColor: string;

  public readonly nativeGroup: THREE.Group = new THREE.Group();
  public get group(): THREE.Group { return this.nativeGroup; }
  public readonly screenMesh: THREE.Mesh;
  public mountedObject: THREE.Object3D | null = null;
  public onInspectCallback?: (exhibit: XRExhibit) => void;

  private materialsToDispose: THREE.Material[] = [];
  private geometriesToDispose: THREE.BufferGeometry[] = [];
  private screenTexture: THREE.CanvasTexture | null = null;

  constructor(options: XRExhibitOptions) {
    this.id = options.id || `exhibit-${Math.random().toString(36).substring(2, 8)}`;
    this.title = options.title;
    this.category = options.category || 'EXHIBICIÓN 3D';
    this.description = options.description || 'Objeto interactivo tridimensional para inspección y análisis espacial.';
    this.specs = options.specs || ['ESCALA: 1:1', 'FORMATO: GLTF/GLB', 'MODO: WebXR'];
    this.themeColor = typeof options.themeColor === 'number'
      ? `#${options.themeColor.toString(16).padStart(6, '0')}`
      : options.themeColor || '#38bdf8';
    this.onInspectCallback = options.onInspect;

    const pos = options.position || [0, 0, 0];
    this.nativeGroup.position.set(pos[0], pos[1], pos[2]);
    this.nativeGroup.rotation.y = options.rotationY || 0;
    this.nativeGroup.name = `XRExhibit_${this.id}`;

    // 1. Build Physical Pedestal & Angled Console
    this.screenMesh = this.buildPedestal();

    // 2. Mount Pre-existing Model or Placeholder
    if (options.model) {
      this.setMountedObject(options.model, options.modelScale);
    } else if (!options.modelUrl) {
      // Default procedural holographic artifact
      const defaultArtifact = this.createDefaultArtifact();
      this.setMountedObject(defaultArtifact, options.modelScale);
    }
  }

  private buildPedestal(): THREE.Mesh {
    const accentHex = parseInt(this.themeColor.replace('#', ''), 16);

    // Common materials
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.7,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.4,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });
    this.materialsToDispose.push(metalMat, darkMat, accentMat);

    // 1. Base Plate
    const baseGeo = new THREE.BoxGeometry(1.4, 0.12, 1.1);
    this.geometriesToDispose.push(baseGeo);
    const baseMesh = new THREE.Mesh(baseGeo, metalMat);
    baseMesh.position.y = 0.06;
    baseMesh.receiveShadow = true;
    this.nativeGroup.add(baseMesh);

    // 2. Stand Pillar
    const pillarGeo = new THREE.BoxGeometry(0.32, 0.9, 0.24);
    this.geometriesToDispose.push(pillarGeo);
    const pillarMesh = new THREE.Mesh(pillarGeo, darkMat);
    pillarMesh.position.set(0, 0.57, 0);
    pillarMesh.castShadow = true;
    this.nativeGroup.add(pillarMesh);

    // Emissive accent line on pillar
    const lineGeo = new THREE.BoxGeometry(0.04, 0.8, 0.25);
    this.geometriesToDispose.push(lineGeo);
    const lineMesh = new THREE.Mesh(lineGeo, accentMat);
    lineMesh.position.set(0, 0.57, 0);
    this.nativeGroup.add(lineMesh);

    // 3. Angled Console Housing (tilted backward by 22 degrees for ergonomic viewing)
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 1.12, 0.08);
    consoleGroup.rotation.x = -Math.PI / 8;

    const frameGeo = new THREE.BoxGeometry(1.6, 1.05, 0.06);
    this.geometriesToDispose.push(frameGeo);
    const frameMesh = new THREE.Mesh(frameGeo, metalMat);
    frameMesh.castShadow = true;
    consoleGroup.add(frameMesh);

    // 4. Generate High-Res Screen Texture via HTML5 Canvas
    this.screenTexture = this.createScreenTexture();
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      toneMapped: false,
    });
    this.materialsToDispose.push(screenMat);

    const screenGeo = new THREE.PlaneGeometry(1.5, 0.96);
    this.geometriesToDispose.push(screenGeo);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = 0.035;
    screenMesh.name = `${this.id}_screen`;

    // Interaction metadata for unified raycasting
    screenMesh.userData = {
      interactive: true,
      exhibit: this,
      prompt: `Inspeccionar ${this.title}`,
    };

    consoleGroup.add(screenMesh);
    this.nativeGroup.add(consoleGroup);

    return screenMesh;
  }

  /**
   * Generates dynamic information screen texture on an HTML Canvas.
   */
  private createScreenTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;

    // 1. Dark Futuristic Background with subtle grid
    ctx.fillStyle = '#060b14';
    ctx.fillRect(0, 0, 1024, 640);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 640);
      ctx.stroke();
    }
    for (let y = 0; y < 640; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // 2. Accent Top Border & Corner Tech Markings
    ctx.fillStyle = this.themeColor;
    ctx.fillRect(36, 36, 8, 568); // Left vertical bar

    // Category Badge
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.strokeStyle = this.themeColor;
    ctx.lineWidth = 2;
    ctx.fillRect(64, 48, 280, 42);
    ctx.strokeRect(64, 48, 280, 42);

    ctx.fillStyle = this.themeColor;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(this.category.toUpperCase(), 84, 75);

    // 3. Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(this.title, 64, 140);

    // 4. Description (with word wrapping)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const words = this.description.split(' ');
    let line = '';
    let y = 185;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 880 && i > 0) {
        ctx.fillText(line, 64, y);
        line = words[i] + ' ';
        y += 32;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 64, y);

    // 5. Specs & Highlights
    y += 48;
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('ESPECIFICACIONES TÉCNICAS:', 64, y);

    y += 30;
    ctx.font = '20px monospace';
    this.specs.slice(0, 4).forEach((spec) => {
      ctx.fillStyle = this.themeColor;
      ctx.beginPath();
      ctx.arc(74, y - 7, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(spec, 94, y);
      y += 32;
    });

    // 6. Bottom Prompt Bar
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(64, 545, 896, 50);
    ctx.strokeStyle = this.themeColor;
    ctx.strokeRect(64, 545, 896, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px monospace';
    ctx.fillText('▶ HAZ CLIC O APUNTA CON EL LÁSER PARA INSPECCIONAR', 160, 577);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  /**
   * Default geometric artifact placeholder if no external model was provided.
   */
  private createDefaultArtifact(): THREE.Group {
    const group = new THREE.Group();
    const accentHex = parseInt(this.themeColor.replace('#', ''), 16);

    const ringGeo = new THREE.TorusGeometry(0.38, 0.02, 16, 32);
    this.geometriesToDispose.push(ringGeo);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.6,
    });
    this.materialsToDispose.push(ringMat);

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const crystalGeo = new THREE.OctahedronGeometry(0.24, 0);
    this.geometriesToDispose.push(crystalGeo);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.9,
      emissive: accentHex,
      emissiveIntensity: 0.3,
    });
    this.materialsToDispose.push(crystalMat);

    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    group.add(crystal);

    return group;
  }

  /**
   * Sets or updates the 3D model mounted on top of the pod.
   */
  public setMountedObject(obj: THREE.Object3D, scale: number = 1.0): void {
    if (this.mountedObject) {
      this.nativeGroup.remove(this.mountedObject);
    }
    this.mountedObject = obj;
    this.mountedObject.position.set(0, 1.9, 0);
    this.mountedObject.scale.set(scale, scale, scale);
    this.nativeGroup.add(this.mountedObject);
  }

  /**
   * Per-frame animation update for the mounted object.
   */
  public update(delta: number): void {
    if (this.mountedObject) {
      this.mountedObject.rotation.y += delta * 0.75;
    }
  }

  /**
   * Triggers the inspection action.
   */
  public inspect(): void {
    if (this.onInspectCallback) {
      this.onInspectCallback(this);
    }
  }

  /**
   * Cleans up textures and geometries from memory.
   */
  public dispose(): void {
    if (this.screenTexture) {
      this.screenTexture.dispose();
      this.screenTexture = null;
    }
    for (const g of this.geometriesToDispose) g.dispose();
    for (const m of this.materialsToDispose) m.dispose();
    this.geometriesToDispose = [];
    this.materialsToDispose = [];
    this.nativeGroup.clear();
  }
}
