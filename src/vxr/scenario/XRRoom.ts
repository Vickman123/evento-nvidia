import * as THREE from 'three';
import type {
  XRRoomOptions,
  XRRoomDimensions,
  RoomTheme,
  WallDirection,
  DoorConfig,
  WalkableAABB,
  DoorAperture,
} from './types.js';

interface ThemeDefinition {
  floorColor: number;
  floorRoughness: number;
  floorMetalness: number;
  wallColor: number;
  wallRoughness: number;
  trimColor: number;
  ceilingColor: number;
  lightColor: number;
  lightIntensity: number;
  grid?: boolean;
}

const THEMES: Record<RoomTheme, ThemeDefinition> = {
  gallery: {
    floorColor: 0xe2d9cc,
    floorRoughness: 0.45,
    floorMetalness: 0.05,
    wallColor: 0xf8fafc,
    wallRoughness: 0.9,
    trimColor: 0xcbd5e1,
    ceilingColor: 0xffffff,
    lightColor: 0xfff7ed,
    lightIntensity: 1.6,
  },
  scifi: {
    floorColor: 0x0f172a,
    floorRoughness: 0.3,
    floorMetalness: 0.6,
    wallColor: 0x1e293b,
    wallRoughness: 0.55,
    trimColor: 0x00f0ff,
    ceilingColor: 0x090d16,
    lightColor: 0x38bdf8,
    lightIntensity: 1.8,
    grid: true,
  },
  office: {
    floorColor: 0x334155,
    floorRoughness: 0.8,
    floorMetalness: 0.05,
    wallColor: 0xf1f5f9,
    wallRoughness: 0.85,
    trimColor: 0x94a3b8,
    ceilingColor: 0xffffff,
    lightColor: 0xffffff,
    lightIntensity: 1.5,
  },
  cozy: {
    floorColor: 0x78350f,
    floorRoughness: 0.6,
    floorMetalness: 0.05,
    wallColor: 0xfef3c7,
    wallRoughness: 0.9,
    trimColor: 0x92400e,
    ceilingColor: 0xfffbeb,
    lightColor: 0xfef08a,
    lightIntensity: 1.4,
  },
  minimal: {
    floorColor: 0x18181b,
    floorRoughness: 0.4,
    floorMetalness: 0.2,
    wallColor: 0x27272a,
    wallRoughness: 0.7,
    trimColor: 0x52525b,
    ceilingColor: 0x09090b,
    lightColor: 0xffffff,
    lightIntensity: 1.4,
  },
};

/**
 * XRRoom builds and encapsulates a fully realized 3D room with procedural
 * geometry, automated wall and doorway cutouts, ceiling lamps, and collision bounds.
 */
export class XRRoom {
  public readonly id: string;
  public readonly name: string;
  public readonly dimensions: XRRoomDimensions;
  public readonly center: THREE.Vector3;
  public readonly theme: RoomTheme;

  /** Root Three.js group containing all room meshes and lighting */
  public readonly nativeGroup: THREE.Group = new THREE.Group();

  /** Wall thickness in meters */
  public readonly wallThickness: number = 0.25;

  /** Door apertures registered in this room */
  public readonly doorApertures: DoorAperture[] = [];

  /** Door configurations attached to this room */
  public readonly doors: DoorConfig[] = [];

  /** Meshes added to the room */
  public readonly meshes: THREE.Mesh[] = [];

  /** Point light or spotlight illuminating the room */
  public ceilingLight: THREE.PointLight | null = null;

  /** Internal materials */
  private materialsToDispose: THREE.Material[] = [];
  private geometriesToDispose: THREE.BufferGeometry[] = [];

  /** Internal spawn point */
  private readonly spawnOffset: [number, number, number];

  constructor(options: XRRoomOptions = {}) {
    this.id = options.id || `room-${Math.random().toString(36).substring(2, 8)}`;
    this.name = options.name || 'Room';
    this.theme = options.theme || 'gallery';

    const dim = options.dimensions || {};
    this.dimensions = {
      width: Math.max(3, dim.width ?? 10),
      depth: Math.max(3, dim.depth ?? 10),
      height: Math.max(2.4, dim.height ?? 3.5),
    };

    const c = options.center || [0, 0, 0];
    this.center = new THREE.Vector3(c[0], c[1], c[2]);
    this.nativeGroup.position.copy(this.center);
    this.nativeGroup.name = `XRRoom_${this.id}`;

    this.spawnOffset = options.spawnPoint || [0, 1.6, 0];

    if (options.doors) {
      this.doors = [...options.doors];
    }

    this.build(options);
  }

