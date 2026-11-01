import * as THREE from 'three';

/**
 * Options for configuring XRScene.
 */
export interface XRSceneOptions {
  /** Enable default ambient and directional lighting. Defaults to true. */
  defaultLighting?: boolean;
  /** Enable shadows on default directional light. Defaults to true. */
  enableShadows?: boolean;
  /** Add a ground reference grid. Defaults to true. */
  enableGrid?: boolean;
  /** Background color for the scene. Defaults to dark slate #0b0f19. */
  backgroundColor?: THREE.ColorRepresentation;
}

export type EnvironmentPreset = 'studio' | 'daylight' | 'dark';

/**
 * XRScene wraps and extends THREE.Scene with balanced lighting,
 * environment presets, ground referencing, and cleanup routines.
 */
export class XRScene {
  /** The underlying native Three.js Scene instance */
  public readonly nativeScene: THREE.Scene;

  public ambientLight: THREE.AmbientLight | null = null;
  public directionalLight: THREE.DirectionalLight | null = null;
  public hemiLight: THREE.HemisphereLight | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private groundPlane: THREE.Mesh | null = null;

  constructor(options: XRSceneOptions = {}) {
    this.nativeScene = new THREE.Scene();

    const bgColor = options.backgroundColor ?? 0x0b0f19;
    this.nativeScene.background = new THREE.Color(bgColor);

    if (options.defaultLighting !== false) {
      this.setupDefaultLighting(options.enableShadows !== false);
    }

    if (options.enableGrid !== false) {
      this.setupGroundReference();
    }
  }

  /**
   * Configures balanced default lighting suitable for architectural and product inspection.
   * @param enableShadows Whether to enable shadow casting on the main light.
   */
  private setupDefaultLighting(enableShadows: boolean): void {
    // 1. Soft neutral ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.ambientLight.name = 'VXR_AmbientLight';
    this.nativeScene.add(this.ambientLight);

    // 2. Primary directional key light
    this.directionalLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    this.directionalLight.name = 'VXR_DirectionalKeyLight';
    this.directionalLight.position.set(6, 12, 8);

    if (enableShadows) {
      this.directionalLight.castShadow = true;
      this.directionalLight.shadow.mapSize.width = 1024;
      this.directionalLight.shadow.mapSize.height = 1024;
      this.directionalLight.shadow.camera.near = 0.5;
      this.directionalLight.shadow.camera.far = 40;
      this.directionalLight.shadow.camera.left = -10;
      this.directionalLight.shadow.camera.right = 10;
      this.directionalLight.shadow.camera.top = 10;
      this.directionalLight.shadow.camera.bottom = -10;
      this.directionalLight.shadow.bias = -0.0004;
      this.directionalLight.shadow.normalBias = 0.02;
    }

    this.nativeScene.add(this.directionalLight);

    // 3. Secondary hemisphere bounce light (fill from ground)
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.4);
    this.hemiLight.name = 'VXR_HemisphereFillLight';
    this.nativeScene.add(this.hemiLight);
  }

  /**
   * Adds a subtle ground plane and visual reference grid at Y = 0.
   */
  private setupGroundReference(): void {
    // Shadow receiving transparent ground plane
    const planeGeo = new THREE.PlaneGeometry(30, 30);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    this.groundPlane = new THREE.Mesh(planeGeo, planeMat);
    this.groundPlane.name = 'VXR_GroundShadowPlane';
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.001;
    this.groundPlane.receiveShadow = true;
    this.nativeScene.add(this.groundPlane);

    // Reference grid
    this.gridHelper = new THREE.GridHelper(20, 20, 0x38bdf8, 0x1e293b);
    this.gridHelper.name = 'VXR_GridHelper';
    this.gridHelper.position.y = 0;
    this.nativeScene.add(this.gridHelper);
  }

  /**
   * Applies pre-calibrated lighting and background environment presets.
   */
  public setEnvironmentPreset(preset: EnvironmentPreset): void {
    if (preset === 'daylight') {
      this.setBackground(0xe2e8f0);
      if (this.ambientLight) {
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.95;
      }
      if (this.directionalLight) {
        this.directionalLight.color.setHex(0xfffaed);
        this.directionalLight.intensity = 1.4;
      }
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x93c5fd);
        this.hemiLight.groundColor.setHex(0x64748b);
        this.hemiLight.intensity = 0.5;
      }
    } else if (preset === 'dark') {
      this.setBackground(0x020617);
      if (this.ambientLight) {
        this.ambientLight.color.setHex(0x94a3b8);
        this.ambientLight.intensity = 0.35;
      }
      if (this.directionalLight) {
        this.directionalLight.color.setHex(0x38bdf8);
        this.directionalLight.intensity = 1.0;
      }
      if (this.hemiLight) {
        this.hemiLight.intensity = 0.2;
      }
    } else {
      // Default: Studio
      this.setBackground(0x0b0f19);
      if (this.ambientLight) {
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.7;
      }
      if (this.directionalLight) {
        this.directionalLight.color.setHex(0xfffaed);
        this.directionalLight.intensity = 1.2;
      }
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xffffff);
        this.hemiLight.groundColor.setHex(0x334155);
        this.hemiLight.intensity = 0.4;
      }
    }
  }

  /**
   * Appends one or more 3D objects to the scene graph.
   */
  public add(...objects: THREE.Object3D[]): this {
    this.nativeScene.add(...objects);
    return this;
  }

  /**
   * Removes one or more 3D objects from the scene graph.
   */
  public remove(...objects: THREE.Object3D[]): this {
    this.nativeScene.remove(...objects);
    return this;
  }

  /**
   * Updates the background of the scene (color or environment texture).
   */
  public setBackground(background: THREE.Color | THREE.Texture | string | number): void {
    if (typeof background === 'string' || typeof background === 'number') {
      this.nativeScene.background = new THREE.Color(background);
    } else {
      this.nativeScene.background = background;
    }
  }

  /**
   * Configures exponential or linear distance fog.
   */
  public setFog(color: THREE.ColorRepresentation, near: number = 10, far: number = 80): void {
    this.nativeScene.fog = new THREE.Fog(color, near, far);
  }

  /**
   * Toggles the visibility of the ground reference grid.
   */
  public setGridVisible(visible: boolean): void {
    if (this.gridHelper) this.gridHelper.visible = visible;
  }

  /**
   * Cleans up scene geometries and materials created by VXR defaults.
   */
  public dispose(): void {
    if (this.groundPlane) {
      this.groundPlane.geometry.dispose();
      (this.groundPlane.material as THREE.Material).dispose();
      this.nativeScene.remove(this.groundPlane);
    }
    if (this.gridHelper) {
      this.gridHelper.geometry.dispose();
      (this.gridHelper.material as THREE.Material).dispose();
      this.nativeScene.remove(this.gridHelper);
    }
    this.nativeScene.clear();
  }
}
