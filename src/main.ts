import { XRApp } from './vxr/XRApp.js';
import { ExperienceManager } from './experience/ExperienceManager.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';
import { ObserverControls } from './vxr/camera/ObserverControls.js';

/**
 * Punto de entrada principal para UNAM Immersive Experience – PC PUMA.
 * Inicializa VXR Core configurado para Meta Quest 3S, Meta Quest 3 y Desktop.
 * Ubica al usuario firmemente en el centro de la plaza peatonal (sin volar ni girar el mapa involuntariamente).
 */
async function bootstrap() {
  console.info('[VXR Core] Inicializando UNAM Immersive Experience - PC PUMA...');

  // 1. Instanciar XRApp con runtime auto-detectable y controles de observador fijos
  const app = new XRApp({
    container: '#app',
    cameraPosition: [0, 1.6, 6], // Firme en el centro de la plaza peatonal a 1.6m de altura
    runtime: 'auto',
    targetFrameRate: 90,
    questOptimization: true,
    enableShadows: true,
    enableGrid: false,
    autoOrbitControls: false, // Desactivar OrbitControls para evitar que la cámara vuele o gire en órbita
    autoVRButton: false,
    pixelRatioCap: 1.25,
    fov: 65,
  });

  // 2. Instanciar ObserverControls (controlador de vista en primera persona sin vuelo)
  const observerControls = new ObserverControls(
    app.camera,
    app.renderer.domElement,
    {
      eyeHeight: 1.6,
      initialPosition: [0, 1.6, 6],
      initialLookAt: [0, 2.5, -20],
      bounds: { minX: -12, maxX: 12, minZ: -4, maxZ: 14 },
      walkSpeed: 3.5,
    }
  );

  // Desactivar controles de ratón cuando se entre a WebXR inmersivo
  app.session.onStateChange((isVR) => {
    observerControls.enabled = !isVR;
    if (isVR) {
      observerControls.resetToCenter();
    }
  });

  // 3. Crear barra flotante de selección de vista (Centro vs Maqueta Aérea)
  createViewModeUI(observerControls);

  // 4. Instanciar el gestor de experiencia y máquina de estados
  const experienceManager = new ExperienceManager(app);
  const performanceMonitor = new PerformanceMonitor(app);

  (window as any).__UNAM_EXPERIENCE__ = experienceManager;
  (window as any).__VXR_APP__ = app;
  (window as any).__OBSERVER_CONTROLS__ = observerControls;

  // 5. Bucle de actualización continuo
  let lastSyncTime = 0;
  app.onUpdate((delta) => {
    observerControls.update(delta);

    const stats = performanceMonitor.update();
    const now = performance.now();
    if (now - lastSyncTime > 1000) {
      lastSyncTime = now;
      experienceManager.syncChannel.send({
        type: 'METRICS_UPDATE',
        payload: {
          stats,
          state: experienceManager.currentState,
          isVR: app.session.isPresenting,
        },
      });
    }
  });

  // 6. Iniciar bucle de renderizado universal de VXR Core
  app.start();
  console.info('[VXR Core] Experiencia UNAM - PC PUMA en ejecución en el centro de la plaza.');
}

/**
 * Crea una interfaz flotante y elegante para alternar entre la vista peatonal en el centro y la vista maqueta aérea
 */
function createViewModeUI(controls: ObserverControls): void {
  const container = document.createElement('div');
  container.id = 'vxr-view-mode-bar';
  container.style.position = 'fixed';
  container.style.bottom = '24px';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.zIndex = '90';
  container.style.display = 'flex';
  container.style.gap = '10px';
  container.style.background = 'rgba(7, 13, 24, 0.88)';
  container.style.backdropFilter = 'blur(12px)';
  container.style.border = '1px solid rgba(212, 175, 55, 0.35)';
  container.style.padding = '8px 16px';
  container.style.borderRadius = '30px';
  container.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';

  const btnGround = document.createElement('button');
  btnGround.textContent = '🚶 En el Centro (Peatonal)';
  styleButton(btnGround, true);

  const btnMaqueta = document.createElement('button');
  btnMaqueta.textContent = '📐 Vista Maqueta (Aérea)';
  styleButton(btnMaqueta, false);

  btnGround.addEventListener('click', () => {
    controls.setMode('ground');
    styleButton(btnGround, true);
    styleButton(btnMaqueta, false);
  });

  btnMaqueta.addEventListener('click', () => {
    controls.setMode('maqueta');
    styleButton(btnGround, false);
    styleButton(btnMaqueta, true);
  });

  container.appendChild(btnGround);
  container.appendChild(btnMaqueta);
  document.body.appendChild(container);
}

function styleButton(btn: HTMLButtonElement, active: boolean): void {
  btn.style.border = 'none';
  btn.style.borderRadius = '20px';
  btn.style.padding = '8px 18px';
  btn.style.fontSize = '0.85rem';
  btn.style.fontWeight = '600';
  btn.style.fontFamily = "'Inter', sans-serif";
  btn.style.cursor = 'pointer';
  btn.style.transition = 'all 0.25s ease';

  if (active) {
    btn.style.background = 'linear-gradient(135deg, #d4af37, #b8860b)';
    btn.style.color = '#070e1a';
    btn.style.boxShadow = '0 2px 12px rgba(212, 175, 55, 0.4)';
  } else {
    btn.style.background = 'transparent';
    btn.style.color = '#cbd5e1';
    btn.style.boxShadow = 'none';
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
