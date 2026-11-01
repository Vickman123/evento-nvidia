import * as THREE from 'three';
import type { XRApp } from '../vxr/XRApp.js';
import type { LoadedModel, ModelMetrics } from '../vxr/types.js';
import type { UNAMScene } from '../scene/UNAMScene.js';
import {
  optimizeModelScene,
  computeMetrics,
  exportSceneToGLBBuffer,
  type OptimizationOptions,
  type OptimizationResult,
} from './MeshOptimizer.js';

export interface TextTo3DOptions {
  prompt: string;
  tier?: 'Gen-2.5-Low' | 'Gen-2.5-Medium' | 'Gen-2.5-High' | 'Gen-2.5-Minimum' | 'Gen-2';
  mesh_mode?: 'Raw' | 'Quad';
  quality?: 'medium' | 'high';
  material?: 'PBR';
  geometry_file_format?: 'glb';
}

export interface ImageTo3DOptions extends Omit<TextTo3DOptions, 'prompt'> {
  prompt?: string;
  image: File | Blob;
}

export interface GenerationTask {
  taskUuid: string;
  subscriptionKey: string;
  consumed?: number;
  message?: string;
  timestamp: number;
}

export interface GenerationStatusResponse {
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  progress?: number;
  details?: any;
}

export interface ValidationResult {
  isValid: boolean;
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
  dimensions: { width: number; height: number; depth: number };
  warnings: string[];
  recommendations: string[];
}

export type SceneSlot = 'biblioteca' | 'rectoria' | 'furniture' | 'vegetation' | 'custom';

/**
 * AIModelGenerator: Integración completa de la API Hyper3D Rodin v2 con VXR Core.
 * Todas las llamadas se canalizan a través de un proxy local seguro para garantizar
 * que la API Key nunca se exponga en el navegador ni en las Meta Quest.
 */
export class AIModelGenerator {
  private apiProxyBase: string;

  constructor(proxyBase: string = '/api/ai3d') {
    this.apiProxyBase = proxyBase;
  }

