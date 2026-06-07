/**
 * L2 validation hooks (Validation stack — L2). RENDER/BOUNDARY layer ONLY — never
 * imported by src/game/ or src/state/, which stay PURE (L1 depends on that purity).
 *
 * These let Playwright pin a DETERMINISTIC scene for a stable screenshot:
 *   ?seed=N      — override the Date.now() boot seed (same seed -> same scene)
 *   ?unlock=all  — open every biome (so e.g. the wetland + its water pond render)
 *   ?at=x,y      — place the player (the camera follows -> frames that area)
 *   ?hide=1      — deploy a portable hide at the player (the #53 cover scene)
 * and signal first-frame-ready so the capture never races a still-loading frame.
 *
 * All of it is a NO-OP in normal play (it only acts when ?seed= is present).
 */

import { unlockBiome } from './game/World';
import { deployHide } from './game/Hide';
import { BIOME_ORDER } from './utils/constants';
import type { GameState } from './game/GameState';

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/** ?freeze=1 — pause the sim so a visual capture is timing-independent (the scene is
 *  frozen at the deterministic initial state). No-op in normal play. */
export function isFrozen(): boolean {
  return params().get('freeze') === '1';
}

/** The pinned test seed, or null in normal play (then main uses Date.now()). */
export function readTestSeed(): number | null {
  const p = params().get('seed');
  if (p === null) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n >>> 0 : null;
}

/** Apply the L2 deterministic-scene setup. No-op unless ?seed= is present (test mode). */
export function applyTestScene(game: GameState): void {
  const p = params();
  if (p.get('seed') === null) return; // only in a pinned-seed capture

  if (p.get('unlock') === 'all') {
    for (const id of BIOME_ORDER) unlockBiome(game.world, id);
  }
  const at = p.get('at');
  if (at) {
    const [x, y] = at.split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      game.player.x = x;
      game.player.y = y;
      game.player.prevX = x;
      game.player.prevY = y;
    }
  }
  if (p.get('hide') === '1') {
    deployHide(game.hide, game.player.x, game.player.y);
  }
}

/** Signal the first rendered frame (Playwright waits on `window.__renderReady` /
 *  `#app[data-ready="1"]` before capturing). Idempotent. */
export function signalRenderReady(app: HTMLElement): void {
  (window as unknown as { __renderReady?: boolean }).__renderReady = true;
  app.dataset.ready = '1';
}
