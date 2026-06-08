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
