import * as THREE from 'three';
import { XRRoom } from './XRRoom.js';
import type {
  XRRoomOptions,
  WallDirection,
  CorridorOptions,
  WalkableAABB,
  ScenarioJSON,
} from './types.js';

interface CorridorData {
  aabb: WalkableAABB;
  group: THREE.Group;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
}

/**
 * XRScenario orchestrates a multi-room virtual architectural layout,
 * managing inter-room corridors, JSON scenario loading, and continuous
 * collision boundaries with wall sliding.
 */
export class XRScenario {
  public name: string;
  public readonly nativeGroup: THREE.Group = new THREE.Group();
  public readonly corridorsGroup: THREE.Group = new THREE.Group();

  private rooms: Map<string, XRRoom> = new Map();
  private corridors: CorridorData[] = [];
  private defaultSpawnRoomId: string | null = null;

  constructor(name: string = 'Scenario') {
    this.name = name;
    this.nativeGroup.name = `XRScenario_${name}`;
    this.nativeGroup.add(this.corridorsGroup);
  }

  /**
   * Adds a new procedural room to the scenario.
   */
  public addRoom(options: XRRoomOptions): XRRoom {
    const room = new XRRoom(options);
    if (this.rooms.has(room.id)) {
      console.warn(`[XRScenario] Room with ID '${room.id}' already exists. Overwriting.`);
      this.removeRoom(room.id);
    }

    this.rooms.set(room.id, room);
    this.nativeGroup.add(room.nativeGroup);

    if (!this.defaultSpawnRoomId) {
      this.defaultSpawnRoomId = room.id;
    }

    return room;
  }

  /**
   * Retrieves a room by its ID.
   */
  public getRoom(id: string): XRRoom | undefined {
    return this.rooms.get(id);
  }

  /**
   * Returns an array of all rooms in the scenario.
   */
  public getAllRooms(): XRRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Removes a room and disposes its 3D assets.
   */
  public removeRoom(id: string): void {
    const room = this.rooms.get(id);
    if (!room) return;

    this.nativeGroup.remove(room.nativeGroup);
    room.dispose();
    this.rooms.delete(id);

    if (this.defaultSpawnRoomId === id) {
      const first = this.rooms.keys().next().value;
      this.defaultSpawnRoomId = first || null;
    }
  }

