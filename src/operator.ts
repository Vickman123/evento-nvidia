import { SyncChannel, type SyncMessage } from './utils/SyncChannel.js';
import { ExperienceState } from './experience/ExperienceStates.js';
import { offlineStorage, type CacheStatus } from './utils/OfflineStorageManager.js';

class OperatorPanelController {
  private syncChannel: SyncChannel;
  private currentState: ExperienceState = ExperienceState.IDLE;
  private isVR: boolean = false;
  private fps: number = 72;

  // Elementos DOM
  private stateBadge: HTMLElement;
  private vrStatusBadge: HTMLElement;
  private fpsDisplay: HTMLElement;
  private drawCallsDisplay: HTMLElement;
  private explorationInput: HTMLInputElement;
  private autoResetInput: HTMLInputElement;
  private videoSelect: HTMLSelectElement;
  private ambientCheckbox: HTMLInputElement;
  private logBox: HTMLElement;

  // Elementos Offline
  private offlineVideoStatus: HTMLElement | null = null;
  private offlineModelStatus: HTMLElement | null = null;
  private offlineUsageStatus: HTMLElement | null = null;
  private btnOfflineDownload: HTMLButtonElement | null = null;
  private btnOfflineClear: HTMLButtonElement | null = null;

  constructor() {
    this.syncChannel = new SyncChannel();

    // Cachear elementos
    this.stateBadge = document.getElementById('current-state-badge')!;
    this.vrStatusBadge = document.getElementById('vr-status-badge')!;
    this.fpsDisplay = document.getElementById('fps-display')!;
    this.drawCallsDisplay = document.getElementById('drawcalls-display')!;
    this.explorationInput = document.getElementById('cfg-exploration-duration') as HTMLInputElement;
    this.autoResetInput = document.getElementById('cfg-reset-duration') as HTMLInputElement;
    this.videoSelect = document.getElementById('cfg-video-path') as HTMLSelectElement;
    this.ambientCheckbox = document.getElementById('cfg-ambient-audio') as HTMLInputElement;
    this.logBox = document.getElementById('event-logs')!;

    this.offlineVideoStatus = document.getElementById('offline-video-status');
    this.offlineModelStatus = document.getElementById('offline-model-status');
    this.offlineUsageStatus = document.getElementById('offline-usage-status');
    this.btnOfflineDownload = document.getElementById('btn-offline-download') as HTMLButtonElement | null;
    this.btnOfflineClear = document.getElementById('btn-offline-clear') as HTMLButtonElement | null;

    this.bindButtons();
    this.bindSync();
    this.bindOffline();
    this.addLog('Panel de operador iniciado. Esperando conexión con el visor...');
  }

  private bindOffline(): void {
    if (this.btnOfflineDownload) {
      this.btnOfflineDownload.addEventListener('click', async () => {
        this.addLog('Iniciando descarga de video y escenario 3D para modo offline...');
        this.btnOfflineDownload!.disabled = true;
        this.btnOfflineDownload!.innerHTML = '<span>⏳ Descargando...</span>';
        try {
          await offlineStorage.downloadAllForOffline();
          this.addLog('Descarga offline completada con éxito.');
        } catch (e: any) {
          this.addLog(`Error en descarga offline: ${e?.message || e}`);
        } finally {
          this.btnOfflineDownload!.disabled = false;
          this.btnOfflineDownload!.innerHTML = '<span>📥 Descargar Todo a Memoria Local</span>';
          this.updateOfflineUI();
        }
      });
    }

    if (this.btnOfflineClear) {
      this.btnOfflineClear.addEventListener('click', async () => {
        if (confirm('¿Seguro que deseas eliminar el video y el escenario 3D de la memoria local?')) {
          await offlineStorage.clearCache();
          this.addLog('Caché local de IndexedDB limpiado.');
          this.updateOfflineUI();
        }
      });
    }

    offlineStorage.onStatus(() => this.updateOfflineUI());
    this.updateOfflineUI();
  }

  private async updateOfflineUI(): Promise<void> {
    const status = await offlineStorage.checkCacheStatus();
    if (this.offlineVideoStatus) {
      this.offlineVideoStatus.textContent = status.videoCached ? '✓ En memoria local' : 'Pendiente';
      this.offlineVideoStatus.style.color = status.videoCached ? '#10B981' : '#F59E0B';
    }
    if (this.offlineModelStatus) {
      this.offlineModelStatus.textContent = status.modelCached ? '✓ En memoria local' : 'Pendiente';
      this.offlineModelStatus.style.color = status.modelCached ? '#10B981' : '#F59E0B';
    }
    if (this.offlineUsageStatus) {
      const mb = (status.totalBytesCached / (1024 * 1024)).toFixed(1);
      this.offlineUsageStatus.textContent = `${mb} MB en uso`;
    }
  }

