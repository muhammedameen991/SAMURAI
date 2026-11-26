import { GameSettings } from './types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private initialized = false;
  private settings: GameSettings;
  private musicTimer: number | null = null;
  private birdTimer: number | null = null;
  private isPlayingWorld = false;
  private noteIndex = 0;

  // Japanese Hirajoshi pentatonic scale frequencies (D minor/modal)
  private readonly scale = [146.83, 164.81, 174.61, 220.0, 233.08, 293.66, 329.63, 349.23, 440.0];

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Pre-generate white/pinkish noise buffer for wind, slashes, footsteps
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }

    this.setupAmbience();
    this.initialized = true;
    this.applySettings(this.settings);
  }

  private setupAmbience(): void {
    if (!this.ctx || !this.noiseBuffer || !this.musicGain) return;

    // Continuous subtle wind bed
    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 1.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.09;

    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.musicGain);
    windSrc.start();

    // Modulate wind frequency slowly
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windFilter.frequency);
    lfo.start();
  }

  public setPlayingState(playing: boolean): void {
    this.isPlayingWorld = playing;
    if (playing) {
      this.startLoops();
    } else {
      this.stopLoops();
    }
  }

  private startLoops(): void {
    if (this.musicTimer === null) {
      this.musicTimer = window.setInterval(() => {
        if (!this.isPlayingWorld || !this.initialized || this.settings.muted) return;
        if (Math.random() < 0.72) {
          this.playKotoNote();
        }
      }, 1350);
    }
    if (this.birdTimer === null) {
      this.birdTimer = window.setInterval(() => {
        if (!this.isPlayingWorld || !this.initialized || this.settings.muted) return;
        if (Math.random() < 0.42) {
          this.playBirdChirp();
        }
      }, 3600);
    }
  }

  private stopLoops(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.birdTimer !== null) {
      clearInterval(this.birdTimer);
      this.birdTimer = null;
    }
  }

  public applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const master = settings.muted ? 0 : settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.05);
    this.musicGain.gain.setTargetAtTime(settings.musicVolume, now, 0.05);
  }

  private playKotoNote(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const step = (this.noteIndex + Math.floor(Math.random() * 3)) % this.scale.length;
    this.noteIndex = step;
    const freq = this.scale[step];

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 1.8);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.2);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 2.3);
    osc2.stop(now + 2.3);
  }

  private playBirdChirp(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const chirps = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < chirps; i++) {
      const start = now + i * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const base = 2200 + Math.random() * 900;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.32, start + 0.05);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, start + 0.11);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.022, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(start);
      osc.stop(start + 0.13);
    }
  }

  public playKatanaSlash(heavy = false): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = heavy ? 1.8 : 2.6;
    filter.frequency.setValueAtTime(heavy ? 700 : 1200, now);
    filter.frequency.exponentialRampToValueAtTime(heavy ? 2400 : 3400, now + 0.07);
    filter.frequency.exponentialRampToValueAtTime(280, now + (heavy ? 0.28 : 0.18));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(heavy ? 0.42 : 0.28, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.3 : 0.19));

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.32);

    // Subtle steel ring
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(heavy ? 1480 : 2100, now);
    ringGain.gain.setValueAtTime(0.035, now);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    ring.connect(ringGain);
    ringGain.connect(this.sfxGain);
    ring.start(now);
    ring.stop(now + 0.17);
  }

  public playSwordClash(parry = false): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const freqs = parry ? [1320, 2180, 3420] : [980, 1690, 2740];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * (0.97 + Math.random() * 0.06), now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + (parry ? 0.45 : 0.26));

      gain.gain.setValueAtTime(parry ? 0.18 : 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + (parry ? 0.46 : 0.27));

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.48);
    });
  }

  public playHitImpact(heavy = false): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 150 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(heavy ? 0.42 : 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.2, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.1);
  }

  public playFootstep(onWood = false): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = onWood ? 'bandpass' : 'lowpass';
    filter.frequency.value = onWood ? 620 + Math.random() * 140 : 420 + Math.random() * 110;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.075);
  }

  public playDodge(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.22);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.24);
  }

  public playUiClick(confirm = false): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(confirm ? 660 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(confirm ? 880 : 440, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playMissionComplete(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const notes = [293.66, 349.23, 440.0, 587.33];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + i * 0.13;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.9);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  }

  public playPickup(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public dispose(): void {
    this.stopLoops();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
