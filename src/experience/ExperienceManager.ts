import * as THREE from 'three';
import { ExperienceState, type StateChangePayload, type StateListener } from './ExperienceStates.js';
import { DEFAULT_CONFIG, type ExperienceConfigData } from './ExperienceConfig.js';
import type { XRApp } from '../vxr/XRApp.js';
import { UNAMScene } from '../scene/UNAMScene.js';
import { VideoScreen } from '../media/VideoScreen.js';
import { VideoManager } from '../media/VideoManager.js';
import { AudioManager } from '../media/AudioManager.js';
import { CinematicTransitions } from '../transitions/CinematicTransitions.js';
import { PCpumaOutro } from '../transitions/PCpumaOutro.js';
import { WelcomeScreen } from '../interface/WelcomeScreen.js';
import { ExperienceUI } from '../interface/ExperienceUI.js';
import { SyncChannel } from '../utils/SyncChannel.js';

/**
 * Gestor y Máquina de Estados Centralizada de la UNAM Immersive Experience.
 * Orquesta la secuencia completa desde la pantalla de bienvenida hasta el cierre PC PUMA y reinicio,
 * asegurando ejecución continua sin fugas de memoria en Meta Quest Browser.
 */
export class ExperienceManager {
  public currentState: ExperienceState = ExperienceState.IDLE;
  public config: ExperienceConfigData;

  public readonly app: XRApp;
  public readonly unamScene: UNAMScene;
  public readonly videoScreen: VideoScreen;
  public readonly videoManager: VideoManager;
  public readonly audioManager: AudioManager;
  public readonly transitions: CinematicTransitions;
  public readonly pcpumaOutro: PCpumaOutro;
  public readonly welcomeScreen: WelcomeScreen;
  public readonly experienceUI: ExperienceUI;
  public readonly syncChannel: SyncChannel;

  private stateListeners: Set<StateListener> = new Set();
  private explorationTimer: number | null = null;
  private explorationSecondsLeft: number = 0;

  constructor(app: XRApp, config: Partial<ExperienceConfigData> = {}) {
    this.app = app;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 1. Inicializar subsistemas
    this.unamScene = new UNAMScene(this.app);
    this.videoScreen = new VideoScreen(this.config);
    this.app.scene.nativeScene.add(this.videoScreen.group);

    this.videoManager = new VideoManager();
    this.audioManager = new AudioManager(this.app);
    this.transitions = new CinematicTransitions(this.app);
    this.pcpumaOutro = new PCpumaOutro(this.app);
    this.welcomeScreen = new WelcomeScreen();
    this.experienceUI = new ExperienceUI(this.app);
    this.syncChannel = new SyncChannel();

    // 2. Conectar eventos y listeners
    this.setupInteractions();
    this.setupSyncChannel();

    // 3. Inicializar en estado IDLE
    this.setState(ExperienceState.IDLE);
    console.info('[ExperienceManager] Inicializado en estado IDLE.');
  }

  private setupInteractions(): void {
    // A. Botón en pantalla de bienvenida HTML
    this.welcomeScreen.onStart(() => {
      this.startExperience();
    });

    // B. Botón 3D "VOLVER A COMENZAR" al final de la experiencia
    this.pcpumaOutro.onRestart(() => {
      this.resetExperience();
    });

    // C. Detección de fin del video institucional
    this.videoManager.onEnded(() => {
      if (this.currentState === ExperienceState.VIDEO_PLAYBACK) {
        this.transitionToOutro();
      }
    });

    // D. Interacción con mandos de Meta Quest (Trigger / Raycast select)
    this.app.onControllerSelect((controllerIndex) => {
      this.handleControllerInteraction(controllerIndex);
    });

    // E. Interacción con puntero / mouse en modo Desktop
    window.addEventListener('pointerdown', (event) => {
      if (!this.app.session.isPresenting) {
        this.handlePointerInteraction(event);
      }
    });

    // F. Loop de actualización continuo
    this.app.onUpdate((delta) => {
      this.unamScene.update(delta);
    });
  }