  private bindButtons(): void {
    document.getElementById('btn-cmd-start')?.addEventListener('click', () => {
      this.sendCommand('START');
      this.addLog('Comando enviado: INICIAR EXPERIENCIA');
    });

    document.getElementById('btn-cmd-skip-exploration')?.addEventListener('click', () => {
      this.sendCommand('SKIP_EXPLORATION');
      this.addLog('Comando enviado: SALTAR EXPLORACIÓN');
    });

    document.getElementById('btn-cmd-play-video')?.addEventListener('click', () => {
      this.sendCommand('PLAY_VIDEO');
      this.addLog('Comando enviado: REPRODUCIR VIDEO');
    });

    document.getElementById('btn-cmd-skip-outro')?.addEventListener('click', () => {
      this.sendCommand('SKIP_TO_OUTRO');
      this.addLog('Comando enviado: SALTAR AL CIERRE');
    });

    document.getElementById('btn-cmd-reset')?.addEventListener('click', () => {
      this.sendCommand('RESET');
      this.addLog('Comando enviado: REINICIAR EXPERIENCIA');
    });

    document.getElementById('btn-apply-config')?.addEventListener('click', () => {
      const explorationDuration = parseInt(this.explorationInput.value, 10) || 35;
      const autoResetDuration = parseInt(this.autoResetInput.value, 10) || 10;
      const videoPath = this.videoSelect.value;
      const ambientAudioEnabled = this.ambientCheckbox.checked;

      this.syncChannel.send({
        type: 'COMMAND',
        command: 'SET_CONFIG',
        payload: {
          explorationDuration,
          autoResetDuration,
          videoPath,
          ambientAudioEnabled,
        },
      });

      this.syncChannel.send({
        type: 'COMMAND',
        command: 'TOGGLE_AUDIO',
        payload: { enabled: ambientAudioEnabled },
      });

      this.addLog(`Configuración aplicada: Exploración=${explorationDuration}s, Reinicio=${autoResetDuration}s, Video=${videoPath}`);
    });
  }

  private bindSync(): void {
    this.syncChannel.subscribe((msg: SyncMessage) => {
      if (msg.type === 'STATE_UPDATE' && msg.payload) {
        this.updateStateUI(msg.payload.state, msg.payload.isVR);
        this.addLog(`Transición en visor: ${msg.payload.previousState || ''} ➔ ${msg.payload.state}`);
      } else if (msg.type === 'METRICS_UPDATE' && msg.payload) {
        if (msg.payload.stats) {
          this.fpsDisplay.textContent = `${msg.payload.stats.fps} FPS`;
          this.drawCallsDisplay.textContent = `${msg.payload.stats.drawCalls} calls | ${msg.payload.stats.triangles.toLocaleString()} tris`;
        }
        if (msg.payload.state) {
          this.updateStateUI(msg.payload.state, msg.payload.isVR);
        }
      }
    });
  }

  private sendCommand(command: any, payload?: any): void {
    this.syncChannel.send({
      type: 'COMMAND',
      command,
      payload,
    });
  }

  private updateStateUI(state: ExperienceState, isVR?: boolean): void {
    this.currentState = state;
    this.stateBadge.textContent = state;

    // Colores según estado
    const colorMap: Record<string, string> = {
      [ExperienceState.IDLE]: '#94A3B8',
      [ExperienceState.ENTER_XR]: '#38BDF8',
      [ExperienceState.EXPLORATION]: '#10B981',
      [ExperienceState.TRANSITION_TO_CINEMA]: '#F59E0B',
      [ExperienceState.VIDEO_PLAYBACK]: '#6366F1',
      [ExperienceState.PC_PUMA_OUTRO]: '#EC4899',
      [ExperienceState.RESET_READY]: '#D4AF37',
    };

    this.stateBadge.style.backgroundColor = colorMap[state] || '#334155';

    if (isVR !== undefined) {
      this.isVR = isVR;
      this.vrStatusBadge.textContent = isVR ? '🥽 Meta Quest VR Activo' : '🖥️ Modo Desktop / Standby';
      this.vrStatusBadge.style.color = isVR ? '#38BDF8' : '#94A3B8';
    }
  }

  private addLog(text: string): void {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.style.padding = '4px 0';
    entry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    entry.innerHTML = `<span style="color:#64748B">[${time}]</span> ${text}`;
    this.logBox.prepend(entry);

    // Mantener máximo 50 logs
    while (this.logBox.children.length > 50) {
      this.logBox.removeChild(this.logBox.lastChild!);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new OperatorPanelController();
});
