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
import { getSpecies } from '../game/Species';
import { effectiveDetectionRadius } from '../game/Detection';
import { catchSuccessRate, type CatchBreakdown } from '../game/catchDiagnostics';
import { clamp } from '../utils/math';
import { BAIT_ORDER, BIOMES, CATCH_FX, CSS_PALETTE, PLAYER, TRACK_SIGNS } from '../utils/constants';

/** `?debug=1` in the URL turns on funnel telemetry + (later) the tuning panel. */
export function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

/** One-line "seeds×N greens×N insects×N" for the debug panel. */
function baitDebugCounts(state: GameState): string {
  return BAIT_ORDER.map((id) => `${id}×${state.bait.counts[id]}`).join('  ');
}

/** "0.85/1.00/1.20/3.50/1.00" — a catch breakdown's five factors for the panel. */
function fmtBreakdown(b: CatchBreakdown): string {
  return [b.base, b.tool, b.proximity, b.calm, b.biome].map((v) => v.toFixed(2)).join('/');
}

/** Per-target detection readout: detected y/n + effective vs base radius — the
 *  bisect tool for "which layer made it notice me". Empty when no target. */
function stealthTargetLine(state: GameState): string {
  const a = state.targetIndex >= 0 ? state.animals[state.targetIndex] : undefined;
  if (!a) return '';
  const species = getSpecies(a.species);
  const eff = effectiveDetectionRadius(species, state.stealth.factor);
  return (
    `\ndetected: ${a.aiState === 'flee' ? 'yes' : 'no'}  ` +
    `effRadius: ${eff.toFixed(2)} (base ${species.detectionRadius.toFixed(2)})`
  );
}

export class HUD {
  private readonly biomeLabel: HTMLDivElement;
  private readonly statusLine: HTMLDivElement;
  private readonly hiddenBadge: HTMLDivElement;
  private readonly resultFlash: HTMLDivElement;
  private readonly baitNotice: HTMLDivElement;
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

    // "Hidden" badge — shown while the player is in cover (the stealth affordance).
    this.hiddenBadge = document.createElement('div');
    this.hiddenBadge.className = 'hud-hidden';
    this.hiddenBadge.textContent = '🌿 Hidden';
    this.hiddenBadge.style.display = 'none';
    root.appendChild(this.hiddenBadge);

    // The big "Got it!" / "It got away!" flash — the unambiguous result signal.
    this.resultFlash = document.createElement('div');
    this.resultFlash.className = 'hud-result';
    this.resultFlash.style.opacity = '0';
    root.appendChild(this.resultFlash);

    // Bait notice ("Out of …" / "Wrong bait — ignored"), near the status line.
    this.baitNotice = document.createElement('div');
    this.baitNotice.className = 'hud-bait-notice';
    this.baitNotice.style.opacity = '0';
    root.appendChild(this.baitNotice);

    this.debugPanel = isDebugEnabled() ? document.createElement('div') : null;
    if (this.debugPanel) {
      this.debugPanel.className = 'hud-debug';
      root.appendChild(this.debugPanel);
    }
  }

  /** Refresh the overlay from the (read-only) game state. */
  update(state: GameState): void {
    this.biomeLabel.textContent = BIOMES[state.currentBiome].displayName;

    // Bait counts/selection now live in the always-visible tray (Controls); the
    // status line just carries the session catch count.
    this.statusLine.textContent = `Caught ${state.sessionCatches}`;

    this.hiddenBadge.style.display = state.stealth.inCover ? 'block' : 'none';

    // Lingering transient notice (bait scarcity / tracking hint), fading over its
    // own lifetime (ttl) so any source fades correctly.
    const notice = state.notice;
    if (notice) {
      this.baitNotice.textContent = notice.text;
      this.baitNotice.style.opacity = String(clamp(notice.timer / notice.ttl, 0, 1));
    } else {
      this.baitNotice.style.opacity = '0';
    }

    // Result flash: fade out over its remaining lifetime.
    const flash = state.resultFlash;
    if (flash) {
      this.resultFlash.textContent = flash.outcome === 'caught' ? 'Got it!' : 'It got away!';
      this.resultFlash.style.color =
        flash.outcome === 'caught' ? CSS_PALETTE.caught : CSS_PALETTE.escaped;
      this.resultFlash.style.opacity = String(clamp(flash.timer / CATCH_FX.resultFlashSec, 0, 1));
    } else {
      this.resultFlash.style.opacity = '0';
    }

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
        `lastChance: ${t.lastChance.toFixed(3)}  shakesSurvived: ${t.shakesSurvived}\n` +
        // Plan #12 diagnostics: which of the three "too easy" causes dominates.
        `--- catch diag (a:rate b:bait c:spam) ---\n` +
        `successRate: ${catchSuccessRate(t.caught, t.catchAttempts).toFixed(2)}  ` +
        `baitOn: ${t.caughtBaitOn}  baitOff: ${t.caughtBaitOff}\n` +
        `presses/target: ${t.attemptsThisTarget} (max ${t.maxAttemptsPerTarget})  ` +
        `outOfBait: ${t.outOfBaitDeploys}\n` +
        `last  base/tool/prox/calm/biome: ${fmtBreakdown(t.lastBreakdown)}\n` +
        `avg   base/tool/prox/calm/biome: ${fmtBreakdown(t.avgBreakdown)}\n` +
        `--- target ---\n` +
        `idx: ${state.targetIndex}  armed: ${state.catchArmed ? 'yes' : 'no'}  ` +
        `baited: ${state.targetBaited ? 'yes' : 'no'}\n` +
        `chance: ${state.targetChance.toFixed(3)}` +
        (state.targetIndex >= 0 && state.animals[state.targetIndex]
          ? `  baseRate: ${getSpecies(state.animals[state.targetIndex].species).baseCatchRate.toFixed(2)}`
          : '') +
        `\n--- bait ---\n` +
        `${baitDebugCounts(state)}\n` +
        `lastDeployMatched: ${state.lastDeployMatched === null ? '-' : state.lastDeployMatched ? 'yes' : 'no'}` +
        `\n--- stealth ---\n` +
        `inCover: ${state.stealth.inCover ? 'yes' : 'no'}  sneaking: ${state.stealth.sneaking ? 'yes' : 'no'}  ` +
        `factor: ${state.stealth.factor.toFixed(2)}` +
        stealthTargetLine(state) +
        // Plan #8b tracking funnel: offered -> signs found -> located -> caught.
        `\n--- track ---\n` +
        `offered: ${state.activeTrackTarget ? state.activeTrackTarget : '-'}  ` +
        `signs: ${state.track.signsFound}/${TRACK_SIGNS.length}  ` +
        `located: ${state.track.located ? 'yes' : 'no'}  caught: ${state.track.caught}`;

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
