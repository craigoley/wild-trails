/**
 * Ambient audio — the §4.3 atmosphere subsystem, SILENT-READY (Atmosphere A1b).
 *
 * A1 (#63) synthesized the ambient (filtered-noise wind + a biome "voice"). Playtest verdict:
 * synthesized NATURE audio reads as STATIC, not wind — the uncanny-valley failure of noise
 * synthesis. A1b STRIPS the synthesis (nothing plays — no static on main) but KEEPS the
 * load-bearing plumbing every real implementation needs: this render-side subsystem shares
 * AudioEngine's single, gesture-gated AudioContext + master bus (so MUTE covers it) and keeps
 * the lifecycle interface (start on the gesture, setScene each frame, tracking biome/phase).
 *
 * The real audio direction is RECORDED ambient LOOPS (a human ears + licensing task). A future
 * slice loads those loops in start()/setScene(), routed through `this.master` so mute + the
 * iOS one-context rule carry over for free. Zero-asset was always the VISUAL identity
 * (procedural geometry) — never a vow that audio must be synthesized.
 *
 * src/game/ + src/state/ import no Web Audio (the purity guard); this changes no game behaviour.
 */

import type { BiomeId, DayPhase } from '../utils/constants';

export class AmbientAudio {
  /** The shared context + master bus — HELD for future sample-based playback (loops route
   *  through the master so mute applies). Unused while silent; the plumbing real loops need. */
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private started = false;
  private lastBiome: BiomeId | null = null;
  private lastPhase: DayPhase | null = null;

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx;
    this.master = master;
  }

  /** Has the ambient subsystem been started (post-gesture)? */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Start the ambient subsystem — call ONCE, on the user gesture (the same gate that resumes
   * the context; the iOS-critical path). Idempotent. SILENT-READY: it marks started but plays
   * NOTHING (A1's synthesis was stripped — it sounded like static). A future sample-based slice
   * loads + starts the recorded ambient loops here, through `this.master`.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    // Intentionally silent — no synthesis. Real ambient loops are loaded + started here later,
    // using this.ctx (decode) + this.master (output bus, so mute covers them).
    void this.ctx;
    void this.master;
  }

  /**
   * Reflect the live biome + phase (called each frame). Tracks state + stays a no-op when
   * nothing changed (zero per-frame work) — and plays NOTHING while silent. A future slice
   * crossfades the biome×phase loops here on a change.
   */
  setScene(biome: BiomeId, phase: DayPhase): void {
    if (!this.started) return;
    if (biome === this.lastBiome && phase === this.lastPhase) return; // unchanged -> nothing to do
    this.lastBiome = biome;
    this.lastPhase = phase;
    // Intentionally silent — a later sample-based slice crossfades the recorded loops here.
  }
}
