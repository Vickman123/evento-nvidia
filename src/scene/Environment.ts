import * as THREE from 'three';

/**
 * Entorno atmosférico, domo celeste y horizonte para Ciudad Universitaria.
 * Diseñado con shaders livianos y geometría esférica para máximo rendimiento en Meta Quest.
 */
export class Environment {
  public readonly group: THREE.Group;
  private skyMesh: THREE.Mesh;
  private mountainsMesh: THREE.Mesh;
  private cloudsGroup: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'VXR_UNAM_Environment';

    // 1. Domo de cielo azul con gradiente diurno luminoso (Ciudad Universitaria, 2,240m)
    // Generado con CanvasTexture de alto rendimiento para garantizar 100% compatibilidad sin fallos de compilación GLSL
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#1565c0');  // Azul cielo intenso en cénit
    grad.addColorStop(0.35, '#1e88e5'); // Azul cielo luminoso
    grad.addColorStop(0.7, '#64b5f6');  // Azul celeste hacia el horizonte
    grad.addColorStop(0.92, '#bbdefb'); // Azul pastel en la línea de horizonte
    grad.addColorStop(1.0, '#e3f2fd');  // Bruma suave del horizonte
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 512);

    const skyTexture = new THREE.CanvasTexture(canvas);
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    skyTexture.minFilter = THREE.LinearFilter;
    skyTexture.magFilter = THREE.LinearFilter;
    skyTexture.wrapS = THREE.ClampToEdgeWrapping;
    skyTexture.wrapT = THREE.ClampToEdgeWrapping;

    const skyGeo = new THREE.SphereGeometry(300, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.name = 'Daytime_Sky_Dome';
    this.group.add(this.skyMesh);

    // 2. Silueta de montañas distantes (Ajusco y serranía del sur del Valle de México)
    this.mountainsMesh = this.createMountainSilhouette();
    this.group.add(this.mountainsMesh);

    // 3. Nubes cúmulos volumétricas algodonosas
    this.cloudsGroup = this.createClouds();
    this.group.add(this.cloudsGroup);
  }

  private createMountainSilhouette(): THREE.Mesh {
    const radius = 260;
    const segments = 48;
    const geo = new THREE.CylinderGeometry(radius, radius + 20, 35, segments, 1, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        const angle = (i / segments) * Math.PI * 2;
        const elevation = Math.sin(angle * 3) * 8 + Math.cos(angle * 7) * 4 + 10;
        pos.setY(i, y + elevation);
      }
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x5c7f99,
      side: THREE.BackSide,
      fog: true,
      transparent: true,
      opacity: 0.55,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 8;
    return mesh;
  }

  private createClouds(): THREE.Group {
    const cloudsContainer = new THREE.Group();
    cloudsContainer.name = 'Clouds_Layer';

    const puffGeo = new THREE.DodecahedronGeometry(1, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.02,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    });

    // Racimos de nubes distribuidas en 360° sobre el campus
    const cloudConfigs = [
      { x: 35, y: 72, z: -110, scale: 24 },
      { x: -75, y: 84, z: -90, scale: 28 },
      { x: -115, y: 68, z: -25, scale: 22 },
      { x: 95, y: 78, z: -40, scale: 26 },
      { x: -65, y: 74, z: 65, scale: 25 },
      { x: 80, y: 70, z: 85, scale: 30 },
      { x: 15, y: 88, z: 120, scale: 27 },
      { x: -130, y: 76, z: 95, scale: 32 },
      { x: 120, y: 85, z: -115, scale: 29 },
      { x: -20, y: 92, z: -155, scale: 34 },
    ];

    cloudConfigs.forEach((cfg, idx) => {
      const singleCloud = new THREE.Group();
      singleCloud.name = `CumulusCloud_${idx}`;

      // Puffs que componen la silueta algodonosa de cada nube
      const puffOffsets = [
        [0, 0, 0, 1.0, 0.45, 0.85],
        [0.45, -0.05, 0.1, 0.75, 0.4, 0.7],
        [-0.45, -0.05, -0.1, 0.7, 0.38, 0.65],
        [0.2, 0.22, -0.05, 0.65, 0.45, 0.6],
        [-0.15, 0.18, 0.1, 0.6, 0.4, 0.55],
        [0.75, -0.12, 0.0, 0.5, 0.3, 0.45],
        [-0.75, -0.12, 0.05, 0.45, 0.28, 0.4],
      ];

      puffOffsets.forEach(([ox, oy, oz, sx, sy, sz]) => {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(ox, oy, oz);
        puff.scale.set(sx, sy, sz);
        singleCloud.add(puff);
      });

      singleCloud.position.set(cfg.x, cfg.y, cfg.z);
      singleCloud.scale.set(cfg.scale, cfg.scale, cfg.scale);
      singleCloud.rotation.y = (idx * 1.3) % (Math.PI * 2);
      cloudsContainer.add(singleCloud);
    });

    return cloudsContainer;
  }

  public update(delta: number): void {
    if (this.cloudsGroup) {
      // Brisa suave que desplaza las nubes de forma relajante
      this.cloudsGroup.children.forEach((cloud) => {
        cloud.position.x += delta * 1.2;
        if (cloud.position.x > 220) {
          cloud.position.x = -220;
        }
      });
    }
  }

  public dispose(): void {
    this.skyMesh.geometry.dispose();
    (this.skyMesh.material as THREE.Material).dispose();
    this.mountainsMesh.geometry.dispose();
    (this.mountainsMesh.material as THREE.Material).dispose();

    this.cloudsGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    this.group.clear();
  }
}
