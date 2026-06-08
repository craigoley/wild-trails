# Activate the L2 visual-regression gate — seed baselines in-container + flip to blocking

L2 visual regression was built (#56-era) but has been **non-blocking + unseeded** — it never
guarded anything (there is no committed baseline set under `e2e/`). TL1 (#82) changed the biome
render (the warming grade), now **approved** (Craig playtested + approved the warming look). This
chore seeds ALL baselines from approved current main, **in the pinned container**, and prepares the
gate flip. Test-infra only — **no game/render change.**

---

## #1 — The L2 visual setup (how it works)

- **`e2e/visual.spec.ts`** captures `toHaveScreenshot()` diffs of **deterministic** scenes
  (`?seed=7&freeze=1` pins the sim + pauses it; `?unlock=all&at=x,y` / `?hide=1` stage the view).
  Scenes today (5): `meadow-day-start`, `wetland-water-pond`, `meadow-cover-hide`, `riverbank-river`
  (#80), `coast-shore` (#80). The **TL1 warming grade** is captured implicitly — every scene's
  ground colour now reflects the thriving grade at its scene state (the frozen scenes are an empty
  journal → the muted baseline; the unlocked scenes show the same).
- **`playwright.config.ts`** — `toHaveScreenshot.maxDiffPixelRatio: 0.02` (WebGL varies run-to-run;
  never exact match), SwiftShader GL args (deterministic headless render), `viewport 1280×720`,
  `retries: 0` (no-flake policy).
- **Baseline storage:** default Playwright path — `e2e/visual.spec.ts-snapshots/<scene>-visual-<platform>.png`.
  In the Linux container that's `…-visual-linux.png`. **None exist yet** (unseeded).
- **Currently non-blocking:** `e2e-visual.yml` runs nightly + manual (NOT on PRs) under the pinned
  `mcr.microsoft.com/playwright:v1.60.0-noble` image with **`continue-on-error: true`** — so a
  missing/failing baseline never red-flags anything. That flag is the gate switch.

## #2 — ⚠️ The seeding plan (IN THE CONTAINER — the environment match)

⚠️ A WebGL screenshot is **platform/GPU-locked**: a macOS (`-darwin`) shot and the Linux-CI shot
differ far beyond any tolerance. The README is explicit — **do not commit host-generated
baselines**. They must be generated in the **same Linux image the gate runs in**.

**This host has no Docker daemon** (CLI present, daemon down), so the baselines cannot be generated
locally. The correct path is to generate them **in the GitHub Actions container** (the exact image
the gate uses). I extended `e2e-visual.yml` with a **seeding mode** (`workflow_dispatch` input
`update_snapshots`): dispatched against this branch, it runs `--update-snapshots` inside the pinned
container, **uploads the baselines as an artifact** (`l2-visual-baselines`) for review, and
**commits them back to the branch**. (Dispatch is recognised from the default-branch workflow but
runs *this branch's* version — so the seeding logic ships with this PR.) Scenes baselined: **all 5**
(every biome scene + the cover/hide + the TL1-graded views).

## #3 — The activation flip (the commitment) — HELD until Craig confirms

Activation = one line in `e2e-visual.yml`: **`continue-on-error: true` → `false`**. ⚠️ Once flipped,
every future visual diff **fails the visual job** and requires a deliberate baseline refresh in that
PR (re-run the seeding mode, review the diff, commit the new baseline). That is the **intended
discipline** — unreviewed visual changes can no longer slip through (the very class of bug L2 exists
to catch: "shipped green, caught only by eye"). **This flip is NOT in this PR** — it activates only
after Craig confirms the captured baselines are the approved look (#78's lesson: don't lock an
unreviewed capture). The exact change is staged below.

## #4 — ⚠️ The captured state (surfaced for Craig's eye)

After the in-container seeding run, the baseline PNGs are (a) attached to the workflow run as the
**`l2-visual-baselines`** artifact and (b) committed to this branch under
`e2e/visual.spec.ts-snapshots/`. **Craig reviews them** (in the PR diff / the artifact) to confirm
each scene is the approved look — the warmed-where-studied world, the water, the cover — **not** a
glitch or wrong state. The gate activates only on that confirmation.

## #5 — Scope (test-infra only)

NO `src/game/`, NO render, NO logic change — the visuals are already shipped + approved; this only
**captures + guards** them. Changed: `e2e-visual.yml` (the seeding mode) + the committed baseline
PNGs (binary, container-generated) + this doc. The catch core, research spine, TL1, the biomes, the
HUD are untouched; `src/game/` pure. **The smoke (every-PR) stays green; the unit suite is unchanged
at 495.**

---

## The activation flip (staged — apply after Craig confirms)

```diff
# .github/workflows/e2e-visual.yml
-    # Non-blocking until the baselines are seeded AND the gate is activated (see the header).
-    continue-on-error: true
+    # ACTIVE gate — a visual diff fails the job (refresh the baseline in the PR if intended).
+    continue-on-error: false
```

## ⚠️ What the first real container run uncovered (the gate never actually worked)

Seeding ran for real **in the container for the first time** — and exposed that the visual gate had
**never captured the game**. Three latent defects, each fixed (render-side changes are guarded to
`?freeze` ONLY — normal gameplay is byte-identical, so the approved look is unchanged):

1. ⚠️ **All baselines were the START SCREEN.** The visual scenes (#56-era) predate the
   `StartScreen` + onboarding; the splash is an HTML overlay over the canvas, so every capture was
   the identical "Wild Trails / START" card — `?seed/?at/?unlock` staged a world nobody screenshotted
   (the gate stayed green only because it's non-blocking + unseeded). **Fix:** a frozen capture skips
   the splash + onboarding (`main.ts`), so the staged world renders.
2. ⚠️ **The camera eased forever → captures hung.** `?freeze` pauses the sim but the camera follow
   eases exponentially (`k = 1 - exp(-camLerp·dt)`, never reaching 1) → a frozen scene drifts
   sub-pixel every frame → the screenshot never settles (3 of 5 scenes timed out). **Fix:** snap the
   focus when frozen (`SceneManager.updateFollow(…, snap)`) → byte-stable frame.
3. ⚠️ **Stabilisation flaked under container load.** The default 5 s settle budget was marginal for
   the busier scenes (7–12 s under load), failing a *different* scene each run. **Fix:**
   `expect.timeout: 30_000` (the settle budget — NOT the diff tolerance, which stays 0.02).

After the fixes: all 5 scenes capture **distinct, real, staged worlds** (the meadow at the TL1 muted
baseline, the wetland pond, the riverbank band, the coast beach+sea, the deployed-hide ring), and a
**second no-update container run diffed all 5 clean** (the README's no-flake proof).

## Order of operations

1. ✅ Confirmed main clean + the live visuals approved (TL1 #82 merged; no in-progress visual change).
2. ✅ Made the gate actually capture the game (the 3 fixes above — all `?freeze`-only).
3. ✅ Seeded ALL 5 baselines **in the container** (dispatch `e2e-visual.yml` with
   `update_snapshots=true`) → committed under `e2e/visual.spec.ts-snapshots/` + the
   `l2-visual-baselines` artifact.
4. ✅ Proved **no-flake** (a 2nd no-update container run diffs all 5 clean).
5. ✅ **Surfaced** the 5 captured baselines for Craig's review (in the PR diff / the artifact).
6. ⏸️ **HOLD** the activation flip (`continue-on-error: true` → `false`) → apply only after Craig
   confirms the captures are the approved look.
