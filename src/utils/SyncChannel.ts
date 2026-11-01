/**
 * Canal de sincronización bidireccional entre la experiencia WebXR y el panel de operador.
 * Utiliza BroadcastChannel nativo (compatible con Meta Quest Browser y navegadores modernos).
 */

export interface SyncMessage {
  type: 'COMMAND' | 'STATE_UPDATE' | 'METRICS_UPDATE';
  command?: 'START' | 'SKIP_EXPLORATION' | 'PLAY_VIDEO' | 'SKIP_TO_OUTRO' | 'RESET' | 'SET_CONFIG' | 'TOGGLE_AUDIO';
  payload?: any;
  timestamp: number;
}

export type SyncCallback = (msg: SyncMessage) => void;

export class SyncChannel {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncCallback> = new Set();
  private readonly channelName = 'unam_pcpuma_experience_channel';

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch (e) {
        console.warn('[SyncChannel] BroadcastChannel no soportado o bloqueado:', e);
      }
    }

    // Fallback con localStorage para pestañas cruzadas si fuera necesario
    window.addEventListener('storage', (event) => {
      if (event.key === this.channelName && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          this.notifyListeners(parsed);
        } catch {}
      }
    });
  }

  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public send(msg: Omit<SyncMessage, 'timestamp'>): void {
    const fullMsg: SyncMessage = {
      ...msg,
      timestamp: Date.now(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(fullMsg);
      } catch {}
    }

    // Fallback localStorage
    try {
      localStorage.setItem(this.channelName, JSON.stringify(fullMsg));
    } catch {}
  }

  private notifyListeners(msg: SyncMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error('[SyncChannel] Error en listener:', err);
      }
    }
  }

  public dispose(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}
