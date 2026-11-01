import * as THREE from 'three';

/**
 * Options for configuring an interactive 3D exhibit pod.
 */
export interface XRExhibitOptions {
  /** Unique ID for the exhibit */
  id?: string;
  /** Main title displayed on the info screen */
  title: string;
  /** Category or institution badge (e.g. 'ARQUEOLOGÍA', 'AEROESPACIAL') */
  category?: string;
  /** Explanatory description */
  description?: string;
  /** List of key bullet points or specifications */
  specs?: string[];
  /** Primary accent color (hex string or number, default: '#38bdf8') */
  themeColor?: string | number;
  /** World position coordinates [x, y, z] */
  position?: [number, number, number];
  /** Y-axis rotation in radians (default: 0) */
  rotationY?: number;
  /** URL to a 3D model (.glb/.gltf) to place on top of the pod */
  modelUrl?: string;
  /** Pre-existing Three.js Object3D to place on top of the pod */
  model?: THREE.Object3D;
  /** Scale factor for the displayed model */
  modelScale?: number;
  /** Callback triggered when the user clicks or inspects this exhibit */
  onInspect?: (exhibit: any) => void;
}