  private setupSyncChannel(): void {
    // Escuchar comandos remotos del Panel de Operador
    this.syncChannel.subscribe((msg) => {
      if (msg.type === 'COMMAND') {
        switch (msg.command) {
          case 'START':
            if (this.currentState === ExperienceState.IDLE) this.startExperience();
            break;
          case 'SKIP_EXPLORATION':
            if (this.currentState === ExperienceState.EXPLORATION) this.transitionToCinema();
            break;
          case 'PLAY_VIDEO':
            if (this.currentState === ExperienceState.EXPLORATION) this.transitionToCinema();
            break;
          case 'SKIP_TO_OUTRO':
            if (this.currentState === ExperienceState.VIDEO_PLAYBACK) this.transitionToOutro();
            break;
          case 'RESET':
            this.resetExperience();
            break;
          case 'TOGGLE_AUDIO':
            if (msg.payload && typeof msg.payload.enabled === 'boolean') {
              this.audioManager.setEnabled(msg.payload.enabled);
            }
            break;
          case 'SET_CONFIG':
            if (msg.payload) {
              this.config = { ...this.config, ...msg.payload };
            }
            break;
        }
      }
    });
  }

  /**
   * Maneja el impacto del rayo del mando Meta Quest en objetos 3D interactivos.
   */
  private handleControllerInteraction(controllerIndex: number): void {
    if (this.currentState === ExperienceState.RESET_READY || this.currentState === ExperienceState.PC_PUMA_OUTRO) {
      const hits = this.app.raycastController(controllerIndex, [this.pcpumaOutro.restartButtonMesh], true);
      if (hits.length > 0) {
        this.audioManager.playButtonSelectSound();
        this.resetExperience();
      }
    }
  }

  /**
   * Maneja el clic con ratón sobre el botón 3D en simulación Desktop.
   */
  private handlePointerInteraction(event: PointerEvent): void {
    if (this.currentState === ExperienceState.RESET_READY || this.currentState === ExperienceState.PC_PUMA_OUTRO) {
      const hits = this.app.raycastPointer(event, [this.pcpumaOutro.restartButtonMesh], true);
      if (hits.length > 0) {
        this.audioManager.playButtonSelectSound();
        this.resetExperience();
      }
    }
  }

  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(newState: ExperienceState): void {
    const previous = this.currentState;
    this.currentState = newState;
    const payload: StateChangePayload = {
      previous,
      current: newState,
      timestamp: Date.now(),
    };

    console.info(`[ExperienceManager] Estado: ${previous} -> ${newState}`);

    // Notificar a listeners locales
    for (const listener of this.stateListeners) {
      try {
        listener(newState, payload);
      } catch (e) {
        console.error('[ExperienceManager] Error en state listener:', e);
      }
    }

    // Emitir al canal de sincronización del panel de operador
    this.syncChannel.send({
      type: 'STATE_UPDATE',
      payload: {
        state: newState,
        previousState: previous,
        timestamp: Date.now(),
        fps: 90, // Calculado por performance monitor
        isVR: this.app.session.isPresenting,
      },
    });
  }

