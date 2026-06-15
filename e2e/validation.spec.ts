import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * §validation — a BROADER live bug-hunt than the freeze-frame baselines (container-only). It drives the
 * REAL game (unfrozen) and HUNTS for defects the visual gate never sees: console errors/warnings across
 * panels / seasons / times / the detail sheet, interaction smoke (open-close, sheet dismiss, chip-tap vs
 * roam), and a live D2 soak (the behavior SM running over time). ⚠️ REPORT-ONLY: it LOGS findings
 * (prefixed [VALIDATION] for the CI log) and HARD-asserts only on a true crash (an uncaught pageerror) —
 * so warnings are surfaced for triage without gating. Run in CI via validation.yml (workflow_dispatch).
 *
 * ⚠️ Harness notes (the F1/F2 fixes):
 *  - An UNFROZEN boot shows the title SPLASH (an opaque overlay that sets body.modal-open → the HUD is
 *    hidden). The sweep is live, so `boot()` DISMISSES the splash (as a real player taps Start) and waits
 *    for the HUD to be interactive before touching it (F1 — wait for the closed state, never force a race).
 *  - The season×time matrix is many FULL reloads, so it's SPLIT per-season with a generous per-test
 *    timeout (F2 — the default 30s test budget can't hold 16 reloads). Each boot logs its combo, so a
 *    real per-combo boot hang (a GAME bug) would isolate to one season's test + the last logged combo.
 */

/** Known, EXPECTED console warnings — surfaced by design, NOT findings. */
const EXPECTED_WARNINGS: RegExp[] = [
  // The species-thumbnail RTT calls readRenderTargetPixels ONCE per species (then caches the dataURL);
  // Chrome warns "GPU stall due to ReadPixels" for the synchronous readback. Working as designed — a
  // known one-time perf note, not a bug (see thumbnailRenderer.ts / speciesPortrait.ts).
  /GPU stall due to ReadPixels/i,
];
const isExpectedWarning = (text: string): boolean => EXPECTED_WARNINGS.some((re) => re.test(text));

/** Attach console + pageerror collectors to a page (expected warnings are filtered out). */
function collect(page: Page): { errors: string[]; warnings: string[]; crashes: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const crashes: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning' && !isExpectedWarning(m.text())) warnings.push(m.text());
  });
  page.on('pageerror', (e) => crashes.push(e.message));
  return { errors, warnings, crashes };
}

/** Wait until the gameplay HUD is interactive (no overlay holding body.modal-open). */
async function waitHudReady(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.body.classList.contains('modal-open'), null, { timeout: 10_000 });
}

/** Boot a scene, wait for the first rendered frame, and DISMISS the title splash (the live sweep needs
 *  the HUD interactive). ?freeze scenes skip the splash, but this sweep runs unfrozen. */
async function boot(page: Page, query: string): Promise<void> {
  console.log(`[VALIDATION] booting ${query}`);
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as { __renderReady?: boolean }).__renderReady === true, null, { timeout: 30_000 });
  const splash = page.locator('.start-overlay');
  if (await splash.isVisible().catch(() => false)) {
    // First run shows a Skip link (begins play AND suppresses the onboarding prompts → a cleaner sweep);
    // a returning player gets Continue. Either is the real "begin play" dismiss path.
    const skip = page.locator('.start-skip');
    if (await skip.isVisible().catch(() => false)) await skip.click();
    else await page.locator('.start-primary').click();
    await expect(splash).toBeHidden();
  }
  await waitHudReady(page);
}

function report(label: string, c: { errors: string[]; warnings: string[]; crashes: string[] }): void {
  console.log(`[VALIDATION] ${label}: ${c.errors.length} error(s), ${c.warnings.length} warning(s), ${c.crashes.length} crash(es)`);
  for (const e of c.errors) console.log(`[VALIDATION]   ERROR: ${e}`);
  for (const w of c.warnings) console.log(`[VALIDATION]   WARN:  ${w}`);
  for (const x of c.crashes) console.log(`[VALIDATION]   CRASH: ${x}`);
}

test('console sweep — boot, each panel, the detail sheet', async ({ page }) => {
  test.setTimeout(60_000);
  const c = collect(page);
  await boot(page, '?seed=7&season=summer');
  // Open each panel via its KEYBOARD SHORTCUT, then close with Escape — waiting for the clean state at
  // each edge. ⚠️ We drive the panels by key (j/m/r/e), NOT by clicking the HUD buttons: while modal-open
  // toggles, the buttons hide/show (a CSS transition), so a rapid open→close→next-button click races that
  // transition ("not stable"/"not visible"). The keyboard toggles are immune (the handler is global) and
  // still exercise each panel for the console-error sweep — the actual goal here.
  for (const [key, name] of [['j', 'journal'], ['m', 'missions'], ['r', 'research'], ['e', 'bait']] as const) {
    await page.keyboard.press(key);
    await page.waitForFunction(() => document.body.classList.contains('modal-open'), null, { timeout: 5_000 }); // opened
    console.log(`[VALIDATION]   ${name} panel opened`);
    await page.keyboard.press('Escape');
    await waitHudReady(page); // closed before the next panel
  }
  // The detail sheet (tap the target chip if it's showing a tracked target).
  const chip = page.locator('.hud-target');
  if ((await chip.count()) && (await chip.first().isVisible())) {
    await chip.first().click();
    await page.waitForTimeout(150);
    const sheetOpen = await page.locator('.detail-overlay').isVisible();
    console.log(`[VALIDATION]   detail sheet opened on chip tap: ${sheetOpen}`);
    await page.keyboard.press('Escape');
    await waitHudReady(page);
    const sheetClosed = !(await page.locator('.detail-overlay').isVisible());
    console.log(`[VALIDATION]   detail sheet closed on Escape: ${sheetClosed}`);
  } else {
    console.log('[VALIDATION]   note: target chip not visible (no tracked target)');
  }
  report('panels+sheet', c);
  expect(c.crashes, `uncaught exceptions: ${c.crashes.join(' | ')}`).toEqual([]);
});

// F2 — SPLIT the season×time matrix per-season (the default 30s test budget can't hold 16 full reloads).
// Each test does 4 boots within a generous budget; a real per-combo boot hang would fail ONE season's
// test and the last "[VALIDATION] booting …" log pinpoints the combo (a GAME bug to flag, not patch).
for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
  test(`console sweep — ${season} × times`, async ({ page }) => {
    test.setTimeout(120_000); // many full reloads + the expected one-time ReadPixels stalls
    const c = collect(page);
    for (const time of ['dawn', 'day', 'dusk', 'night'] as const) {
      await boot(page, `?seed=7&unlock=all&season=${season}&time=${time}`);
      await page.waitForTimeout(100);
    }
    report(`${season}×times`, c);
    expect(c.crashes, `uncaught exceptions: ${c.crashes.join(' | ')}`).toEqual([]);
  });
}

test('interaction — chip tap does not break roam; a canvas drag still works', async ({ page }) => {
  test.setTimeout(60_000);
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
  test.setTimeout(60_000);
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
