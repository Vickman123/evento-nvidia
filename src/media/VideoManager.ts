import { offlineStorage, OFFLINE_ASSET_KEYS } from '../utils/OfflineStorageManager.js';

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

    // Verificar si ya existe en el DOM para evitar duplicados en recargas
    let video = document.getElementById('vxr-video-stream') as HTMLVideoElement | null;
    if (!video) {
      video = document.createElement('video');
      video.id = 'vxr-video-stream';
      video.crossOrigin = 'anonymous';
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'auto';
      video.loop = false;
      video.autoplay = false;
      video.muted = false; // Audio habilitado por defecto tras el clic del usuario
      video.volume = 1.0;

      // CRÍTICO PARA META QUEST BROWSER / ANDROID CHROMIUM:
      // Debe tener dimensiones no nulas y opacidad visible (>0) para que el compositor
      // de Chromium y MediaCodec mantengan la decodificación activa sin suspender fotogramas.
      video.style.position = 'fixed';
      video.style.bottom = '0';
      video.style.right = '0';
      video.style.width = '320px';
      video.style.height = '180px';
      video.style.opacity = '0.05';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-1';

      if (!document.body.contains(video)) {
        document.body.appendChild(video);
      }
    }

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

  /**
   * Prepara y activa la reproducción del video en respuesta a una interacción del usuario,
   * permitiendo sortear las restricciones de reproducción automática (autoplay) de los navegadores.
   * Se ejecuta síncronamente dentro del evento click del usuario.
   */
  public prime(url?: string): void {
    this.hasUserInteracted = true;
    if (!this.videoElement) {
      this.createVideoElement();
    }
    const video = this.videoElement!;
    if (url) {
      let resolvedUrl: string;
      if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        resolvedUrl = url;
      } else {
        const base = import.meta.env.BASE_URL || '/';
        const cleanBase = base.endsWith('/') ? base : `${base}/`;
        resolvedUrl = url.startsWith('assets/') ? `${cleanBase}${url}` : url;
      }

      if (video.src !== resolvedUrl && !video.src.endsWith(url)) {
        video.src = resolvedUrl;
        video.load();
      }
    }

    // Iniciar reproducción síncrona dentro del gesto del usuario
    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[VideoManager] Prime con audio bloqueado, activando modo silenciado temporal:', err);
          video.muted = true;
          video.play().catch((e) => console.warn('[VideoManager] Prime silenciado falló:', e));
        });
      }
    } catch (e) {
      console.warn('[VideoManager] Error en prime:', e);
    }
  }

  public async loadAndPlay(url: string): Promise<HTMLVideoElement> {
    if (!this.videoElement) {
      this.createVideoElement();
    }
    const video = this.videoElement!;

    // Si el video está almacenado en caché local offline (IndexedDB), usar el blob local directamente
    const localBlobUrl = await offlineStorage.getAssetBlobUrl(OFFLINE_ASSET_KEYS.VIDEO);
    const targetUrl = localBlobUrl || url;

    let resolvedUrl: string;
    if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      resolvedUrl = targetUrl;
    } else {
      const base = import.meta.env.BASE_URL || '/';
      const cleanBase = base.endsWith('/') ? base : `${base}/`;
      resolvedUrl = targetUrl.startsWith('assets/') ? `${cleanBase}${targetUrl}` : targetUrl;
    }

    if (localBlobUrl) {
      console.info('[VideoManager] Reproduciendo video institucional directamente desde memoria local (Offline Blob).');
    }

    if (video.src !== resolvedUrl && !video.src.endsWith(targetUrl)) {
      video.src = resolvedUrl;
      video.load();
    }

    if (video.paused) {
      try {
        await video.play();
        console.info('[VideoManager] Reproducción de video iniciada con audio.');
      } catch (playError) {
        console.warn('[VideoManager] Autoplay con audio bloqueado por el navegador; intentando modo silenciado temporal:', playError);
        video.muted = true;
        try {
          await video.play();
          console.info('[VideoManager] Reproducción iniciada en modo silenciado temporal.');
        } catch (err) {
          console.error('[VideoManager] No se pudo reproducir el video:', err);
        }
      }
    }

    return video;
  }

  /**
   * Reactiva el audio en caso de que el navegador haya requerido inicio silenciado.
   */
  public unmute(): void {
    if (this.videoElement && this.videoElement.muted) {
      try {
        this.videoElement.muted = false;
        this.videoElement.volume = 1.0;
        console.info('[VideoManager] Audio desmutado con éxito.');
      } catch (e) {
        console.warn('[VideoManager] Error al desmutar audio:', e);
      }
    }
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

  public restart(): void {
    if (this.videoElement) {
      this.videoElement.currentTime = 0;
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
