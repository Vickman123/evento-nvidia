import * as THREE from 'three';
import type { XRSession } from '../XRSession.js';
import type {
  ActionCallback,
  ActionEvent,
  ButtonState,
  InputDevice,
  Vector2D,
  XRButtonBindings,
  XRInputOptions,
} from './types.js';

/**
 * Default keyboard mappings: Action -> array of KeyboardEvent.code strings.
 */
const DEFAULT_KEY_BINDINGS: Record<string, string[]> = {
  move_forward: ['KeyW', 'ArrowUp'],
  move_backward: ['KeyS', 'ArrowDown'],
  move_left: ['KeyA', 'ArrowLeft'],
  move_right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'KeyF'],
  reload: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  fire: ['Enter'],
  altFire: ['KeyQ'],
};

/**
 * Default mouse button mappings: MouseEvent.button -> action name.
 * 0: Left, 1: Middle, 2: Right
 */
const DEFAULT_MOUSE_BUTTONS: Record<number, string> = {
  0: 'fire',
  2: 'altFire',
  1: 'interact',
};

/**
 * Default WebXR controller button mappings.
 */
const DEFAULT_XR_BUTTONS: Required<XRButtonBindings> = {
  trigger: 'fire',
  grip: 'altFire',
  primaryButton: 'jump',
  secondaryButton: 'pause',
  thumbstickPress: 'sprint',
};

/**
 * XRInput provides a high-level, hardware-agnostic semantic action abstraction
 * for desktop keyboards/mice, touchscreens, and WebXR 6DoF motion controllers.
 *
 * It bridges PC and Meta Quest VR inputs into unified actions like 'move', 'look',
 * and 'fire', allowing identical game mechanics to work anywhere seamlessly.
 *
 * @example
 * ```typescript
 * const input = new XRInput(canvas, app.session);
 *
 * app.onUpdate((delta) => {
 *   const move = input.getVector('move');
 *   if (input.isJustPressed('fire')) {
 *     player.shoot();
 *   }
 * });
 * ```
 */
export class XRInput {
  public options: Required<Omit<XRInputOptions, 'domElement' | 'keyBindings' | 'mouseButtonBindings' | 'xrButtonBindings'>> & {
    domElement: HTMLElement | null;
    keyBindings: Record<string, string[]>;
    mouseButtonBindings: Record<number, string>;
    xrButtonBindings: Required<XRButtonBindings>;
  };

  private xrSession: XRSession | null = null;
  private domElement: HTMLElement | null = null;

  // Raw hardware state tracking
  private activeKeys: Set<string> = new Set();
  private activeMouseButtons: Set<number> = new Set();
  private mouseDelta: Vector2D = { x: 0, y: 0 };
  private _isPointerLocked: boolean = false;

  // Processed Action States: action -> ButtonState
  private actionStates: Map<string, ButtonState> = new Map();
  private prevActionPressed: Map<string, boolean> = new Map();

  // Analog 2D vectors: action -> Vector2D
  private vectorStates: Map<string, Vector2D> = new Map();

  // Event Listeners: action -> Set<ActionCallback>
  private actionListeners: Map<string, Set<ActionCallback>> = new Map();

  // Snap turn state in XR
  private snapCooldownTimer: number = 0;
  private snapTurnPending: number = 0; // Degrees to turn on current frame

  // Listener unregister callbacks
  private cleanupCallbacks: Array<() => void> = [];

  // Temporary vectors for locomotion math
  private tempForward = new THREE.Vector3();
  private tempRight = new THREE.Vector3();
  private tempDirection = new THREE.Vector3();

