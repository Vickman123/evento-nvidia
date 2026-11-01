import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { XRScene } from './XRScene.js';
import { XRRenderer } from './XRRenderer.js';
import { XRSession, ControllerSelectCallback } from './XRSession.js';
import { XRAssetManager } from './XRAssetManager.js';
import { XRRoom } from './scenario/XRRoom.js';
import { XRScenario } from './scenario/XRScenario.js';
import type {
  XRRoomOptions,
  WallDirection,
  CorridorOptions,
  ScenarioJSON,
} from './scenario/types.js';
import type {
  LoadedModel,
  LoadModelOptions,
  UpdatableCallback,
  XRAppOptions,
} from './types.js';
import { XRAudio } from './audio/XRAudio.js';
import { XRExhibit } from './exhibit/XRExhibit.js';
import type { XRExhibitOptions } from './exhibit/types.js';
import { XRTutorial } from './tutorial/XRTutorial.js';
import type { XRTutorialOptions } from './tutorial/types.js';
import { enableLocalFileDrop, type LocalDropOptions } from './utils/localDrop.js';
import { XRRuntime } from './runtime/XRRuntime.js';
import { DesktopRuntime } from './runtime/DesktopRuntime.js';
import { WebXRRuntime } from './runtime/WebXRRuntime.js';
import { XRInput } from './input/XRInput.js';

/**
 * XRApp is the high-level entry point for VXR applications.
 *
 * It orchestrates scene setup, WebGL rendering, WebXR session negotiation,
 * desktop navigation controls, 3D asset loading, and unified pointer/controller raycasting.
 *
 * @example
 * ```typescript
 * const app = new XRApp();
 * await app.loadModel("./model.glb");
 * app.start();
 * ```
 */
export class XRApp {
  /** The encapsulated scene manager */
  public readonly scene: XRScene;

  /** The encapsulated WebGL and WebXR renderer */
  public readonly renderer: XRRenderer;

  /** The WebXR session and VR button manager */
  public readonly session: XRSession;

  /** The 3D model asset loader and memory manager */
  public readonly assets: XRAssetManager;

  /** Desktop orbit controls active when not in WebXR */
  public readonly controls: OrbitControls | null = null;

  /** Cross-platform input & semantic action manager (PC, WebXR, Mobile) */
  public readonly input: XRInput;

  /** Active runtime strategy (DesktopRuntime or WebXRRuntime) */
  public readonly runtime: XRRuntime;

  /** Initial camera position for reset */
  private initialCameraPosition: [number, number, number];

  /** Initial look-at target for reset */
  private initialCameraTarget: [number, number, number] = [0, 0.8, 0];

  /** Active model currently loaded via loadModel, if any */
  private currentModel: LoadedModel | null = null;

  /** Active multi-room scenario, if any */
  private activeScenario: XRScenario | null = null;

  /** Procedural Web Audio synthesizer */
  private xrAudio: XRAudio | null = null;

  /** Active museum / showcase exhibits */
  public readonly exhibits: XRExhibit[] = [];

  /** Interactive tutorial / mission guide */
  public tutorial: XRTutorial | null = null;

  /** Drop listener unregister callback */
  private dropCleanup: (() => void) | null = null;

