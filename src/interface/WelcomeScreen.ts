import { offlineStorage, type CacheProgress, type CacheStatus } from '../utils/OfflineStorageManager.js';

/**
 * Pantalla inicial de bienvenida en HTML/DOM (ESTADO 1: IDLE).
 * Diseñada para el stand del evento: presenta identidad institucional UNAM y PC PUMA,
 * y activa explícitamente la sesión WebXR y el audio tras el toque del visitante.
 * Incorpora un centro de control de Modo Offline para descargar y verificar
 * que el video institucional (41MB) y el escenario 3D (13MB) estén en la memoria local del visor.
 */

export class WelcomeScreen {
  private container: HTMLElement;
  private onStartCallback: (() => void) | null = null;
  private onDirectVideoCallback: (() => void) | null = null;
  private isVisible: boolean = true;

  // Elementos de la tarjeta Offline
  private offlineCard!: HTMLElement;
  private offlineIcon!: HTMLElement;
  private offlineBadge!: HTMLElement;
  private offlineDesc!: HTMLElement;
  private offlineProgressWrap!: HTMLElement;
  private offlineProgressLabel!: HTMLElement;
  private offlineProgressPercent!: HTMLElement;
  private offlineProgressBar!: HTMLElement;
  private offlineActionBtn!: HTMLButtonElement;
  private offlineExtraInfo!: HTMLElement;

  constructor() {
    this.container = this.buildDOM();
    document.body.appendChild(this.container);
    this.initOfflineControls();
  }

  private buildDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.id = 'vxr-welcome-screen';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'radial-gradient(circle at center, rgba(0, 23, 45, 0.95) 0%, rgba(2, 11, 22, 0.98) 100%)';
    wrap.style.color = '#ffffff';
    wrap.style.zIndex = '9990';
    wrap.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    wrap.style.padding = '20px';
    wrap.style.textAlign = 'center';
    wrap.style.backdropFilter = 'blur(10px)';
    wrap.style.overflowY = 'auto';
    wrap.style.transition = 'opacity 0.8s ease, visibility 0.8s ease';

