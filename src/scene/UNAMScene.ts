import * as THREE from 'three';
import { Environment } from './Environment.js';
import { Architecture } from './Architecture.js';
import { Vegetation } from './Vegetation.js';
import { Lighting } from './Lighting.js';
import { BibliotecaCentralDiorama } from './BibliotecaCentralDiorama.js';
import type { XRApp } from '../vxr/XRApp.js';

/**
 * Escenario principal de Ciudad Universitaria para VXR Core.
 * Integra entorno atmosférico, el Diorama de alta fidelidad de la Biblioteca Central y su Plaza
 * (con podio arquitectónico, losetas de terracota, jacarandas y muro de relieves),
 * iluminación solar PBR y soporte modular para modelos GLB.
 */
export class UNAMScene {
  public readonly group: THREE.Group;
  public readonly environment: Environment;
  public readonly diorama: BibliotecaCentralDiorama;
  public readonly architecture: Architecture;
  public readonly vegetation: Vegetation;
  public readonly lighting: Lighting;

  private app: XRApp;
  private externalBuildingGroup: THREE.Group | null = null;
  private aiSlotObjects: Map<string, THREE.Object3D> = new Map();
  private dioramaModelGroup: THREE.Group | null = null;

  constructor(app: XRApp) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'VXR_UNAM_Root';

    // 1. Instanciar subsistemas de la escena
    this.environment = new Environment();
    this.diorama = new BibliotecaCentralDiorama();
    this.architecture = new Architecture();
    this.vegetation = new Vegetation();
    this.lighting = new Lighting();

    // 2. Montar en el grafo (cielo diurno, diorama central e iluminación PBR)
    this.group.add(this.environment.group);
    this.group.add(this.diorama.group);
    this.group.add(this.lighting.group);

    // Los edificios lejanos se mantienen ocultos por defecto para dar protagonismo total al Diorama
    this.architecture.group.visible = false;
    this.vegetation.group.visible = false;
    this.group.add(this.architecture.group);
    this.group.add(this.vegetation.group);

    // 3. Añadir a la escena nativa de VXR Core
    this.app.scene.nativeScene.add(this.group);

    // 4. Configurar atmósfera diurna luminosa con cielo azul y horizonte suave
    this.app.scene.setBackground(0x4a96e6);
    this.app.scene.setFog(0xd4e9fb, 120, 380);

