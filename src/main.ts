import gsap from 'gsap';
import { XRApp } from './vxr/XRApp.js';
import { ExperienceManager } from './experience/ExperienceManager.js';
import { ExperienceState } from './experience/ExperienceStates.js';
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

  // 3. Instanciar el gestor de experiencia y máquina de estados
  const experienceManager = new ExperienceManager(app);
  const performanceMonitor = new PerformanceMonitor(app);

  (window as any).__UNAM_EXPERIENCE__ = experienceManager;
  (window as any).__VXR_APP__ = app;
  (window as any).__OBSERVER_CONTROLS__ = observerControls;

  // Desactivar controles de ratón y anclar al spawn point exacto cuando se entre a WebXR inmersivo
  app.session.onStateChange((isVR) => {
    observerControls.enabled = !isVR;
    if (isVR) {
      observerControls.resetToCenter();
      app.lockVRToSpawn([0, 1.6, 6]);
      // Alinear la pantalla virtual justo frente a la mirada del usuario en VR
      experienceManager.videoScreen.placeInFrontOf(app.camera, 3.6, 0.2);
      // Si el usuario entra en WebXR desde Meta Quest Browser estando en IDLE,
      // arrancar automáticamente la experiencia y el video institucional
      if (experienceManager.currentState === ExperienceState.IDLE) {
        experienceManager.startExperience();
      }
    }
  });

  // 4. Crear barra flotante de selección de vista y reproducción de video
  createViewModeUI(observerControls, experienceManager);

  // 5. Bucle de actualización continuo
  let lastSyncTime = 0;
  app.onUpdate((delta) => {
    // Sincronizar ticker de GSAP en cada fotograma del bucle WebXR
    try {
      gsap.ticker.tick();
    } catch (e) {}

    if (!app.session.isPresenting) {
      observerControls.update(delta);
    } else {
      // En Meta Quest (WebXR), anclamos firmemente en el punto de spawn de la plaza (0, 1.6, 6)
      // Bloqueando todo desplazamiento físico o de joystick, y permitiendo rotación 360° libre de la cabeza.
      app.lockVRToSpawn([0, 1.6, 6]);
    }

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
function createViewModeUI(controls: ObserverControls, exp: ExperienceManager): void {
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

  const btnVideo = document.createElement('button');
  btnVideo.textContent = '🎬 Ver Video Institucional';
  styleButton(btnVideo, false);
  btnVideo.style.borderColor = 'rgba(0, 240, 255, 0.4)';
  btnVideo.style.color = '#38bdf8';

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

  btnVideo.addEventListener('click', () => {
    controls.setMode('ground');
    styleButton(btnGround, true);
    styleButton(btnMaqueta, false);
    if (exp.currentState === ExperienceState.IDLE) {
      exp.startExperience();
    } else {
      exp.transitionToCinema();
    }
  });

  container.appendChild(btnGround);
  container.appendChild(btnMaqueta);
  container.appendChild(btnVideo);
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

/**
 * Muestra un mensaje visual claro en caso de que ocurra un error fatal al inicializar Three.js / WebXR,
 * evitando que el usuario quede frente a una pantalla azul vacía sin retroalimentación.
 */
function showFatalError(err: unknown): void {
  const existing = document.getElementById('vxr-error-fallback');
  if (existing) return;

  const box = document.createElement('div');
  box.id = 'vxr-error-fallback';
  box.style.position = 'fixed';
  box.style.inset = '0';
  box.style.zIndex = '999999';
  box.style.background = '#070e1a';
  box.style.color = '#f8fafc';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.padding = '24px';
  box.style.textAlign = 'center';
  box.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  box.innerHTML = `
    <div style="max-width: 520px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
      <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
      <h2 style="font-size: 20px; color: #f87171; margin-bottom: 8px;">No se pudo inicializar la experiencia 3D</h2>
      <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">
        Ocurrió un inconveniente al cargar el motor gráfico WebGL / WebXR.
      </p>
      <div style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #fca5a5; text-align: left; max-height: 140px; overflow-y: auto; margin-bottom: 24px; word-break: break-all;">
        ${msg}
      </div>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button onclick="window.location.reload()" style="background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">
          ↺ Reintentar
        </button>
        <a href="operador/" style="background: #1e293b; color: #38bdf8; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          <span>Panel de Operador →</span>
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(box);
}

// Captura global de excepciones
window.addEventListener('error', (e) => {
  console.error('[VXR Window Error]', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[VXR Unhandled Rejection]', e.reason);
});

// Inicialización segura sin depender de que DOMContentLoaded no haya ocurrido todavía
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch(showFatalError);
  });
} else {
  bootstrap().catch(showFatalError);
}
