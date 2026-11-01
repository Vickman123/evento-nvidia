import * as THREE from 'three';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { ModelMetrics } from '../vxr/types.js';

export interface OptimizationOptions {
  /** Target percentage of triangles to remove (e.g. 0.5 = 50% reduction) */
  targetRatio: number;
  /** Whether to recalculate vertex normals after decimation (default: true) */
  recomputeNormals?: boolean;
  /** Whether to set materials to double-sided for architectural visibility (default: true) */
  makeDoubleSided?: boolean;
  /** Consolidate fragmented meshes by material to minimize draw calls (default: true) */
  mergeDrawCalls?: boolean;
}

export interface OptimizationResult {
  optimizedScene: THREE.Group;
  metrics: ModelMetrics;
  originalTriangles: number;
  optimizedTriangles: number;
  reductionPercentage: number;
  drawCallReduction: {
    before: number;
    after: number;
  };
}

/**
 * Calculates geometry metrics (triangle count, vertex count, bounding size) for a 3D scene.
 */
export function computeMetrics(scene: THREE.Object3D): ModelMetrics {
  let triangleCount = 0;
  let vertexCount = 0;
  let meshCount = 0;

  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      meshCount++;
      const geom = mesh.geometry;
      if (geom) {
        if (geom.index) {
          triangleCount += geom.index.count / 3;
        } else if (geom.attributes.position) {
          triangleCount += geom.attributes.position.count / 3;
        }
        if (geom.attributes.position) {
          vertexCount += geom.attributes.position.count;
        }
      }
    }
  });

  const bbox = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  return {
    triangleCount: Math.round(triangleCount),
    vertexCount,
    meshCount,
    dimensions: {
      width: Number(size.x.toFixed(2)),
      height: Number(size.y.toFixed(2)),
      depth: Number(size.z.toFixed(2)),
    },
    center: [Number(center.x.toFixed(2)), Number(center.y.toFixed(2)), Number(center.z.toFixed(2))],
  };
}

/**
 * Consolidates fragmented sub-meshes sharing identical materials into unified meshes.
 * Drastically reduces draw calls from hundreds or thousands down to single digits for Meta Quest 90 FPS.
 */
export function mergeSceneSubMeshes(sourceScene: THREE.Group | THREE.Object3D): THREE.Group {
  sourceScene.updateMatrixWorld(true);

  const materialGroups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();

  sourceScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
      const mesh = child as THREE.Mesh;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const matKey = mat ? mat.uuid || mat.name || 'default_mat' : 'default_mat';

      if (!materialGroups.has(matKey)) {
        materialGroups.set(matKey, { material: mat, geometries: [] });
      }

      // Clone geometry and apply world transform so positions remain 100% accurate
      let clonedGeom = mesh.geometry.clone();
      clonedGeom.applyMatrix4(mesh.matrixWorld);

      // Normalize to non-indexed so mergeGeometries never fails due to mixed indexing
      if (clonedGeom.index) {
        clonedGeom = clonedGeom.toNonIndexed();
      }

      // Keep only standard attributes required for rendering to avoid attribute mismatch during merge
      for (const attr in clonedGeom.attributes) {
        if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
          clonedGeom.deleteAttribute(attr);
        }
      }

      if (!clonedGeom.attributes.normal) {
        clonedGeom.computeVertexNormals();
      }

      clonedGeom.morphAttributes = {};
      clonedGeom.clearGroups();

      materialGroups.get(matKey)!.geometries.push(clonedGeom);
    }
  });

  const mergedRootGroup = new THREE.Group();
  mergedRootGroup.name = 'Quest_MergedGroup';

  materialGroups.forEach(({ material, geometries }) => {
    if (geometries.length === 0) return;
    try {
      const batchSize = 250;
      for (let i = 0; i < geometries.length; i += batchSize) {
        const chunk = geometries.slice(i, i + batchSize);
        const mergedGeom = mergeGeometries(chunk, false);
        if (mergedGeom) {
          mergedGeom.computeBoundingBox();
          mergedGeom.computeBoundingSphere();
          const mergedMesh = new THREE.Mesh(mergedGeom, material);
          mergedMesh.frustumCulled = true;
          mergedMesh.castShadow = true;
          mergedMesh.receiveShadow = true;
          mergedRootGroup.add(mergedMesh);
        } else {
          chunk.forEach((g) => {
            mergedRootGroup.add(new THREE.Mesh(g, material));
          });
        }
      }
    } catch (err) {
      console.warn('[MeshOptimizer] Fallback merge failed, preserving individual meshes:', err);
      geometries.forEach((g) => {
        mergedRootGroup.add(new THREE.Mesh(g, material));
      });
    }
  });

  return mergedRootGroup;
}