    wrap.innerHTML = `
      <div style="max-width: 680px; width: 100%; display: flex; flex-direction: column; align-items: center; margin: auto;">
        <!-- Escudo / Logos -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 18px;">
          <div style="text-align: center;">
            <div style="font-size: 14px; font-weight: 700; letter-spacing: 0.15em; color: #D4AF37; text-transform: uppercase;">
              Universidad Nacional Autónoma de México
            </div>
            <div style="font-size: 12px; letter-spacing: 0.25em; color: #94A3B8; text-transform: uppercase; margin-top: 4px;">
              Ciudad Universitaria
            </div>
          </div>
        </div>

        <!-- Título Principal -->
        <h1 style="font-size: clamp(26px, 4.5vw, 40px); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 10px 0; background: linear-gradient(135deg, #FFFFFF 0%, #38BDF8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          UNAM IMMERSIVE EXPERIENCE
        </h1>

        <!-- Subtítulo Institucional PC PUMA -->
        <div style="display: inline-flex; align-items: center; gap: 10px; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 9999px; padding: 6px 18px; margin-bottom: 16px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00F0FF; box-shadow: 0 0 12px #00F0FF;"></span>
          <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: #00F0FF;">PRESENTED BY PC PUMA</span>
        </div>

        <p style="font-size: clamp(14px, 2.2vw, 17px); line-height: 1.5; color: #CBD5E1; margin: 0 0 20px 0; max-width: 560px;">
          Bienvenido a una nueva experiencia de aprendizaje inmersivo. Explora Ciudad Universitaria en 360° y disfruta el video institucional optimizado para Meta Quest.
        </p>

        <!-- Tarjeta de Modo Offline y Descarga Local -->
        <div id="offline-cache-card" style="
          width: 100%;
          max-width: 560px;
          background: rgba(7, 14, 26, 0.85);
          border: 1px solid rgba(212, 175, 55, 0.35);
          border-radius: 14px;
          padding: 16px 20px;
          margin-bottom: 24px;
          text-align: left;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="offline-icon" style="font-size: 20px;">⚡</span>
              <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.05em; color: #D4AF37; text-transform: uppercase;">
                Modo Offline (Stand del Evento)
              </span>
            </div>
            <span id="offline-badge" style="
              font-size: 11px;
              font-weight: 700;
              padding: 4px 12px;
              border-radius: 9999px;
              background: rgba(56, 189, 248, 0.15);
              color: #38BDF8;
              border: 1px solid rgba(56, 189, 248, 0.3);
            ">Verificando memoria local...</span>
          </div>

          <p id="offline-desc" style="font-size: 12.5px; line-height: 1.45; color: #94A3B8; margin-bottom: 12px;">
            Guarda el video institucional (41 MB) y el escenario 3D (13 MB) en la memoria interna del visor para reproducir sin cortes ni depender del internet del evento.
          </p>

          <!-- Barra de Progreso de Descarga Offline -->
          <div id="offline-progress-wrap" style="display: none; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #E2E8F0; margin-bottom: 6px;">
              <span id="offline-progress-label">Descargando a memoria local...</span>
              <span id="offline-progress-percent">0%</span>
            </div>
            <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 9999px; overflow: hidden;">
              <div id="offline-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #D4AF37, #00F0FF); transition: width 0.15s ease;"></div>
            </div>
          </div>

          <!-- Botón de acción offline -->
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button id="btn-download-offline" style="
              background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(0, 240, 255, 0.2) 100%);
              border: 1px solid #D4AF37;
              color: #F8FAFC;
              border-radius: 8px;
              padding: 9px 18px;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.03em;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              transition: all 0.2s ease;
              outline: none;
            ">
              <span>📥 Guardar en memoria local (54 MB)</span>
            </button>
            <span id="offline-extra-info" style="font-size: 11px; color: #64748B;">
              No requiere internet una vez completado
            </span>
          </div>
        </div>

        <!-- Botones de Acción Inmersiva -->
        <div style="display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; align-items: center;">
          <button id="btn-start-experience" style="
            background: linear-gradient(135deg, #002B7A 0%, #0284C7 100%);
            color: #FFFFFF;
            border: 1px solid #38BDF8;
            border-radius: 9999px;
            padding: 16px 36px;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            cursor: pointer;
            box-shadow: 0 12px 32px -4px rgba(14, 165, 233, 0.5);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
            display: flex;
            align-items: center;
            gap: 10px;
          ">
            <span>🥽 INICIAR EXPERIENCIA Y VER VIDEO</span>
          </button>

          <button id="btn-direct-video" style="
            background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
            color: #070e1a;
            border: 1px solid #ffd700;
            border-radius: 9999px;
            padding: 16px 36px;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            cursor: pointer;
            box-shadow: 0 12px 32px -4px rgba(212, 175, 55, 0.5);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
            display: flex;
            align-items: center;
            gap: 10px;
          ">
            <span>🎬 ENTRAR DIRECTO A VIDEO</span>
          </button>
        </div>

        <!-- Indicador de compatibilidad Meta Quest -->
        <div style="margin-top: 28px; font-size: 12px; color: #64748B; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;">
          <span>Optimizado para Meta Quest 3S, Meta Quest 3 y Meta Quest Browser</span>
          <span>•</span>
          <span style="color: #D4AF37;">Powered by VXR Core</span>
        </div>
      </div>
    `;

