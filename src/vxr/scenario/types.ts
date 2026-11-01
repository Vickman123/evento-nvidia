import * as THREE from 'three';

/**
 * Predefined visual themes for rapid room styling.
 */
export type RoomTheme = 'gallery' | 'scifi' | 'office' | 'cozy' | 'minimal';

/**
 * Compass directions for room walls and doorways.
 */
export type WallDirection = 'north' | 'south' | 'east' | 'west';

/**
 * Configuration for a doorway aperture in a wall.
 */
export interface DoorConfig {
  /** The wall where the door is placed */
  wall: WallDirection;
  /** Width of the door opening in meters (default: 2.2) */
  width?: number;
  /** Height of the door opening in meters (default: 2.6) */
  height?: number;
  /** Horizontal offset from wall center in meters (default: 0) */
  offset?: number;
  /** Optional ID of the room or corridor this door connects to */
  targetRoomId?: string;
}

/**
 * Dimensions of a room in 3D space.
 */
export interface XRRoomDimensions {
  /** Width along the X axis in meters (default: 10) */
  width: number;
  /** Depth along the Z axis in meters (default: 10) */
  depth: number;
  /** Height along the Y axis in meters (default: 3.5) */
  height: number;
}

/**
 * Material customization for room floor.
 */
export interface RoomFloorOptions {
  color?: string | number;
  roughness?: number;
  metalness?: number;
  grid?: boolean;
}

/**
 * Material customization for room walls.
 */
export interface RoomWallsOptions {
  color?: string | number;
  roughness?: number;
  trimColor?: string | number;
  thickness?: number;
}

/**
 * Ceiling customization and integrated lighting.
 */
export interface RoomCeilingOptions {
  enabled?: boolean;
  color?: string | number;
  lamps?: boolean;
}

/**
 * Integrated ceiling lighting for the room.
 */
export interface RoomLightingOptions {
  enabled?: boolean;
  color?: string | number;
  intensity?: number;
  distance?: number;
  decay?: number;
}

/**
 * Complete options for creating an XRRoom.
 */
export interface XRRoomOptions {
  /** Unique identifier for the room (e.g. 'lobby', 'lab') */
  id?: string;
  /** Human-readable display name */
  name?: string;
  /** Room dimensions (width, depth, height) */
  dimensions?: Partial<XRRoomDimensions>;
  /** Center position in 3D space [x, y, z] */
  center?: [number, number, number];
  /** Visual preset theme */
  theme?: RoomTheme;
  /** Floor customization */
  floor?: RoomFloorOptions;
  /** Walls customization */
  walls?: RoomWallsOptions;
  /** Ceiling customization */
  ceiling?: RoomCeilingOptions;
  /** Room lighting */
  lighting?: RoomLightingOptions;
  /** Doorway apertures */
  doors?: DoorConfig[];
  /** Player spawn point inside the room [x, y, z] */
  spawnPoint?: [number, number, number];
}

/**
 * Walkable axis-aligned bounding box for collision detection.
 */
export interface WalkableAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Doorway aperture opening allowing movement across walls.
 */
export interface DoorAperture {
  wall: WallDirection;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Configuration options for connecting two rooms with an automatic corridor.
 */
export interface CorridorOptions {
  /** Width of the corridor in meters (default: 2.4) */
  width?: number;
  /** Height of the corridor in meters (default: 3.0) */
  height?: number;
  /** Theme to inherit or override */
  theme?: RoomTheme;
  /** Whether to add ceiling downlights */
  lighting?: boolean;
}

/**
 * JSON schema for a single room when loading scenarios declaratively.
 */
export interface ScenarioRoomJSON extends XRRoomOptions {
  id: string;
}

/**
 * JSON schema for a corridor connection between rooms.
 */
export interface ScenarioConnectionJSON {
  fromRoom: string;
  fromWall: WallDirection;
  toRoom: string;
  toWall: WallDirection;
  options?: CorridorOptions;
}

/**
 * JSON schema for defining complete multi-room scenarios without writing code.
 */
export interface ScenarioJSON {
  name?: string;
  author?: string;
  rooms: ScenarioRoomJSON[];
  connections?: ScenarioConnectionJSON[];
  defaultSpawnRoom?: string;
}
