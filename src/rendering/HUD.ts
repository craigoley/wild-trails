/**
 * The HTML overlay layer (absolutely-positioned divs above the canvas). Shows
 * the current biome name, and — under `?debug=1` — a small readout of the player
 * position, current biome and whether the unlocked-bounds clamp is active this
 * frame. Kept as HTML (not three.js) so UI text stays crisp and accessible.
 *
 * READS game state, never mutates it.
 */

import type { GameState } from '../game/GameState';
import { clampActive } from '../game/World';
import { BIOMES, PLAYER } from '../utils/constants';

/** `?debug=1` in the URL turns on funnel telemetry + (later) the tuning panel. */
export function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

export class HUD {
  private readonly biomeLabel: HTMLDivElement;
  private readonly debugPanel: HTMLDivElement | null;

  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    container.appendChild(root);

    this.biomeLabel = document.createElement('div');
    this.biomeLabel.className = 'hud-biome';
    root.appendChild(this.biomeLabel);

    this.debugPanel = isDebugEnabled() ? document.createElement('div') : null;
    if (this.debugPanel) {
      this.debugPanel.className = 'hud-debug';
      root.appendChild(this.debugPanel);
    }
  }

  /** Refresh the overlay from the (read-only) game state. */
  update(state: GameState): void {
    this.biomeLabel.textContent = BIOMES[state.currentBiome].displayName;

    if (this.debugPanel) {
      const p = state.player;
      const clamped = clampActive(state.world, p.x, p.y, PLAYER.radius);
      this.debugPanel.textContent =
        `biome: ${state.currentBiome}\n` +
        `pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}\n` +
        `clamp: ${clamped ? 'yes' : 'no'}`;
    }
  }
}
