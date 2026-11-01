import * as THREE from 'three';

/**
 * Representación arquitectónica estilizada y optimizada de Ciudad Universitaria (UNAM).
 * Incluye la Biblioteca Central (con los murales de Juan O'Gorman), la Torre de Rectoría
 * (con el mural escultórico de David Alfaro Siqueiros), andadores y mobiliario universitario.
 */
export class Architecture {
  public readonly group: THREE.Group;
  private muralTextures: THREE.CanvasTexture[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'VXR_UNAM_Architecture';

    this.buildBibliotecaCentral();
    this.buildTorreRectoria();
    this.buildPlazaAndadores();
    this.buildUniversityFurniture();
    this.buildPCPumaKiosk();
  }

  /**
   * Construye la Biblioteca Central de la UNAM:
   * - Zócalo de piedra volcánica con lobby acristalado y columnata.
   * - Torre monumental de 10 pisos con los 4 murales de mosaico de Juan O'Gorman.
   * - Remate escalonado superior.
   */
  private buildBibliotecaCentral(): void {
    const biblioGroup = new THREE.Group();
    biblioGroup.name = 'Biblioteca_Central';
    // Posicionada al Norte de Las Islas (Z negativo)
    biblioGroup.position.set(0, 0, -55);

    // 1. Zócalo / Base de piedra volcánica (plinto inferior)
    const baseGeo = new THREE.BoxGeometry(48, 4.5, 34);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3d352e, // Tono piedra braza / tezontle oscuro
      roughness: 0.9,
      metalness: 0.1,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 2.25;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    biblioGroup.add(baseMesh);

    // Escalinatas de acceso al zócalo
    const stairsGeo = new THREE.BoxGeometry(18, 1.2, 8);
    const stairsMesh = new THREE.Mesh(stairsGeo, baseMat);
    stairsMesh.position.set(0, 0.6, 17);
    stairsMesh.receiveShadow = true;
    biblioGroup.add(stairsMesh);

    // Lobby acristalado entre zócalo y torre de murales
    const lobbyGeo = new THREE.BoxGeometry(38, 2.2, 22);
    const lobbyMat = new THREE.MeshStandardMaterial({
      color: 0x1a2634,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const lobbyMesh = new THREE.Mesh(lobbyGeo, lobbyMat);
    lobbyMesh.position.y = 4.5 + 1.1;
    biblioGroup.add(lobbyMesh);

    // Columnas del peristilo del lobby
    const colGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 12);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x2b2520, roughness: 0.8 });
    for (let x = -17; x <= 17; x += 5.6) {
      const colFront = new THREE.Mesh(colGeo, colMat);
      colFront.position.set(x, 4.5 + 1.1, 11);
      colFront.castShadow = true;
      biblioGroup.add(colFront);
    }

