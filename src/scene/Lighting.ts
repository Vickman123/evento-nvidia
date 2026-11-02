import * as THREE from 'three';

/**
 * Sistema de iluminación natural y sombras calibrado para Meta Quest Browser.
 * Utiliza una única luz solar direccional con proyección de sombras (map size 1024x1024)
 * y luz hemisférica suave para simular la luz solar de la meseta del Valle de México.
 */
export class Lighting {
  public readonly group: THREE.Group;
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public ambientLight: THREE.AmbientLight;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'VXR_UNAM_Lighting';

    // 1. Luz solar direccional principal (Key Light)
    // Inclinación a 45° tipo maqueta arquitectónica institucional
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.85);
    this.sunLight.name = 'SunKeyLight';
    this.sunLight.position.set(24, 36, 20);

    // Configuración rigurosa de sombras para no degradar rendimiento en Meta Quest
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -35;
    this.sunLight.shadow.camera.right = 35;
    this.sunLight.shadow.camera.top = 35;
    this.sunLight.shadow.camera.bottom = -35;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;

    this.group.add(this.sunLight);

    // 2. Luz hemisférica (cielo cálido y rebote de cantera)
    this.hemiLight = new THREE.HemisphereLight(0x90bfe8, 0x6e5040, 0.65);
    this.hemiLight.name = 'SkyBounceHemiLight';
    this.group.add(this.hemiLight);

    // 3. Luz ambiental suave de relleno
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.ambientLight.name = 'AmbientFillLight';
    this.group.add(this.ambientLight);
  }

  public setCinemaMode(active: boolean): void {
    // Al entrar en modo cine/video, atenuamos suavemente la luz solar para concentrar la atención en la pantalla
    if (active) {
      this.sunLight.intensity = 0.45;
      this.hemiLight.intensity = 0.3;
      this.ambientLight.intensity = 0.15;
    } else {
      this.sunLight.intensity = 1.35;
      this.hemiLight.intensity = 0.55;
      this.ambientLight.intensity = 0.25;
    }
  }

  public dispose(): void {
    this.group.remove(this.sunLight);
    this.group.remove(this.hemiLight);
    this.group.remove(this.ambientLight);
    this.group.clear();
  }
}
