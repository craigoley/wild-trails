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

  /** Create (or reuse) the AudioContext. Safe to call before any gesture. */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
  }

  /** Resume the context after a user gesture (required by autoplay policy). */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
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
    osc.connect(g).connect(ctx.destination);
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
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}
