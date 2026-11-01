import * as THREE from 'three';
import gsap from 'gsap';
import type { XRApp } from '../vxr/XRApp.js';

/**
 * Transiciones visuales y fundidos cinematográficos calibrados para WebXR.
 * Utiliza una viñeta esférica interna anclada a la cámara para transiciones suaves
 * (fade to dark y fade to light) que evitan desorientación en visores Meta Quest.
 */
export class CinematicTransitions {
  private app: XRApp;
  private fadeMesh: THREE.Mesh;
  private fadeMaterial: THREE.MeshBasicMaterial;

  constructor(app: XRApp) {
    this.app = app;

    // Esfera invertida pequeña anclada justo enfrente del HMD del usuario
    const fadeGeo = new THREE.SphereGeometry(0.3, 16, 12);
    this.fadeMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.0,
      depthTest: false,
    });

    this.fadeMesh = new THREE.Mesh(fadeGeo, this.fadeMaterial);
    this.fadeMesh.renderOrder = 9999;
    this.app.renderer.camera.add(this.fadeMesh);
  }

  /**
   * Fundido a negro.
   */
  public fadeOut(duration: number = 1.0): Promise<void> {
    return new Promise((resolve) => {
      gsap.killTweensOf(this.fadeMaterial);
      gsap.to(this.fadeMaterial, {
        opacity: 1.0,
        duration,
        ease: 'power2.inOut',
        onComplete: () => resolve(),
      });
    });
  }

  /**
   * Fundido desde negro a la escena.
   */
  public fadeIn(duration: number = 1.0): Promise<void> {
    return new Promise((resolve) => {
      gsap.killTweensOf(this.fadeMaterial);
      gsap.to(this.fadeMaterial, {
        opacity: 0.0,
        duration,
        ease: 'power2.inOut',
        onComplete: () => resolve(),
      });
    });
  }

  /**
   * Pulso de transición rápida (fade out -> acción -> fade in).
   */
  public async transitionPulse(action: () => void | Promise<void>, duration: number = 0.8): Promise<void> {
    await this.fadeOut(duration / 2);
    await action();
    await this.fadeIn(duration / 2);
  }

  public reset(): void {
    gsap.killTweensOf(this.fadeMaterial);
    this.fadeMaterial.opacity = 0.0;
  }

  public dispose(): void {
    this.reset();
    this.app.renderer.camera.remove(this.fadeMesh);
    this.fadeMesh.geometry.dispose();
    this.fadeMaterial.dispose();
  }
}
