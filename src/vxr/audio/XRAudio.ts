/**
 * XRAudio provides procedural 3D/WebXR audio synthesis using the browser's native Web Audio API.
 * Requires 0 MB of external MP3/WAV downloads; all audio effects and ambient drones are
 * synthesized mathematically in real-time with zero latency and no copyright restrictions.
 */
export class XRAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private muted: boolean = false;
  private lastStepTime: number = 0;

  constructor() {
    // Lazily initialized on first user gesture or sound trigger
  }

  /**
   * Initializes or resumes the AudioContext to adhere to browser autoplay policies.
   */
  public resume(): void {
    if (!this.ctx) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (e) {
        console.warn('[XRAudio] Web Audio API not supported in this environment:', e);
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Toggles audio mute state.
   * @returns Whether audio is now muted.
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  /**
   * Returns whether audio is currently muted.
   */
  public get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Plays a subtle footstep sound when walking in the virtual environment.
   */
  public playStep(): void {
    const now = Date.now();
    if (now - this.lastStepTime < 320) return; // Debounce footstep rate
    this.lastStepTime = now;

    this.resume();
    if (!this.ctx || !this.masterGain || this.muted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Soft low thud
      const freq = 65 + Math.random() * 15;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {}
  }

  /**
   * Plays a crisp tactile UI click or laser pointer trigger sound.
   */
  public playClick(): void {
    this.resume();
    if (!this.ctx || !this.masterGain || this.muted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(240, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  /**
   * Plays a celebratory harmonic chime when a task or objective is completed.
   */
  public playSuccess(): void {
    this.resume();
    if (!this.ctx || !this.masterGain || this.muted) return;

    try {
      // 3-note ascending major chord (C5, E5, G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const startTime = this.ctx!.currentTime + idx * 0.08;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.16, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(startTime);
        osc.stop(startTime + 0.46);
      });
    } catch {}
  }

  /**
   * Plays an alert or warning tone for hazard simulation or system warnings.
   */
  public playAlert(): void {
    this.resume();
    if (!this.ctx || !this.masterGain || this.muted) return;

    try {
      [0, 0.12].forEach((delay) => {
        const t = this.ctx!.currentTime + delay;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(880, t + 0.05);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + 0.11);
      });
    } catch {}
  }

  /**
   * Plays a futuristic sci-fi warp sweep for teleportation or waypoint jumps.
   */
  public playWarp(): void {
    this.resume();
    if (!this.ctx || !this.masterGain || this.muted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(840, this.ctx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.26);
    } catch {}
  }

  /**
   * Starts a subtle synthesized ambient drone in the background.
   */
  public startAmbient(preset: 'laboratory' | 'space' | 'drone' = 'laboratory'): void {
    this.resume();
    if (!this.ctx || !this.masterGain || this.ambientGain) return;

    try {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.035, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset === 'space' ? 85 : 120, this.ctx.currentTime);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();

      const baseFreq = preset === 'space' ? 45 : 55;
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq + 1.2, this.ctx.currentTime); // Binaural beat

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      osc1.start();
      osc2.start();
      this.ambientOscs = [osc1, osc2];
    } catch {}
  }

  /**
   * Stops the active ambient background drone.
   */
  public stopAmbient(): void {
    for (const osc of this.ambientOscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.ambientOscs = [];
    if (this.ambientGain) {
      try {
        this.ambientGain.disconnect();
      } catch {}
      this.ambientGain = null;
    }
  }

  /**
   * Cleans up audio nodes and closes context.
   */
  public dispose(): void {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