/**
 * Optimizes an AI-generated model for Meta Quest 3/3S:
 * 1. Consolidates fragmented sub-meshes to minimize draw calls.
 * 2. Applies SimplifyModifier decimation to reduce triangle count to target ratio.
 * 3. Recalculates smooth vertex normals.
 * 4. Ensures double-sided rendering on architectural faces.
 */
export async function optimizeModelScene(
  sourceScene: THREE.Group,
  options: OptimizationOptions,
  onProgress?: (progressPercent: number) => void
): Promise<OptimizationResult> {
  const initialMetrics = computeMetrics(sourceScene);
  let initialMeshCount = 0;
  sourceScene.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) initialMeshCount++;
  });

  // 1. Draw call consolidation
  let workingScene: THREE.Group;
  if (options.mergeDrawCalls !== false && initialMeshCount > 8) {
    workingScene = mergeSceneSubMeshes(sourceScene);
  } else {
    workingScene = sourceScene.clone(true);
  }

  let finalMeshCount = 0;
  workingScene.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) finalMeshCount++;
  });

  // 2. Geometry decimation
  const modifier = new SimplifyModifier();
  const meshList: THREE.Mesh[] = [];

  workingScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        meshList.push(mesh);
      }
    }
  });

  const totalMeshes = meshList.length;
  let processedCount = 0;

  for (let i = 0; i < totalMeshes; i++) {
    const mesh = meshList[i];
    const geom = mesh.geometry;
    const posAttribute = geom.getAttribute('position');

    if (posAttribute && posAttribute.count > 16 && options.targetRatio > 0.05) {
      const vertCount = posAttribute.count;
      const removeCount = Math.floor(vertCount * Math.min(0.85, Math.max(0.05, options.targetRatio)));

      if (removeCount > 3) {
        try {
          const simplifiedGeom = await modifier.modify(geom, removeCount);

          if (options.recomputeNormals !== false) {
            simplifiedGeom.computeVertexNormals();
          }
          simplifiedGeom.computeBoundingBox();
          simplifiedGeom.computeBoundingSphere();

          mesh.geometry = simplifiedGeom;
        } catch (err) {
          console.warn(`[MeshOptimizer] Decimation skipped on mesh ${mesh.name || i}:`, err);
        }
      }
    }

    if (options.makeDoubleSided !== false && mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          m.side = THREE.DoubleSide;
          m.needsUpdate = true;
        });
      } else {
        mesh.material.side = THREE.DoubleSide;
        mesh.material.needsUpdate = true;
      }
    }

    processedCount++;
    if (onProgress && totalMeshes > 0) {
      onProgress(Math.round((processedCount / totalMeshes) * 100));
    }
  }

  const newMetrics = computeMetrics(workingScene);
  const reductionPercentage = initialMetrics.triangleCount > 0
    ? Math.round(((initialMetrics.triangleCount - newMetrics.triangleCount) / initialMetrics.triangleCount) * 100)
    : 0;

  return {
    optimizedScene: workingScene,
    metrics: newMetrics,
    originalTriangles: initialMetrics.triangleCount,
    optimizedTriangles: newMetrics.triangleCount,
    reductionPercentage: Math.max(0, reductionPercentage),
    drawCallReduction: {
      before: initialMeshCount,
      after: finalMeshCount,
    },
  };
}

/**
 * Exports an optimized THREE scene to binary GLB format ArrayBuffer.
 */
export function exportSceneToGLBBuffer(scene: THREE.Object3D): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          resolve(gltf);
        } else {
          // If returned as JSON object, convert to binary
          const str = JSON.stringify(gltf);
          const buf = new TextEncoder().encode(str).buffer;
          resolve(buf);
        }
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}
