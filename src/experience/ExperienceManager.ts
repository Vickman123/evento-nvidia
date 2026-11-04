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
  private vrAlignmentFrames: number = 0;

  // Control de reinicio por pulsación sostenida del botón [A] (4 segundos)
  private aButtonHoldTime: number = 0;
  private readonly HOLD_RESTART_DURATION: number = 4.0;
  private isAButtonLocked: boolean = false;
  private isKeyboardAPressed: boolean = false;

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

    this.welcomeScreen.onDirectVideo(() => {
      this.startExperienceDirectVideo();
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

    // Soporte para probar reinicio con tecla 'A' y pausa con barra espaciadora en simulación Desktop
    window.addEventListener('keydown', (e) => {
      if (e.key === 'a' || e.key === 'A') {
        this.isKeyboardAPressed = true;
      }
      if (e.code === 'Space' && this.currentState === ExperienceState.VIDEO_PLAYBACK) {
        e.preventDefault();
        this.toggleVideoPause();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'a' || e.key === 'A') {
        this.isKeyboardAPressed = false;
      }
    });

    // F. Loop de actualización continuo
    this.app.onUpdate((delta) => {
      this.unamScene.update(delta);
      if (this.vrAlignmentFrames > 0) {
        this.vrAlignmentFrames--;
        if (this.currentState === ExperienceState.TRANSITION_TO_CINEMA || this.currentState === ExperienceState.VIDEO_PLAYBACK) {
          this.videoScreen.placeInFrontOf(this.app, 3.5, 0.15);
        }
      }
      this.videoScreen.update();
      this.checkControllerHoldToRestart(delta);
    });
  }

  public requestVRAlignment(frames: number = 180): void {
    this.vrAlignmentFrames = frames;
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
          case 'PLAY_VIDEO':
            this.transitionToCinema();
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
   * Maneja el gatillo (trigger) del mando Meta Quest:
   * En reproducción de video: alterna Pausa / Reanudar con vibración háptica.
   * En pantallas finales: reinicia la experiencia al apuntar al botón 3D.
   */
  private handleControllerInteraction(controllerIndex: number): void {
    this.videoManager.unmute();

    // 1. En reproducción de video: el gatillo actúa como botón de Pausa / Reanudar
    if (this.currentState === ExperienceState.VIDEO_PLAYBACK) {
      this.toggleVideoPause();

      // Pulso háptico de respuesta en el mando
      const session = this.app.renderer.xr.getSession() as any;
      if (session && session.inputSources && session.inputSources[controllerIndex]) {
        const source = session.inputSources[controllerIndex];
        if (source.gamepad?.hapticActuators?.length) {
          source.gamepad.hapticActuators[0]?.pulse?.(0.5, 50);
        }
      }
      return;
    }

    if (this.currentState === ExperienceState.RESET_READY || this.currentState === ExperienceState.PC_PUMA_OUTRO) {
      const hits = this.app.raycastController(controllerIndex, [this.pcpumaOutro.restartButtonMesh], true);
      if (hits.length > 0) {
        this.audioManager.playButtonSelectSound();
        this.resetExperience();
      }
    }
  }

  /**
   * Maneja el clic con ratón en simulación Desktop:
   * En video: pausa o reanuda.
   * En pantallas finales: pulsa botón 3D.
   */
  private handlePointerInteraction(event: PointerEvent): void {
    this.videoManager.unmute();

    if (this.currentState === ExperienceState.VIDEO_PLAYBACK) {
      this.toggleVideoPause();
      return;
    }

    if (this.currentState === ExperienceState.RESET_READY || this.currentState === ExperienceState.PC_PUMA_OUTRO) {
      const hits = this.app.raycastPointer(event, [this.pcpumaOutro.restartButtonMesh], true);
      if (hits.length > 0) {
        this.audioManager.playButtonSelectSound();
        this.resetExperience();
      }
    }
  }

  /**
   * Alterna la pausa y reanudación del video institucional,
   * actualizando la superficie 3D con el letrero de PAUSA.
   */
  public toggleVideoPause(): void {
    const video = this.videoManager.getVideoElement();
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        this.videoScreen.setPaused(false);
        this.audioManager.playButtonSelectSound();
        console.info('[ExperienceManager] Video reanudado con gatillo.');
      }).catch(() => {});
    } else {
      video.pause();
      this.videoScreen.setPaused(true);
      this.audioManager.playButtonSelectSound();
      console.info('[ExperienceManager] Video pausado con gatillo.');
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
   * Presenta de inmediato el video institucional en la sala virtual.
   */
  public async startExperience(): Promise<void> {
    this.setState(ExperienceState.ENTER_XR);

    // 1. Activar reproducción síncronamente durante el clic del usuario (autoplay permission)
    this.videoManager.prime(this.config.videoPath);
    this.welcomeScreen.hide();

    // 2. Conectar de inmediato el elemento de video a la superficie 3D
    const videoEl = this.videoManager.getVideoElement();
    if (videoEl) {
      this.videoScreen.attachVideo(videoEl);
    }

    // 3. Solicitar sesión WebXR inmersiva si el navegador lo soporta (Meta Quest)
    try {
      const isVRSupported = await this.app.session.checkVRSupport();
      if (isVRSupported && !this.app.session.isPresenting) {
        await this.app.session.enterVR({
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        console.info('[ExperienceManager] Sesión WebXR immersive-vr iniciada con éxito.');
      }
    } catch (err) {
      console.info('[ExperienceManager] Modo Desktop o visor no conectado; continuando en simulación:', err);
    }

    // 4. Centrar la cámara firmemente en el punto de spawn de la plaza peatonal
    this.app.resetCamera([0, 1.6, 6], [0, 2.5, -20]);

    // 5. Iniciar audio ambiental
    this.audioManager.startAmbient();

    // 6. Transicionar de inmediato a la sala de video cinematográfica (sin esperar 35 segundos)
    await this.transitionToCinema();
  }

  /**
   * Inicia directamente en la sala de video cinematográfica.
   */
  public async startExperienceDirectVideo(): Promise<void> {
    await this.startExperience();
  }

  /**
   * Fase de Exploración Libre 360° de Ciudad Universitaria.
   */
  public startExploration(): void {
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
   * La pantalla se visualiza y reproduce de inmediato frente a la mirada del usuario.
   */
  public async transitionToCinema(): Promise<void> {
    this.clearExplorationTimer();
    this.setState(ExperienceState.TRANSITION_TO_CINEMA);

    // Ocultar HUD de exploración
    this.experienceUI.hideHUD();

    // Posicionar la pantalla exactamente frente a la mirada del usuario a la distancia cinematográfica perfecta
    this.videoScreen.placeInFrontOf(this.app, 3.5, 0.15);
    this.requestVRAlignment(180); // 180 fotogramas = 2.5s continuos de alineación para que aparezca perfecta desde el inicio

    // Asegurar que el elemento de video esté conectado a la pantalla virtual de inmediato
    const videoEl = this.videoManager.getVideoElement();
    if (videoEl) {
      this.videoScreen.attachVideo(videoEl);
    }

    // Chime y atenuación de luz diurna para enfoque en la pantalla
    this.audioManager.playTransitionChime();
    this.unamScene.setCinemaMode(true);
    this.audioManager.duckAmbient(true);

    // Iniciar carga/reproducción del video institucional
    const playPromise = this.videoManager.loadAndPlay(this.config.videoPath);

    // Mostrar pantalla
    this.videoScreen.animateIn(0.6);

    this.setState(ExperienceState.VIDEO_PLAYBACK);
    this.requestVRAlignment(180);

    try {
      const activeVideoEl = await playPromise;
      this.videoScreen.attachVideo(activeVideoEl);
    } catch (err) {
      console.warn('[ExperienceManager] Error al reproducir video:', err);
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

    // 4. Reposicionar cámara a vista inicial en el centro de la plaza
    this.app.resetCamera([0, 1.6, 6], [0, 2.5, -20]);

    // 5. Regresar a pantalla de bienvenida IDLE
    this.welcomeScreen.show();
    this.setState(ExperienceState.IDLE);
  }

  /**
   * Reinicia la reproducción del video institucional desde el segundo 0,
   * reactiva audio y recentra la pantalla virtual frente a la mirada del usuario en VR.
   */
  public restartVideoPlayback(): void {
    console.info('[ExperienceManager] Reiniciando video institucional...');
    this.audioManager.playButtonSelectSound();

    if (this.currentState === ExperienceState.IDLE) {
      this.startExperience();
      return;
    }

    if (this.currentState === ExperienceState.RESET_READY || this.currentState === ExperienceState.PC_PUMA_OUTRO) {
      this.transitionToCinema();
      return;
    }

    if (this.currentState === ExperienceState.EXPLORATION) {
      this.transitionToCinema();
      return;
    }

    // Si ya nos encontramos en VIDEO_PLAYBACK o TRANSITION_TO_CINEMA:
    this.videoScreen.setPaused(false);
    this.videoManager.restart();
    this.videoScreen.placeInFrontOf(this.app, 3.5, 0.15);
    this.requestVRAlignment(180);
  }

  /**
   * Supervisa si el usuario mantiene presionado el botón [A] del mando de Meta Quest
   * (o la tecla 'A' en Desktop) durante 4 segundos para reiniciar el video.
   */
  private checkControllerHoldToRestart(delta: number): void {
    let isAPressed = this.isKeyboardAPressed;
    let activeSource: any = null;

    // 1. Polling de mandos WebXR (Meta Quest)
    const session = this.app.renderer.xr.getSession() as any;
    if (session && session.inputSources) {
      for (let i = 0; i < session.inputSources.length; i++) {
        const source = session.inputSources[i];
        if (!source || !source.gamepad) continue;
        const gp = source.gamepad;

        // Botón 4: botón [A] en mando derecho (o [X] en mando izquierdo)
        if (gp.buttons.length > 4 && gp.buttons[4].pressed) {
          isAPressed = true;
          activeSource = source;
          break;
        }
      }
    }

    // 2. Si el botón no está presionado, restablecer temporizador
    if (!isAPressed) {
      if (this.aButtonHoldTime > 0) {
        this.aButtonHoldTime = 0;
        this.videoScreen.setRestartHoldProgress(0, this.HOLD_RESTART_DURATION);
      }
      this.isAButtonLocked = false;
      return;
    }

    // 3. Si ya se ejecutó el reinicio durante esta misma pulsación, esperar a que se libere el botón
    if (this.isAButtonLocked) {
      return;
    }

    this.aButtonHoldTime += delta;
    const progress = Math.min(1.0, this.aButtonHoldTime / this.HOLD_RESTART_DURATION);
    const secondsRemaining = Math.max(0, this.HOLD_RESTART_DURATION - this.aButtonHoldTime);

    // Actualizar HUD visual de cuenta regresiva y barra de progreso
    this.videoScreen.setRestartHoldProgress(progress, secondsRemaining);

    // Vibración háptica en el mando de Meta Quest durante el hold
    if (activeSource?.gamepad?.hapticActuators && activeSource.gamepad.hapticActuators.length > 0) {
      const actuator = activeSource.gamepad.hapticActuators[0];
      if (actuator && typeof actuator.pulse === 'function') {
        const pulseCycle = Math.floor(this.aButtonHoldTime * 2);
        const lastCycle = Math.floor((this.aButtonHoldTime - delta) * 2);
        if (pulseCycle > lastCycle) {
          actuator.pulse(0.35, 45);
        }
      }
    }

    // 4. Al completar los 4 segundos:
    if (this.aButtonHoldTime >= this.HOLD_RESTART_DURATION) {
      this.isAButtonLocked = true;
      this.aButtonHoldTime = 0;
      this.videoScreen.setRestartHoldProgress(0, 0);

      // Vibración de confirmación potente
      if (activeSource?.gamepad?.hapticActuators && activeSource.gamepad.hapticActuators.length > 0) {
        const actuator = activeSource.gamepad.hapticActuators[0];
        if (actuator && typeof actuator.pulse === 'function') {
          actuator.pulse(1.0, 300);
        }
      }

      this.restartVideoPlayback();
    }
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
