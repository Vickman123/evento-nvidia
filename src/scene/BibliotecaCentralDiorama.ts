import * as THREE from 'three';

/**
 * BibliotecaCentralDiorama: Recreación arquitectónica de alta fidelidad
 * del escenario de la Biblioteca Central y la Plaza de Ciudad Universitaria (UNAM).
 * Diseñado exactamente con la composición, escala, jardines, jacarandas,
 * muro de relieves prehispánicos y podio de maqueta institucional solicitado por el usuario.
 */
export class BibliotecaCentralDiorama {
  public readonly group: THREE.Group;
  private textures: THREE.Texture[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'UNAM_Biblioteca_Central_Diorama';

    // 1. Podio base de maqueta arquitectónica
    this.buildPodiumBase();

    // 2. Plaza central pavimentada (donde se ubica el observador)
    this.buildCentralPlaza();

    // 3. Muro de piedra volcánica con relieves prehispánicos (flanco derecho)
    this.buildVolcanicReliefWall();

    // 4. Jardineras laterales, césped y andadores
    this.buildGardensAndPlanters();

    // 5. Arbolado: Jacarandas floridas y árboles de sombra
    this.buildTreesAndJacarandas();

    // 6. Mobiliario urbano: Farolas/luminarias y bancas universitarias
    this.buildCampusFurniture();

    // 7. Edificio monumental de la Biblioteca Central de la UNAM
    this.buildBibliotecaCentralBuilding();
  }

