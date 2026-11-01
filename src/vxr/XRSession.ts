import * as THREE from 'three';

export type SessionStateCallback = (active: boolean, session: globalThis.XRSession | null) => void;
export type ControllerSelectCallback = (
  controllerIndex: number,
  controller: THREE.XRTargetRaySpace
) => void;

/**
 * XRSession manages WebXR device availability, session requests,
 * reference spaces, controller laser pointers, and floating VR action buttons.
 */
export class XRSession {
  private renderer: THREE.WebGLRenderer;
  private activeSession: globalThis.XRSession | null = null;
  private sessionListeners: Set<SessionStateCallback> = new Set();
  private selectListeners: Set<ControllerSelectCallback> = new Set();
  private buttonElement: HTMLElement | null = null;

  /** WebXR target ray controllers (0: primary, 1: secondary) */
  public readonly controllers: THREE.XRTargetRaySpace[] = [];

  /** WebXR grip spaces for physical controller visualization */
  public readonly grips: THREE.XRGripSpace[] = [];

  /** Container group holding controller ray and grip instances */
  public readonly controllerGroup: THREE.Group;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.controllerGroup = new THREE.Group();
    this.controllerGroup.name = 'VXR_ControllerRig';

    this.setupControllers();
    this.setupRendererEvents();
  }

  /**
   * Initializes WebXR controllers with visual laser pointers.
   */
  private setupControllers(): void {
    const createLaserRay = () => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(geometry, material);
      line.name = 'VXR_LaserRay';
      return line;
    };

    for (let i = 0; i < 2; i++) {
      // 1. Ray controller space
      const controller = this.renderer.xr.getController(i);
      controller.name = `VXR_Controller_${i}`;
      const ray = createLaserRay();
      controller.add(ray);

      // Event listener for trigger press in VR
      controller.addEventListener('select', () => {
        this.notifySelectListeners(i, controller);
      });

      this.controllerGroup.add(controller);
      this.controllers.push(controller);

      // 2. Grip space
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.name = `VXR_Grip_${i}`;
      this.controllerGroup.add(grip);
      this.grips.push(grip);
    }
  }

  /**
   * Internal listeners for Three.js XR lifecycle events.
   */
  private setupRendererEvents(): void {
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.activeSession = this.renderer.xr.getSession();
      this.notifyListeners(true);
      this.updateButtonUI();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.activeSession = null;
      this.notifyListeners(false);
      this.updateButtonUI();
    });
  }

  /**
   * Checks whether the current browser and hardware support immersive VR.
   */
  public async checkVRSupport(): Promise<boolean> {
    if (!('xr' in navigator) || !navigator.xr) {
      return false;
    }
    try {
      return await navigator.xr.isSessionSupported('immersive-vr');
    } catch {
      return false;
    }
  }

  /**
   * Requests and enters an immersive WebXR VR session.
   */
  public async enterVR(sessionInit?: XRSessionInit): Promise<globalThis.XRSession> {
    if (!('xr' in navigator) || !navigator.xr) {
      throw new Error('[VXR] WebXR is not supported on this browser or platform.');
    }

    const init: XRSessionInit = sessionInit ?? {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    };

    const session = await navigator.xr.requestSession('immersive-vr', init);
    await this.renderer.xr.setSession(session);
    this.activeSession = session;
    return session;
  }

  /**
   * Gracefully exits an active immersive WebXR session.
   */
  public async exitVR(): Promise<void> {
    if (this.activeSession) {
      await this.activeSession.end();
      this.activeSession = null;
    }
  }

  /**
   * Toggles VR mode on or off.
   */
  public async toggleVR(): Promise<void> {
    if (this.isPresenting) {
      await this.exitVR();
    } else {
      await this.enterVR();
    }
  }

  /**
   * Whether an immersive VR session is currently presenting.
   */
  public get isPresenting(): boolean {
    return this.renderer.xr.isPresenting;
  }

  /**
   * The current raw WebXR session instance, if active.
   */
  public get currentSession(): globalThis.XRSession | null {
    return this.activeSession;
  }

  /**
   * Subscribes to WebXR session start and end events.
   * @returns Unsubscribe function.
   */
  public onStateChange(callback: SessionStateCallback): () => void {
    this.sessionListeners.add(callback);
    return () => this.sessionListeners.delete(callback);
  }

  /**
   * Subscribes to controller trigger select events in VR.
   * @returns Unsubscribe function.
   */
  public onSelect(callback: ControllerSelectCallback): () => void {
    this.selectListeners.add(callback);
    return () => this.selectListeners.delete(callback);
  }

  private notifyListeners(active: boolean): void {
    for (const listener of this.sessionListeners) {
      try {
        listener(active, this.activeSession);
      } catch (err) {
        console.error('[VXR] Error in XRSession listener:', err);
      }
    }
  }

  private notifySelectListeners(index: number, controller: THREE.XRTargetRaySpace): void {
    for (const listener of this.selectListeners) {
      try {
        listener(index, controller);
      } catch (err) {
        console.error('[VXR] Error in XRSession controller select listener:', err);
      }
    }
  }

  /**
   * Casts a ray in 3D world space along the pointing direction of a given WebXR controller.
   *
   * @param controllerIndex 0 (primary/right) or 1 (secondary/left).
   * @param objects List of 3D objects to test intersections against.
   * @param recursive Test children recursively (default: true).
   */
  public raycastController(
    controllerIndex: number,
    objects: THREE.Object3D[],
    recursive: boolean = true
  ): THREE.Intersection[] {
    const controller = this.controllers[controllerIndex];
    if (!controller) return [];

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const origin = new THREE.Vector3();
    controller.getWorldPosition(origin);

    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix).normalize();

    const raycaster = new THREE.Raycaster();
    raycaster.set(origin, direction);

    return raycaster.intersectObjects(objects, recursive);
  }

  /**
   * Creates a modern, styled floating action button to enter/exit VR.
   * @param container Target container for the button (defaults to document.body).
   */
  public createVRButton(container?: HTMLElement): HTMLElement {
    if (this.buttonElement) {
      return this.buttonElement;
    }

    const btn = document.createElement('button');
    btn.id = 'vxr-vr-button';
    btn.setAttribute('aria-label', 'Enter WebXR Virtual Reality');
    btn.style.position = 'fixed';
    btn.style.bottom = '24px';
    btn.style.left = '50%';
    btn.style.transform = 'translateX(-50%)';
    btn.style.padding = '12px 24px';
    btn.style.fontSize = '13px';
    btn.style.fontWeight = '600';
    btn.style.letterSpacing = '0.06em';
    btn.style.textTransform = 'uppercase';
    btn.style.color = '#ffffff';
    btn.style.backgroundColor = '#0284c7';
    btn.style.border = '1px solid #38bdf8';
    btn.style.borderRadius = '9999px';
    btn.style.boxShadow = '0 10px 25px -5px rgba(14, 165, 233, 0.4)';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '9999';
    btn.style.transition = 'all 0.2s ease';
    btn.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    btn.textContent = 'CHECKING VR...';
    btn.disabled = true;

    // Check capability asynchronously
    this.checkVRSupport().then((supported) => {
      if (supported) {
        btn.textContent = '🥽 ENTER VR';
        btn.disabled = false;
        btn.style.backgroundColor = '#0284c7';
      } else {
        btn.textContent = 'VR NOT SUPPORTED';
        btn.disabled = true;
        btn.style.backgroundColor = '#334155';
        btn.style.border = '1px solid #475569';
        btn.style.color = '#94a3b8';
        btn.style.cursor = 'not-allowed';
      }
    });

    // Click handler
    btn.addEventListener('click', () => {
      this.toggleVR().catch((err) => {
        console.warn('[VXR] Failed to toggle VR session:', err);
      });
    });

    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) {
        btn.style.backgroundColor = '#0369a1';
        btn.style.transform = 'translateX(-50%) scale(1.04)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (!btn.disabled) {
        btn.style.backgroundColor = '#0284c7';
        btn.style.transform = 'translateX(-50%) scale(1.0)';
      }
    });

    this.buttonElement = btn;
    const parent = container ?? document.body;
    parent.appendChild(btn);

    return btn;
  }

  /**
   * Updates button label and styling depending on session state.
   */
  private updateButtonUI(): void {
    if (!this.buttonElement) return;

    if (this.isPresenting) {
      this.buttonElement.textContent = '❌ EXIT VR';
      this.buttonElement.style.backgroundColor = '#dc2626';
      this.buttonElement.style.borderColor = '#f87171';
    } else {
      this.buttonElement.textContent = '🥽 ENTER VR';
      this.buttonElement.style.backgroundColor = '#0284c7';
      this.buttonElement.style.borderColor = '#38bdf8';
    }
  }

  /**
   * Disposes the session manager and removes UI elements.
   */
  public dispose(): void {
    this.exitVR().catch(() => {});
    if (this.buttonElement?.parentElement) {
      this.buttonElement.parentElement.removeChild(this.buttonElement);
      this.buttonElement = null;
    }
    this.sessionListeners.clear();
    this.selectListeners.clear();
  }
}
