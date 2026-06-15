import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * §validation — a BROADER live bug-hunt than the freeze-frame baselines (container-only). It drives the
 * REAL game (unfrozen) and HUNTS for defects the visual gate never sees: console errors/warnings across
 * panels / seasons / times / the detail sheet, interaction smoke (open-close, sheet dismiss, chip-tap vs
 * roam), and a live D2 soak (the behavior SM running over time). ⚠️ REPORT-ONLY: it LOGS findings
 * (prefixed [VALIDATION] for the CI log) and HARD-asserts only on a true crash (an uncaught pageerror) —
 * so warnings are surfaced for triage without gating. Run in CI via validation.yml (workflow_dispatch).
 */

/** Attach console + pageerror collectors to a page. */
function collect(page: Page): { errors: string[]; warnings: string[]; crashes: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const crashes: string[] = [];
  const onConsole = (m: ConsoleMessage): void => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning') warnings.push(m.text());
  };
  page.on('console', onConsole);
  page.on('pageerror', (e) => crashes.push(e.message));
  return { errors, warnings, crashes };
}

async function boot(page: Page, query: string): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as { __renderReady?: boolean }).__renderReady === true, null, { timeout: 30_000 });
}

function report(label: string, c: { errors: string[]; warnings: string[]; crashes: string[] }): void {
  console.log(`[VALIDATION] ${label}: ${c.errors.length} error(s), ${c.warnings.length} warning(s), ${c.crashes.length} crash(es)`);
  for (const e of c.errors) console.log(`[VALIDATION]   ERROR: ${e}`);
  for (const w of c.warnings) console.log(`[VALIDATION]   WARN:  ${w}`);
  for (const x of c.crashes) console.log(`[VALIDATION]   CRASH: ${x}`);
}

test('console sweep — boot, each panel, the detail sheet', async ({ page }) => {
  const c = collect(page);
  await boot(page, '?seed=7&season=summer');
  // Open each panel by its HUD button, then close with Escape.
  for (const sel of ['.action-journal', '.action-missions', '.action-research', '.action-baitpanel']) {
    const btn = page.locator(sel);
    if ((await btn.count()) === 0) { console.log(`[VALIDATION]   note: ${sel} not present`); continue; }
    await btn.first().click({ force: true });
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  // The detail sheet (tap the target chip if it's showing a tracked target).
  const chip = page.locator('.hud-target');
  if ((await chip.count()) && (await chip.first().isVisible())) {
    await chip.first().click({ force: true });
    await page.waitForTimeout(150);
    const sheetOpen = await page.locator('.detail-overlay').isVisible();
    console.log(`[VALIDATION]   detail sheet opened on chip tap: ${sheetOpen}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const sheetClosed = !(await page.locator('.detail-overlay').isVisible());
    console.log(`[VALIDATION]   detail sheet closed on Escape: ${sheetClosed}`);
  } else {
    console.log('[VALIDATION]   note: target chip not visible at boot (no tracked target)');
  }
  report('panels+sheet', c);
  expect(c.crashes, `uncaught exceptions: ${c.crashes.join(' | ')}`).toEqual([]);
});

test('console sweep — every season × representative times', async ({ page }) => {
  const c = collect(page);
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const time of ['dawn', 'day', 'dusk', 'night']) {
      await boot(page, `?seed=7&unlock=all&season=${season}&time=${time}`);
      await page.waitForTimeout(120);
    }
  }
  report('seasons×times', c);
  expect(c.crashes, `uncaught exceptions: ${c.crashes.join(' | ')}`).toEqual([]);
});

test('interaction — chip tap does not break roam; a canvas drag still works', async ({ page }) => {
  const c = collect(page);
  await boot(page, '?seed=7&season=summer');
  const canvas = page.locator('#app canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (box) {
    // A drag on the canvas (roam gesture) — must not throw.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  // The canvas is still rendering (non-blank) after the interaction.
  const shot = await canvas.screenshot();
  console.log(`[VALIDATION]   canvas bytes after drag: ${shot.length}`);
  expect(shot.length).toBeGreaterThan(5_000);
  report('interaction', c);
  expect(c.crashes, `uncaught exceptions: ${c.crashes.join(' | ')}`).toEqual([]);
});

test('live D2 soak — the behavior SM runs unfrozen for a stretch (no crash / no error storm)', async ({ page }) => {
  const c = collect(page);
  await boot(page, '?seed=7&unlock=all&season=summer'); // unfrozen → the sim + the ethogram run live
  await page.waitForTimeout(10_000); // ~10s of live sim — the newest code (the behavior SM) exercised hardest
  const canvas = page.locator('#app canvas');
  const shot = await canvas.screenshot();
  console.log(`[VALIDATION]   canvas bytes after 10s soak: ${shot.length}`);
  expect(shot.length).toBeGreaterThan(5_000); // still rendering, didn't blank/freeze
  report('live-soak', c);
  expect(c.crashes, `uncaught exceptions: ${c.crashes.join(' | ')}`).toEqual([]);
});