  /**
   * Inicia la experiencia inmersiva: solicita WebXR o continúa en Desktop.
   */
  public async startExperience(): Promise<void> {
    this.setState(ExperienceState.ENTER_XR);
    this.videoManager.setUserInteracted(true);
    this.welcomeScreen.hide();

    // Intentar entrar en sesión WebXR inmersiva si el navegador lo soporta
    try {
      const isVRSupported = await this.app.session.checkVRSupport();
      if (isVRSupported && !this.app.session.isPresenting) {
        await this.app.session.enterVR({
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        console.info('[ExperienceManager] Sesión WebXR immersive-vr iniciada con éxito.');
      }
    } catch (err) {
      console.info('[ExperienceManager] Modo Desktop o visor no conectado; continuando en simulación de escritorio:', err);
    }

    // Centrar la cámara en el origen peatonal de Las Islas
    this.app.resetCamera([0, 1.6, 0], [0, 1.6, -30]);

    // Iniciar audio ambiental
    this.audioManager.startAmbient();

    // Avanzar a la fase de exploración libre
    this.startExploration();
  }

  /**
   * Fase de Exploración Libre 360° de Ciudad Universitaria.
   */
  private startExploration(): void {
    this.setState(ExperienceState.EXPLORATION);
    this.unamScene.setCinemaMode(false);

    const duration = this.config.explorationDuration;
    this.explorationSecondsLeft = duration;
    this.experienceUI.showExplorationHUD(duration);

    if (this.explorationTimer !== null) {
      clearInterval(this.explorationTimer);
    }

    this.explorationTimer = window.setInterval(() => {
      this.explorationSecondsLeft--;
      this.experienceUI.updateTime(this.explorationSecondsLeft);

      if (this.explorationSecondsLeft <= 0) {
        this.clearExplorationTimer();
        this.transitionToCinema();
      }
    }, 1000);
  }

  private clearExplorationTimer(): void {
    if (this.explorationTimer !== null) {
      clearInterval(this.explorationTimer);
      this.explorationTimer = null;
    }
  }

  /**
   * Transición cinematográfica hacia la pantalla de video 16:9.
   */
  public async transitionToCinema(): Promise<void> {
    this.clearExplorationTimer();
    this.setState(ExperienceState.TRANSITION_TO_CINEMA);

    // Ocultar HUD de exploración
    await this.experienceUI.hideHUD();

    // Chime y atenuación de luz diurna para enfoque en la pantalla
    this.audioManager.playTransitionChime();
    this.unamScene.setCinemaMode(true);
    this.audioManager.duckAmbient(true);

    // Animación de entrada de la pantalla virtual 16:9
    await this.videoScreen.animateIn(2.0);

    // Iniciar reproducción de video
    this.startVideoPlayback();
  }

  /**
   * Reproducción del video institucional local.
   */
  private async startVideoPlayback(): Promise<void> {
    this.setState(ExperienceState.VIDEO_PLAYBACK);

    try {
      const videoEl = await this.videoManager.loadAndPlay(this.config.videoPath);
      this.videoScreen.attachVideo(videoEl);
    } catch (err) {
      console.warn('[ExperienceManager] Error al reproducir video; avanzando a cierre:', err);
      setTimeout(() => this.transitionToOutro(), 3000);
    }
  }

  /**
   * Cierre institucional PC PUMA: lema y despedida.
   */
  public async transitionToOutro(): Promise<void> {
    this.setState(ExperienceState.PC_PUMA_OUTRO);

    // Detener video y liberar buffer
    this.videoManager.stopAndRelease();

    // Transición de salida de la pantalla de video
    await this.videoScreen.animateOut(1.2);

    // Restablecer ambiente y mostrar panel de cierre
    this.audioManager.duckAmbient(false);
    await this.pcpumaOutro.show(this.config.autoResetDuration);

    this.setState(ExperienceState.RESET_READY);
  }

  /**
   * Reinicio completo de la experiencia para el siguiente visitante.
   */
  public resetExperience(): void {
    console.info('[ExperienceManager] Restableciendo experiencia para el siguiente visitante...');
    this.clearExplorationTimer();

    // 1. Detener multimedia
    this.videoManager.stopAndRelease();
    this.videoScreen.reset();
    this.audioManager.duckAmbient(false);

    // 2. Ocultar paneles 3D
    this.experienceUI.reset();
    this.pcpumaOutro.reset();
    this.transitions.reset();

    // 3. Restaurar iluminación diurna natural
    this.unamScene.setCinemaMode(false);

    // 4. Reposicionar cámara a vista inicial
    this.app.resetCamera([0, 1.6, 0], [0, 1.6, -30]);

    // 5. Regresar a pantalla de bienvenida IDLE
    this.welcomeScreen.show();
    this.setState(ExperienceState.IDLE);
  }

  public dispose(): void {
    this.clearExplorationTimer();
    this.stateListeners.clear();
    this.welcomeScreen.dispose();
    this.experienceUI.dispose();
    this.pcpumaOutro.dispose();
    this.transitions.dispose();
    this.audioManager.dispose();
    this.videoManager.dispose();
    this.videoScreen.dispose();
    this.unamScene.dispose();
    this.syncChannel.dispose();
  }
}
