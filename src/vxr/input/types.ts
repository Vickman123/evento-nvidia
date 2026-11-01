/**
 * VXR Input & Action Mapping Types
 *
 * Provides a unified, hardware-agnostic semantic action abstraction for:
 * - Desktop PC (Keyboard & Mouse with PointerLock)
 * - WebXR 6DoF Motion Controllers (Meta Quest 2/3/3S/Pro, Pico, Vive, Vision Pro)
 * - Mobile Touch & Virtual Joysticks
 */

/**
 * Common standard actions for XR games and interactive 3D simulations.
 */
export type StandardAction =
  | 'move'
  | 'look'
  | 'fire'
  | 'primaryAction'
  | 'altFire'
  | 'secondaryAction'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'reload'
  | 'pause';

/**
 * Input device category originating an action.
 */
export type InputDevice = 'keyboard' | 'mouse' | 'xr-controller' | 'touch' | 'virtual';

/**
 * 2D vector for directional inputs (movement, camera look, analog thumbsticks).
 */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * State snapshot of a digital or analog button.
 */
export interface ButtonState {
  /** Whether the action button is currently held down */
  pressed: boolean;
  /** True only during the exact frame the button transitioned from released to pressed */
  justPressed: boolean;
  /** True only during the exact frame the button transitioned from pressed to released */
  justReleased: boolean;
  /** Analog intensity value between 0.0 and 1.0 (e.g. trigger pressure depth) */
  value: number;
}

/**
 * Event payload dispatched when an action state changes.
 */
export interface ActionEvent {
  /** Name of the triggered action (e.g. 'fire', 'move', 'jump') */
  action: string;
  /** Whether the action is active / pressed */
  pressed: boolean;
  /** Analog depth value (0.0 to 1.0) */
  value: number;
  /** 2D directional vector if applicable (e.g. for 'move' or 'look') */
  vector?: Vector2D;
  /** Hardware device originating the event */
  device: InputDevice;
  /** WebXR controller index (0: primary, 1: secondary) if originating from XR */
  controllerIndex?: number;
  /** High resolution timestamp */
  timestamp: number;
}

/**
 * Callback function for action event subscriptions.
 */
export type ActionCallback = (event: ActionEvent) => void;

/**
 * Custom mapping configuration for WebXR motion controller buttons.
 */
export interface XRButtonBindings {
  /** Action for index finger trigger (Button 0). Default: 'fire' / 'primaryAction' */
  trigger?: string;
  /** Action for hand grip/squeeze button (Button 1). Default: 'altFire' / 'secondaryAction' */
  grip?: string;
  /** Action for lower primary face button (A on right, X on left - Button 4). Default: 'jump' */
  primaryButton?: string;
  /** Action for upper secondary face button (B on right, Y on left - Button 5). Default: 'pause' */
  secondaryButton?: string;
  /** Action for thumbstick press / click (Button 3). Default: 'sprint' */
  thumbstickPress?: string;
}

/**
 * Options for configuring the XRInput subsystem.
 */
export interface XRInputOptions {
  /**
   * Target DOM element for mouse and touch listeners.
   * If omitted, defaults to document.body or window.
   */
  domElement?: HTMLElement | null;

  /**
   * Automatically request Pointer Lock on click for FPS mouse look.
   * Default: false.
   */
  pointerLock?: boolean;

  /**
   * Mouse look rotational sensitivity multiplier.
   * Default: 0.0024.
   */
  mouseSensitivity?: number;

  /**
   * Invert vertical pitch axis for mouse look.
   * Default: false.
   */
  invertMouseY?: boolean;

  /**
   * Deadzone threshold for analog thumbsticks (0.0 to 1.0).
   * Values inside this radius are clamped to zero to prevent stick drift.
   * Default: 0.15.
   */
  thumbstickDeadzone?: number;

  /**
   * Snap turn angle in degrees for the right XR thumbstick (e.g. 45 or 30).
   * Set to 0 for continuous smooth rotation.
   * Default: 0 (smooth).
   */
  snapTurnAngle?: number;

  /**
   * Minimum cooldown delay in seconds between consecutive snap turns.
   * Default: 0.28.
   */
  snapTurnCooldown?: number;

  /**
   * Custom keyboard bindings mapping action names to KeyboardEvent.code strings.
   * Example: { jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'] }
   */
  keyBindings?: Record<string, string[]>;

  /**
   * Custom mouse button bindings mapping mouse button number to action name.
   * Default: { 0: 'fire', 2: 'altFire' }
   */
  mouseButtonBindings?: Record<number, string>;

  /**
   * Custom WebXR controller button mappings.
   */
  xrButtonBindings?: XRButtonBindings;
}
