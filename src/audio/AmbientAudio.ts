/**
 * Ambient audio — the §4.3 atmosphere FOUNDATION (Atmosphere A1). A render-side subsystem
 * (like WorldRenderer): it READS the live game state (current biome + day phase) and drives
 * a continuous, CALM, zero-asset soundscape. All sound is synthesized with the Web Audio API
 * — NO audio files, ever (CLAUDE.md). It changes no game behaviour; src/game/ + src/state/
 * import no Web Audio.
 *
 * A1 = the foundation: a gentle WIND base everywhere (filtered noise + a slow "breathing"
 * LFO) + ONE biome-keyed layer (a soft airy meadow "voice"), crossfaded as you change biome.
 * A2 layers the full biome×phase soundscape (incl. birdsong).
 *
 * It SHARES AudioEngine's single AudioContext + master bus (the iOS one-context rule, and so
 * the master mute silences the ambient too) — it never creates its own context. The nodes are
 * built ONCE on start(); setScene() is a per-frame no-op unless the biome/phase changed.
 */

import { AUDIO, type BiomeId, type DayPhase } from '../utils/constants';

export class AmbientAudio {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private started = false;
  private lastBiome: BiomeId | null = null;
  private lastPhase: DayPhase | null = null;
  private voice: GainNode | null = null;

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx;
    this.master = master;
  }

  /** Has the ambient bed been started (post-gesture)? */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Build + start the continuous ambient bed — call ONCE, on the user gesture (the same gate
   * that resumes the context). Idempotent. Fades the wind in smoothly (no abrupt onset). The
   * bed always runs once started; MUTE is the master bus (so a muted player hears nothing but
   * the nodes still exist — unmute just ramps the master back up).
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // The WIND base: looping filtered noise -> a gain that fades in + "breathes" via a slow LFO.
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = AUDIO.windFilterHz;
    windFilter.Q.value = AUDIO.windFilterQ;
    const wind = ctx.createGain();
    wind.gain.value = 0;
    this.noiseSource().connect(windFilter).connect(wind).connect(this.master);
    wind.gain.linearRampToValueAtTime(AUDIO.windGain, t + AUDIO.ambientFadeInSec); // smooth onset

    // Breathing: an LFO oscillator -> depth gain -> SUMMED into the wind gain param, so the
    // level swings gently around windGain (slow, ~10s — calm, never a sudden change).
    const lfo = ctx.createOscillator();
    lfo.frequency.value = AUDIO.windLfoHz;
    const depth = ctx.createGain();
    depth.gain.value = AUDIO.windGain * AUDIO.windLfoDepth;
    lfo.connect(depth).connect(wind.gain);
    lfo.start(t);

    // The biome VOICE layer (the meadow shimmer): a second filtered-noise source, silent until
    // setScene ramps it in for the meadow (and back out elsewhere) — the crossfade.
    const voiceFilter = ctx.createBiquadFilter();
    voiceFilter.type = 'bandpass';
    voiceFilter.frequency.value = AUDIO.meadowVoiceHz;
    voiceFilter.Q.value = AUDIO.voiceFilterQ;
    const voice = ctx.createGain();
    voice.gain.value = 0;
    this.noiseSource().connect(voiceFilter).connect(voice).connect(this.master);
    this.voice = voice;
  }

  /**
   * Reflect the live biome + phase (call each frame). GUARDED to a no-op before start() and
   * whenever nothing changed — zero per-frame work / allocation. A1: the meadow voice
   * crossfades in/out on a biome change (a smooth gain ramp — never an abrupt cut); the phase
   * is tracked for A2 (no audible effect yet).
   */
  setScene(biome: BiomeId, phase: DayPhase): void {
    if (!this.started) return;
    if (biome === this.lastBiome && phase === this.lastPhase) return; // unchanged -> nothing to do
    const biomeChanged = biome !== this.lastBiome;
    this.lastBiome = biome;
    this.lastPhase = phase;
    if (biomeChanged && this.voice) {
      const target = biome === 'meadow' ? AUDIO.voiceGain : 0; // A1's one biome layer
      const g = this.voice.gain;
      const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(target, t + AUDIO.voiceCrossfadeSec); // crossfade, no abrupt cut
    }
  }

  /** A looping white-noise buffer source — the zero-asset noise primitive (random fill is fine
   *  here: this is render-side, NOT the deterministic sim). */
  private noiseSource(): AudioBufferSourceNode {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * AUDIO.noiseBufferSec);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }
}
