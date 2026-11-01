import * as THREE from 'three';

/**
 * Vegetación y entorno natural de Ciudad Universitaria:
 * - Praderas de "Las Islas" con pasto cortado e iluminación suave.
 * - Formaciones de roca volcánica basalto del Pedregal de San Ángel.
 * - Jacarandas emblemáticas de flor morada y fresnos universitarios.
 * - Optimizado con geometrías compartidas para bajo conteo de polígonos en Meta Quest.
 */
export class Vegetation {
  public readonly group: THREE.Group;
  private sharedGeometries: THREE.BufferGeometry[] = [];
  private sharedMaterials: THREE.Material[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'VXR_UNAM_Vegetation';

    this.buildLasIslasLawns();
    this.buildPedregalVolcanicRocks();
    this.buildJacarandaTrees();
    this.buildFresnoTrees();
  }

  /**
   * Grandes extensiones de áreas verdes ("Las Islas").
   */
  private buildLasIslasLawns(): void {
    // Plano principal de césped universitario
    const lawnGeo = new THREE.PlaneGeometry(240, 240, 16, 16);
    const lawnMat = new THREE.MeshStandardMaterial({
      color: 0x486b36, // Verde pasto natural
      roughness: 0.9,
      metalness: 0.05,
    });
    this.sharedGeometries.push(lawnGeo);
    this.sharedMaterials.push(lawnMat);

    const lawnMesh = new THREE.Mesh(lawnGeo, lawnMat);
    lawnMesh.rotation.x = -Math.PI / 2;
    lawnMesh.position.y = 0.0;
    lawnMesh.receiveShadow = true;
    this.group.add(lawnMesh);

    // Pequeñas colinas / desniveles verdes perimetrales
    const moundGeo = new THREE.CylinderGeometry(14, 18, 1.2, 16);
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0x3d5d2e,
      roughness: 0.92,
    });
    this.sharedGeometries.push(moundGeo);
    this.sharedMaterials.push(moundMat);

    const moundPositions = [
      [25, 0.4, 25],
      [-28, 0.4, 30],
      [32, 0.4, -20],
      [-35, 0.4, -28],
    ];

    moundPositions.forEach(([x, y, z]) => {
      const mound = new THREE.Mesh(moundGeo, moundMat);
      mound.position.set(x, y, z);
      mound.receiveShadow = true;
      this.group.add(mound);
    });
  }

  /**
   * Formaciones de roca volcánica del Pedregal de San Ángel:
   * Elemento geológico identitario sobre el cual se fundó Ciudad Universitaria.
   */
  private buildPedregalVolcanicRocks(): void {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x221f1d, // Basalto volcánico muy oscuro
      roughness: 0.96,
      metalness: 0.1,
    });
    this.sharedMaterials.push(rockMat);

    const rockGeoA = new THREE.DodecahedronGeometry(1.4, 1);
    const rockGeoB = new THREE.DodecahedronGeometry(2.2, 0);
    this.sharedGeometries.push(rockGeoA, rockGeoB);

    // Grupos de roca volcánica dispuestos alrededor de los andadores
    const rockClusters = [
      [9, 0.6, 6, 1.2, 0.7, 1.1],
      [10.5, 0.8, 5, 0.9, 0.9, 0.9],
      [-8.5, 0.7, 7, 1.4, 0.6, 1.3],
      [-10, 0.5, 8.5, 0.8, 0.5, 0.8],
      [12, 0.7, -8, 1.6, 0.8, 1.2],
      [-14, 0.9, -12, 1.8, 0.7, 1.4],
      [18, 0.6, 15, 1.5, 0.8, 1.5],
      [-22, 0.7, 18, 1.7, 0.9, 1.3],
    ];

    rockClusters.forEach(([x, y, z, sx, sy, sz], idx) => {
      const geo = idx % 2 === 0 ? rockGeoA : rockGeoB;
      const rock = new THREE.Mesh(geo, rockMat);
      rock.position.set(x, y, z);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(Math.sin(x), Math.cos(z), (x * z) % 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    });
  }

  /**
   * Árboles Jacaranda:
   * Troncos estilizados y copas de flor violeta/morada icónicas de la UNAM.
   */
  private buildJacarandaTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x42362b,
      roughness: 0.88,
    });
    const blossomMat = new THREE.MeshStandardMaterial({
      color: 0x7b2cbf, // Violeta jacaranda vibrante
      roughness: 0.7,
      metalness: 0.05,
    });
    const blossomLightMat = new THREE.MeshStandardMaterial({
      color: 0x9d4edd, // Violeta claro para resaltar
      roughness: 0.65,
    });
    this.sharedMaterials.push(trunkMat, blossomMat, blossomLightMat);

    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 4.5, 8);
    const canopyGeo = new THREE.SphereGeometry(2.4, 7, 6);
    this.sharedGeometries.push(trunkGeo, canopyGeo);

    const treePositions = [
      [14, 0, 10],
      [18, 0, 4],
      [16, 0, -12],
      [22, 0, -22],
      [-16, 0, 14],
      [-20, 0, 2],
      [-24, 0, -16],
      [-18, 0, -32],
      [8, 0, 32],
      [-12, 0, 35],
    ];

    treePositions.forEach(([x, _y, z], index) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      // Tronco
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.25;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Copa principal de flores moradas
      const canopy = new THREE.Mesh(canopyGeo, blossomMat);
      canopy.position.y = 5.2;
      canopy.scale.set(1.2, 0.9, 1.2);
      canopy.castShadow = true;
      treeGroup.add(canopy);

      // Copa secundaria para dar volumen asimétrico natural
      const subCanopy = new THREE.Mesh(canopyGeo, blossomLightMat);
      subCanopy.position.set(0.7, 5.8, (index % 2 === 0 ? 0.6 : -0.6));
      subCanopy.scale.set(0.85, 0.8, 0.85);
      treeGroup.add(subCanopy);

      this.group.add(treeGroup);
    });
  }

  /**
   * Fresnos y árboles frondosos verdes del campus.
   */
  private buildFresnoTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d312a, roughness: 0.9 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 });
    this.sharedMaterials.push(trunkMat, greenMat);

    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.55, 5.5, 8);
    const foliageGeo = new THREE.DodecahedronGeometry(3.2, 1);
    this.sharedGeometries.push(trunkGeo, foliageGeo);

    const fresnoPositions = [
      [30, 0, 18],
      [35, 0, -5],
      [-32, 0, 22],
      [-38, 0, -8],
      [4, 0, -42],
      [-14, 0, -45],
    ];

    fresnoPositions.forEach(([x, _y, z]) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.75;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const foliage = new THREE.Mesh(foliageGeo, greenMat);
      foliage.position.y = 6.4;
      foliage.scale.set(1.1, 1.0, 1.1);
      foliage.castShadow = true;
      treeGroup.add(foliage);

      this.group.add(treeGroup);
    });
  }

  public dispose(): void {
    this.sharedGeometries.forEach((g) => g.dispose());
    this.sharedGeometries.length = 0;

    this.sharedMaterials.forEach((m) => m.dispose());
    this.sharedMaterials.length = 0;

    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      }
    });
    this.group.clear();
  }
}
