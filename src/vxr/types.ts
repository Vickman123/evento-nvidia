import type * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { XRInputOptions } from './input/types.js';

/**
 * Geometric and complexity metrics computed from a loaded 3D model.
 */
export interface ModelMetrics {
  /** Physical bounding box dimensions in meters [width, height, depth] */
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  /** Calculated volumetric center coordinates */
  center: [number, number, number];
  /** Total vertex count across all contained meshes */
  vertexCount: number;
  /** Total polygon / triangle count */
  triangleCount: number;
  /** Number of individual Mesh objects inside the hierarchy */
  meshCount: number;
}

/**
 * Result returned upon successfully loading a 3D model.
 */
export interface LoadedModel {
  /** The root container group with normalized positioning */
  group: THREE.Group;
  /** Geometric metrics calculated from the model */
  metrics: ModelMetrics;
  /** Direct access to the raw GLTF object */
  rawGltf: GLTF;
  /** Function to cleanly dispose all GPU resources of this model */
  dispose: () => void;
}

/**
 * Options for configuring model loading behavior.
 */
export interface LoadModelOptions {
  /** Automatically adjust model elevation so its lowest point rests on Y = 0 (Default: true) */
  autoGround?: boolean;
  /** Automatically center model at X = 0, Z = 0 (Default: true) */
  autoCenter?: boolean;
  /** Optional custom DRACO decoder path */
  dracoPath?: string;
  /** Progress callback returning percentage (0 to 100) */
  onProgress?: (percent: number) => void;
}

/**
 * Configuration options for creating an XRApp instance.
 */
export interface XRAppOptions {
  /**
   * DOM element or selector string to append the 3D canvas to.
   * Defaults to document.body.
   */
  container?: HTMLElement | string;

  /**
   * Custom HTMLCanvasElement to render into.
   * If omitted, VXR creates a new canvas automatically.
   */
  canvas?: HTMLCanvasElement;

  /**
   * Enable real-time shadow maps (PCF Soft Shadows).
   * Defaults to true.
   */
  enableShadows?: boolean;

  /**
   * Add a default reference ground plane and grid.
   * Defaults to true.
   */
  enableGrid?: boolean;

  /**
   * Maximum device pixel ratio cap to preserve battery and frame rate on mobile/Quest.
   * Defaults to 1.5.
   */
  pixelRatioCap?: number;

  /**
   * Initial camera position [x, y, z] in meters.
   * Defaults to [0, 1.6, 3.5] (operator eye level).
   */
  cameraPosition?: [number, number, number];

  /**
   * Camera field of view in degrees.
   * Defaults to 60.
   */
  fov?: number;

  /**
   * Camera near clipping plane in meters.
   * Defaults to 0.1.
   */
  near?: number;

  /**
   * Camera far clipping plane in meters.
   * Defaults to 200.
   */
  far?: number;

  /**
   * Enable antialiasing on WebGL context.
   * Defaults to true.
   */
  antialias?: boolean;

  /**
   * Enable desktop OrbitControls when not immersed in VR.
   * Defaults to true.
   */
  autoOrbitControls?: boolean;

  /**
   * Automatically create and mount a floating "ENTER VR" button.
   * Defaults to true.
   */
  autoVRButton?: boolean;

  /**
   * Runtime strategy mode or custom XRRuntime instance.
   * - 'auto': Determines runtime environment automatically (Default).
   * - 'desktop': Forces desktop mouse/touch OrbitControls runtime.
   * - 'webxr': Prepares WebXR immersive runtime with Quest optimizations.
   */
  runtime?: 'auto' | 'desktop' | 'webxr' | import('./runtime/XRRuntime.js').XRRuntime;

  /**
   * Target frame rate in Hz to request in Meta Quest Browser (e.g. 72, 90, 120).
   * Defaults to 90.
   */
  targetFrameRate?: number;

  /**
   * Enable Meta Quest rendering optimizations (adaptive pixel ratio clamping, thermal protection).
   * Defaults to true.
   */
  questOptimization?: boolean;

  /**
   * Configuration options for the cross-platform XRInput action mapping subsystem.
   */
  input?: XRInputOptions;
}

/**
 * Callback function executed on every rendered frame.
 * @param delta Time in seconds elapsed since the previous frame.
 * @param elapsed Total time in seconds since the engine loop started.
 */
export type UpdatableCallback = (delta: number, elapsed: number) => void;
