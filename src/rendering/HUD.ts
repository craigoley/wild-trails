/**
 * The HTML overlay layer (an absolutely-positioned div above the canvas).
 * PLACEHOLDER for Phase 0 — it creates the overlay root and exposes the
 * `?debug=1` flag, but renders nothing yet. The Field-Journal readout, the catch
 * meter, biome/time-of-day and the on-screen prompts land in later phased PRs.
 *
 * Kept as HTML (not three.js) so UI text stays crisp and accessible; this layer
 * READS game state, never mutates it.
 */

import type { GameState } from '../game/GameState';

/** `?debug=1` in the URL turns on funnel telemetry + (later) the tuning panel. */
export function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

export class HUD {
  private readonly root: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    container.appendChild(this.root);
  }

  /** Refresh the overlay from the (read-only) game state. No-op placeholder. */
  update(_state: GameState): void {
    // Phase 0: nothing to draw yet.
  }
}