  /**
   * Connects two rooms with an automatic covered corridor linking their respective doorways.
   *
   * @param fromRoomId ID of the starting room
   * @param fromWall Wall direction on starting room ('north', 'south', 'east', 'west')
   * @param toRoomId ID of the destination room
   * @param toWall Wall direction on destination room
   * @param options Corridor styling and dimensions
   */
  public connectRooms(
    fromRoomId: string,
    fromWall: WallDirection,
    toRoomId: string,
    toWall: WallDirection,
    options: CorridorOptions = {}
  ): void {
    const roomA = this.rooms.get(fromRoomId);
    const roomB = this.rooms.get(toRoomId);

    if (!roomA || !roomB) {
      console.warn(`[XRScenario] Cannot connect rooms: '${fromRoomId}' or '${toRoomId}' not found.`);
      return;
    }

    const corridorW = options.width ?? 2.4;
    const corridorH = options.height ?? 3.0;
    const t = 0.2;

    // Calculate door edge coordinates
    let startX = roomA.center.x;
    let startZ = roomA.center.z;
    if (fromWall === 'north') startZ -= roomA.dimensions.depth / 2;
    else if (fromWall === 'south') startZ += roomA.dimensions.depth / 2;
    else if (fromWall === 'west') startX -= roomA.dimensions.width / 2;
    else if (fromWall === 'east') startX += roomA.dimensions.width / 2;

    let endX = roomB.center.x;
    let endZ = roomB.center.z;
    if (toWall === 'north') endZ -= roomB.dimensions.depth / 2;
    else if (toWall === 'south') endZ += roomB.dimensions.depth / 2;
    else if (toWall === 'west') endX -= roomB.dimensions.width / 2;
    else if (toWall === 'east') endX += roomB.dimensions.width / 2;

    // Determine corridor orientation (Z-axis corridor or X-axis corridor)
    const isZAligned = Math.abs(endZ - startZ) >= Math.abs(endX - startX);

    const group = new THREE.Group();
    group.name = `corridor_${fromRoomId}_to_${toRoomId}`;
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.1,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });
    materials.push(floorMat, wallMat, ceilingMat);

    let aabb: WalkableAABB;

    if (isZAligned) {
      const minZ = Math.min(startZ, endZ);
      const maxZ = Math.max(startZ, endZ);
      const lengthZ = Math.max(0.5, maxZ - minZ);
      const midZ = (minZ + maxZ) / 2;
      const midX = (startX + endX) / 2;

      // Floor
      const fGeo = new THREE.BoxGeometry(corridorW, 0.2, lengthZ);
      geometries.push(fGeo);
      const fMesh = new THREE.Mesh(fGeo, floorMat);
      fMesh.position.set(midX, -0.1, midZ);
      fMesh.receiveShadow = true;
      group.add(fMesh);

      // Ceiling
      const cGeo = new THREE.BoxGeometry(corridorW, 0.2, lengthZ);
      geometries.push(cGeo);
      const cMesh = new THREE.Mesh(cGeo, ceilingMat);
      cMesh.position.set(midX, corridorH + 0.1, midZ);
      group.add(cMesh);

      // Left Wall (West)
      const wLeftGeo = new THREE.BoxGeometry(t, corridorH, lengthZ);
      geometries.push(wLeftGeo);
      const wLeft = new THREE.Mesh(wLeftGeo, wallMat);
      wLeft.position.set(midX - corridorW / 2 + t / 2, corridorH / 2, midZ);
      wLeft.castShadow = true;
      wLeft.receiveShadow = true;
      group.add(wLeft);

      // Right Wall (East)
      const wRightGeo = new THREE.BoxGeometry(t, corridorH, lengthZ);
      geometries.push(wRightGeo);
      const wRight = new THREE.Mesh(wRightGeo, wallMat);
      wRight.position.set(midX + corridorW / 2 - t / 2, corridorH / 2, midZ);
      wRight.castShadow = true;
      wRight.receiveShadow = true;
      group.add(wRight);

      // Lighting
      if (options.lighting !== false) {
        const light = new THREE.PointLight(0x38bdf8, 1.2, lengthZ * 1.5, 1.0);
        light.position.set(midX, corridorH - 0.3, midZ);
        group.add(light);
      }

      // Generous overlap reaching 2.0m into both connected rooms to guarantee seamless passage
      const corridorReach = 2.0;
      aabb = {
        minX: midX - corridorW / 2 + 0.15,
        maxX: midX + corridorW / 2 - 0.15,
        minZ: minZ - corridorReach,
        maxZ: maxZ + corridorReach,
      };
    } else {
      // X-aligned corridor
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const lengthX = Math.max(0.5, maxX - minX);
      const midX = (minX + maxX) / 2;
      const midZ = (startZ + endZ) / 2;

      // Floor
      const fGeo = new THREE.BoxGeometry(lengthX, 0.2, corridorW);
      geometries.push(fGeo);
      const fMesh = new THREE.Mesh(fGeo, floorMat);
      fMesh.position.set(midX, -0.1, midZ);
      fMesh.receiveShadow = true;
      group.add(fMesh);

      // Ceiling
      const cGeo = new THREE.BoxGeometry(lengthX, 0.2, corridorW);
      geometries.push(cGeo);
      const cMesh = new THREE.Mesh(cGeo, ceilingMat);
      cMesh.position.set(midX, corridorH + 0.1, midZ);
      group.add(cMesh);

      // North Wall
      const wNorthGeo = new THREE.BoxGeometry(lengthX, corridorH, t);
      geometries.push(wNorthGeo);
      const wNorth = new THREE.Mesh(wNorthGeo, wallMat);
      wNorth.position.set(midX, corridorH / 2, midZ - corridorW / 2 + t / 2);
      wNorth.castShadow = true;
      wNorth.receiveShadow = true;
      group.add(wNorth);

      // South Wall
      const wSouthGeo = new THREE.BoxGeometry(lengthX, corridorH, t);
      geometries.push(wSouthGeo);
      const wSouth = new THREE.Mesh(wSouthGeo, wallMat);
      wSouth.position.set(midX, corridorH / 2, midZ + corridorW / 2 - t / 2);
      wSouth.castShadow = true;
      wSouth.receiveShadow = true;
      group.add(wSouth);

      // Lighting
      if (options.lighting !== false) {
        const light = new THREE.PointLight(0x38bdf8, 1.2, lengthX * 1.5, 1.0);
        light.position.set(midX, corridorH - 0.3, midZ);
        group.add(light);
      }

      // Generous overlap reaching 2.0m into both connected rooms to guarantee seamless passage
      const corridorReach = 2.0;
      aabb = {
        minX: minX - corridorReach,
        maxX: maxX + corridorReach,
        minZ: midZ - corridorW / 2 + 0.15,
        maxZ: midZ + corridorW / 2 - 0.15,
      };
    }

    this.corridorsGroup.add(group);
    this.corridors.push({
      aabb,
      group,
      materials,
      geometries,
    });
  }

  /**
   * Checks whether a 2D position (X, Z) is inside any room or connecting corridor.
   */
  public isWalkable(pos: THREE.Vector3, margin: number = 0.35): boolean {
    // 1. Check rooms
    for (const room of this.rooms.values()) {
      if (room.containsPoint(pos.x, pos.z, margin)) {
        return true;
      }
    }

    // 2. Check corridors
    for (const c of this.corridors) {
      if (
        pos.x >= c.aabb.minX &&
        pos.x <= c.aabb.maxX &&
        pos.z >= c.aabb.minZ &&
        pos.z <= c.aabb.maxZ
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Constrains player / camera movement inside walkable scenario boundaries.
   * If the proposed position hits a wall, automatically slides along valid axes.
   *
   * @param currentPos Current valid position
   * @param proposedPos Desired target position
   * @param radius Player collision radius in meters (default: 0.35)
   * @returns Clamped safe position
   */
  public clampMovement(
    currentPos: THREE.Vector3,
    proposedPos: THREE.Vector3,
    radius: number = 0.35
  ): THREE.Vector3 {
    // If entire movement is valid, accept it directly
    if (this.isWalkable(proposedPos, radius)) {
      return proposedPos.clone();
    }

    // Attempt sliding along X axis
    const tryX = new THREE.Vector3(proposedPos.x, proposedPos.y, currentPos.z);
    if (this.isWalkable(tryX, radius)) {
      return tryX;
    }

    // Attempt sliding along Z axis
    const tryZ = new THREE.Vector3(currentPos.x, proposedPos.y, proposedPos.z);
    if (this.isWalkable(tryZ, radius)) {
      return tryZ;
    }

    // If completely blocked, retain current safe position
    return currentPos.clone();
  }

  /**
   * Loads and builds an entire multi-room scenario from a declarative JSON configuration.
   */
  public loadFromJSON(json: ScenarioJSON): void {
    if (json.name) this.name = json.name;

    // 1. Clear existing scenario elements
    this.clear();

    // 2. Create rooms
    if (Array.isArray(json.rooms)) {
      for (const rOptions of json.rooms) {
        this.addRoom(rOptions);
      }
    }

    // 3. Connect rooms with corridors
    if (Array.isArray(json.connections)) {
      for (const conn of json.connections) {
        this.connectRooms(
          conn.fromRoom,
          conn.fromWall,
          conn.toRoom,
          conn.toWall,
          conn.options
        );
      }
    }

    if (json.defaultSpawnRoom) {
      this.defaultSpawnRoomId = json.defaultSpawnRoom;
    }
  }

  /**
   * Loads a declarative scenario JSON file from a remote or local URL.
   */
  public async loadFromURL(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`[XRScenario] Failed to fetch scenario from '${url}': ${response.statusText}`);
    }
    const data: ScenarioJSON = await response.json();
    this.loadFromJSON(data);
  }

  /**
   * Gets the spawn position for the default or specified room.
   */
  public getSpawnPosition(roomId?: string): THREE.Vector3 {
    const targetId = roomId || this.defaultSpawnRoomId;
    if (targetId) {
      const room = this.rooms.get(targetId);
      if (room) {
        return room.getSpawnPosition();
      }
    }
    return new THREE.Vector3(0, 1.6, 0);
  }

  /**
   * Clears all rooms, corridors, geometries, and materials.
   */
  public clear(): void {
    for (const room of this.rooms.values()) {
      this.nativeGroup.remove(room.nativeGroup);
      room.dispose();
    }
    this.rooms.clear();

    for (const c of this.corridors) {
      this.corridorsGroup.remove(c.group);
      for (const g of c.geometries) g.dispose();
      for (const m of c.materials) m.dispose();
    }
    this.corridors = [];
    this.corridorsGroup.clear();
    this.defaultSpawnRoomId = null;
  }

  /**
   * Completely disposes the scenario from memory.
   */
  public dispose(): void {
    this.clear();
    this.nativeGroup.clear();
  }
}