    // 2. Torre monumental de murales (Juan O'Gorman)
    const towerWidth = 32;
    const towerHeight = 24;
    const towerDepth = 15;
    const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth);

    // Generar texturas individuales para cada una de las 4 fachadas del mural
    const texNorth = this.createOgorManMuralTexture('NORTE: PASADO PREHISPÁNICO', 0x9e2a2b);
    const texSouth = this.createOgorManMuralTexture('SUR: PASADO COLONIAL', 0x335c67);
    const texEast = this.createOgorManMuralTexture('ORIENTE: EL MUNDO CONTEMPORÁNEO', 0x283618);
    const texWest = this.createOgorManMuralTexture('PONIENTE: LA UNIVERSIDAD Y EL MÉXICO ACTUAL', 0xbb3e03);

    const stoneEdgeMat = new THREE.MeshStandardMaterial({ color: 0x8d775f, roughness: 0.85 });

    // Orden de caras en Three.js BoxGeometry: [right(+X, Este), left(-X, Oeste), top(+Y), bottom(-Y), front(+Z, Sur/Islas), back(-Z, Norte)]
    const towerMaterials: THREE.Material[] = [
      new THREE.MeshStandardMaterial({ map: texEast, roughness: 0.85 }),  // Este
      new THREE.MeshStandardMaterial({ map: texWest, roughness: 0.85 }),  // Oeste
      stoneEdgeMat,                                                      // Arriba
      stoneEdgeMat,                                                      // Abajo
      new THREE.MeshStandardMaterial({ map: texSouth, roughness: 0.85 }), // Sur (Viendo a Las Islas)
      new THREE.MeshStandardMaterial({ map: texNorth, roughness: 0.85 }), // Norte
    ];

    const towerMesh = new THREE.Mesh(towerGeo, towerMaterials);
    towerMesh.position.y = 6.7 + towerHeight / 2;
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    biblioGroup.add(towerMesh);

    // 3. Remate escalonado superior
    const crownGeo = new THREE.BoxGeometry(26, 2.5, 11);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x7c6a59, roughness: 0.8 });
    const crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.position.y = 6.7 + towerHeight + 1.25;
    crownMesh.castShadow = true;
    biblioGroup.add(crownMesh);

    this.group.add(biblioGroup);
  }

  /**
   * Genera texturas ricas de mosaico en piedra natural simulando el estilo de Juan O'Gorman.
   */
  private createOgorManMuralTexture(title: string, accentHex: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;

    // Fondo base ocre / piedra cantera
    ctx.fillStyle = '#b89f7a';
    ctx.fillRect(0, 0, 1024, 768);

    // Mosaico cuadriculado de piedras naturales
    const tileSize = 32;
    const colors = ['#a43820', '#d4a373', '#e9edc9', '#3d5a80', '#293241', '#e07a5f', '#f4a261', '#588157'];
    for (let y = 0; y < 768; y += tileSize) {
      for (let x = 0; x < 1024; x += tileSize) {
        if (Math.random() > 0.4) {
          ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        }
      }
    }

    // Elementos geométricos y astronómicos centrales del mural
    ctx.save();
    ctx.translate(512, 384);

    // Sol / Luna o glifo central
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#261c14';
    ctx.stroke();

    // Rayos solares / motivos prehispánicos
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 150, Math.sin(angle) * 150);
      ctx.lineTo(Math.cos(angle) * 220, Math.sin(angle) * 220);
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#c44536';
      ctx.stroke();
    }

    // Escudos y cartelas laterales
    ctx.fillStyle = '#1f363d';
    ctx.fillRect(-380, -100, 140, 200);
    ctx.fillRect(240, -100, 140, 200);

    ctx.restore();

    // Marco ornamental exterior de piedra
    ctx.lineWidth = 24;
    ctx.strokeStyle = '#382e25';
    ctx.strokeRect(12, 12, 1000, 744);

    // Rótulo tipográfico estilizado en friso
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(40, 680, 944, 60);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(`BIBLIOTECA CENTRAL UNAM — ${title}`, 512, 720);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.muralTextures.push(texture);
    return texture;
  }

  /**
   * Construye la Torre de Rectoría de la UNAM:
   * - Torre esbelta modernista de 16 pisos con fachada acristalada y parteluces.
   * - El emblemático mural escultórico tridimensional de David Alfaro Siqueiros.
   */
  private buildTorreRectoria(): void {
    const rectoriaGroup = new THREE.Group();
    rectoriaGroup.name = 'Torre_Rectoria';
    // Posicionada al Poniente de Las Islas (X negativo)
    rectoriaGroup.position.set(-60, 0, -10);

    // 1. Zócalo de acceso elevado
    const baseGeo = new THREE.BoxGeometry(28, 2.5, 36);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x36302a, roughness: 0.9 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 1.25;
    baseMesh.receiveShadow = true;
    rectoriaGroup.add(baseMesh);

    // 2. Torre principal esbelta (arquitectura moderna funcionalista: Pani, del Moral, Salvador Ortega)
    const towerWidth = 16;
    const towerHeight = 44;
    const towerDepth = 22;
    const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth);

    // Muros laterales ciegos de ladrillo rojo / concreto y fachadas de vidrio
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x8a3324, // Rojo ladrillo universitario característico
      roughness: 0.75,
      metalness: 0.15,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f273d, // Azul profundo reflejante
      roughness: 0.1,
      metalness: 0.85,
    });

    const rectoriaMaterials = [
      concreteMat, // +X
      concreteMat, // -X
      concreteMat, // +Y
      concreteMat, // -Y
      glassMat,    // +Z (Ventanas al Sur)
      glassMat,    // -Z (Ventanas al Norte)
    ];

    const towerMesh = new THREE.Mesh(towerGeo, rectoriaMaterials);
    towerMesh.position.y = 2.5 + towerHeight / 2;
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    rectoriaGroup.add(towerMesh);

    // Brise-soleil / parteluces verticales sobre la fachada de cristal
    const slatGeo = new THREE.BoxGeometry(0.15, towerHeight, 0.6);
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    for (let x = -6.5; x <= 6.5; x += 1.8) {
      const slatSouth = new THREE.Mesh(slatGeo, slatMat);
      slatSouth.position.set(x, 2.5 + towerHeight / 2, towerDepth / 2 + 0.3);
      rectoriaGroup.add(slatSouth);
    }

    // 3. Mural escultórico de David Alfaro Siqueiros:
    // "El pueblo a la universidad, la universidad al pueblo"
    // Prisma trapezoidal que sobresale con relieve poliédrico
    const siqueirosGroup = new THREE.Group();
    siqueirosGroup.name = 'Mural_Siqueiros';
    siqueirosGroup.position.set(towerWidth / 2 + 1.8, 12, 4);

    const muralBoxGeo = new THREE.BoxGeometry(3.6, 9.5, 11);
    const siqueirosTexture = this.createSiqueirosTexture();
    const muralMat = new THREE.MeshStandardMaterial({
      map: siqueirosTexture,
      roughness: 0.6,
      metalness: 0.2,
    });
    const muralMesh = new THREE.Mesh(muralBoxGeo, muralMat);
    muralMesh.castShadow = true;
    siqueirosGroup.add(muralMesh);

    // Brazo escultórico poliédrico saliente (rectoría esculpida)
    const armGeo = new THREE.ConeGeometry(1.6, 4.5, 5);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.5 });
    const armMesh = new THREE.Mesh(armGeo, armMat);
    armMesh.rotation.z = -Math.PI / 2.5;
    armMesh.position.set(2.2, 1.5, 0);
    siqueirosGroup.add(armMesh);

    rectoriaGroup.add(siqueirosGroup);
    this.group.add(rectoriaGroup);
  }

  /**
   * Genera textura para el mural escultórico de Siqueiros.
   */
  private createSiqueirosTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Fondo geométrico enérgico (rojo siqueiros, negro, ocre)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#b7094c';
    ctx.beginPath();
    ctx.moveTo(50, 450);
    ctx.lineTo(450, 100);
    ctx.lineTo(480, 480);
    ctx.fill();

    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(260, 240, 80, 0, Math.PI * 2);
    ctx.fill();

    // Líneas dinámicas de perspectiva poliangular siqueiriana
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(100, 400 - i * 40);
      ctx.lineTo(400, 200 - i * 30);
      ctx.stroke();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SIQUEIROS: EL PUEBLO A LA UNIVERSIDAD', 40, 480);

    const tex = new THREE.CanvasTexture(canvas);
    this.muralTextures.push(tex);
    return tex;
  }

  /**
   * Construye la explanada central, andadores de tezontle y escalinatas de Las Islas.
   */
  private buildPlazaAndadores(): void {
    const plazaGroup = new THREE.Group();
    plazaGroup.name = 'Andadores_Las_Islas';

    // 1. Andador principal Norte-Sur (conecta Biblioteca Central con Las Islas)
    const andadorGeo = new THREE.PlaneGeometry(8, 80);
    const andadorMat = new THREE.MeshStandardMaterial({
      color: 0x9c8e7d, // Concreto texturizado claro con toque volcánico
      roughness: 0.88,
      metalness: 0.05,
    });
    const andadorMesh = new THREE.Mesh(andadorGeo, andadorMat);
    andadorMesh.rotation.x = -Math.PI / 2;
    andadorMesh.position.set(0, 0.02, -15);
    andadorMesh.receiveShadow = true;
    plazaGroup.add(andadorMesh);

    // 2. Andador Poniente-Oriente (conecta Rectoría con las facultades)
    const andadorEOGeo = new THREE.PlaneGeometry(80, 6);
    const andadorEOMesh = new THREE.Mesh(andadorEOGeo, andadorMat);
    andadorEOMesh.rotation.x = -Math.PI / 2;
    andadorEOMesh.position.set(-20, 0.025, 0);
    andadorEOMesh.receiveShadow = true;
    plazaGroup.add(andadorEOMesh);

    // 3. Glorieta central de observación (donde aparece el visitante a nivel de suelo)
    const plazaCenterGeo = new THREE.CylinderGeometry(6.5, 7.0, 0.12, 32);
    const plazaCenterMat = new THREE.MeshStandardMaterial({
      color: 0x827362,
      roughness: 0.8,
      metalness: 0.1,
    });
    const plazaCenter = new THREE.Mesh(plazaCenterGeo, plazaCenterMat);
    plazaCenter.position.set(0, 0.06, 0);
    plazaCenter.receiveShadow = true;
    plazaGroup.add(plazaCenter);

    // Anillo exterior decorativo de tezontle rojo
    const ringGeo = new THREE.RingGeometry(6.6, 7.8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x6e261d, // Tezontle rojo volcánico
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.07, 0);
    ringMesh.receiveShadow = true;
    plazaGroup.add(ringMesh);

    this.group.add(plazaGroup);
  }

  /**
   * Mobiliario universitario representativo (bancas de cantera, postes de iluminación).
   */
  private buildUniversityFurniture(): void {
    const furnitureGroup = new THREE.Group();
    furnitureGroup.name = 'Mobiliario_Campus';

    const benchGeo = new THREE.BoxGeometry(2.4, 0.45, 0.65);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.85 });

    // Bancas perimetrales alrededor de la rotonda central
    const benchPositions = [
      [5, 0.23, 4, Math.PI / 4],
      [-5, 0.23, 4, -Math.PI / 4],
      [5, 0.23, -4, -Math.PI / 4],
      [-5, 0.23, -4, Math.PI / 4],
    ];

    benchPositions.forEach(([x, y, z, rot]) => {
      const bench = new THREE.Mesh(benchGeo, benchMat);
      bench.position.set(x, y, z);
      bench.rotation.y = rot;
      bench.castShadow = true;
      bench.receiveShadow = true;
      furnitureGroup.add(bench);
    });

    this.group.add(furnitureGroup);
  }

  /**
   * Tótem tecnológico institucional PC PUMA:
   * Representa la conectividad y el aprendizaje móvil de PC PUMA en los campus de la UNAM.
   */
  private buildPCPumaKiosk(): void {
    const kioskGroup = new THREE.Group();
    kioskGroup.name = 'Kiosco_PCPUMA_Campus';
    kioskGroup.position.set(3.5, 0, -2.5);

    // Base del tótem
    const baseGeo = new THREE.BoxGeometry(0.8, 0.2, 0.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x070e1a, metalness: 0.8, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    kioskGroup.add(base);

    // Columna vertical estilizada
    const poleGeo = new THREE.BoxGeometry(0.4, 2.4, 0.25);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x0d2238, metalness: 0.85, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.3;
    pole.castShadow = true;
    kioskGroup.add(pole);

    // Pantalla del tótem con logo luminoso PC PUMA
    const screenGeo = new THREE.PlaneGeometry(0.34, 0.6);
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 256;
    screenCanvas.height = 450;
    const ctx = screenCanvas.getContext('2d')!;
    ctx.fillStyle = '#00172D';
    ctx.fillRect(0, 0, 256, 450);
    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PC PUMA', 128, 120);
    ctx.fillStyle = '#D4AF37';
    ctx.font = '20px sans-serif';
    ctx.fillText('ZONA WI-FI', 128, 180);
    ctx.fillText('UNAM', 128, 220);

    const screenTex = new THREE.CanvasTexture(screenCanvas);
    this.muralTextures.push(screenTex);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 1.5, 0.13);
    kioskGroup.add(screenMesh);

    // Luz sutil emitida por el tótem
    const glowLight = new THREE.PointLight(0x00f0ff, 0.8, 4);
    glowLight.position.set(0, 1.6, 0.4);
    kioskGroup.add(glowLight);

    this.group.add(kioskGroup);
  }

  public dispose(): void {
    this.muralTextures.forEach((tex) => tex.dispose());
    this.muralTextures.length = 0;

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
