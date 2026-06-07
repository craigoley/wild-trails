/**
 * Synthesized audio engine. Per CLAUDE.md, all sound is generated with the Web
 * Audio API — there are NO audio files, ever. The context is created up front but
 * only resumed after a user gesture (autoplay policy).
 *
 * This PR adds the catch voices: a short blip on each shake beat (rising pitch
 * with the shake index = mounting tension), a bright arpeggio on a catch, and a
 * dull downward tone on an escape. Each is a few oscillator+gain nodes created on
 * demand and torn down when they finish — no pooling needed for these one-shots.
 */

import { AUDIO } from '../utils/constants';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  /** Master bus — ALL sound (SFX one-shots + the ambient subsystem) routes through this,
   *  so a single mute (master gain -> 0) silences everything. Created with the context. */
  private masterGain: GainNode | null = null;
  private muted = false;

  /**
   * Create (or reuse) the AudioContext + master bus. Safe to call before any gesture.
   * GUARDED: if Web Audio is unavailable / a context can't be created (a headless or
   * no-audio-device context — e.g. the L2 screenshot run), this is a SILENT no-op (ctx
   * stays null; every method guards on it) — never a throw or a console error.
   */
  init(): void {
    if (this.ctx) return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return; // no Web Audio in this environment — stay silent
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : AUDIO.masterGain;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null; // creation failed (no audio device) — silent no-op
    }
  }

  /** Resume the context after a user gesture (required by autoplay policy). */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /** The shared AudioContext (null before init / when unavailable) — the ambient subsystem
   *  uses this ONE context (the iOS single-context rule), never its own. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** The master bus the ambient subsystem connects to (so mute covers it too). */
  get master(): GainNode | null {
    return this.masterGain;
  }

  /** Mute / unmute ALL sound via the master bus (a short ramp — instant-feeling, no click).
   *  Persisted by the caller; the flag is remembered so the glyph + next toggle stay in sync. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(muted ? 0 : AUDIO.masterGain, t + AUDIO.muteRampSec);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** A short percussive blip — one per shake beat. `index` (0-based) nudges the
   *  pitch up so tension mounts across the sequence; `passed` brightens a
   *  surviving shake vs a duller break. */
  shakeBlip(index: number, passed: boolean): void {
    const base = passed ? AUDIO.shakeBaseHz : AUDIO.shakeBaseHz * AUDIO.shakeFailPitchRatio;
    this.tone(base + index * AUDIO.shakeStepHz, AUDIO.blipDuration, passed ? 'triangle' : 'square', AUDIO.blipGain);
  }

  /** A bright two-note flourish on a successful catch. */
  catchTone(): void {
    this.tone(AUDIO.catchHz, AUDIO.catchDuration, 'triangle', AUDIO.catchGain);
    this.tone(AUDIO.catchHz * AUDIO.catchHarmonicRatio, AUDIO.catchHarmonicDuration, 'triangle', AUDIO.catchHarmonicGain, AUDIO.catchHarmonicDelay);
  }

  /** A dull downward tone on an escape. */
  escapeTone(): void {
    this.glide(AUDIO.escapeHz, AUDIO.escapeHz * AUDIO.escapeGlideRatio, AUDIO.escapeDuration, AUDIO.escapeGain);
  }

  /** A soft confirmation blip when bait is deployed. */
  baitBlip(): void {
    this.tone(AUDIO.baitHz, AUDIO.baitDuration, 'sine', AUDIO.baitGain);
  }

  /** A two-note rising chime on a mission completion. */
  missionTone(): void {
    this.tone(AUDIO.missionHz, AUDIO.missionDuration, 'triangle', AUDIO.missionGain);
    this.tone(AUDIO.missionHz * AUDIO.missionHarmonicRatio, AUDIO.missionDuration, 'triangle', AUDIO.missionGain, AUDIO.missionDuration);
  }

  /** A three-note rising fanfare when a new area unlocks (the spine's payoff). */
  unlockFanfare(): void {
    this.tone(AUDIO.unlockHz, AUDIO.missionDuration, 'triangle', AUDIO.unlockGain);
    this.tone(AUDIO.unlockHz * AUDIO.unlockNote2Ratio, AUDIO.missionDuration, 'triangle', AUDIO.unlockGain, AUDIO.missionDuration);
    this.tone(AUDIO.unlockHz * AUDIO.unlockNote3Ratio, AUDIO.missionDuration * AUDIO.unlockNote3DurScale, 'triangle', AUDIO.unlockGain, AUDIO.missionDuration * 2);
  }

  /** A low "denied" buzz when a deploy is blocked (out of bait). */
  denyBlip(): void {
    this.tone(AUDIO.denyHz, AUDIO.denyDuration, 'square', AUDIO.denyGain);
  }

  // --- Primitives -----------------------------------------------------------

  /** One oscillator note with a quick attack + exponential decay. */
  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.masterGain ?? ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A note that glides from `from` to `to` over `dur`. */
  private glide(from: number, to: number, dur: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.masterGain ?? ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}