  /**
   * Constructs floor, walls with doorway cutouts, ceiling, and lighting.
   */
  private build(options: XRRoomOptions): void {
    const tDef = THEMES[this.theme] || THEMES.gallery;
    const { width, depth, height } = this.dimensions;
    const t = this.wallThickness;

    // 1. Floor Material & Geometry
    const floorColor = options.floor?.color ?? tDef.floorColor;
    const floorRoughness = options.floor?.roughness ?? tDef.floorRoughness;
    const floorMetalness = options.floor?.metalness ?? tDef.floorMetalness;

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: floorRoughness,
      metalness: floorMetalness,
    });
    this.materialsToDispose.push(floorMat);

    const floorGeo = new THREE.BoxGeometry(width, 0.2, depth);
    this.geometriesToDispose.push(floorGeo);

    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.1, 0);
    floorMesh.receiveShadow = true;
    floorMesh.name = `${this.id}_floor`;
    this.nativeGroup.add(floorMesh);
    this.meshes.push(floorMesh);

    // Optional Grid on floor
    const hasGrid = options.floor?.grid ?? tDef.grid;
    if (hasGrid) {
      const grid = new THREE.GridHelper(Math.max(width, depth), Math.round(Math.max(width, depth)), 0x00f0ff, 0x1e293b);
      grid.position.set(0, 0.005, 0);
      this.nativeGroup.add(grid);
    }

    // 2. Ceiling Material & Geometry
    if (options.ceiling?.enabled !== false) {
      const ceilingColor = options.ceiling?.color ?? tDef.ceilingColor;
      const ceilingMat = new THREE.MeshStandardMaterial({
        color: ceilingColor,
        roughness: 0.85,
        metalness: 0.05,
      });
      this.materialsToDispose.push(ceilingMat);

      const ceilingGeo = new THREE.BoxGeometry(width, 0.2, depth);
      this.geometriesToDispose.push(ceilingGeo);

      const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
      ceilingMesh.position.set(0, height + 0.1, 0);
      ceilingMesh.name = `${this.id}_ceiling`;
      this.nativeGroup.add(ceilingMesh);
      this.meshes.push(ceilingMesh);

      // Lamp fixture
      if (options.ceiling?.lamps !== false) {
        const fixtureMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: options.lighting?.color ?? tDef.lightColor,
          emissiveIntensity: 0.6,
          roughness: 0.3,
        });
        this.materialsToDispose.push(fixtureMat);

        const fixtureGeo = new THREE.BoxGeometry(1.6, 0.08, 0.8);
        this.geometriesToDispose.push(fixtureGeo);

        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(0, height - 0.04, 0);
        this.nativeGroup.add(fixture);
      }
    }

    // 3. Wall Material
    const wallColor = options.walls?.color ?? tDef.wallColor;
    const wallRoughness = options.walls?.roughness ?? tDef.wallRoughness;
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: wallRoughness,
      metalness: 0.05,
    });
    this.materialsToDispose.push(wallMat);

    // Decorative trim material
    const trimColor = options.walls?.trimColor ?? tDef.trimColor;
    const trimMat = new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.4,
      metalness: 0.4,
    });
    this.materialsToDispose.push(trimMat);

    // 4. Build 4 Walls with automatic doorway aperture calculations
    this.buildWall('north', width, depth, height, t, wallMat, trimMat);
    this.buildWall('south', width, depth, height, t, wallMat, trimMat);
    this.buildWall('east', width, depth, height, t, wallMat, trimMat);
    this.buildWall('west', width, depth, height, t, wallMat, trimMat);

    // 5. Room Lighting
    if (options.lighting?.enabled !== false) {
      const lightColor = options.lighting?.color ?? tDef.lightColor;
      const lightIntensity = options.lighting?.intensity ?? tDef.lightIntensity;
      const lightDistance = Math.max(width, depth) * 1.8;

      const pLight = new THREE.PointLight(lightColor, lightIntensity, lightDistance, 1.0);
      pLight.position.set(0, height - 0.4, 0);
      pLight.castShadow = true;
      pLight.shadow.mapSize.width = 1024;
      pLight.shadow.mapSize.height = 1024;
      pLight.shadow.bias = -0.0003;
      this.ceilingLight = pLight;
      this.nativeGroup.add(pLight);
    }
  }

  /**
   * Generates a single wall, automatically creating left/right/header segments if a door exists.
   */
  private buildWall(
    direction: WallDirection,
    roomW: number,
    roomD: number,
    roomH: number,
    t: number,
    wallMat: THREE.Material,
    trimMat: THREE.Material
  ): void {
    const door = this.doors.find((d) => d.wall === direction);

    if (!door) {
      // Solid continuous wall
      let geo: THREE.BufferGeometry;
      let x = 0;
      let z = 0;

      if (direction === 'north' || direction === 'south') {
        geo = new THREE.BoxGeometry(roomW, roomH, t);
        z = direction === 'north' ? -roomD / 2 : roomD / 2;
      } else {
        geo = new THREE.BoxGeometry(t, roomH, roomD);
        x = direction === 'west' ? -roomW / 2 : roomW / 2;
      }

      this.geometriesToDispose.push(geo);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, roomH / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `${this.id}_wall_${direction}`;
      this.nativeGroup.add(mesh);
      this.meshes.push(mesh);
      return;
    }

    // Doorway present: partition wall into left, right, and lintel
    const dw = Math.min(door.width ?? 2.2, (direction === 'north' || direction === 'south' ? roomW : roomD) - 1.0);
    const dh = Math.min(door.height ?? 2.6, roomH - 0.4);
    const offset = door.offset ?? 0;
    const wallLength = direction === 'north' || direction === 'south' ? roomW : roomD;

    const leftLen = (wallLength / 2 + offset) - dw / 2;
    const rightLen = (wallLength / 2 - offset) - dw / 2;
    const lintelH = roomH - dh;

    // Build wall parts
    if (direction === 'north' || direction === 'south') {
      const zPos = direction === 'north' ? -roomD / 2 : roomD / 2;

      // Left segment
      if (leftLen > 0.05) {
        const leftGeo = new THREE.BoxGeometry(leftLen, roomH, t);
        this.geometriesToDispose.push(leftGeo);
        const leftMesh = new THREE.Mesh(leftGeo, wallMat);
        leftMesh.position.set(-roomW / 2 + leftLen / 2, roomH / 2, zPos);
        leftMesh.castShadow = true;
        leftMesh.receiveShadow = true;
        this.nativeGroup.add(leftMesh);
        this.meshes.push(leftMesh);
      }

      // Right segment
      if (rightLen > 0.05) {
        const rightGeo = new THREE.BoxGeometry(rightLen, roomH, t);
        this.geometriesToDispose.push(rightGeo);
        const rightMesh = new THREE.Mesh(rightGeo, wallMat);
        rightMesh.position.set(roomW / 2 - rightLen / 2, roomH / 2, zPos);
        rightMesh.castShadow = true;
        rightMesh.receiveShadow = true;
        this.nativeGroup.add(rightMesh);
        this.meshes.push(rightMesh);
      }

      // Lintel over door
      if (lintelH > 0.05) {
        const lintelGeo = new THREE.BoxGeometry(dw, lintelH, t);
        this.geometriesToDispose.push(lintelGeo);
        const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
        lintelMesh.position.set(offset, dh + lintelH / 2, zPos);
        lintelMesh.castShadow = true;
        lintelMesh.receiveShadow = true;
        this.nativeGroup.add(lintelMesh);
        this.meshes.push(lintelMesh);
      }

      // Decorative doorway jambs
      const jambGeo = new THREE.BoxGeometry(0.08, dh, t * 1.15);
      this.geometriesToDispose.push(jambGeo);
      const leftJamb = new THREE.Mesh(jambGeo, trimMat);
      leftJamb.position.set(offset - dw / 2 + 0.04, dh / 2, zPos);
      const rightJamb = new THREE.Mesh(jambGeo, trimMat);
      rightJamb.position.set(offset + dw / 2 - 0.04, dh / 2, zPos);
      // Register doorway aperture in world coordinates.
      // Must extend generously into the room (to overlap with main walkable bounds)
      // and into the corridor/exterior so player never hits an invisible boundary.
      const worldCenterZ = this.center.z + zPos;
      const doorClearanceMargin = 0.15;
      const halfPassageWidth = Math.max(0.4, dw / 2 - doorClearanceMargin);
      const reach = Math.max(2.0, t + 1.5);

      this.doorApertures.push({
        wall: direction,
        minX: this.center.x + offset - halfPassageWidth,
        maxX: this.center.x + offset + halfPassageWidth,
        minZ: worldCenterZ - reach,
        maxZ: worldCenterZ + reach,
      });
    } else {
      // East or West wall
      const xPos = direction === 'west' ? -roomW / 2 : roomW / 2;

      // North side of door
      if (leftLen > 0.05) {
        const sideGeo = new THREE.BoxGeometry(t, roomH, leftLen);
        this.geometriesToDispose.push(sideGeo);
        const sideMesh = new THREE.Mesh(sideGeo, wallMat);
        sideMesh.position.set(xPos, roomH / 2, -roomD / 2 + leftLen / 2);
        sideMesh.castShadow = true;
        sideMesh.receiveShadow = true;
        this.nativeGroup.add(sideMesh);
        this.meshes.push(sideMesh);
      }

      // South side of door
      if (rightLen > 0.05) {
        const sideGeo = new THREE.BoxGeometry(t, roomH, rightLen);
        this.geometriesToDispose.push(sideGeo);
        const sideMesh = new THREE.Mesh(sideGeo, wallMat);
        sideMesh.position.set(xPos, roomH / 2, roomD / 2 - rightLen / 2);
        sideMesh.castShadow = true;
        sideMesh.receiveShadow = true;
        this.nativeGroup.add(sideMesh);
        this.meshes.push(sideMesh);
      }

      // Lintel over door
      if (lintelH > 0.05) {
        const lintelGeo = new THREE.BoxGeometry(t, lintelH, dw);
        this.geometriesToDispose.push(lintelGeo);
        const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
        lintelMesh.position.set(xPos, dh + lintelH / 2, offset);
        lintelMesh.castShadow = true;
        lintelMesh.receiveShadow = true;
        this.nativeGroup.add(lintelMesh);
        this.meshes.push(lintelMesh);
      }

      // Doorway jambs
      const jambGeo = new THREE.BoxGeometry(t * 1.15, dh, 0.08);
      this.geometriesToDispose.push(jambGeo);
      const topJamb = new THREE.Mesh(jambGeo, trimMat);
      topJamb.position.set(xPos, dh / 2, offset - dw / 2 + 0.04);
      const btmJamb = new THREE.Mesh(jambGeo, trimMat);
      btmJamb.position.set(xPos, dh / 2, offset + dw / 2 - 0.04);
      this.nativeGroup.add(topJamb, btmJamb);

      // Register doorway aperture in world coordinates.
      const worldCenterX = this.center.x + xPos;
      const doorClearanceMargin = 0.15;
      const halfPassageWidth = Math.max(0.4, dw / 2 - doorClearanceMargin);
      const reach = Math.max(2.0, t + 1.5);

      this.doorApertures.push({
        wall: direction,
        minX: worldCenterX - reach,
        maxX: worldCenterX + reach,
        minZ: this.center.z + offset - halfPassageWidth,
        maxZ: this.center.z + offset + halfPassageWidth,
      });
    }
  }

  /**
   * Returns the primary walkable AABB boundary inside the room.
   */
  public getWalkableBounds(margin: number = 0.35): WalkableAABB {
    const halfW = this.dimensions.width / 2 - this.wallThickness - margin;
    const halfD = this.dimensions.depth / 2 - this.wallThickness - margin;

    return {
      minX: this.center.x - halfW,
      maxX: this.center.x + halfW,
      minZ: this.center.z - halfD,
      maxZ: this.center.z + halfD,
    };
  }

  /**
   * Checks whether a 2D world coordinate (X, Z) is within this room's walkable area
   * or inside one of its doorway exit apertures.
   */
  public containsPoint(x: number, z: number, margin: number = 0.35): boolean {
    const bounds = this.getWalkableBounds(margin);
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
      return true;
    }

    // Check if the point is passing through an active doorway aperture
    for (const ap of this.doorApertures) {
      if (x >= ap.minX && x <= ap.maxX && z >= ap.minZ && z <= ap.maxZ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculates the global 3D world coordinates for the player spawn position.
   */
  public getSpawnPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.center.x + this.spawnOffset[0],
      this.center.y + this.spawnOffset[1],
      this.center.z + this.spawnOffset[2]
    );
  }

  /**
   * Adds an arbitrary 3D model, prop, or furniture to the room relative to its center.
   */
  public addDecoration(
    object: THREE.Object3D,
    relativePosition: [number, number, number] = [0, 0, 0]
  ): void {
    object.position.set(relativePosition[0], relativePosition[1], relativePosition[2]);
    this.nativeGroup.add(object);
  }

  /**
   * Disposes geometries and materials to avoid memory leaks.
   */
  public dispose(): void {
    for (const g of this.geometriesToDispose) g.dispose();
    for (const m of this.materialsToDispose) m.dispose();
    this.geometriesToDispose = [];
    this.materialsToDispose = [];
    this.nativeGroup.clear();
  }
}
