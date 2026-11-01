import * as THREE from 'three';
import { Environment } from './Environment.js';
import { Architecture } from './Architecture.js';
import { Vegetation } from './Vegetation.js';
import { Lighting } from './Lighting.js';
import type { XRApp } from '../vxr/XRApp.js';

/**
 * Escenario principal de Ciudad Universitaria para VXR Core.
 * Integra entorno atmosférico, arquitectura emblemática (Biblioteca Central, Rectoría),
 * áreas verdes de Las Islas, iluminación solar PBR y soporte opcional para modelos GLB.
 */
export class UNAMScene {
  public readonly group: THREE.Group;
  public readonly environment: Environment;
  public readonly architecture: Architecture;
  public readonly vegetation: Vegetation;
  public readonly lighting: Lighting;

  private app: XRApp;
  private externalBuildingGroup: THREE.Group | null = null;
  private aiSlotObjects: Map<string, THREE.Object3D> = new Map();

  constructor(app: XRApp) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.name = 'VXR_UNAM_Root';

    // 1. Instanciar subsistemas de la escena
    this.environment = new Environment();
    this.architecture = new Architecture();
    this.vegetation = new Vegetation();
    this.lighting = new Lighting();

    // 2. Montar en el grafo
    this.group.add(this.environment.group);
    this.group.add(this.architecture.group);
    this.group.add(this.vegetation.group);
    this.group.add(this.lighting.group);

    // 3. Añadir a la escena nativa de VXR Core
    this.app.scene.nativeScene.add(this.group);

    // 4. Configurar niebla suave en VXR Core para profundidad aérea
    this.app.scene.setFog(0xdcebf8, 30, 220);

    // 5. Cargar modelo complementario si está disponible
    this.tryLoadExternalModels();
  }

  /**
   * Intenta cargar el modelo GLB institucional de Filológicas o complementos sin bloquear.
   */
  private async tryLoadExternalModels(): Promise<void> {
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
    }

    newObject.name = `AI_Slot_${slot}`;
    this.aiSlotObjects.set(slot, newObject);
    this.group.add(newObject);
    console.info(`[UNAMScene] Slot "${slot}" actualizado exitosamente en el grafo de escena.`);
  }

  public dispose(): void {
    this.environment.dispose();
    this.architecture.dispose();
    this.vegetation.dispose();
    this.lighting.dispose();

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
