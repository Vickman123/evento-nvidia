import * as THREE from 'three';

export interface ObserverControlsOptions {
  eyeHeight?: number;
  initialPosition?: [number, number, number];
  initialLookAt?: [number, number, number];
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  walkSpeed?: number;
}

/**
 * ObserverControls: Controlador de observador en primera persona para visualización arquitectónica.
 * Mantiene al usuario firme y ubicado en el centro de la plaza peatonal (sin volar ni girar el mapa involuntariamente).
 * - En Desktop: El arrastre de mouse o touch rota suavemente la cabeza (yaw/pitch) desde la posición de los ojos.
 * - Teclas WASD o flechas permiten caminar dentro de los límites de la plaza.
 * - Permite alternar instantáneamente entre la vista peatonal en el centro y la vista aérea de maqueta.
 */
export class ObserverControls {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public enabled: boolean = true;

  // Parámetros de posición fija en el centro
  public readonly eyeHeight: number;
  public readonly defaultPosition: THREE.Vector3;
  public readonly defaultLookAt: THREE.Vector3;
  public readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  public readonly walkSpeed: number;

  // Ángulos de orientación (cabeza del observador)
  private yaw: number = 0;
  private pitch: number = 0;
  private targetYaw: number = 0;
  private targetPitch: number = 0;

  // Estado de interacción
  private isPointerDown: boolean = false;
  private prevPointerX: number = 0;
  private prevPointerY: number = 0;

  // Teclado
  private keys = { forward: false, backward: false, left: false, right: false };

  // Modo de visualización: 'ground' (en el centro) o 'maqueta' (aérea isométrica)
  public mode: 'ground' | 'maqueta' = 'ground';
  private maquetaPosition = new THREE.Vector3(26, 28, 36);
  private maquetaLookAt = new THREE.Vector3(0, 6, -8);

  private isTransitioning: boolean = false;
  private transitionProgress: number = 0;
  private transitionStartPos = new THREE.Vector3();
  private transitionTargetPos = new THREE.Vector3();

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: ObserverControlsOptions = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;

    this.eyeHeight = options.eyeHeight ?? 1.6;
    const initPos = options.initialPosition ?? [0, this.eyeHeight, 6];
    const initLook = options.initialLookAt ?? [0, this.eyeHeight + 2, -22];

    this.defaultPosition = new THREE.Vector3(initPos[0], initPos[1], initPos[2]);
    this.defaultLookAt = new THREE.Vector3(initLook[0], initLook[1], initLook[2]);
    this.bounds = options.bounds ?? { minX: -12, maxX: 12, minZ: -6, maxZ: 14 };
    this.walkSpeed = options.walkSpeed ?? 3.5;

    // Configurar posición inicial exactamente en el centro
    this.camera.position.copy(this.defaultPosition);
    this.lookAt(this.defaultLookAt);

    this.initEvents();
  }

  private initEvents(): void {
    // Puntero / Ratón / Touch
    this.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());
    window.addEventListener('pointercancel', () => this.onPointerUp());

    // Teclado para desplazamiento suave
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  public setMode(newMode: 'ground' | 'maqueta'): void {
    if (this.mode === newMode && !this.isTransitioning) return;
    this.mode = newMode;
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.transitionStartPos.copy(this.camera.position);

    if (newMode === 'ground') {
      this.transitionTargetPos.copy(this.defaultPosition);
      this.targetYaw = 0;
      this.targetPitch = 0.05;
    } else {
      this.transitionTargetPos.copy(this.maquetaPosition);
    }
  }

  public resetToCenter(): void {
    this.mode = 'ground';
    this.camera.position.copy(this.defaultPosition);
    this.camera.position.y = this.eyeHeight;
    this.lookAt(this.defaultLookAt);
  }

  public lookAt(target: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(target, this.camera.position).normalize();
    this.targetYaw = Math.atan2(-dir.x, -dir.z);
    this.targetPitch = Math.asin(Math.max(-0.99, Math.min(0.99, dir.y)));
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
    this.applyRotation();
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    this.isPointerDown = true;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled || !this.isPointerDown) return;

    const deltaX = e.clientX - this.prevPointerX;
    const deltaY = e.clientY - this.prevPointerY;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;

    const sensitivity = 0.003;
    this.targetYaw -= deltaX * sensitivity;
    this.targetPitch -= deltaY * sensitivity;

    // Limitar ángulo de inclinación vertical (pitch) para evitar giros extraños
    const maxPitch = Math.PI / 2.2;
    this.targetPitch = Math.max(-maxPitch, Math.min(maxPitch, this.targetPitch));
  }

  private onPointerUp(): void {
    this.isPointerDown = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
    }
  }

  public update(delta: number): void {
    if (!this.enabled) return;

    // 1. Transición suave entre vistas si está activa
    if (this.isTransitioning) {
      this.transitionProgress += delta * 1.5;
      const t = Math.min(1, this.transitionProgress);
      const ease = t * t * (3 - 2 * t); // smoothstep

      this.camera.position.lerpVectors(this.transitionStartPos, this.transitionTargetPos, ease);

      if (this.mode === 'maqueta') {
        this.camera.lookAt(this.maquetaLookAt);
      } else {
        this.camera.lookAt(this.defaultLookAt);
      }

      if (t >= 1) {
        this.isTransitioning = false;
        if (this.mode === 'ground') {
          this.camera.position.copy(this.defaultPosition);
          this.lookAt(this.defaultLookAt);
        }
      }
      return;
    }

    if (this.mode === 'maqueta') {
      this.camera.position.copy(this.maquetaPosition);
      this.camera.lookAt(this.maquetaLookAt);
      return;
    }

    // 2. Interpolación suave de rotación de la mirada
    const damping = 0.12;
    this.yaw += (this.targetYaw - this.yaw) * damping;
    this.pitch += (this.targetPitch - this.pitch) * damping;
    this.applyRotation();

    // 3. Desplazamiento opcional con teclado limitado al perímetro de la plaza
    if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
      const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);

      const move = new THREE.Vector3();
      if (this.keys.forward) move.sub(forward);
      if (this.keys.backward) move.add(forward);
      if (this.keys.left) move.sub(right);
      if (this.keys.right) move.add(right);

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(this.walkSpeed * delta);
        this.camera.position.add(move);

        // Clampear a los límites de la plaza peatonal
        this.camera.position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.camera.position.x));
        this.camera.position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.camera.position.z));
      }
    }

    // Asegurar que la altura del observador permanezca firme a nivel de ojos
    this.camera.position.y = this.eyeHeight;
  }

  private applyRotation(): void {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }
}
