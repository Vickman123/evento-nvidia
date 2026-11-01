import * as THREE from 'three';
import type { UpdatableCallback, XRAppOptions } from './types.js';

/**
 * XRRenderer encapsulates the WebGLRenderer, PerspectiveCamera,
 * automatic window resize handling, and WebXR-compatible animation loop.
 */
export class XRRenderer {
  /** The native Three.js WebGLRenderer */
  public readonly nativeRenderer: THREE.WebGLRenderer;

  /** The primary PerspectiveCamera */
  public readonly camera: THREE.PerspectiveCamera;

  /** The container DOM element hosting the canvas */
  public readonly container: HTMLElement;

  /** High-precision clock for frame delta calculation */
  private clock: THREE.Clock;

  /** Set of update callbacks executed on every frame */
  private updatables: Set<UpdatableCallback> = new Set();

  /** Bound resize handler for clean listener removal */
  private boundOnResize: () => void;

  /** Active animation loop status */
  private isRunning: boolean = false;

  constructor(options: XRAppOptions = {}) {
    // 1. Resolve container element
    if (typeof options.container === 'string') {
      const el = document.querySelector<HTMLElement>(options.container);
      if (!el) {
        throw new Error(`[VXR] Container selector "${options.container}" not found in DOM.`);
      }
      this.container = el;
    } else if (options.container instanceof HTMLElement) {
      this.container = options.container;
    } else {
      this.container = document.body;
    }

    // 2. Camera setup
    const aspect = this.container.clientWidth / (this.container.clientHeight || window.innerHeight);
    const fov = options.fov ?? 60;
    const near = options.near ?? 0.1;
    const far = options.far ?? 200;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    const camPos = options.cameraPosition ?? [0, 1.6, 3.5];
    this.camera.position.set(camPos[0], camPos[1], camPos[2]);
    this.camera.lookAt(0, 1.0, 0);

    // 3. WebGLRenderer setup
    this.nativeRenderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: options.antialias !== false,
      alpha: true,
      powerPreference: 'high-performance',
    });

    const pixelRatioCap = options.pixelRatioCap ?? 1.5;
    this.nativeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    this.updateSize();

    // Color & lighting calibration
    this.nativeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.nativeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.nativeRenderer.toneMappingExposure = 1.1;

    // Shadow configuration
    if (options.enableShadows !== false) {
      this.nativeRenderer.shadowMap.enabled = true;
      this.nativeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Mandatory WebXR flag
    this.nativeRenderer.xr.enabled = true;

    // Mount canvas if not already in DOM
    if (!this.nativeRenderer.domElement.parentElement) {
      this.container.appendChild(this.nativeRenderer.domElement);
    }

    // 4. Clock and resize listeners
    this.clock = new THREE.Clock();
    this.boundOnResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundOnResize);
  }

  /**
   * Returns the underlying canvas DOM element.
   */
  public get domElement(): HTMLCanvasElement {
    return this.nativeRenderer.domElement;
  }

  /**
   * Recalculates canvas size and camera aspect ratio from the container dimensions.
   */
  private updateSize(): void {
    const width = this.container === document.body ? window.innerWidth : this.container.clientWidth;
    const height = this.container === document.body ? window.innerHeight : this.container.clientHeight;
    this.nativeRenderer.setSize(width, height, false);
    this.camera.aspect = width / (height || 1);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Window resize handler.
   */
  public handleResize(): void {
    this.updateSize();
  }

  /**
   * Adds an update callback executed on every frame before rendering.
   * @returns Unsubscribe function to remove the callback.
   */
  public addUpdatable(callback: UpdatableCallback): () => void {
    this.updatables.add(callback);
    return () => this.updatables.delete(callback);
  }

  /**
   * Starts the WebXR-compatible animation loop.
   * @param renderHook Callback responsible for rendering the active scene.
   */
  public start(renderHook: (delta: number, elapsed: number) => void): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    this.nativeRenderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      // Execute registered updatables
      for (const updateFn of this.updatables) {
        try {
          updateFn(delta, elapsed);
        } catch (err) {
          console.error('[VXR] Error inside updatable callback:', err);
        }
      }

      // Execute render hook
      renderHook(delta, elapsed);
    });
  }

  /**
   * Stops the animation loop.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.nativeRenderer.setAnimationLoop(null);
    this.clock.stop();
  }

  /**
   * Renders the given scene from the primary camera.
   */
  public render(scene: THREE.Scene): void {
    this.nativeRenderer.render(scene, this.camera);
  }

  /**
   * Cleans up listeners, stops the animation loop, and disposes the WebGL context.
   */
  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.boundOnResize);
    this.updatables.clear();
    this.nativeRenderer.dispose();
    if (this.nativeRenderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.nativeRenderer.domElement);
    }
  }
}
