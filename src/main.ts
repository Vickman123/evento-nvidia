import { XRApp } from './vxr/XRApp.js';
import { ExperienceManager } from './experience/ExperienceManager.js';
import { PerformanceMonitor } from './utils/PerformanceMonitor.js';

/**
 * Punto de entrada principal para UNAM Immersive Experience – PC PUMA.
 * Inicializa VXR Core configurado para Meta Quest 3S, Meta Quest 3 y Desktop.
 */
async function bootstrap() {
  console.info('[VXR Core] Inicializando UNAM Immersive Experience - PC PUMA...');

  // 1. Instanciar XRApp con runtime auto-detectable y optimizaciones Quest
  const app = new XRApp({
    container: '#app',
    cameraPosition: [0, 1.6, 0],
    runtime: 'auto',
    targetFrameRate: 90,
    questOptimization: true,
    enableShadows: true,
    enableGrid: false,
    autoVRButton: false, // La entrada a WebXR se controla mediante la pantalla de bienvenida institucional
    pixelRatioCap: 1.25,  // Evita estrangulamiento térmico en Meta Quest
    fov: 65,
  });

  // 2. Instanciar el gestor de experiencia y máquina de estados
  const experienceManager = new ExperienceManager(app);
  const performanceMonitor = new PerformanceMonitor(app);

  // 3. Exponer globalmente para depuración y control en consola de desarrollo
  (window as any).__UNAM_EXPERIENCE__ = experienceManager;
  (window as any).__VXR_APP__ = app;

  // 4. Registro de telemetría y actualización periódica al canal de sincronización
  let lastSyncTime = 0;
  app.onUpdate(() => {
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

  // 5. Iniciar bucle de renderizado universal de VXR Core
  app.start();
  console.info('[VXR Core] Experiencia UNAM - PC PUMA en ejecución.');
}

window.addEventListener('DOMContentLoaded', bootstrap);