  /**
   * Comprueba si el proxy del servidor tiene configurada la credencial RODIN_API_KEY.
   */
  public async checkAuth(): Promise<{ authenticated: boolean; message: string }> {
    try {
      const res = await fetch(`${this.apiProxyBase}/auth-check`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          authenticated: false,
          message: err.message || `Error HTTP ${res.status}`,
        };
      }
      const data = await res.json();
      return {
        authenticated: Boolean(data.authenticated),
        message: data.message || 'Credenciales válidas',
      };
    } catch (e: any) {
      return {
        authenticated: false,
        message: `No se pudo conectar con el proxy local (${e.message})`,
      };
    }
  }

  /**
   * Genera un modelo 3D a partir de una descripción en lenguaje natural.
   */
  public async generateFromText(options: TextTo3DOptions): Promise<GenerationTask> {
    const formData = new FormData();
    formData.append('prompt', options.prompt);
    formData.append('tier', options.tier || 'Gen-2.5-Low');
    formData.append('mesh_mode', options.mesh_mode || 'Raw');
    formData.append('quality', options.quality || 'medium');
    formData.append('material', options.material || 'PBR');
    formData.append('geometry_file_format', options.geometry_file_format || 'glb');

    const res = await fetch(`${this.apiProxyBase}/generate`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Error de generación HTTP ${res.status}`);
    }

    const data = await res.json();
    const taskUuid = data.uuid || data.task_uuid;
    const subscriptionKey = data.jobs?.subscription_key || data.subscription_key;

    if (!taskUuid || !subscriptionKey) {
      throw new Error(`Respuesta inválida del proveedor 3D: faltan identificadores de tarea`);
    }

    return {
      taskUuid,
      subscriptionKey,
      consumed: data.consumed,
      message: data.message,
      timestamp: Date.now(),
    };
  }

  /**
   * Genera un modelo 3D guiado por una imagen de referencia.
   */
  public async generateFromImage(options: ImageTo3DOptions): Promise<GenerationTask> {
    const formData = new FormData();
    formData.append('images', options.image);
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    formData.append('tier', options.tier || 'Gen-2.5-Low');
    formData.append('mesh_mode', options.mesh_mode || 'Raw');
    formData.append('quality', options.quality || 'medium');
    formData.append('material', options.material || 'PBR');
    formData.append('geometry_file_format', options.geometry_file_format || 'glb');

    const res = await fetch(`${this.apiProxyBase}/generate`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Error HTTP ${res.status}`);
    }

    const data = await res.json();
    const taskUuid = data.uuid || data.task_uuid;
    const subscriptionKey = data.jobs?.subscription_key || data.subscription_key;

    if (!taskUuid || !subscriptionKey) {
      throw new Error(`Respuesta inválida del proveedor 3D: faltan identificadores de tarea`);
    }

    return {
      taskUuid,
      subscriptionKey,
      consumed: data.consumed,
      message: data.message,
      timestamp: Date.now(),
    };
  }

  /**
   * Consulta el estado de la tarea de generación en la cola de Hyper3D Rodin.
   */
  public async getGenerationStatus(subscriptionKey: string): Promise<GenerationStatusResponse> {
    const res = await fetch(`${this.apiProxyBase}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_key: subscriptionKey }),
    });

    if (!res.ok) {
      throw new Error(`Error al consultar estado de generación: HTTP ${res.status}`);
    }

    const data = await res.json();

    // Interpretar respuesta de Hyper3D status
    // Formato típico: { status: 'Running' | 'Succeeded' | 'Failed', jobs: [...] }
    let status: GenerationStatusResponse['status'] = 'PENDING';
    const rawStatus = (data.status || data.state || '').toUpperCase();

    if (rawStatus.includes('SUCCEED') || rawStatus === 'COMPLETED' || rawStatus === 'SUCCESS') {
      status = 'SUCCEEDED';
    } else if (rawStatus.includes('RUN') || rawStatus === 'PROCESSING' || rawStatus === 'QUEUED') {
      status = 'RUNNING';
    } else if (rawStatus.includes('FAIL') || rawStatus.includes('ERR')) {
      status = 'FAILED';
    }

    // Calcular progreso si está reportado en jobs
    let progress = data.progress;
    if (progress === undefined && Array.isArray(data.jobs) && data.jobs.length > 0) {
      const activeJob = data.jobs[0];
      progress = activeJob.progress;
    }

    return {
      status,
      progress,
      details: data,
    };
  }

  /**
   * Descarga el modelo GLB completado y lo guarda en cache o disco local.
   */
  public async downloadModel(
    taskUuid: string,
    saveName?: string
  ): Promise<{ blob: Blob; localUrl: string; downloadUrl: string }> {
    const res = await fetch(`${this.apiProxyBase}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_uuid: taskUuid,
        save_name: saveName,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error descargando modelo 3D (HTTP ${res.status})`);
    }

    const data = await res.json();
    const downloadUrl = data.downloadUrl;
    const localUrl = data.localUrl || downloadUrl;

    // Obtener blob en memoria
    const fileRes = await fetch(downloadUrl);
    const blob = await fileRes.blob();

    return {
      blob,
      localUrl,
      downloadUrl,
    };
  }

  /**
   * Valida la geometría, materiales y métricas de un modelo cargado según los límites de Meta Quest 3/3S.
   */
  public validateModel(loadedModel: LoadedModel): ValidationResult {
    const metrics = loadedModel.metrics;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    let meshCount = 0;
    loadedModel.group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) meshCount++;
    });

    // Criterios Meta Quest 3 / WebXR
    const MAX_RECOMMENDED_TRIANGLES = 120000;
    const MAX_RECOMMENDED_MESHES = 45;

    if (metrics.triangleCount > MAX_RECOMMENDED_TRIANGLES) {
      warnings.push(
        `Triángulos excesivos (${metrics.triangleCount.toLocaleString()}). Meta Quest requiere < ${MAX_RECOMMENDED_TRIANGLES.toLocaleString()} para 90 FPS.`
      );
      recommendations.push('Aplicar decimation con ratio 0.4 - 0.6.');
    }

    if (meshCount > MAX_RECOMMENDED_MESHES) {
      warnings.push(
        `Demasiados submeshes / draw calls (${meshCount}). Recomendado < ${MAX_RECOMMENDED_MESHES}.`
      );
      recommendations.push('Consolidar submeshes por material usando mergeSceneSubMeshes.');
    }

    if (metrics.dimensions.height > 100 || metrics.dimensions.width > 200) {
      warnings.push(`Escala sobredimensionada: (${metrics.dimensions.width}m x ${metrics.dimensions.height}m x ${metrics.dimensions.depth}m).`);
      recommendations.push('Ajustar escala arquitectónica.');
    }

    return {
      isValid: warnings.length === 0,
      triangleCount: metrics.triangleCount,
      vertexCount: metrics.vertexCount,
      meshCount,
      dimensions: metrics.dimensions,
      warnings,
      recommendations,
    };
  }

  /**
   * Optimiza el modelo para su reproducción fluida en Meta Quest 3/3S.
   */
  public async optimizeModel(
    sceneGroup: THREE.Group,
    options: OptimizationOptions = { targetRatio: 0.5, makeDoubleSided: true, mergeDrawCalls: true },
    onProgress?: (percent: number) => void
  ): Promise<OptimizationResult> {
    return optimizeModelScene(sceneGroup, options, onProgress);
  }

  /**
   * Importa y posiciona el modelo dentro del escenario UNAM en el slot arquitectónico correspondiente.
   */
  public importIntoScene(
    app: XRApp,
    unamScene: UNAMScene,
    model: THREE.Group,
    slot: SceneSlot
  ): void {
    // Normalizar escala y grounding
    const metrics = computeMetrics(model);
    console.info(`[AIModelGenerator] Importando modelo en slot: "${slot}" (${metrics.triangleCount} tris)`);

    switch (slot) {
      case 'biblioteca':
        // Posicionar en la coordenada norte de la Biblioteca Central (-55m Z)
        model.position.set(0, 0, -55);
        // Ajustar escala para que mantenga altura monumental de ~36m
        if (metrics.dimensions.height > 0) {
          const targetHeight = 36;
          const factor = targetHeight / metrics.dimensions.height;
          model.scale.set(factor, factor, factor);
        }
        unamScene.replaceSlot('biblioteca', model);
        break;

      case 'rectoria':
        // Posicionada al Poniente de Las Islas (-65m X, -20m Z)
        model.position.set(-65, 0, -20);
        if (metrics.dimensions.height > 0) {
          const targetHeight = 58;
          const factor = targetHeight / metrics.dimensions.height;
          model.scale.set(factor, factor, factor);
        }
        unamScene.replaceSlot('rectoria', model);
        break;

      case 'furniture':
        // Posicionar en el andador universitario frente al usuario
        model.position.set(4, 0, -6);
        model.scale.set(1, 1, 1);
        unamScene.replaceSlot('furniture', model);
        break;

      case 'vegetation':
        // Posicionar en los jardines de Las Islas
        model.position.set(-15, 0, -18);
        unamScene.replaceSlot('vegetation', model);
        break;

      case 'custom':
      default:
        // Frente a la cámara para inspección
        model.position.set(0, 0, -12);
        unamScene.replaceSlot('custom', model);
        break;
    }

    app.audio.playSuccess();
  }
}