    // Vincular botones principales
    const startBtn = wrap.querySelector('#btn-start-experience') as HTMLButtonElement;
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.transform = 'scale(1.05)';
      startBtn.style.boxShadow = '0 16px 40px -4px rgba(14, 165, 233, 0.7)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.transform = 'scale(1.0)';
      startBtn.style.boxShadow = '0 12px 32px -4px rgba(14, 165, 233, 0.5)';
    });
    startBtn.addEventListener('click', () => {
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback();
      }
    });

    const videoBtn = wrap.querySelector('#btn-direct-video') as HTMLButtonElement;
    if (videoBtn) {
      videoBtn.addEventListener('mouseenter', () => {
        videoBtn.style.transform = 'scale(1.05)';
        videoBtn.style.boxShadow = '0 16px 40px -4px rgba(212, 175, 55, 0.7)';
      });
      videoBtn.addEventListener('mouseleave', () => {
        videoBtn.style.transform = 'scale(1.0)';
        videoBtn.style.boxShadow = '0 12px 32px -4px rgba(212, 175, 55, 0.5)';
      });
      videoBtn.addEventListener('click', () => {
        this.hide();
        if (this.onDirectVideoCallback) {
          this.onDirectVideoCallback();
        }
      });
    }

    return wrap;
  }

  private initOfflineControls(): void {
    this.offlineCard = this.container.querySelector('#offline-cache-card') as HTMLElement;
    this.offlineIcon = this.container.querySelector('#offline-icon') as HTMLElement;
    this.offlineBadge = this.container.querySelector('#offline-badge') as HTMLElement;
    this.offlineDesc = this.container.querySelector('#offline-desc') as HTMLElement;
    this.offlineProgressWrap = this.container.querySelector('#offline-progress-wrap') as HTMLElement;
    this.offlineProgressLabel = this.container.querySelector('#offline-progress-label') as HTMLElement;
    this.offlineProgressPercent = this.container.querySelector('#offline-progress-percent') as HTMLElement;
    this.offlineProgressBar = this.container.querySelector('#offline-progress-bar') as HTMLElement;
    this.offlineActionBtn = this.container.querySelector('#btn-download-offline') as HTMLButtonElement;
    this.offlineExtraInfo = this.container.querySelector('#offline-extra-info') as HTMLElement;

    // Conectar botón de descarga
    this.offlineActionBtn.addEventListener('click', () => {
      this.startOfflineDownload();
    });

    // Suscribirse a eventos de progreso
    offlineStorage.onProgress((progress: CacheProgress) => {
      this.handleCacheProgress(progress);
    });

    // Suscribirse a eventos de estado
    offlineStorage.onStatus((status: CacheStatus) => {
      this.handleCacheStatus(status);
    });

    // Comprobar estado inicial
    offlineStorage.checkCacheStatus().then((status) => {
      this.handleCacheStatus(status);
      // Si estamos en línea y no está descargado, sugerir o auto-iniciar en segundo plano
      if (!status.isFullyCached && navigator.onLine) {
        // Auto-descarga en segundo plano tras 1.5 segundos para comodidad del usuario
        setTimeout(() => {
          if (!status.isFullyCached) {
            this.startOfflineDownload();
          }
        }, 1500);
      }
    });
  }

  private startOfflineDownload(): void {
    this.offlineProgressWrap.style.display = 'block';
    this.offlineActionBtn.disabled = true;
    this.offlineActionBtn.style.opacity = '0.6';
    this.offlineActionBtn.innerHTML = '<span>⏳ Guardando...</span>';

    offlineStorage.downloadAllForOffline().catch((err) => {
      console.error('[WelcomeScreen] Error en descarga offline:', err);
      this.offlineActionBtn.disabled = false;
      this.offlineActionBtn.style.opacity = '1';
      this.offlineActionBtn.innerHTML = '<span>⚠️ Reintentar descarga</span>';
    });
  }

  private handleCacheProgress(progress: CacheProgress): void {
    if (progress.status === 'downloading' || progress.status === 'saving') {
      this.offlineProgressWrap.style.display = 'block';
      const percent = progress.overallPercent;
      this.offlineProgressBar.style.width = `${percent}%`;
      this.offlineProgressPercent.textContent = `${percent}%`;

      const mbLoaded = (progress.loadedBytes / (1024 * 1024)).toFixed(1);
      const mbTotal = (progress.totalBytes / (1024 * 1024)).toFixed(1);

      if (progress.assetKey.includes('video')) {
        this.offlineProgressLabel.textContent = `Descargando video institucional: ${percent}% (${mbLoaded} / ${mbTotal} MB)...`;
      } else if (progress.assetKey.includes('diorama')) {
        this.offlineProgressLabel.textContent = `Descargando escenario 3D: ${percent}% (${mbLoaded} / ${mbTotal} MB)...`;
      } else {
        this.offlineProgressLabel.textContent = `Guardando en memoria interna: ${percent}%...`;
      }

      this.offlineBadge.textContent = `Descargando (${percent}%)`;
      this.offlineBadge.style.color = '#F59E0B';
      this.offlineBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      this.offlineBadge.style.background = 'rgba(245, 158, 11, 0.15)';
    } else if (progress.status === 'ready') {
      this.offlineProgressWrap.style.display = 'none';
      this.offlineProgressBar.style.width = '100%';
    } else if (progress.status === 'error') {
      this.offlineProgressLabel.textContent = `Error: ${progress.errorMessage || 'No se pudo completar la descarga'}`;
      this.offlineBadge.textContent = 'Error de descarga';
      this.offlineBadge.style.color = '#EF4444';
      this.offlineBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      this.offlineBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      this.offlineActionBtn.disabled = false;
      this.offlineActionBtn.style.opacity = '1';
      this.offlineActionBtn.innerHTML = '<span>⚠️ Reintentar guardado</span>';
    }
  }

  private handleCacheStatus(status: CacheStatus): void {
    if (status.isFullyCached) {
      this.offlineIcon.textContent = '⚡';
      this.offlineBadge.textContent = '✓ 100% GUARDADO LOCALMENTE';
      this.offlineBadge.style.color = '#10B981';
      this.offlineBadge.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      this.offlineBadge.style.background = 'rgba(16, 185, 129, 0.15)';

      const totalMB = (status.totalBytesCached / (1024 * 1024)).toFixed(1);
      this.offlineDesc.innerHTML = `
        <strong style="color: #38BDF8;">¡Todo listo para usar sin internet!</strong><br/>
        El video institucional (41 MB) y el escenario 3D (13 MB) están almacenados en la memoria del visor (${totalMB} MB). No requieres internet para presentar en el evento.
      `;

      this.offlineActionBtn.disabled = false;
      this.offlineActionBtn.style.opacity = '1';
      this.offlineActionBtn.style.background = 'rgba(16, 185, 129, 0.15)';
      this.offlineActionBtn.style.borderColor = '#10B981';
      this.offlineActionBtn.style.color = '#10B981';
      this.offlineActionBtn.innerHTML = '<span>✓ Actualizar / Re-descargar</span>';
      this.offlineExtraInfo.textContent = 'Memoria local activa • Modo offline listo';
      this.offlineExtraInfo.style.color = '#10B981';
    } else {
      this.offlineBadge.textContent = 'Conectado a internet';
      this.offlineBadge.style.color = '#38BDF8';
      this.offlineBadge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      this.offlineBadge.style.background = 'rgba(56, 189, 248, 0.1)';

      this.offlineActionBtn.disabled = false;
      this.offlineActionBtn.style.opacity = '1';
      this.offlineActionBtn.innerHTML = '<span>📥 Guardar en memoria local (54 MB)</span>';
      this.offlineExtraInfo.textContent = 'Recomendado antes de iniciar en el stand';
    }
  }

  public onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  public onDirectVideo(callback: () => void): void {
    this.onDirectVideoCallback = callback;
  }

  public show(): void {
    this.isVisible = true;
    this.container.style.opacity = '1';
    this.container.style.visibility = 'visible';
    this.container.style.pointerEvents = 'auto';
  }

  public hide(): void {
    this.isVisible = false;
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
    setTimeout(() => {
      if (!this.isVisible) {
        this.container.style.visibility = 'hidden';
      }
    }, 800);
  }

  public dispose(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
