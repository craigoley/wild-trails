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
const scenes = [
  { name: 'meadow-day-start', query: `?seed=${SEED}&freeze=1` },
  { name: 'wetland-water-pond', query: `?seed=${SEED}&freeze=1&unlock=all&at=33,8` },
  { name: 'meadow-cover-hide', query: `?seed=${SEED}&freeze=1&hide=1` },
  // §4.2 — the first new biome: the Riverbank river reach (the reused #55 water as a band).
  { name: 'riverbank-river', query: `?seed=${SEED}&freeze=1&unlock=all&at=40,80` },
  // §4.2 — the 2nd new biome: the Coast shore + the large outer-edge SEA (the player on the beach).
  { name: 'coast-shore', query: `?seed=${SEED}&freeze=1&unlock=all&at=40,114` },
  // §4.2 — the 1st BRANCHED biome: the Moor's heather-purple ground, east of the Highlands (a new
  // frozen baseline — the world canvas grows a new cell; the existing 5 baselines are unchanged).
  { name: 'moor-heather', query: `?seed=${SEED}&freeze=1&unlock=all&at=80,40` },
  // §4.2 — the 1st CLOSED/dense biome: the Pine Forest's instanced pine scatter, NW of the Woodland.
  // A NEW additive baseline (seeded after Craig approves the dense look). ⚠️ The GLOBAL entities-on-top
  // change may also shift the existing baselines — re-run the visual project, regen only what diffs.
  { name: 'pine-forest', query: `?seed=${SEED}&freeze=1&unlock=all&at=0,80` },
  // §4.2 — the always-dark CAVE: a near-black ground with the lights UNCHANGED (lit entities pop). A new
  // additive baseline (seeded after Craig approves the dark look). Eyeball: does the player/animals read?
  { name: 'cave-dark', query: `?seed=${SEED}&freeze=1&unlock=all&at=80,80` },
  // §4.2 — the TIDAL/SALTMARSH: the olive-mud estuary E of the Coast (the brackish tidal pools). A new
  // additive baseline (seeded after Craig approves the marsh look).
  { name: 'tidal-saltmarsh', query: `?seed=${SEED}&freeze=1&unlock=all&at=80,120` },
  // §4.2 — the ALPINE/MONTANE SUMMIT: the bare cold-grey scree E of the Moor (the single boulder, the
  // exposed difficulty-ceiling biome). A new additive baseline (seeded after Craig approves the summit
  // look). Eyeball: does it read as the bare rocky top — distinct from the Moor's heather-purple?
  { name: 'alpine-summit', query: `?seed=${SEED}&freeze=1&unlock=all&at=120,40` },
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
