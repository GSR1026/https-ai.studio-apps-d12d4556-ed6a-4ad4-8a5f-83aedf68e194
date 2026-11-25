import type { AudioSettings, DimensionMode } from './types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private unlocked = false;

  private settings: AudioSettings = {
    musicVolume: 0.45,
    sfxVolume: 0.7,
    muted: false,
    mouseSensitivity: 1.0,
  };

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(next: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...next };
    this.applyGains();
  }

  /**
   * Unlocks Web Audio on explicit user interaction (never auto-plays before interaction).
   */
  public unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyGains();
      this.startAmbience();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  private applyGains() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.muted ? 0 : 1, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume * 0.22, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume * 0.45, now, 0.03);
  }

  private startAmbience() {
    if (!this.ctx || !this.musicGain || this.droneOsc1) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 2.5;
    filter.connect(this.musicGain);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55; // A1 cyber bass drone
    osc1.connect(filter);
    osc1.start();

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 82.41; // E2 fifth harmonic
    osc2.connect(filter);
    osc2.start();

    this.droneFilter = filter;
    this.droneOsc1 = osc1;
    this.droneOsc2 = osc2;
  }

  public setAmbienceDimension(dim: DimensionMode) {
    if (!this.ctx || !this.droneFilter || !this.droneOsc2) return;
    const now = this.ctx.currentTime;
    if (dim === 'shadow') {
      this.droneFilter.frequency.setTargetAtTime(520, now, 0.25);
      this.droneOsc2.frequency.setTargetAtTime(87.31, now, 0.2); // eerie minor shift
    } else {
      this.droneFilter.frequency.setTargetAtTime(260, now, 0.25);
      this.droneOsc2.frequency.setTargetAtTime(82.41, now, 0.2);
    }
  }

  public setPaused(paused: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const target = paused ? 0.04 : this.settings.musicVolume * 0.22;
    this.musicGain.gain.setTargetAtTime(target, now, 0.08);
  }

  private canPlaySfx(): boolean {
    return Boolean(this.unlocked && this.ctx && this.sfxGain && !this.settings.muted);
  }

  public playFootstep() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const pitch = 95 + (Math.random() - 0.5) * 18;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.07);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playShoot() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const base = 740 + (Math.random() - 0.5) * 80;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.13);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playHit(isCrit: boolean, wasBlocked: boolean) {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    if (wasBlocked) {
      osc.type = 'square';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.09);
      return;
    }
    osc.type = isCrit ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 1120 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 1680 : 280, now + 0.09);
    g.gain.setValueAtTime(isCrit ? 0.34 : 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playDash() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.15);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playEchoShift(toShadow: boolean) {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sawtooth';
    if (toShadow) {
      osc1.frequency.setValueAtTime(160, now);
      osc1.frequency.exponentialRampToValueAtTime(760, now + 0.32);
      osc2.frequency.setValueAtTime(240, now);
      osc2.frequency.exponentialRampToValueAtTime(510, now + 0.32);
    } else {
      osc1.frequency.setValueAtTime(680, now);
      osc1.frequency.exponentialRampToValueAtTime(150, now + 0.28);
      osc2.frequency.setValueAtTime(480, now);
      osc2.frequency.exponentialRampToValueAtTime(110, now + 0.28);
    }
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.sfxGain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  public playEnemyAttack(isBoss = false) {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = isBoss ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isBoss ? 240 : 410, now);
    osc.frequency.exponentialRampToValueAtTime(isBoss ? 75 : 160, now + (isBoss ? 0.24 : 0.12));
    g.gain.setValueAtTime(isBoss ? 0.32 : 0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isBoss ? 0.25 : 0.13));
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isBoss ? 0.26 : 0.14));
  }

  public playEnemyExplode(isBoss = false) {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dur = isBoss ? 0.9 : 0.32;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBoss ? 700 : 950, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(isBoss ? 0.5 : 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
  }

  public playPlayerHurt() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playCoreCollect() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playBossIntro() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(58, now + 0.8);
    g.gain.setValueAtTime(0.36, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.92);
  }

  public playVictory() {
    if (!this.canPlaySfx() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  public dispose() {
    if (this.droneOsc1) {
      try {
        this.droneOsc1.stop();
      } catch {}
    }
    if (this.droneOsc2) {
      try {
        this.droneOsc2.stop();
      } catch {}
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