  /**
   * 1. Podio base de la maqueta arquitectónica (pedestal con bordes biselados oscuros)
   */
  private buildPodiumBase(): void {
    const podiumGroup = new THREE.Group();
    podiumGroup.name = 'Podium_Base';

    const width = 56;
    const depth = 64;
    const height = 2.4;

    // Cuerpo principal del podio (Y: -2.4 a 0)
    const baseGeo = new THREE.BoxGeometry(width, height, depth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x181e26, // Antracita oscuro mate
      roughness: 0.85,
      metalness: 0.15,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -height / 2, -4);
    baseMesh.receiveShadow = true;
    podiumGroup.add(baseMesh);

    // Borde biselado perimetral superior (chamfer)
    const bevelMat = new THREE.MeshStandardMaterial({
      color: 0x242c38,
      roughness: 0.7,
      metalness: 0.2,
    });
    const rimThickness = 0.6;
    const rimHeight = 0.25;

    // Moldura perimetral
    const northRim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, rimHeight, rimThickness), bevelMat);
    northRim.position.set(0, -rimHeight / 2, -4 - depth / 2);
    podiumGroup.add(northRim);

    const southRim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, rimHeight, rimThickness), bevelMat);
    southRim.position.set(0, -rimHeight / 2, -4 + depth / 2);
    podiumGroup.add(southRim);

    const westRim = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, depth), bevelMat);
    westRim.position.set(-width / 2, -rimHeight / 2, -4);
    podiumGroup.add(westRim);

    const eastRim = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, depth), bevelMat);
    eastRim.position.set(width / 2, -rimHeight / 2, -4);
    podiumGroup.add(eastRim);

    this.group.add(podiumGroup);
  }

  /**
   * 2. Plaza central pavimentada con losetas de terracota y escalinatas de acceso
   */
  private buildCentralPlaza(): void {
    const plazaGroup = new THREE.Group();
    plazaGroup.name = 'Plaza_Central_Pavimentada';

    // Textura procedural de losetas de cantera/terracota con despiece y llagas
    const plazaTex = this.createTerracottaPaversTexture();
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      roughness: 0.88,
      metalness: 0.08,
    });

    // Plano de pavimento de la plaza (ancho: 28m, largo: 28m, centrado frente a la biblioteca)
    const plazaGeo = new THREE.PlaneGeometry(28, 28);
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(0, 0.01, 4);
    plazaMesh.receiveShadow = true;
    plazaGroup.add(plazaMesh);

    // Escalinata frontal (Sur): Acceso amplio con peldaños de cantera
    const stepMat = new THREE.MeshStandardMaterial({
      color: 0x9c553a,
      roughness: 0.85,
    });
    const numFrontSteps = 6;
    const stepWidth = 20;
    const stepDepth = 0.8;
    const stepHeight = 0.18;

    for (let i = 0; i < numFrontSteps; i++) {
      const stepGeo = new THREE.BoxGeometry(stepWidth - i * 0.4, stepHeight, stepDepth);
      const stepMesh = new THREE.Mesh(stepGeo, stepMat);
      stepMesh.position.set(0, -i * stepHeight - stepHeight / 2, 18.2 + i * stepDepth);
      stepMesh.receiveShadow = true;
      plazaGroup.add(stepMesh);
    }

    this.group.add(plazaGroup);
  }

  /**
   * 3. Muro de piedra volcánica con relieves prehispánicos (Flanco derecho de la plaza)
   */
  private buildVolcanicReliefWall(): void {
    const wallGroup = new THREE.Group();
    wallGroup.name = 'Muro_Relieves_Prehispanicos';

    // Posicionado en el flanco este de la plaza
    const wallLength = 22;
    const wallHeight = 2.4;
    const wallThickness = 1.0;

    // Textura de piedra volcánica con glifos y motivos prehispánicos tallados
    const reliefTex = this.createPrehispanicBasReliefTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: reliefTex,
      color: 0x3d352e, // Tono piedra braza volcánica del Pedregal
      roughness: 0.95,
      metalness: 0.05,
    });

    const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, wallLength);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(14.5, wallHeight / 2, 2);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    wallGroup.add(wallMesh);

    // Pasillo / patio hundido lateral a la derecha del muro
    const sunkenPavingMat = new THREE.MeshStandardMaterial({
      color: 0x7a6958,
      roughness: 0.9,
    });
    const sunkenFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 24), sunkenPavingMat);
    sunkenFloor.rotation.x = -Math.PI / 2;
    sunkenFloor.position.set(19, 0.02, 2);
    sunkenFloor.receiveShadow = true;
    wallGroup.add(sunkenFloor);

    this.group.add(wallGroup);
  }

  /**
   * 4. Jardineras laterales, césped y andadores
   */
  private buildGardensAndPlanters(): void {
    const gardensGroup = new THREE.Group();
    gardensGroup.name = 'Jardineras_Y_Andadores';

    // Césped verde esmeralda institucional
    const grassTex = this.createManicuredGrassTexture();
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.95,
      metalness: 0.0,
    });

    // Sardineles de piedra para las jardineras
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xbdb09e,
      roughness: 0.8,
    });

    // Jardinera izquierda (Oeste)
    const westGrass = new THREE.Mesh(new THREE.PlaneGeometry(12, 28), grassMat);
    westGrass.rotation.x = -Math.PI / 2;
    westGrass.position.set(-20.5, 0.15, 4);
    westGrass.receiveShadow = true;
    gardensGroup.add(westGrass);

    // Sardinel contenedor izquierdo
    const westCurb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 28), curbMat);
    westCurb.position.set(-14.3, 0.175, 4);
    westCurb.receiveShadow = true;
    gardensGroup.add(westCurb);

    // Jardinera derecha (Este, detrás del muro de relieves)
    const eastGrass = new THREE.Mesh(new THREE.PlaneGeometry(6, 28), grassMat);
    eastGrass.rotation.x = -Math.PI / 2;
    eastGrass.position.set(24, 0.15, 4);
    eastGrass.receiveShadow = true;
    gardensGroup.add(eastGrass);

    // Césped posterior alrededor de la Biblioteca
    const backGrass = new THREE.Mesh(new THREE.PlaneGeometry(54, 18), grassMat);
    backGrass.rotation.x = -Math.PI / 2;
    backGrass.position.set(0, 0.05, -25);
    backGrass.receiveShadow = true;
    gardensGroup.add(backGrass);

    this.group.add(gardensGroup);
  }

  /**
   * 5. Árboles y Jacarandas floridas de Ciudad Universitaria
   */
  private buildTreesAndJacarandas(): void {
    const treesGroup = new THREE.Group();
    treesGroup.name = 'Jacarandas_Y_Arbolado';

    // 4 Jacarandas floridas con follaje violeta vibrante
    const jacarandaPositions = [
      { x: -18, z: 10, scale: 1.1 },
      { x: -21, z: -3, scale: 1.25 },
      { x: 19, z: 12, scale: 1.05 },
      { x: 23, z: -5, scale: 1.2 },
    ];

    jacarandaPositions.forEach((pos) => {
      const jacaranda = this.createJacarandaTree(pos.scale);
      jacaranda.position.set(pos.x, 0, pos.z);
      treesGroup.add(jacaranda);
    });

    // Árboles verdes de sombra en esquinas y fondo
    const greenTreePositions = [
      { x: -24, z: -18, scale: 1.3 },
      { x: -16, z: -26, scale: 1.4 },
      { x: 16, z: -26, scale: 1.35 },
      { x: 24, z: -18, scale: 1.25 },
      { x: -23, z: 17, scale: 0.95 },
      { x: 24, z: 18, scale: 0.95 },
    ];

    greenTreePositions.forEach((pos) => {
      const tree = this.createShadeTree(pos.scale);
      tree.position.set(pos.x, 0, pos.z);
      treesGroup.add(tree);
    });

    this.group.add(treesGroup);
  }

  /**
   * Crea una Jacaranda con tronco escultural y copa violeta-lila
   */
  private createJacarandaTree(scale: number): THREE.Group {
    const tree = new THREE.Group();

    // Tronco
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e3228, roughness: 0.9 });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3.8, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.9;
    trunk.castShadow = true;
    tree.add(trunk);

    // Copa florecida en lila/violeta
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x8a4fe6, // Violeta jacaranda característico
      roughness: 0.8,
      flatShading: true,
    });

    const puffPositions = [
      [0, 4.2, 0, 2.2],
      [-0.9, 4.0, 0.6, 1.6],
      [0.9, 4.3, -0.5, 1.7],
      [0.2, 5.0, 0.3, 1.5],
      [-0.4, 4.6, -0.7, 1.4],
      [0.6, 3.8, 0.9, 1.3],
    ];

    puffPositions.forEach(([x, y, z, r]) => {
      const puffGeo = new THREE.DodecahedronGeometry(r, 1);
      const puff = new THREE.Mesh(puffGeo, canopyMat);
      puff.position.set(x, y, z);
      puff.castShadow = true;
      puff.receiveShadow = true;
      tree.add(puff);
    });

    tree.scale.set(scale, scale, scale);
    return tree;
  }

  /**
   * Crea un árbol de sombra verde
   */
  private createShadeTree(scale: number): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x42382e, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 4.2, 7), trunkMat);
    trunk.position.y = 2.1;
    trunk.castShadow = true;
    tree.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2e5e24, // Verde bosque natural
      roughness: 0.85,
      flatShading: true,
    });

    const puffs = [
      [0, 4.5, 0, 2.4],
      [-0.8, 4.2, 0.6, 1.8],
      [0.8, 4.4, -0.6, 1.9],
      [0, 5.3, 0.2, 1.7],
    ];

    puffs.forEach(([x, y, z, r]) => {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), foliageMat);
      puff.position.set(x, y, z);
      puff.castShadow = true;
      puff.receiveShadow = true;
      tree.add(puff);
    });

    tree.scale.set(scale, scale, scale);
    return tree;
  }

  /**
   * 6. Mobiliario urbano: Farolas/luminarias y bancas
   */
  private buildCampusFurniture(): void {
    const furnGroup = new THREE.Group();
    furnGroup.name = 'Mobiliario_Urbano_Plaza';

    // Farolas clásicas de Ciudad Universitaria
    const lampPositions = [
      { x: -13.5, z: -8 },
      { x: 13.5, z: -8 },
      { x: -13.5, z: 2 },
      { x: 13.5, z: 2 },
      { x: -13.5, z: 12 },
      { x: 13.5, z: 12 },
    ];

    lampPositions.forEach((pos) => {
      const lamp = this.createCampusLamp();
      lamp.position.set(pos.x, 0, pos.z);
      furnGroup.add(lamp);
    });

    // Bancas universitarias de cantera y madera
    const benchPositions = [
      { x: -13.2, z: -3, rot: Math.PI / 2 },
      { x: -13.2, z: 7, rot: Math.PI / 2 },
      { x: 13.2, z: 7, rot: -Math.PI / 2 },
      { x: 20, z: -2, rot: 0 },
      { x: 20, z: 6, rot: 0 },
    ];

    benchPositions.forEach((pos) => {
      const bench = this.createCampusBench();
      bench.position.set(pos.x, 0, pos.z);
      bench.rotation.y = pos.rot;
      furnGroup.add(bench);
    });

    this.group.add(furnGroup);
  }

  private createCampusLamp(): THREE.Group {
    const lamp = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1d242a, metalness: 0.85, roughness: 0.3 });

    // Poste vertical
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.4, 8), metalMat);
    pole.position.y = 1.7;
    pole.castShadow = true;
    lamp.add(pole);

    // Farol superior
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.15, 0.35, 6), headMat);
    head.position.y = 3.55;
    lamp.add(head);

    // Tapa del farol
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.15, 6), metalMat);
    cap.position.y = 3.8;
    lamp.add(cap);

    return lamp;
  }

  private createCampusBench(): THREE.Group {
    const bench = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a433a, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5229, roughness: 0.7 });

    // Soportes de piedra
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.6), stoneMat);
    legL.position.set(-0.8, 0.225, 0);
    legL.castShadow = true;
    bench.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.6), stoneMat);
    legR.position.set(0.8, 0.225, 0);
    legR.castShadow = true;
    bench.add(legR);

    // Tablón de madera
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.6), woodMat);
    seat.position.set(0, 0.48, 0);
    seat.castShadow = true;
    bench.add(seat);

    return bench;
  }

  /**
   * 7. Biblioteca Central de la UNAM:
   * - Zócalo y escalinatas de acceso (+1.2m)
   * - Lobby de cristal con columnata y alas bajas con losas rojas
   * - Torre monumental de 10 pisos con los 4 murales de Juan O'Gorman
   */
  private buildBibliotecaCentralBuilding(): void {
    const biblioGroup = new THREE.Group();
    biblioGroup.name = 'Biblioteca_Central_Edificio';
    biblioGroup.position.set(0, 0, -20); // Al fondo de la plaza central

    // A. Escalinatas amplias de acceso desde la plaza
    const stepsMat = new THREE.MeshStandardMaterial({ color: 0x4d4239, roughness: 0.9 });
    const accessSteps = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 4), stepsMat);
    accessSteps.position.set(0, 0.6, 8);
    accessSteps.receiveShadow = true;
    biblioGroup.add(accessSteps);

    // B. Plinto / Basamento inferior de piedra volcánica (Y: 0 a 1.2)
    const plinthGeo = new THREE.BoxGeometry(44, 1.2, 28);
    const plinth = new THREE.Mesh(plinthGeo, stepsMat);
    plinth.position.set(0, 0.6, -6);
    plinth.receiveShadow = true;
    biblioGroup.add(plinth);

    // C. Alas bajas de 1 piso con azoteas rojas de tezontle y friso blanco
    const wingRoofMat = new THREE.MeshStandardMaterial({
      color: 0xa83824, // Rojo terracota / tezontle característico
      roughness: 0.85,
    });
    const fasciaMat = new THREE.MeshStandardMaterial({
      color: 0xefede8, // Blanco roto funcionalista
      roughness: 0.5,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x162230,
      metalness: 0.85,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });

    // Cuerpo de planta baja (Lobby y salas de lectura)
    const groundFloorHeight = 3.6;
    const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(42, groundFloorHeight, 26), glassMat);
    groundFloor.position.set(0, 1.2 + groundFloorHeight / 2, -6);
    groundFloor.castShadow = true;
    groundFloor.receiveShadow = true;
    biblioGroup.add(groundFloor);

    // Columnas rojas del lobby
    const colMat = new THREE.MeshStandardMaterial({ color: 0x9e2d1b, roughness: 0.5 });
    for (let c = -18; c <= 18; c += 4.5) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, groundFloorHeight, 0.35), colMat);
      col.position.set(c, 1.2 + groundFloorHeight / 2, 6.9);
      col.castShadow = true;
      biblioGroup.add(col);
    }

    // Cubierta / Azotea roja de la planta baja
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(43.5, 0.4, 27.5), wingRoofMat);
    roofSlab.position.set(0, 1.2 + groundFloorHeight + 0.2, -6);
    roofSlab.receiveShadow = true;
    biblioGroup.add(roofSlab);

    // Pretil blanco de remate perimetral
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(43.8, 0.5, 27.8), fasciaMat);
    parapet.position.set(0, 1.2 + groundFloorHeight + 0.45, -6);
    biblioGroup.add(parapet);

    // D. Torre Monumental de 10 pisos con los 4 murales de mosaico de Juan O'Gorman
    const towerWidth = 24;
    const towerHeight = 22;
    const towerDepth = 14;

    const texSouth = this.createMuralTexture('Sur', '#c28524');
    const texNorth = this.createMuralTexture('Norte', '#2d5a88');
    const texEast = this.createMuralTexture('Este', '#a63820');
    const texWest = this.createMuralTexture('Oeste', '#4a6b3d');

    const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth);
    const stoneEdgeMat = new THREE.MeshStandardMaterial({ color: 0x8a7258, roughness: 0.85 });

    const towerMaterials: THREE.Material[] = [
      new THREE.MeshStandardMaterial({ map: texEast, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ map: texWest, roughness: 0.85 }),
      wingRoofMat, // Azotea de la torre
      stoneEdgeMat,
      new THREE.MeshStandardMaterial({ map: texSouth, roughness: 0.85 }), // Sur (Viendo directamente a la plaza)
      new THREE.MeshStandardMaterial({ map: texNorth, roughness: 0.85 }),
    ];

    const towerMesh = new THREE.Mesh(towerGeo, towerMaterials);
    towerMesh.position.set(0, 1.2 + groundFloorHeight + 0.4 + towerHeight / 2, -6);
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    biblioGroup.add(towerMesh);

    // E. Remate escalonado superior en la azotea de la torre
    const crownGeo = new THREE.BoxGeometry(16, 2.0, 8);
    const crown = new THREE.Mesh(crownGeo, fasciaMat);
    crown.position.set(0, 1.2 + groundFloorHeight + 0.4 + towerHeight + 1.0, -6);
    crown.castShadow = true;
    biblioGroup.add(crown);

    this.group.add(biblioGroup);
  }

  /**
   * Genera la textura de losetas de terracota / cantera de la plaza central
   */
  private createTerracottaPaversTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Fondo base arena
    ctx.fillStyle = '#442a1d';
    ctx.fillRect(0, 0, 1024, 1024);

    const cols = 16;
    const rows = 16;
    const tileW = 1024 / cols;
    const tileH = 1024 / rows;
    const shades = ['#ad4e30', '#ba5838', '#994125', '#c76442', '#a0472b', '#8f3b20'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
        ctx.fillRect(c * tileW + 2, r * tileH + 2, tileW - 4, tileH - 4);

        // Textura fina de piedra porosa
        if (Math.random() > 0.5) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.fillRect(c * tileW + 4, r * tileH + 4, tileW - 8, tileH - 8);
        }
      }
    }

    // Cuadrícula arquitectónica mayor cada 4 losas
    ctx.strokeStyle = '#2b180f';
    ctx.lineWidth = 6;
    for (let x = 0; x <= 1024; x += tileW * 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += tileH * 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    this.textures.push(tex);
    return tex;
  }

  /**
   * Genera el mural de relieves prehispánicos tallados en piedra volcánica
   */
  private createPrehispanicBasReliefTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2d2722';
    ctx.fillRect(0, 0, 1024, 256);

    // Glifos tallados en piedra oscura con sombras simuladas
    ctx.strokeStyle = '#181411';
    ctx.lineWidth = 8;
    ctx.fillStyle = '#3f3630';

    for (let x = 32; x < 1000; x += 128) {
      // Relieve circular / serpiente emplumada
      ctx.beginPath();
      ctx.arc(x + 48, 128, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();

      // Motivos prehispánicos geométricos
      ctx.beginPath();
      ctx.rect(x + 20, 80, 56, 96);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 20, 128);
      ctx.lineTo(x + 76, 128);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    this.textures.push(tex);
    return tex;
  }

  /**
   * Césped verde esmeralda
   */
  private createManicuredGrassTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#446e2a';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#558835' : '#395c22';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.textures.push(tex);
    return tex;
  }

  /**
   * Genera los murales de Juan O'Gorman en alta resolución con sus símbolos cósmicos
   */
  private createMuralTexture(facadeName: string, primaryColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1536;
    const ctx = canvas.getContext('2d')!;

    // Fondo ocre de piedra natural
    ctx.fillStyle = '#b3956e';
    ctx.fillRect(0, 0, 2048, 1536);

    // Piedras de colores del mosaico
    const tileSize = 24;
    const colors = ['#8f2814', '#c98a28', '#264653', '#e76f51', '#2a9d8f', '#e9c46a', '#1d3557', '#3d261a'];
    for (let y = 0; y < 1536; y += tileSize) {
      for (let x = 0; x < 2048; x += tileSize) {
        if (Math.random() > 0.45) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
      }
    }

    // Gran Sol / Cosmograma central de Juan O'Gorman
    ctx.save();
    ctx.translate(1024, 768);

    // Círculo astronómico central
    ctx.beginPath();
    ctx.arc(0, 0, 340, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.lineWidth = 28;
    ctx.strokeStyle = '#221812';
    ctx.stroke();

    // Círculo concéntrico interior
    ctx.beginPath();
    ctx.arc(0, 0, 220, 0, Math.PI * 2);
    ctx.fillStyle = '#dfb542';
    ctx.fill();
    ctx.stroke();

    // Rayos cósmicos solares
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#8f2814';
    for (let a = 0; a < 24; a++) {
      const angle = (a / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 220, Math.sin(angle) * 220);
      ctx.lineTo(Math.cos(angle) * 340, Math.sin(angle) * 340);
      ctx.stroke();
    }

    // Órbitas ptolemaicas y copernicanas laterales
    [-540, 540].forEach((ox) => {
      ctx.beginPath();
      ctx.arc(ox, -80, 190, 0, Math.PI * 2);
      ctx.fillStyle = '#264653';
      ctx.fill();
      ctx.strokeStyle = '#dfb542';
      ctx.lineWidth = 12;
      ctx.stroke();

      // Motivos mesoamericanos
      ctx.beginPath();
      ctx.arc(ox, -80, 110, 0, Math.PI * 2);
      ctx.fillStyle = '#8f2814';
      ctx.fill();
      ctx.stroke();
    });

    // Friso superior ornamental de grecas
    ctx.restore();
    ctx.fillStyle = '#1c140e';
    ctx.fillRect(80, 80, 1888, 110);
    ctx.fillStyle = '#dfb542';
    ctx.font = 'bold 52px serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO', 1024, 155);

    const tex = new THREE.CanvasTexture(canvas);
    this.textures.push(tex);
    return tex;
  }

  public dispose(): void {
    this.textures.forEach((tex) => tex.dispose());
    this.textures.length = 0;

    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      }
    });
    this.group.clear();
  }
}
