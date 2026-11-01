import type { XRApp } from '../vxr/XRApp.js';

/**
 * Gestor de audio institucional y ambiental.
 * Aprovecha el sintetizador Web Audio procedural de VXR Core (XRAudio)
 * para generar tonos ceremoniales, retroalimentación háptico-auditiva de mandos
 * y paisajes sonoros ambientales sin dependencias de red.
 */
export class AudioManager {
  private app: XRApp;
  private audioCtx: AudioContext | null = null;
  private ambientOscillator: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.35;

  constructor(app: XRApp) {
    this.app = app;
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Inicia un fondo sonoro ambiental sutil (simulación de brisa y resonancia universitaria).
   */
  public startAmbient(): void {
    if (!this.isEnabled) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    if (this.ambientOscillator) return; // Ya en ejecución

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, ctx.currentTime); // Tono cálido A2

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(this.volume * 0.12, ctx.currentTime + 3.0);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.ambientOscillator = osc;
      this.ambientGain = gain;
    } catch (e) {
      console.warn('[AudioManager] No se pudo iniciar audio ambiental:', e);
    }
  }

  /**
   * Atenúa o apaga el fondo ambiental cuando comienza el video institucional.
   */
  public duckAmbient(duck: boolean): void {
    if (!this.ambientGain || !this.audioCtx) return;
    const ctx = this.audioCtx;
    const target = duck ? 0.0001 : this.volume * 0.12;
    this.ambientGain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
  }

  public stopAmbient(): void {
    if (this.ambientOscillator) {
      try {
        this.ambientOscillator.stop();
        this.ambientOscillator.disconnect();
      } catch {}
      this.ambientOscillator = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  /**
   * Reproduce campanadas institucionales o chimes de transición usando VXR Audio.
   */
  public playTransitionChime(): void {
    try {
      this.app.audio.playSuccess();
    } catch {}
  }

  /**
   * Tono de confirmación al presionar botón con controlador Meta Quest o puntero.
   */
  public playButtonSelectSound(): void {
    try {
      this.app.audio.playClick();
    } catch {}
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stopAmbient();
    } else {
      this.startAmbient();
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ambientGain && this.audioCtx) {
      this.ambientGain.gain.setTargetAtTime(this.volume * 0.12, this.audioCtx.currentTime, 0.2);
    }
  }

  public dispose(): void {
    this.stopAmbient();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
