# L2 — Playwright smoke + visual regression

**L2 is the render-regression net** (Validation stack, PLAN.md §4.0). It catches things L1
can't: L1 asserts game **state**; L2 looks at the actual **browser render** — did the canvas
render, did a HUD element vanish, did the layout regress. It *would have caught* the
gameplay-area layout regression (world squashed to the top ~55%, black band below — shipped
green, caught only by eye).

## ⚠️ The canvas wall

The Three.js `<canvas>` is **one opaque rectangle** to the DOM. L2 **cannot** see or aim at
anything *in* the scene (the player, animals, the pond). It can only: confirm the canvas
mounts + isn't blank, read **DOM/HUD** elements + the console, and **diff screenshots** of
deterministic scenes. So L2 covers *"did the render break / did a HUD element vanish / did
layout regress"* — **not** *"does it play / does it feel."* That stays **L1** (logic) +
**Craig** (feel). Don't oversell it.

## Two layers

### Smoke — `smoke.spec.ts` (every-PR, in `ci.yml`)
Platform-independent, **no baselines**. Boots the built app in headless Chromium and checks:
the page loads, the canvas mounts + **renders (not blank)** via a screenshot-size heuristic,
**no console errors** on boot, and the **HUD DOM is present** (the action buttons + panel
toggles). Run locally: `npm run test:e2e`.

### Visual regression — `visual.spec.ts` (container-only, nightly, `e2e-visual.yml`)
Screenshot diffs of **deterministic** scenes — one per biome (the world's 10) plus two staged
mechanic views. Every biome is under the gate, so a future visual change to any of them flags:

| scene | URL | what it guards |
|---|---|---|
| `meadow-day-start` | `?seed=7&freeze=1` | the default view + HUD layout |
| `wetland-water-pond` | `?seed=7&freeze=1&unlock=all&at=33,8` | the #55 water render |
| `meadow-cover-hide` | `?seed=7&freeze=1&hide=1` | the #53 cover + deployed-hide footprint |
| `riverbank-river` | `?seed=7&freeze=1&unlock=all&at=40,80` | the riverbank water band |
| `coast-shore` | `?seed=7&freeze=1&unlock=all&at=40,114` | the coast + the outer-edge sea |
| `moor-heather` | `?seed=7&freeze=1&unlock=all&at=80,40` | the moor's heather-purple ground |
| `pine-forest` | `?seed=7&freeze=1&unlock=all&at=0,80` | the dense instanced pines + entities-on-top |
| `cave-dark` | `?seed=7&freeze=1&unlock=all&at=80,80` | the dark cave ground + lit entities |
| `tidal-saltmarsh` | `?seed=7&freeze=1&unlock=all&at=80,120` | the olive-mud estuary + tidal pools |

> ⚠️ The global **entities-on-top** change (`depthTest:false`, Pine #109) makes the player/animals
> composite over the props — so an existing baseline may shift when it's reseeded. That's the
> *intended* change; confirm any diff is it (not a regression) before locking the new baseline.

**Determinism** comes from the L2 hooks (render layer only — `src/testHooks.ts`; `src/game/`
stays pure): `?seed=N` pins the sim seed, `?freeze=1` pauses it at the initial state (so the
capture is timing-independent), and `?unlock=all` / `?at=x,y` / `?hide=1` stage the scene. The
app signals `window.__renderReady` after the first frame, which the tests wait on. Diffs use
`maxDiffPixelRatio` (WebGL varies run-to-run) — never exact match.

## ⚠️ Why visual is container-only

A WebGL screenshot is **platform/GPU-locked** — a macOS shot and a Linux-CI shot differ far
beyond any sane tolerance. So baselines are useless unless the render is pinned to **one**
platform. We pin it to the official **`mcr.microsoft.com/playwright`** Linux image, used both
in CI and (via `docker run`) locally — **one image → one baseline set**. **Do not commit
host-generated baselines** (e.g. `*-darwin.png`); they have no CI value.

## Seeding / updating the visual baselines

The baselines MUST be generated **in the pinned Linux container** (a host/`-darwin` shot has no CI
value). Seeding runs **in GitHub Actions** (the exact image the gate uses) — dispatch
`e2e-visual.yml` with `update_snapshots=true` against the branch:

```sh
gh workflow run e2e-visual.yml --ref <your-branch> -f update_snapshots=true
```

It runs `--update-snapshots` in the container, uploads the baselines as the `l2-visual-baselines`
artifact for review, and commits them back under `e2e/visual.spec.ts-snapshots/`. (With local
Docker the equivalent is `docker run … mcr.microsoft.com/playwright:v1.60.0-noble sh -c "npm ci &&
npm run test:e2e:visual -- --update-snapshots"` + commit — same image, same bytes.)

**Prove no-flake by dispatching once more *without* `update_snapshots`** — it diffs the committed
baselines in-container and must pass. Then flip `continue-on-error: false` in `e2e-visual.yml` to
make it a real gate. Never commit a host screenshot.

⚠️ **Capture determinism** (why a frozen scene is byte-stable): `?freeze` skips the title splash +
onboarding and **snaps the camera** to the player (the follow eases exponentially and never settles
otherwise) — both `?freeze`-only, so gameplay is unaffected. The settle budget is `expect.timeout`
(30 s, generous for the slow container) — NOT the diff tolerance (`maxDiffPixelRatio: 0.02`).

## What L2 does NOT do

It does **not** unblock feel work (e.g. the Nets B1 glide-smoothness, frog-aliveness,
Highlands open-vs-barren) — that's **in-canvas feel**, beyond the canvas wall. L2 is a
parallel, permanent **render-regression** safety net; the **playtest** is still Craig's.
