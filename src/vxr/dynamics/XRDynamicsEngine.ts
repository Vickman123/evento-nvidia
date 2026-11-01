import * as THREE from 'three';

export interface XRDynamicsOptions {
  /** Target duration of a dynamic challenge in seconds (Default: 60) */
  duration?: number;
  /** Maximum concurrent active 3D target nodes (Default: 5) */
  maxNodes?: number;
  /** Custom score multipliers */
  basePoints?: number;
}

export interface XRDynamicNode {
  mesh: THREE.Mesh;
  id: string;
  points: number;
  createdAt: number;
}

/**
 * XRDynamicsEngine manages gameplay loops, calibration sessions, score tracking,
 * combo streaks, and interactive target node generation in 3D WebXR environments.
 */
export class XRDynamicsEngine {
  public score: number = 0;
  public streak: number = 1;
  public nodesCleared: number = 0;
  public isRunning: boolean = false;
  public timeRemaining: number = 60;

  private scene: THREE.Scene;
  private options: Required<XRDynamicsOptions>;
  private activeNodes: Map<string, XRDynamicNode> = new Map();
  private timerInterval: number | null = null;
  private nodeContainer: THREE.Group;

  constructor(scene: THREE.Scene, options: XRDynamicsOptions = {}) {
    this.scene = scene;
    this.options = {
      duration: options.duration ?? 60,
      maxNodes: options.maxNodes ?? 5,
      basePoints: options.basePoints ?? 100,
    };

    this.nodeContainer = new THREE.Group();
    this.nodeContainer.name = 'VXR_Dynamics_Nodes';
    this.scene.add(this.nodeContainer);
  }

  /**
   * Starts the dynamics challenge loop.
   */
  public start(): void {
    this.stop();
    this.score = 0;
    this.streak = 1;
    this.nodesCleared = 0;
    this.timeRemaining = this.options.duration;
    this.isRunning = true;

    this.spawnBatch(3);

    this.timerInterval = window.setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.complete();
      }
    }, 1000);
  }

  /**
   * Spawns a floating interactive 3D node around the player.
   */
  public spawnNode(): XRDynamicNode {
    const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Geometry: Pulsing Icosahedron / Orb
    const geo = new THREE.IcosahedronGeometry(0.24, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Random spherical coordinates in front of player
    const radius = 2.2 + Math.random() * 3.5;
    const angle = (Math.random() - 0.5) * Math.PI * 0.9;
    const height = 0.8 + Math.random() * 1.6;

    mesh.position.set(Math.sin(angle) * radius, height, -Math.cos(angle) * radius);

    mesh.userData = {
      isDynamicNode: true,
      nodeId: id,
    };

    this.nodeContainer.add(mesh);
    const node: XRDynamicNode = {
      mesh,
      id,
      points: this.options.basePoints,
      createdAt: Date.now(),
    };
    this.activeNodes.set(id, node);

    return node;
  }

  public spawnBatch(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.activeNodes.size < this.options.maxNodes) {
        this.spawnNode();
      }
    }
  }

  /**
   * Registers a hit/interaction on a dynamic node.
   */
  public hitNode(nodeMesh: THREE.Object3D): number {
    const id = nodeMesh.userData.nodeId;
    const node = this.activeNodes.get(id);
    if (!node) return 0;

    const gained = node.points * this.streak;
    this.score += gained;
    this.streak = Math.min(this.streak + 1, 5);
    this.nodesCleared++;

    // Remove from scene with cleanup
    this.nodeContainer.remove(node.mesh);
    node.mesh.geometry.dispose();
    (node.mesh.material as THREE.Material).dispose();
    this.activeNodes.delete(id);

    // Maintain node count if game active
    if (this.isRunning && this.activeNodes.size < 3) {
      this.spawnNode();
    }

    return gained;
  }

  /**
   * Per-frame animation tick for active nodes.
   */
  public update(delta: number, elapsed: number): void {
    let idx = 0;
    this.activeNodes.forEach(node => {
      node.mesh.rotation.y += delta * 1.5;
      node.mesh.rotation.x += delta * 0.8;
      node.mesh.position.y += Math.sin(elapsed * 2.0 + idx) * 0.002;
      idx++;
    });
  }

  /**
   * Completes the challenge when time expires.
   */
  public complete(): void {
    this.isRunning = false;
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Resets and stops the dynamic session.
   */
  public stop(): void {
    this.complete();
    this.activeNodes.forEach(node => {
      this.nodeContainer.remove(node.mesh);
      node.mesh.geometry.dispose();
      (node.mesh.material as THREE.Material).dispose();
    });
    this.activeNodes.clear();
  }

  public dispose(): void {
    this.stop();
    this.scene.remove(this.nodeContainer);
  }
}