  constructor(options: XRAppOptions = {}) {
    // 1. Initialize core subsystems
    this.scene = new XRScene({
      enableShadows: options.enableShadows,
      enableGrid: options.enableGrid,
    });

    this.renderer = new XRRenderer(options);

    this.session = new XRSession(this.renderer.nativeRenderer);

    this.input = new XRInput(
      this.renderer.domElement,
      this.session,
      options.input
    );

    this.assets = new XRAssetManager();

    // 2. Resolve runtime strategy
    if (options.runtime && typeof options.runtime === 'object') {
      this.runtime = options.runtime;
    } else if (options.runtime === 'desktop') {
      this.runtime = new DesktopRuntime();
    } else {
      // 'auto' or 'webxr': WebXRRuntime seamlessly supports both desktop & VR mode
      this.runtime = new WebXRRuntime({
        targetFrameRate: options.targetFrameRate,
        questOptimization: options.questOptimization,
      });
    }

    // 3. Attach WebXR controllers to scene so laser rays render automatically
    this.scene.nativeScene.add(this.session.controllerGroup);

    // 4. Store initial camera transforms
    this.initialCameraPosition = options.cameraPosition ?? [0, 1.6, 3.5];

    // 5. Setup desktop OrbitControls if enabled
    if (options.autoOrbitControls !== false) {
      this.controls = new OrbitControls(
        this.renderer.camera,
        this.renderer.domElement
      );
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.minDistance = 0.5;
      this.controls.maxDistance = 100;
      this.controls.target.set(
        this.initialCameraTarget[0],
        this.initialCameraTarget[1],
        this.initialCameraTarget[2]
      );
    }

    // 6. Mount floating VR Button if enabled
    if (options.autoVRButton !== false) {
      this.session.createVRButton(this.renderer.container);
    }

    // 7. Disable orbit controls during active VR sessions to avoid conflicts
    this.session.onStateChange((isVR) => {
      if (this.controls) {
        this.controls.enabled = !isVR;
      }
    });

    // 8. Initialize runtime lifecycle
    this.runtime.init(this).catch((err) => {
      console.warn('[VXR] Runtime initialization warning:', err);
    });
  }

  /**
   * Convenience getter for the primary PerspectiveCamera.
   */
  public get camera(): THREE.PerspectiveCamera {
    return this.renderer.camera;
  }

  /**
   * Convenience getter for the underlying THREE.Scene.
   */
  public get nativeScene(): THREE.Scene {
    return this.scene.nativeScene;
  }

  /**
   * Convenience getter for the underlying THREE.WebGLRenderer.
   */
  public get nativeRenderer(): THREE.WebGLRenderer {
    return this.renderer.nativeRenderer;
  }

  /**
   * Currently loaded 3D model, if any.
   */
  public get model(): LoadedModel | null {
    return this.currentModel;
  }

  /**
   * WebXR controller spaces (0: primary, 1: secondary).
   */
  public get controllers(): THREE.XRTargetRaySpace[] {
    return this.session.controllers;
  }

  /**
   * Procedural Web Audio synthesizer (zero external downloads).
   */
  public get audio(): XRAudio {
    if (!this.xrAudio) {
      this.xrAudio = new XRAudio();
    }
    return this.xrAudio;
  }

  /**
   * Resets camera and orbit target to default coordinates or specific target.
   */
  public resetCamera(
    targetPosition?: [number, number, number],
    targetLookAt?: [number, number, number]
  ): void {
    const pos = targetPosition ?? this.initialCameraPosition;
    const look = targetLookAt ?? this.initialCameraTarget;

    this.renderer.camera.position.set(pos[0], pos[1], pos[2]);
    if (this.controls) {
      this.controls.target.set(look[0], look[1], look[2]);
      this.controls.update();
    } else {
      this.renderer.camera.lookAt(look[0], look[1], look[2]);
    }
  }

  /**
   * Casts a ray from screen coordinates (mouse or touch) and returns intersecting 3D objects.
   *
   * @param event MouseEvent or PointerEvent from DOM.
   * @param objects List of 3D objects to test (defaults to scene children).
   * @param recursive Test children recursively (default: true).
   */
  public raycastPointer(
    event: MouseEvent | PointerEvent | { clientX: number; clientY: number },
    objects?: THREE.Object3D[],
    recursive: boolean = true
  ): THREE.Intersection[] {
    const dom = this.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.renderer.camera);