  constructor(
    domElement?: HTMLElement | null,
    xrSession?: XRSession | null,
    options: XRInputOptions = {}
  ) {
    this.domElement = domElement ?? null;
    this.xrSession = xrSession ?? null;

    this.options = {
      domElement: this.domElement,
      pointerLock: options.pointerLock ?? false,
      mouseSensitivity: options.mouseSensitivity ?? 0.0024,
      invertMouseY: options.invertMouseY ?? false,
      thumbstickDeadzone: Math.max(0.01, Math.min(0.9, options.thumbstickDeadzone ?? 0.15)),
      snapTurnAngle: options.snapTurnAngle ?? 0,
      snapTurnCooldown: options.snapTurnCooldown ?? 0.28,
      keyBindings: { ...DEFAULT_KEY_BINDINGS, ...options.keyBindings },
      mouseButtonBindings: { ...DEFAULT_MOUSE_BUTTONS, ...options.mouseButtonBindings },
      xrButtonBindings: { ...DEFAULT_XR_BUTTONS, ...options.xrButtonBindings },
    };

    this.setupDesktopListeners();
    this.setupXRListeners();
  }

  // ===========================================================================
  // Desktop Input Setup
  // ===========================================================================

  private setupDesktopListeners(): void {
    if (typeof window === 'undefined') return;

    // 1. Keyboard Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes inside text inputs or textareas
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      this.activeKeys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.activeKeys.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.cleanupCallbacks.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });

    // 2. Mouse Button Listeners
    const target = this.domElement ?? (typeof document !== 'undefined' ? document.body : null);
    if (!target) return;

    const onMouseDown = (e: MouseEvent) => {
      this.activeMouseButtons.add(e.button);

      // Handle pointer lock if enabled
      if (this.options.pointerLock && !this._isPointerLocked) {
        this.requestPointerLock();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      this.activeMouseButtons.delete(e.button);
    };

    const onContextMenu = (e: MouseEvent) => {
      // If right click is bound to an action, prevent default browser context menu
      if (this.options.mouseButtonBindings[2]) {
        e.preventDefault();
      }
    };

    target.addEventListener('mousedown', onMouseDown as EventListener);
    window.addEventListener('mouseup', onMouseUp as EventListener);
    target.addEventListener('contextmenu', onContextMenu as EventListener);

    this.cleanupCallbacks.push(() => {
      target.removeEventListener('mousedown', onMouseDown as EventListener);
      window.removeEventListener('mouseup', onMouseUp as EventListener);
      target.removeEventListener('contextmenu', onContextMenu as EventListener);
    });

    // 3. Mouse Movement Listeners
    const onMouseMove = (e: MouseEvent) => {
      if (this.options.pointerLock && !this._isPointerLocked) return;

      const deltaX = (e.movementX || 0) * this.options.mouseSensitivity;
      const multY = this.options.invertMouseY ? 1 : -1;
      const deltaY = (e.movementY || 0) * this.options.mouseSensitivity * multY;

      this.mouseDelta.x += deltaX;
      this.mouseDelta.y += deltaY;
    };

    window.addEventListener('mousemove', onMouseMove);
    this.cleanupCallbacks.push(() => {
      window.removeEventListener('mousemove', onMouseMove);
    });

    // 4. Pointer Lock State Change
    const onPointerLockChange = () => {
      this._isPointerLocked =
        typeof document !== 'undefined' && document.pointerLockElement === target;
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', onPointerLockChange);
      this.cleanupCallbacks.push(() => {
        document.removeEventListener('pointerlockchange', onPointerLockChange);
      });
    }
  }

  // ===========================================================================
  // WebXR Input Setup
  // ===========================================================================

  private setupXRListeners(): void {
    if (!this.xrSession) return;

    // Subscribe to standard trigger select events as secondary fallback
    const unsub = this.xrSession.onSelect((controllerIndex) => {
      const action = this.options.xrButtonBindings.trigger;
      this.dispatchImmediateAction(action, true, 1.0, 'xr-controller', controllerIndex);
    });
    this.cleanupCallbacks.push(unsub);
  }

  // ===========================================================================
  // Pointer Lock API Helpers
  // ===========================================================================

  /**
   * Requests pointer lock on the target canvas element for first-person mouse look.
   */
  public requestPointerLock(): void {
    if (this.domElement && typeof this.domElement.requestPointerLock === 'function') {
      try {
        this.domElement.requestPointerLock();
      } catch (err) {
        console.warn('[XRInput] Failed to request pointer lock:', err);
      }
    }
  }

  /**
   * Exits pointer lock.
   */
  public exitPointerLock(): void {
    if (typeof document !== 'undefined' && typeof document.exitPointerLock === 'function') {
      try {
        document.exitPointerLock();
      } catch (err) {
        console.warn('[XRInput] Failed to exit pointer lock:', err);
      }
    }
  }

  /**
   * Whether pointer lock is currently active on the canvas.
   */
  public get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }

  // ===========================================================================
  // Action State Queries (Polling API)
  // ===========================================================================

  /**
   * Returns whether a given action is currently pressed / active.
   */
  public isPressed(action: string): boolean {
    const state = this.actionStates.get(action);
    return state ? state.pressed : false;
  }

  /**
   * Returns true ONLY during the exact frame the action transitioned from released to pressed.
   */
  public isJustPressed(action: string): boolean {
    const state = this.actionStates.get(action);
    return state ? state.justPressed : false;
  }

  /**
   * Returns true ONLY during the exact frame the action transitioned from pressed to released.
   */
  public isJustReleased(action: string): boolean {
    const state = this.actionStates.get(action);
    return state ? state.justReleased : false;
  }

  /**
   * Returns the analog intensity value of an action between 0.0 and 1.0 (e.g. trigger depth).
   */
  public getValue(action: string): number {
    const state = this.actionStates.get(action);
    return state ? state.value : 0;
  }

  /**
   * Returns the current 2D vector for directional actions (e.g. 'move' or 'look').
   */
  public getVector(action: string): Vector2D {
    const vec = this.vectorStates.get(action);
    return vec ? { x: vec.x, y: vec.y } : { x: 0, y: 0 };
  }

  /**
   * Returns any pending snap turn rotation in degrees triggered during this frame.
   * Resets to 0 after read.
   */
  public consumeSnapTurn(): number {
    const angle = this.snapTurnPending;
    this.snapTurnPending = 0;
    return angle;
  }

  // ===========================================================================
  // Event-Driven Action Subscriptions
  // ===========================================================================

  /**
   * Subscribes to changes in an action state (pressed or released).
   * @returns Unsubscribe function.
   */
  public onAction(action: string, callback: ActionCallback): () => void {
    if (!this.actionListeners.has(action)) {
      this.actionListeners.set(action, new Set());
    }
    const set = this.actionListeners.get(action)!;
    set.add(callback);
    return () => set.delete(callback);
  }

  /**
   * Subscribes to when an action is pressed down.
   */
  public onActionDown(action: string, callback: () => void): () => void {
    return this.onAction(action, (e) => {
      if (e.pressed) callback();
    });
  }

  /**
   * Subscribes to when an action is released.
   */
  public onActionUp(action: string, callback: () => void): () => void {
    return this.onAction(action, (e) => {
      if (!e.pressed) callback();
    });
  }

  // ===========================================================================
  // Locomotion & Direction Helper
  // ===========================================================================

  /**
   * Computes a normalized world-space movement vector based on the player's
   * current 'move' action and the horizontal orientation of a reference camera.
   *
   * @param camera The active camera (Desktop or WebXR eye camera)
   * @returns THREE.Vector3 direction vector on the X-Z ground plane
   */
  public getMovementDirection(camera: THREE.Camera): THREE.Vector3 {
    const move = this.getVector('move');
    if (move.x === 0 && move.y === 0) {
      return this.tempDirection.set(0, 0, 0);
    }

    // Extract horizontal forward vector from camera
    camera.getWorldDirection(this.tempForward);
    this.tempForward.y = 0;
    this.tempForward.normalize();

    // Extract horizontal right vector
    this.tempRight.crossVectors(this.tempForward, camera.up);
    this.tempRight.y = 0;
    this.tempRight.normalize();

    // Combine: forward * move.y + right * move.x
    this.tempDirection
      .set(0, 0, 0)
      .addScaledVector(this.tempForward, move.y)
      .addScaledVector(this.tempRight, move.x);

    const length = this.tempDirection.length();
    if (length > 1.0) {
      this.tempDirection.normalize();
    }

    return this.tempDirection;
  }

  // ===========================================================================
  // Per-Frame Update Loop
  // ===========================================================================

  /**
   * Evaluates hardware state, processes WebXR gamepads, calculates transitions,
   * and fires action events. Must be called once per frame.
   *
   * @param delta Time in seconds since previous frame
   */
  public update(delta: number): void {
    // 1. Decrement snap turn cooldown
    if (this.snapCooldownTimer > 0) {
      this.snapCooldownTimer -= delta;
    }

    // 2. Poll desktop inputs (Keyboard & Mouse)
    const currentActionValues: Map<string, { value: number; device: InputDevice; ctrl?: number }> =
      new Map();

    this.pollDesktop(currentActionValues);

    // 3. Poll WebXR motion controllers (Gamepads)
    this.pollXR(delta, currentActionValues);

    // 4. Update digital & analog action transitions (isJustPressed, isJustReleased)
    for (const [action, current] of currentActionValues.entries()) {
      const isPressedNow = current.value > 0.15;
      const prevPressed = this.prevActionPressed.get(action) ?? false;

      const justPressed = isPressedNow && !prevPressed;
      const justReleased = !isPressedNow && prevPressed;

      this.actionStates.set(action, {
        pressed: isPressedNow,
        justPressed,
        justReleased,
        value: current.value,
      });

      this.prevActionPressed.set(action, isPressedNow);

      if (justPressed || justReleased) {
        this.dispatchAction(action, isPressedNow, current.value, current.device, current.ctrl);
      }
    }

    // 5. Clean actions that went completely inactive
    for (const [action, wasPressed] of this.prevActionPressed.entries()) {
      if (!currentActionValues.has(action)) {
        if (wasPressed) {
          // Transitioned from pressed to released on this frame
          this.actionStates.set(action, {
            pressed: false,
            justPressed: false,
            justReleased: true,
            value: 0,
          });
          this.prevActionPressed.set(action, false);
          this.dispatchAction(action, false, 0, 'keyboard');
        } else {
          // Was already released previously: clear justReleased flag
          const existing = this.actionStates.get(action);
          if (existing && existing.justReleased) {
            this.actionStates.set(action, {
              pressed: false,
              justPressed: false,
              justReleased: false,
              value: 0,
            });
          }
        }
      }
    }

    // 6. Reset per-frame mouse delta
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
  }

  // ===========================================================================
  // Hardware Polling Subroutines
  // ===========================================================================

  private pollDesktop(
    outValues: Map<string, { value: number; device: InputDevice; ctrl?: number }>
  ): void {
    // 1. Keys -> Actions
    for (const [action, codes] of Object.entries(this.options.keyBindings)) {
      let active = false;
      for (const code of codes) {
        if (this.activeKeys.has(code)) {
          active = true;
          break;
        }
      }
      if (active) {
        outValues.set(action, { value: 1.0, device: 'keyboard' });
      }
    }

    // 2. Mouse Buttons -> Actions
    for (const [btnIndexStr, action] of Object.entries(this.options.mouseButtonBindings)) {
      const btn = Number(btnIndexStr);
      if (this.activeMouseButtons.has(btn)) {
        outValues.set(action, { value: 1.0, device: 'mouse' });
      }
    }

    // 3. Desktop Directional Vector: 'move'
    let moveX = 0;
    let moveY = 0;

    if (this.isKeyActive('move_right')) moveX += 1;
    if (this.isKeyActive('move_left')) moveX -= 1;
    if (this.isKeyActive('move_forward')) moveY += 1;
    if (this.isKeyActive('move_backward')) moveY -= 1;

    // Normalize diagonal movement on desktop
    const moveLen = Math.hypot(moveX, moveY);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveY /= moveLen;
    }
    this.vectorStates.set('move', { x: moveX, y: moveY });

    // 4. Desktop Directional Vector: 'look'
    this.vectorStates.set('look', { x: this.mouseDelta.x, y: this.mouseDelta.y });
  }

  private pollXR(
    delta: number,
    outValues: Map<string, { value: number; device: InputDevice; ctrl?: number }>
  ): void {
    if (!this.xrSession || !this.xrSession.isPresenting) return;

    const controllers = this.xrSession.controllers;

    for (let i = 0; i < controllers.length; i++) {
      const controller = controllers[i];
      const inputSource = (controller as any).inputSource as globalThis.XRInputSource | undefined;
      if (!inputSource || !inputSource.gamepad) continue;

      const gp = inputSource.gamepad;
      const handedness = inputSource.handedness; // 'left' | 'right' | 'none'

      // Buttons reading
      // 0: Trigger, 1: Squeeze/Grip, 3: Thumbstick, 4: Primary (A/X), 5: Secondary (B/Y)
      if (gp.buttons.length > 0) {
        const trigger = gp.buttons[0];
        if (trigger && trigger.value > 0.05) {
          const action = this.options.xrButtonBindings.trigger;
          const prev = outValues.get(action)?.value ?? 0;
          if (trigger.value > prev) {
            outValues.set(action, { value: trigger.value, device: 'xr-controller', ctrl: i });
          }
        }
      }

      if (gp.buttons.length > 1) {
        const grip = gp.buttons[1];
        if (grip && grip.value > 0.05) {
          const action = this.options.xrButtonBindings.grip;
          const prev = outValues.get(action)?.value ?? 0;
          if (grip.value > prev) {
            outValues.set(action, { value: grip.value, device: 'xr-controller', ctrl: i });
          }
        }
      }

      if (gp.buttons.length > 3) {
        const thumbBtn = gp.buttons[3];
        if (thumbBtn && thumbBtn.pressed) {
          outValues.set(this.options.xrButtonBindings.thumbstickPress, {
            value: 1.0,
            device: 'xr-controller',
            ctrl: i,
          });
        }
      }

      if (gp.buttons.length > 4) {
        const primaryBtn = gp.buttons[4];
        if (primaryBtn && primaryBtn.pressed) {
          outValues.set(this.options.xrButtonBindings.primaryButton, {
            value: 1.0,
            device: 'xr-controller',
            ctrl: i,
          });
        }
      }

      if (gp.buttons.length > 5) {
        const secBtn = gp.buttons[5];
        if (secBtn && secBtn.pressed) {
          outValues.set(this.options.xrButtonBindings.secondaryButton, {
            value: 1.0,
            device: 'xr-controller',
            ctrl: i,
          });
        }
      }

      // Thumbstick Axes reading
      // In WebXR Gamepads spec, thumbsticks are typically axes[2] (X) and axes[3] (Y)
      // Some runtimes without touchpads map axes[0] and axes[1].
      let stickX = 0;
      let stickY = 0;

      if (gp.axes.length >= 4) {
        stickX = gp.axes[2];
        stickY = gp.axes[3];
      } else if (gp.axes.length >= 2) {
        stickX = gp.axes[0];
        stickY = gp.axes[1];
      }

      // Apply deadzone
      const deadzone = this.options.thumbstickDeadzone;
      const mag = Math.hypot(stickX, stickY);

      let cleanX = 0;
      let cleanY = 0;
      if (mag > deadzone) {
        const normalizedMag = Math.min(1.0, (mag - deadzone) / (1.0 - deadzone));
        cleanX = (stickX / mag) * normalizedMag;
        cleanY = (stickY / mag) * normalizedMag;
      }

      // Left hand controls locomotion ('move')
      if (handedness === 'left' || (handedness === 'none' && i === 1)) {
        if (Math.hypot(cleanX, cleanY) > 0) {
          // WebXR thumbstick Y is -1 forward, +1 backward. Invert for forward = +1
          this.vectorStates.set('move', { x: cleanX, y: -cleanY });
        }
      }

      // Right hand controls camera rotation ('look' / snap turn)
      if (handedness === 'right' || (handedness === 'none' && i === 0)) {
        if (this.options.snapTurnAngle > 0) {
          // Snap turn logic
          if (Math.abs(cleanX) > 0.65 && this.snapCooldownTimer <= 0) {
            this.snapTurnPending = cleanX > 0 ? -this.options.snapTurnAngle : this.options.snapTurnAngle;
            this.snapCooldownTimer = this.options.snapTurnCooldown;
          }
        } else {
          // Smooth turn look
          if (Math.abs(cleanX) > 0) {
            const currentLook = this.vectorStates.get('look') ?? { x: 0, y: 0 };
            this.vectorStates.set('look', {
              x: currentLook.x - cleanX * delta * 2.5,
              y: currentLook.y,
            });
          }
        }
      }
    }
  }

  private isKeyActive(actionKey: string): boolean {
    const codes = this.options.keyBindings[actionKey] ?? [];
    for (const code of codes) {
      if (this.activeKeys.has(code)) return true;
    }
    return false;
  }

  // ===========================================================================
  // Action Dispatchers
  // ===========================================================================

  private dispatchAction(
    action: string,
    pressed: boolean,
    value: number,
    device: InputDevice,
    ctrlIndex?: number
  ): void {
    const listeners = this.actionListeners.get(action);
    if (!listeners || listeners.size === 0) return;

    const event: ActionEvent = {
      action,
      pressed,
      value,
      vector: this.vectorStates.get(action),
      device,
      controllerIndex: ctrlIndex,
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[XRInput] Error in action listener for '${action}':`, err);
      }
    }
  }

  private dispatchImmediateAction(
    action: string,
    pressed: boolean,
    value: number,
    device: InputDevice,
    ctrlIndex?: number
  ): void {
    this.actionStates.set(action, {
      pressed,
      justPressed: pressed,
      justReleased: !pressed,
      value,
    });
    this.dispatchAction(action, pressed, value, device, ctrlIndex);
  }

  // ===========================================================================
  // Testing & Simulation Hooks (Headless / Unit Test friendly)
  // ===========================================================================

  /**
   * Simulates a key event for unit tests or virtual on-screen keyboards.
   */
  public simulateKey(code: string, pressed: boolean): void {
    if (pressed) {
      this.activeKeys.add(code);
    } else {
      this.activeKeys.delete(code);
    }
  }

  /**
   * Simulates a mouse button event for unit tests.
   */
  public simulateMouseButton(button: number, pressed: boolean): void {
    if (pressed) {
      this.activeMouseButtons.add(button);
    } else {
      this.activeMouseButtons.delete(button);
    }
  }

  /**
   * Simulates mouse delta movement for unit tests.
   */
  public simulateMouseMove(deltaX: number, deltaY: number): void {
    const multY = this.options.invertMouseY ? 1 : -1;
    this.mouseDelta.x += deltaX * this.options.mouseSensitivity;
    this.mouseDelta.y += deltaY * this.options.mouseSensitivity * multY;
  }

  // ===========================================================================
  // Cleanup & Disposal
  // ===========================================================================

  /**
   * Releases all event listeners and state maps.
   */
  public dispose(): void {
    for (const cleanup of this.cleanupCallbacks) {
      try {
        cleanup();
      } catch (err) {
        console.warn('[XRInput] Error during listener cleanup:', err);
      }
    }
    this.cleanupCallbacks.length = 0;
    this.activeKeys.clear();
    this.activeMouseButtons.clear();
    this.actionStates.clear();
    this.prevActionPressed.clear();
    this.vectorStates.clear();
    this.actionListeners.clear();
    this.domElement = null;
    this.xrSession = null;
  }
}
