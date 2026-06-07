import { test, expect } from '@playwright/test';

/**
 * L2 smoke (every-PR, no baselines, platform-independent). Catches hard render breakage +
 * boot JS errors WITHOUT a cross-platform screenshot baseline:
 *  - the page loads and the canvas mounts,
 *  - the render loop runs (window.__renderReady fires) and the canvas isn't blank,
 *  - NO console errors on boot,
 *  - the key HUD DOM elements are present (which Playwright CAN see — unlike anything
 *    in-canvas; see the README's "canvas wall").
 */
test('boot: canvas renders, no console errors, HUD present', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?seed=1'); // a pinned seed -> deterministic boot (sim still runs)

  // The render loop reached its first rendered frame.
  await page.waitForFunction(() => (window as { __renderReady?: boolean }).__renderReady === true, null, {
    timeout: 30_000,
  });

  // The canvas mounted with real dimensions.
  const canvas = page.locator('#app canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);

  // Not blank: a rendered WebGL scene screenshots to a non-trivial PNG (a blank/uniform
  // canvas compresses to a few hundred bytes; the grid + ground + props are far bigger).
  const shot = await canvas.screenshot();
  expect(shot.length).toBeGreaterThan(5_000);

  // The HUD DOM is PRESENT (the regression L2 guards: an element vanished). Attached,
  // not strict-visible — the CATCH button boots dimmed/disabled + the canvas overlays
  // them, which is fine; what we pin is that they exist in the DOM.
  for (const sel of ['.action-catch', '.action-bait', '.action-hide', '.action-journal', '.action-missions']) {
    await expect(page.locator(sel)).toBeAttached();
  }

  // No console errors / uncaught exceptions on boot — the regression a Vite/render bump can slip past.
  expect(errors).toEqual([]);
});