    const targets = objects ?? this.scene.nativeScene.children;
    return raycaster.intersectObjects(targets, recursive);
  }

  /**
   * Casts a ray along the pointing orientation of a WebXR controller.
   *
   * @param controllerIndex 0 (primary/right) or 1 (secondary/left).
   * @param objects List of 3D objects to test (defaults to scene children).
   * @param recursive Test children recursively (default: true).
   */
  public raycastController(
    controllerIndex: number,
    objects?: THREE.Object3D[],
    recursive: boolean = true
  ): THREE.Intersection[] {
    const targets = objects ?? this.scene.nativeScene.children;
    return this.session.raycastController(controllerIndex, targets, recursive);
  }

  /**
   * Subscribes to controller trigger click events in WebXR.
   * @returns Unsubscribe function.
   */
  public onControllerSelect(callback: ControllerSelectCallback): () => void {
    return this.session.onSelect(callback);
  }

  /**
   * Asynchronously loads a glTF/GLB model, aligns it at ground level (Y = 0),
   * adds it to the scene, and adjusts camera framing.
   *
   * @param source URL string or File object.
   * @param options Configuration for grounding, centering, and progress.
   */
  public async loadModel(
    source: string | File,
    options: LoadModelOptions = {}
  ): Promise<LoadedModel> {
    // Dispose previous model if present
    if (this.currentModel) {
      this.scene.remove(this.currentModel.group);
      this.currentModel.dispose();
      this.currentModel = null;
    }

    const loaded = await this.assets.loadModel(source, options);
    this.currentModel = loaded;
    this.scene.add(loaded.group);

    // Frame camera nicely toward the model center
    if (this.controls) {
      const height = loaded.metrics.dimensions.height;
      this.initialCameraTarget = [0, height * 0.4, 0];
      this.controls.target.set(0, height * 0.4, 0);
      this.controls.update();
    }

    return loaded;
  }

  /**
   * Registers a callback executed on every frame before rendering.
   * @returns Unsubscribe function to remove the callback.
   */
  public onUpdate(callback: UpdatableCallback): () => void {
    return this.renderer.addUpdatable(callback);
  }

  /**
   * Starts the animation loop and rendering.
   */
  public start(): this {
    this.renderer.start((delta, elapsed) => {
      // 1. Process unified hardware input and semantic actions
      this.input.update(delta);

      // 2. Delegate frame update to runtime
      this.runtime.update(delta, elapsed);

      // Update OrbitControls on desktop
      if (this.controls && this.controls.enabled) {
        this.controls.update();
      }

      // Render the scene
      this.renderer.render(this.scene.nativeScene);
    });
    return this;
  }

  /**
   * Pauses the animation loop.
   */
  public stop(): this {
    this.renderer.stop();
    return this;
  }

  /**
   * Active multi-room scenario, if initialized.
   */
  public get scenario(): XRScenario | null {
    return this.activeScenario;
  }

  /**
   * Creates or activates a multi-room scenario.
   */
  public createScenario(name: string = 'Scenario'): XRScenario {
    if (this.activeScenario) {
      this.scene.nativeScene.remove(this.activeScenario.nativeGroup);
      this.activeScenario.dispose();
    }
    this.activeScenario = new XRScenario(name);
    this.scene.nativeScene.add(this.activeScenario.nativeGroup);
    return this.activeScenario;
  }

  /**
   * Rapidly creates and attaches an XRRoom to the application.
   * If no scenario exists, automatically creates a default one.
   *
   * @example
   * ```typescript
   * const room = app.createRoom({
   *   name: 'Lobby',
   *   theme: 'gallery',
   *   dimensions: { width: 12, depth: 10 }
   * });
   * ```
   */
  public createRoom(options: XRRoomOptions = {}): XRRoom {
    if (!this.activeScenario) {
      this.createScenario('DefaultScenario');
    }
    return this.activeScenario!.addRoom(options);
  }

  /**
   * Connects two existing rooms with an automatic covered corridor.
   */
  public connectRooms(
    fromRoomId: string,
    fromWall: WallDirection,
    toRoomId: string,
    toWall: WallDirection,
    options: CorridorOptions = {}
  ): void {
    if (!this.activeScenario) {
      console.warn('[XRApp] Cannot connect rooms: No active scenario found.');
      return;
    }
    this.activeScenario.connectRooms(fromRoomId, fromWall, toRoomId, toWall, options);
  }

  /**
   * Loads a complete scenario from a declarative JSON configuration or URL.
   *
   * @example
   * ```typescript
   * await app.loadScenario("./escenario.json");
   * ```
   */
  public async loadScenario(configOrUrl: ScenarioJSON | string): Promise<XRScenario> {
    const sc = this.createScenario();
    if (typeof configOrUrl === 'string') {
      await sc.loadFromURL(configOrUrl);
    } else {
      sc.loadFromJSON(configOrUrl);
    }
    return sc;
  }

  /**
   * Teleports camera and controls to the spawn point of a room.
   */
  public teleportToRoom(roomId: string): void {
    if (!this.activeScenario) return;
    const room = this.activeScenario.getRoom(roomId);
    if (!room) {
      console.warn(`[XRApp] Cannot teleport: Room '${roomId}' not found.`);
      return;
    }
    const spawn = room.getSpawnPosition();
    this.resetCamera([spawn.x, spawn.y, spawn.z], [room.center.x, spawn.y, room.center.z]);
  }

  /**
   * Constrains player / avatar movement to valid walkable room and corridor bounds.
   *
   * @param currentPos Current valid position
   * @param proposedPos Desired target position
   * @param radius Player collision radius in meters (default: 0.35)
   */
  public constrainToScenario(
    currentPos: THREE.Vector3,
    proposedPos: THREE.Vector3,
    radius: number = 0.35
  ): THREE.Vector3 {
    if (!this.activeScenario) {
      return proposedPos;
    }
    return this.activeScenario.clampMovement(currentPos, proposedPos, radius);
  }

  /**
   * Adds an interactive 3D exhibit pedestal with info panel and model support.
   */
  public addExhibit(options: XRExhibitOptions): XRExhibit {
    const exhibit = new XRExhibit(options);
    this.scene.nativeScene.add(exhibit.group);
    this.exhibits.push(exhibit);

    // Register updatable for smooth model rotation
    this.renderer.addUpdatable((delta) => exhibit.update(delta));
    return exhibit;
  }

  /**
   * Creates and mounts an interactive guided tutorial / mission HUD.
   */
  public createTutorial(options: XRTutorialOptions): XRTutorial {
    if (this.tutorial) {
      this.tutorial.destroy();
    }
    this.tutorial = new XRTutorial(options, this.audio);
    return this.tutorial;
  }

  /**
   * Enables zero-server client-side 3D model drag & drop with automatic metrics and grounding.
   */
  public enableLocalFileDrop(options: LocalDropOptions = {}): () => void {
    if (this.dropCleanup) {
      this.dropCleanup();
    }
    this.dropCleanup = enableLocalFileDrop(this, options);
    return this.dropCleanup;
  }

  /**
   * Disposes the application, closing sessions, clearing models, and releasing WebGL resources.
   */
  public dispose(): void {
    this.stop();
    if (this.dropCleanup) {
      this.dropCleanup();
      this.dropCleanup = null;
    }
    if (this.tutorial) {
      this.tutorial.destroy();
      this.tutorial = null;
    }
    for (const exhibit of this.exhibits) {
      exhibit.dispose();
    }
    this.exhibits.length = 0;
    if (this.xrAudio) {
      this.xrAudio.dispose();
      this.xrAudio = null;
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.activeScenario) {
      this.scene.nativeScene.remove(this.activeScenario.nativeGroup);
      this.activeScenario.dispose();
      this.activeScenario = null;
    }
    this.input.dispose();
    this.session.dispose();
    this.runtime.dispose();
    this.assets.dispose();
    this.scene.dispose();
    this.renderer.dispose();
    this.currentModel = null;
  }
}
