import { test, expect } from '@playwright/test';

/**
 * L2 visual regression (container-only, gated/nightly). Screenshot diffs of DETERMINISTIC
 * scenes — they catch render/layout regressions the smoke test can't (e.g. the world
 * squashed to the top 55% with a black band below: shipped green, caught only by eye).
 *
 * Determinism: ?seed= pins the sim; ?freeze=1 pauses it at the initial state so the capture
 * is timing-independent; the baseline set is generated ONCE in the pinned Playwright Linux
 * container (see README) so one platform + one GL == one baseline. Diffs use a tolerance.
 *
 * The scenes deliberately exercise the recent visual work — where a future regression hides:
 *  - meadow-day start          (the default view + HUD layout)
 *  - wetland + the water pond   (#55 water render)
 *  - meadow + cover + a hide    (#53 cover + the deployed-hide footprint)
 */
const SEED = 7;
// ⚠️ §4.6 D1a — every scene PINS `&season=summer` so the capture is DATE-INDEPENDENT (a seasonal look
// otherwise varies by when the gate runs). Summer is the IDENTITY grade (no tint, no sat change), so the
// existing baselines DO NOT MOVE — these stay byte-for-byte as before. The seasonal looks are guarded by
// the new 4-season meadow set below (spring/autumn/winter; summer ≈ meadow-day-start).
const scenes = [
  { name: 'meadow-day-start', query: `?seed=${SEED}&freeze=1&season=summer` },
  { name: 'wetland-water-pond', query: `?seed=${SEED}&freeze=1&unlock=all&at=33,8&season=summer` },
  { name: 'meadow-cover-hide', query: `?seed=${SEED}&freeze=1&hide=1&season=summer` },
  // §4.2 — the first new biome: the Riverbank river reach (the reused #55 water as a band).
  { name: 'riverbank-river', query: `?seed=${SEED}&freeze=1&unlock=all&at=40,80&season=summer` },
  // §4.2 — the 2nd new biome: the Coast shore + the large outer-edge SEA (the player on the beach).
  { name: 'coast-shore', query: `?seed=${SEED}&freeze=1&unlock=all&at=40,114&season=summer` },
  // §4.2 — the 1st BRANCHED biome: the Moor's heather-purple ground, east of the Highlands.
  { name: 'moor-heather', query: `?seed=${SEED}&freeze=1&unlock=all&at=80,40&season=summer` },
  // §4.2 — the 1st CLOSED/dense biome: the Pine Forest's instanced pine scatter, NW of the Woodland.
  { name: 'pine-forest', query: `?seed=${SEED}&freeze=1&unlock=all&at=0,80&season=summer` },
  // §4.2 — the always-dark CAVE: a near-black ground with the lights UNCHANGED (lit entities pop).
  { name: 'cave-dark', query: `?seed=${SEED}&freeze=1&unlock=all&at=80,80&season=summer` },
  // §4.2 — the TIDAL/SALTMARSH: the olive-mud estuary E of the Coast (the brackish tidal pools).
  { name: 'tidal-saltmarsh', query: `?seed=${SEED}&freeze=1&unlock=all&at=80,120&season=summer` },
  // §4.2 — the ALPINE/MONTANE SUMMIT: the bare cold-grey scree E of the Moor (the single boulder).
  { name: 'alpine-summit', query: `?seed=${SEED}&freeze=1&unlock=all&at=120,40&season=summer` },
  // §hedgerow — the CONNECTOR corridor (the thin full-width ribbon S of the Meadow): the hedge LINES the
  // sides with a clear walk-through lane (the Pine #109 legibility — a hedge never hides a catch).
  { name: 'hedgerow-corridor', query: `?seed=${SEED}&freeze=1&unlock=all&at=0,-24&season=summer` },
  // §hedgerow — the isolated HAZEL COPSE (the remnant the corridor reaches): a sparse stand + a glade.
  { name: 'hazel-copse', query: `?seed=${SEED}&freeze=1&unlock=all&at=0,-48&season=summer` },
  // §4.6 D1a — the 4-SEASON meadow set: the seasonal re-grade on ONE representative scene (the meadow,
  // same seed/freeze as meadow-day-start). Summer ≈ meadow-day-start (identity), so these THREE are the
  // additive seasonal baselines (seeded after Craig approves the look). Eyeball: does each read as its
  // season — the fresh spring, the gold autumn, the cool/snowy winter — composed with the thriving grade?
  { name: 'meadow-spring', query: `?seed=${SEED}&freeze=1&season=spring` },
  { name: 'meadow-autumn', query: `?seed=${SEED}&freeze=1&season=autumn` },
  { name: 'meadow-winter', query: `?seed=${SEED}&freeze=1&season=winter` },
];

for (const scene of scenes) {
  test(`visual: ${scene.name}`, async ({ page }) => {
    await page.goto(`/${scene.query}`);
    await page.waitForFunction(() => (window as { __renderReady?: boolean }).__renderReady === true, null, {
      timeout: 30_000,
    });
    // Frozen scene -> two extra frames just guarantee the buffer is painted; the state
    // does not advance, so the capture is identical regardless of timing.
    await page.waitForTimeout(200);
    await expect(page.locator('#app canvas')).toHaveScreenshot(`${scene.name}.png`);
  });
}
