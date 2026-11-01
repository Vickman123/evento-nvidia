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

    // 1. Domo de cielo con gradiente realista de la Ciudad de México (altitud 2,240m)
    const skyGeo = new THREE.SphereGeometry(300, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1a66cc) },     // Azul cielo profundo en cénit
        horizonColor: { value: new THREE.Color(0xdcebf8) }, // Calidez suave en horizonte
        bottomColor: { value: new THREE.Color(0xb5cfb8) },  // Reflejo terrestre
        offset: { value: 30 },
        exponent: { value: 0.7 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          vec3 sky = mix(horizonColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
          vec3 ground = mix(horizonColor, bottomColor, max(pow(max(-h, 0.0), exponent), 0.0));
          gl_FragColor = vec4(h > 0.0 ? sky : ground, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(this.skyMesh);

    // 2. Silueta de montañas distantes (Ajusco y cordillera del sur del Valle de México)
    this.mountainsMesh = this.createMountainSilhouette();
    this.group.add(this.mountainsMesh);

    // 3. Nubes estilizadas en capas altas
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
        // Ondulación natural de picos volcánicos
        const angle = (i / segments) * Math.PI * 2;
        const elevation = Math.sin(angle * 3) * 8 + Math.cos(angle * 7) * 4 + 10;
        pos.setY(i, y + elevation);
      }
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x4a6572,
      side: THREE.BackSide,
      fog: true,
      transparent: true,
      opacity: 0.65,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 8;
    return mesh;
  }

  private createClouds(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Clouds_Layer';
    const cloudGeo = new THREE.SphereGeometry(12, 8, 6);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });

    const positions = [
      [80, 75, -120, 2.5, 0.6, 1.8],
      [-90, 80, -90, 3.0, 0.5, 2.0],
      [120, 70, 80, 2.8, 0.5, 1.6],
      [-130, 85, 100, 3.2, 0.7, 2.2],
    ];

    positions.forEach(([x, y, z, sx, sy, sz]) => {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(x, y, z);
      cloud.scale.set(sx, sy, sz);
      group.add(cloud);
    });

    return group;
  }

  public update(delta: number): void {
    // Rotación sutil de la capa de nubes para dinamismo atmosférico
    this.cloudsGroup.rotation.y += delta * 0.003;
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