    // 5. Cargar modelo complementario si está disponible
    this.tryLoadExternalModels();
  }

  /**
   * Intenta cargar el modelo GLB de alta fidelidad o complementos sin bloquear.
   */
  private async tryLoadExternalModels(): Promise<void> {
    // 0. Cargar el Diorama 3D empacado de alta fidelidad (agentic_0002_pack_glb_model-2.glb)
    try {
      const dioramaModel = await this.app.loadModel('assets/models/unam_biblioteca_diorama.glb', {
        autoGround: false,
        autoCenter: false,
      });

      if (dioramaModel && dioramaModel.group) {
        dioramaModel.group.name = 'VXR_Pack_Biblioteca_Diorama';
        dioramaModel.group.position.set(0, -1.1, -10);
        this.dioramaModelGroup = dioramaModel.group;
        this.group.add(dioramaModel.group);

        // Ocultar la versión procedural para dar protagonismo total al modelo 3D optimizado
        this.diorama.group.visible = false;
        console.info('[UNAMScene] Modelo GLB Diorama (agentic_0002_pack_glb_model-2.glb) cargado exitosamente.');
        return;
      }
    } catch (e) {
      console.warn('[UNAMScene] Modelo GLB de diorama no disponible, recurriendo a diorama procedural.', e);
      this.diorama.group.visible = true;
    }

    try {
      const model = await this.app.loadModel('assets/models/Filologicas.glb', {
        autoGround: true,
        autoCenter: true,
      });

      if (model && model.group) {
        // Colocar al oriente del andador para complementar la vista
        model.group.position.set(45, 0, 15);
        model.group.scale.set(0.65, 0.65, 0.65);
        this.externalBuildingGroup = model.group;
        this.group.add(model.group);
        console.info('[UNAMScene] Modelo GLB Filologicas cargado con éxito.');
      }
    } catch (e) {
      console.info('[UNAMScene] Modelo GLB opcional omitido o no presente; la escena procedural está completa.');
    }

    // Cargar modelos generados por IA si existen en assets/models/ai/
    // 1. Banca de Cantera y Basalto
    try {
      const benchModel = await this.app.loadModel('assets/models/ai/unam_banca_cantera.glb', {
        autoGround: true,
        autoCenter: true,
      });
      if (benchModel && benchModel.group) {
        benchModel.group.position.set(4, 0, -6);
        benchModel.group.scale.set(0.8, 0.8, 0.8);
        this.replaceSlot('furniture', benchModel.group);
        console.info('[UNAMScene] Modelo IA unam_banca_cantera cargado exitosamente en slot "furniture".');
      }
    } catch (e) {}

    // 2. Biblioteca Central Monumental
    try {
      const biblioModel = await this.app.loadModel('assets/models/ai/unam_biblioteca_central.glb', {
        autoGround: true,
        autoCenter: true,
      });
      if (biblioModel && biblioModel.group) {
        biblioModel.group.position.set(0, 0, -55);
        if (biblioModel.metrics.dimensions.height > 0) {
          const factor = 36 / biblioModel.metrics.dimensions.height;
          biblioModel.group.scale.set(factor, factor, factor);
        }
        this.replaceSlot('biblioteca', biblioModel.group);
        console.info('[UNAMScene] Modelo IA unam_biblioteca_central montado a escala monumental.');
      }
    } catch (e) {}

    // 3. Torre de Rectoría con Mural Escultórico
    try {
      const rectoriaModel = await this.app.loadModel('assets/models/ai/unam_torre_rectoria.glb', {
        autoGround: true,
        autoCenter: true,
      });
      if (rectoriaModel && rectoriaModel.group) {
        rectoriaModel.group.position.set(-65, 0, -20);
        if (rectoriaModel.metrics.dimensions.height > 0) {
          const factor = 58 / rectoriaModel.metrics.dimensions.height;
          rectoriaModel.group.scale.set(factor, factor, factor);
        }
        this.replaceSlot('rectoria', rectoriaModel.group);
        console.info('[UNAMScene] Modelo IA unam_torre_rectoria montado a escala en Las Islas.');
      }
    } catch (e) {}

    // 4. Árbol Jacaranda Florido de Las Islas
    try {
      const jacarandaModel = await this.app.loadModel('assets/models/ai/unam_arbol_jacaranda.glb', {
        autoGround: true,
        autoCenter: true,
      });
      if (jacarandaModel && jacarandaModel.group) {
        const jGroup = new THREE.Group();
        jGroup.name = 'AI_Jacarandas_Ensemble';
        const positions = [
          { x: -16, z: -18, scale: 1.1, rot: 0.2 },
          { x: 18, z: -22, scale: 0.95, rot: 1.5 },
          { x: -28, z: -35, scale: 1.25, rot: 2.8 },
          { x: 24, z: -38, scale: 1.05, rot: 4.1 },
        ];
        positions.forEach((p, idx) => {
          const clone = idx === 0 ? jacarandaModel.group : jacarandaModel.group.clone();
          clone.position.set(p.x, 0, p.z);
          clone.scale.set(p.scale, p.scale, p.scale);
          clone.rotation.y = p.rot;
          jGroup.add(clone);
        });
        this.replaceSlot('vegetation', jGroup);
        console.info('[UNAMScene] Ensamble IA de Jacarandas floridas distribuido en Las Islas.');
      }
    } catch (e) {}

    // 5. Pabellón Tecnológico Kiosko PC PUMA
    try {
      const kioskModel = await this.app.loadModel('assets/models/ai/unam_kiosko_pcpuma.glb', {
        autoGround: true,
        autoCenter: true,
      });
      if (kioskModel && kioskModel.group) {
        kioskModel.group.position.set(12, 0, -9);
        kioskModel.group.scale.set(1.4, 1.4, 1.4);
        this.replaceSlot('kiosko_pcpuma', kioskModel.group);
        console.info('[UNAMScene] Modelo IA Kiosko PC PUMA montado junto al andador.');
      }
    } catch (e) {}

    // 6. Luminarias de Alumbrado de Ciudad Universitaria
    try {
      const lampModel = await this.app.loadModel('assets/models/ai/unam_luminaria_campus.glb', {
        autoGround: true,
        autoCenter: true,
      });
      if (lampModel && lampModel.group) {
        const lampsGroup = new THREE.Group();
        lampsGroup.name = 'AI_Campus_Lamps_Ensemble';
        const lampPositions = [
          { x: 5.5, z: -12 },
          { x: -5.5, z: -12 },
          { x: 5.5, z: -28 },
          { x: -5.5, z: -28 },
        ];
        lampPositions.forEach((pos, idx) => {
          const clone = idx === 0 ? lampModel.group : lampModel.group.clone();
          clone.position.set(pos.x, 0, pos.z);
          clone.scale.set(0.65, 0.65, 0.65);
          lampsGroup.add(clone);
        });
        this.replaceSlot('luminarias', lampsGroup);
        console.info('[UNAMScene] Modelos IA Luminarias distribuidas en los andadores.');
      }
    } catch (e) {}
  }

  public update(delta: number): void {
    this.environment.update(delta);
  }

  public setCinemaMode(active: boolean): void {
    this.lighting.setCinemaMode(active);
  }

  /**
   * Reemplaza dinámicamente un elemento arquitectónico o de ambientación por un modelo GLB generado por IA.
   * Maneja ocultamiento del placeholder procedural y liberación de memoria GPU.
   */
  public replaceSlot(slot: string, newObject: THREE.Object3D): void {
    // Si ya existía un modelo en este slot, liberarlo
    if (this.aiSlotObjects.has(slot)) {
      const prev = this.aiSlotObjects.get(slot)!;
      this.group.remove(prev);
      this.app.assets.disposeObject(prev);
      this.aiSlotObjects.delete(slot);
    }

    // Gestionar visibilidad de los equivalentes procedurales
    if (slot === 'biblioteca') {
      const proceduralBiblio = this.architecture.group.getObjectByName('Biblioteca_Central');
      if (proceduralBiblio) {
        proceduralBiblio.visible = false;
        console.info('[UNAMScene] Placeholder procedural de Biblioteca Central ocultado en favor del modelo IA.');
      }
    } else if (slot === 'rectoria') {
      const proceduralRectoria = this.architecture.group.getObjectByName('Torre_Rectoria');
      if (proceduralRectoria) {
        proceduralRectoria.visible = false;
        console.info('[UNAMScene] Placeholder procedural de Torre de Rectoría ocultado en favor del modelo IA.');
      }
    } else if (slot === 'kiosko_pcpuma') {
      const proceduralKiosk = this.architecture.group.getObjectByName('Kiosco_PCPUMA_Campus');
      if (proceduralKiosk) {
        proceduralKiosk.visible = false;
        console.info('[UNAMScene] Tótem procedural de PC PUMA sustituido por el Pabellón IA.');
      }
    } else if (slot === 'furniture') {
      const proceduralFurniture = this.architecture.group.getObjectByName('Mobiliario_Universitario');
      if (proceduralFurniture) {
        proceduralFurniture.visible = false;
        console.info('[UNAMScene] Mobiliario procedural sustituido por las bancas IA de Cantera.');
      }
    }

    newObject.name = `AI_Slot_${slot}`;
    this.aiSlotObjects.set(slot, newObject);
    this.group.add(newObject);
    console.info(`[UNAMScene] Slot "${slot}" actualizado exitosamente en el grafo de escena.`);
  }

  public dispose(): void {
    this.diorama.dispose();
    this.environment.dispose();
    this.architecture.dispose();
    this.vegetation.dispose();
    this.lighting.dispose();

    if (this.dioramaModelGroup) {
      this.group.remove(this.dioramaModelGroup);
      this.app.assets.disposeObject(this.dioramaModelGroup);
      this.dioramaModelGroup = null;
    }

    this.aiSlotObjects.forEach((obj) => {
      this.group.remove(obj);
      this.app.assets.disposeObject(obj);
    });
    this.aiSlotObjects.clear();

    if (this.externalBuildingGroup) {
      this.app.assets.disposeObject(this.externalBuildingGroup);
      this.externalBuildingGroup = null;
    }

    this.app.scene.nativeScene.remove(this.group);
    this.group.clear();
  }
}
