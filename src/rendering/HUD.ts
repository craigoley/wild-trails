/**
 * The HTML overlay layer (absolutely-positioned divs above the canvas). Shows
 * the current biome, the session catch count, and the selected bait; under
 * `?debug=1` it adds the full spawn -> roam -> catch funnel and, during a catch,
 * the computed chance + the per-shake results — so feel can be verified against
 * the math. Kept as HTML (not three.js) so UI text stays crisp and accessible.
 *
 * READS game state, never mutates it.
 */

import type { GameState } from '../game/GameState';
import { liveAnimalCount } from '../game/GameState';
import { clampActive } from '../game/World';
import { BIOMES, PLAYER } from '../utils/constants';

/** `?debug=1` in the URL turns on funnel telemetry + (later) the tuning panel. */
export function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

export class HUD {
  private readonly biomeLabel: HTMLDivElement;
  private readonly statusLine: HTMLDivElement;
  private readonly debugPanel: HTMLDivElement | null;

  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    container.appendChild(root);

    this.biomeLabel = document.createElement('div');
    this.biomeLabel.className = 'hud-biome';
    root.appendChild(this.biomeLabel);

    this.statusLine = document.createElement('div');
    this.statusLine.className = 'hud-status';
    root.appendChild(this.statusLine);

    this.debugPanel = isDebugEnabled() ? document.createElement('div') : null;
    if (this.debugPanel) {
      this.debugPanel.className = 'hud-debug';
      root.appendChild(this.debugPanel);
    }
  }

  /** Refresh the overlay from the (read-only) game state. */
  update(state: GameState): void {
    this.biomeLabel.textContent = BIOMES[state.currentBiome].displayName;

    const bait = state.bait;
    this.statusLine.textContent =
      `Caught ${state.sessionCatches}   ·   Bait: ${bait.selected} ×${bait.counts[bait.selected]}`;

    if (this.debugPanel) {
      const p = state.player;
      const clamped = clampActive(state.world, p.x, p.y, PLAYER.radius);
      const t = state.telemetry;
      let text =
        `biome: ${state.currentBiome}  phase: ${state.dayPhase}\n` +
        `pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}  clamp: ${clamped ? 'yes' : 'no'}\n` +
        `--- spawn -> roam ---\n` +
        `eligible: ${t.eligible}  active: ${liveAnimalCount(state)}/${state.animals.length}\n` +
        `attempts: ${t.attempts}  spawned: ${t.spawned}  fled: ${t.fled}  despawned: ${t.despawned}\n` +
        `--- catch ---\n` +
        `attempts: ${t.catchAttempts}  caught: ${t.caught}  escaped: ${t.escaped}\n` +
        `lastChance: ${t.lastChance.toFixed(3)}  shakesSurvived: ${t.shakesSurvived}`;

      // During an attempt, show the live chance + per-shake DATA so the on-screen
      // animation can be checked against the resolved odds.
      const enc = state.encounter;
      if (enc) {
        const beads = enc.shakes
          .map((s, i) => (i < enc.shakeIndex ? (s.passed ? '●' : '✗') : '·'))
          .join(' ');
        text +=
          `\n--- encounter: ${enc.species}${enc.critical ? ' (CRIT)' : ''} ---\n` +
          `chance: ${enc.chance.toFixed(3)}  ${enc.caught ? 'CATCH' : 'ESCAPE'}\n` +
          `shakes: ${beads}  (${enc.phase})`;
      }
      this.debugPanel.textContent = text;
    }
  }
}
