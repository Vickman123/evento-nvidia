/**
 * VXR Core: High-level WebXR and 3D simulation layer for Three.js
 */

export { XRApp } from './XRApp.js';
export { XRScene } from './XRScene.js';
export type { XRSceneOptions, EnvironmentPreset } from './XRScene.js';
export { XRRenderer } from './XRRenderer.js';
export { XRSession } from './XRSession.js';
export type { SessionStateCallback, ControllerSelectCallback } from './XRSession.js';
export { XRAssetManager } from './XRAssetManager.js';
export { XRRoom } from './scenario/XRRoom.js';
export { XRScenario } from './scenario/XRScenario.js';
export { XRAudio } from './audio/XRAudio.js';
export { XRExhibit } from './exhibit/XRExhibit.js';
export type { XRExhibitOptions } from './exhibit/types.js';
export { XRTutorial } from './tutorial/XRTutorial.js';
export type { TutorialTask, XRTutorialOptions } from './tutorial/types.js';
export { enableLocalFileDrop } from './utils/localDrop.js';
export type { LocalDropOptions } from './utils/localDrop.js';
export { DesktopRuntime } from './runtime/DesktopRuntime.js';
export { WebXRRuntime } from './runtime/WebXRRuntime.js';
export type { WebXRRuntimeOptions } from './runtime/WebXRRuntime.js';
export type { XRRuntime, XRRuntimeMode } from './runtime/XRRuntime.js';
export { detectQuestCapabilities, negotiateFrameRate } from './runtime/questDetection.js';
export type { QuestRuntimeCapabilities } from './runtime/questDetection.js';
export { XRInput } from './input/XRInput.js';
export type {
  StandardAction,
  InputDevice,
  Vector2D,
  ButtonState,
  ActionEvent,
  ActionCallback,
  XRButtonBindings,
  XRInputOptions,
} from './input/types.js';

export type {
  XRAppOptions,
  LoadedModel,
  LoadModelOptions,
  ModelMetrics,
  UpdatableCallback,
} from './types.js';

// UI & 3D Interactive Screens
export { XRDisplayScreen } from './ui/XRDisplayScreen.js';
export type {
  XRDisplayScreenOptions,
  XRMediaItem,
  XRCanvasHotspot,
} from './ui/types.js';

// Portals & Hub Navigation
export { XRPortal } from './portal/XRPortal.js';
export type { XRPortalOptions } from './portal/XRPortal.js';

// Dynamics & Gamification Loops
export { XRDynamicsEngine } from './dynamics/XRDynamicsEngine.js';
export type {
  XRDynamicsOptions,
  XRDynamicNode,
} from './dynamics/XRDynamicsEngine.js';

export type {
  RoomTheme,
  WallDirection,
  DoorConfig,
  XRRoomDimensions,
  RoomFloorOptions,
  RoomWallsOptions,
  RoomCeilingOptions,
  RoomLightingOptions,
  XRRoomOptions,
  WalkableAABB,
  DoorAperture,
  CorridorOptions,
  ScenarioRoomJSON,
  ScenarioConnectionJSON,
  ScenarioJSON,
} from './scenario/types.js';

