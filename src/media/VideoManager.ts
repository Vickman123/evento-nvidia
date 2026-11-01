/**
 * Gestor robusto de reproducción de video institucional para Meta Quest y Desktop.
 * Controla el ciclo de vida del elemento HTML5 Video, sincronización de audio,
 * eventos de finalización y liberación de memoria.
 */

export interface VideoPlaybackStatus {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  isBuffering: boolean;
  hasEnded: boolean;
}

export type VideoEventCallback = (status: VideoPlaybackStatus) => void;

export class VideoManager {
  private videoElement: HTMLVideoElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onStatusCallback: VideoEventCallback | null = null;
  private isMuted: boolean = false;
  private isDisposed: boolean = false;
  private hasUserInteracted: boolean = false;

  constructor() {
    this.createVideoElement();
  }

  private createVideoElement(): void {
    if (this.videoElement) return;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = false;
    video.autoplay = false;
    video.muted = false; // Audio habilitado tras el click del usuario en "INICIAR EXPERIENCIA"

    video.addEventListener('ended', () => {
      console.info('[VideoManager] Video institucional finalizado.');
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    video.addEventListener('timeupdate', () => {
      this.emitStatus();
    });

    video.addEventListener('waiting', () => {
      this.emitStatus(true);
    });

    video.addEventListener('playing', () => {
      this.emitStatus(false);
    });

    video.addEventListener('error', (err) => {
      console.warn('[VideoManager] Error en reproducción de video:', err);
      // Si hay error en archivo local, permitir continuar el flujo para no bloquear el stand
      setTimeout(() => {
        if (this.onEndedCallback) this.onEndedCallback();
      }, 3000);
    });

    this.videoElement = video;
  }

  public setUserInteracted(interacted: boolean = true): void {
    this.hasUserInteracted = interacted;
  }

  public async loadAndPlay(url: string): Promise<HTMLVideoElement> {
    if (!this.videoElement) {
      this.createVideoElement();
    }
    const video = this.videoElement!;

    if (video.src !== url && !video.src.endsWith(url)) {
      video.src = url;
      video.load();
    }

    video.currentTime = 0;

    // Si el navegador bloquea autoplay con audio no silenciado, intentamos reproducir
    try {
      await video.play();
      console.info('[VideoManager] Reproducción de video iniciada con audio.');
    } catch (playError) {
      console.warn('[VideoManager] Autoplay con audio bloqueado por el navegador; intentando modo silenciado temporal:', playError);
      video.muted = true;
      try {
        await video.play();
        // Si el usuario ya interactuó, desmutear inmediatamente
        if (this.hasUserInteracted) {
          setTimeout(() => { video.muted = false; }, 300);
        }
      } catch (err) {
        console.error('[VideoManager] No se pudo reproducir el video:', err);
      }
    }

    return video;
  }

  public pause(): void {
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
    }
  }

  public resume(): void {
    if (this.videoElement && this.videoElement.paused) {
      this.videoElement.play().catch(() => {});
    }
  }

  public stopAndRelease(): void {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.currentTime = 0;
      this.videoElement.removeAttribute('src');
      this.videoElement.load(); // Libera el buffer multimedia de la memoria del navegador
    }
  }

  public onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  public onStatus(callback: VideoEventCallback): void {
    this.onStatusCallback = callback;
  }

  public getStatus(): VideoPlaybackStatus {
    const video = this.videoElement;
    if (!video) {
      return {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        progress: 0,
        isBuffering: false,
        hasEnded: false,
      };
    }

    const duration = video.duration || 0;
    const currentTime = video.currentTime || 0;
    const progress = duration > 0 ? currentTime / duration : 0;

    return {
      isPlaying: !video.paused && !video.ended,
      currentTime,
      duration,
      progress,
      isBuffering: video.readyState < 3,
      hasEnded: video.ended,
    };
  }

  private emitStatus(buffering?: boolean): void {
    if (this.onStatusCallback) {
      const status = this.getStatus();
      if (buffering !== undefined) {
        status.isBuffering = buffering;
      }
      this.onStatusCallback(status);
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public dispose(): void {
    this.stopAndRelease();
    this.videoElement = null;
    this.onEndedCallback = null;
    this.onStatusCallback = null;
    this.isDisposed = true;
  }
}
