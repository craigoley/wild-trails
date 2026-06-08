import { defineConfig } from '@playwright/test';

/**
 * L2 — Playwright smoke + visual regression (Validation stack). See e2e/README.md.
 *
 * Two projects:
 *  - `smoke`  — every-PR, NO baselines, platform-independent (boot / canvas-not-blank /
 *               no console errors / HUD present). Catches hard render breakage + boot JS errors.
 *  - `visual` — container-only, gated/nightly: screenshot diffs of deterministic scenes.
 *               Run inside the pinned mcr.microsoft.com/playwright image so the render
 *               (one Linux + one GL) always matches the single committed baseline set.
 *
 * No-flake policy: retries = 0 (a flaky test is fixed, not retried green); visual diffs use a
 * tolerance (WebGL variance), never exact match; a pinned ?seed= + ?freeze= make scenes stable.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  expect: {
    // The screenshot STABILISATION budget (consecutive-frame settle). The default 5s is marginal
    // for the busier scenes under container CPU load (the canvas is large + the build just ran),
    // which showed as a flaky "Timeout 5000ms exceeded" on a different scene each run. 30s gives
    // ample settle room — it is NOT the diff tolerance (that stays maxDiffPixelRatio below), so the
    // gate's strictness is unchanged; only slow stabilisation gets more time.
    timeout: 30_000,
    // WebGL renders vary slightly run-to-run, so visual diffs allow a small pixel ratio.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      // Software WebGL (SwiftShader) so the canvas renders headlessly + deterministically.
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\.spec\.ts/ },
    { name: 'visual', testMatch: /visual\.spec\.ts/ },
  ],
  webServer: {
    // Build once, then serve the static dist for the browser to hit.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
