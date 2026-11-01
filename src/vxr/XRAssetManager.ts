import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { LoadedModel, LoadModelOptions, ModelMetrics } from './types.js';

/**
 * XRAssetManager handles asynchronous loading of glTF/GLB models,
 * computes bounding box metrics, performs ground alignment, and manages GPU memory disposal.
 */
export class XRAssetManager {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader | null = null;
  private loadedCache: Map<string, LoadedModel> = new Map();

  constructor(defaultDracoPath?: string) {
    this.gltfLoader = new GLTFLoader();

    // Configure DRACO decoder if provided or use default CDN
    const dracoPath = defaultDracoPath ?? 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(dracoPath);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  /**
   * Loads a glTF or GLB 3D model from a URL or local File instance.
   * Automatically calculates metrics, enables shadows, and centers/grounds the model.
   *
   * @param source Remote URL string, local path string, or File object.
   * @param options Configuration for grounding, centering, and progress updates.
   */
  public async loadModel(
    source: string | File,
    options: LoadModelOptions = {}
  ): Promise<LoadedModel> {
    let url: string;
    let cacheKey: string | null = null;
    let shouldRevokeBlob = false;

    if (typeof source === 'string') {
      url = source;
      cacheKey = source;
      if (this.loadedCache.has(cacheKey)) {
        return this.loadedCache.get(cacheKey)!;
      }
    } else {
      url = URL.createObjectURL(source);
      shouldRevokeBlob = true;
    }

    const gltf = await new Promise<any>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (data) => resolve(data),
        (xhr) => {
          if (options.onProgress && xhr.total > 0) {
            options.onProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => reject(error)
      );
    });

    if (shouldRevokeBlob) {
      URL.revokeObjectURL(url);
    }

    const rawScene: THREE.Group = gltf.scene;

    // 1. Traverse and configure shadows & frustum culling for Quest performance
    rawScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
      }
    });

    // 2. Compute bounding box and geometric metrics
    const metrics = this.computeMetrics(rawScene);

    // 3. Ground alignment and centering
    const autoGround = options.autoGround !== false;
    const autoCenter = options.autoCenter !== false;

    const initialBox = new THREE.Box3().setFromObject(rawScene);
    const offsetX = autoCenter ? -metrics.center[0] : 0;
    const offsetY = autoGround ? -initialBox.min.y : 0;
    const offsetZ = autoCenter ? -metrics.center[2] : 0;

    rawScene.position.set(offsetX, offsetY, offsetZ);

    // 4. Wrap inside a clean container group
    const rootGroup = new THREE.Group();
    rootGroup.name = 'VXR_ModelContainer';
    rootGroup.add(rawScene);

    // 5. Build loaded model bundle
    const result: LoadedModel = {
      group: rootGroup,
      metrics,
      rawGltf: gltf,
      dispose: () => {
        this.disposeObject(rootGroup);
        if (cacheKey) {
          this.loadedCache.delete(cacheKey);
        }
      },
    };

    if (cacheKey) {
      this.loadedCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Evaluates volume, vertex count, and triangle count of an object hierarchy.
   */
  public computeMetrics(object: THREE.Object3D): ModelMetrics {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    const center = new THREE.Vector3();
    box.getCenter(center);

    let vertexCount = 0;
    let triangleCount = 0;
    let meshCount = 0;

    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        const mesh = child as THREE.Mesh;
        const geometry = mesh.geometry;
        if (geometry) {
          const position = geometry.attributes.position;
          if (position) {
            vertexCount += position.count;
          }
          if (geometry.index) {
            triangleCount += geometry.index.count / 3;
          } else if (position) {
            triangleCount += position.count / 3;
          }
        }
      }
    });

    return {
      dimensions: {
        width: Number(size.x.toFixed(3)),
        height: Number(size.y.toFixed(3)),
        depth: Number(size.z.toFixed(3)),
      },
      center: [
        Number(center.x.toFixed(3)),
        Number(center.y.toFixed(3)),
        Number(center.z.toFixed(3)),
      ],
      vertexCount,
      triangleCount: Math.round(triangleCount),
      meshCount,
    };
  }

  /**
   * Aggressively frees GPU memory by disposing geometries, materials, and textures.
   */
  public disposeObject(root: THREE.Object3D): void {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) {
            // Dispose standard textures if present
            const m = mat as any;
            if (m.map) m.map.dispose();
            if (m.normalMap) m.normalMap.dispose();
            if (m.roughnessMap) m.roughnessMap.dispose();
            if (m.metalnessMap) m.metalnessMap.dispose();
            if (m.aoMap) m.aoMap.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            mat.dispose();
          }
        }
      }
    });

    if (root.parent) {
      root.parent.remove(root);
    }
    root.clear();
  }

  /**
   * Disposes the asset manager, clearing caches and loaders.
   */
  public dispose(): void {
    for (const model of this.loadedCache.values()) {
      model.dispose();
    }
    this.loadedCache.clear();
    if (this.dracoLoader) {
      this.dracoLoader.dispose();
      this.dracoLoader = null;
    }
  }
}
