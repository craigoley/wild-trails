# Ground seam — recon / diagnosis

**Status:** RECON ONLY (no fix in this PR). Diagnose the cause, propose the targeted fix,
stop for Craig's decision. ⚠️ This **blocks the seasonal reseed** — reseeding now would bake
the seam into the canonical L2 baselines.

## Observed (ground truth, from Craig's device screenshot)

A hard, **straight diagonal** line across the play field on a **dawn meadow**: a
**darker-green triangle in the upper-left**, the lighter meadow green over the rest. A crisp
straight boundary — not soft natural variation, so a **seam/boundary**, not a gradient.

---

## The cheap evidence first (world-vs-screen / season / time)

⚠️ I cannot run Craig's device, so these are the answers the **code + geometry demand**, each
with the 30-second device check that confirms or falsifies it.

### 1. World-space or screen-space? → **WORLD-SPACE** (CAUSE, from code)

The only things drawn are per-biome ground **planes** (`WorldRenderer.rebuildDynamic`), a grid,
cover props, and a seasonal **particle** layer. There is **no screen-space overlay, no fog, no
post-process, no vignette** (`grep scene.fog` → none; `SceneManager` clears to a flat
`PALETTE.background` and adds only static lights). So a screen-fixed gradient is ruled out by
construction — the seam must be a feature **on the ground**, fixed in world space.

- **Device check:** roam the player west/north (drag). The dark triangle should **track the
  ground** — grow as you approach the edge, shrink as you retreat. If it instead stays welded to
  the screen, my cause is wrong (but the code has no screen-space layer that could do it).

### 2. Every season incl. summer, or seasonal-only? → **EVERY season, incl. summer** (CAUSE)

The darker region is **not** seasonally graded. Only **unlocked** biome grounds get
`gradedGround(...)` re-graded by season (`groundMats`); the scene **background** and the
**locked-neighbour dim** are season-independent constants. Summer is the identity grade, yet the
seam's dark side (background / locked dim) is unchanged → **the seam is NOT the seasonal work**.
It is a pre-existing world-edge issue the seasons merely sit on top of.

- **Device check:** `?season=summer` — the seam should still be there. (If summer is seam-free,
  reconsider — but the code says it won't be.)

### 3. Every time, or dawn-only? → **EVERY time** (CAUSE)

The lighting is **static** — `SceneManager` builds Ambient + Hemisphere + one Directional key
**once** in the constructor and **never updates them by time of day**. There is no day/night
scene tint and **no shadow mapping** (`shadowMap` is never enabled; nothing `castShadow`). So
there is **no lighting terminator** and the "dawn" in the screenshot is just the clock label, not
a cause. The seam is time-independent.

- **Device check:** `?time=day` / `dusk` / `night` — the seam should look the same.

> **Why lighting can't be the cause at all:** every ground plane is **flat** (a single
> `PlaneGeometry`, constant +Y normal). Under per-pixel `MeshStandardMaterial`, ambient +
> hemisphere (normal·up is constant) + a directional light all shade a flat quad **uniformly** —
> they cannot produce a diagonal across one plane. So the diagonal is **geometry/colour**, not
> light.

---

## The cause (matched to the evidence)

### CAUSE — the meadow ground plane *ends*, and the dark background shows beyond its edge

The meadow is the rect `[-20,20] × [-20,20]`. Its `adjacent` list is **only** `woodland` (north,
`z∈[20,60]`) and `wetland` (east, `x∈[20,60]`). **West (`x<-20`) and south (`z<-20`) have no
neighbour at all** — no ground plane is drawn there, so the camera sees the bare
`scene.background` = `PALETTE.background` = `0x0d1f12` (a **dark green-teal**).

Mapping the screenshot to the iso camera (position `focus+(20,20,20)`, 45° yaw) pins it exactly:

| Screen region | World direction | What's there |
|---|---|---|
| **upper-left** | **west** (`x → −20`) | **no neighbour → bare dark background `0x0d1f12`** |
| lower-left | north (`z → 20`) | woodland, locked → dimmed `0x102414` |
| lower-right | east (`x → 20`) | wetland, locked → dimmed `0x132926` |

So the **darker-green upper-left triangle is the dark scene background showing past the meadow's
western ground-plane edge.** An axis-aligned world edge (`x=-20`) viewed at the 45° yaw renders
as a **straight diagonal** on screen — the "seam." `CAMERA.frameBiasY` (0.18) shifts the focus
**below** centre, so the view reaches farther toward the top/SW and brings that edge into the
upper portion even near the meadow centre (the player is clamped to the unlocked region but can
roam to the boundary, and the spawn is the meadow centre `(0,0)`).

The dark side is a near-black green; the meadow side is the lighter graded green — hence a
**hard, crisp diagonal** with no blend across it.

### Same root, secondary instances (NOT the upper-left one)

The **north/east** edges (woodland/wetland) are the *same* phenomenon — a hard, un-blended step
from the lighter meadow to a much darker plane (locked dim `×0.45`) — but they project to the
**lower-left / lower-right**, so they are *not* the upper-left triangle in the shot. The
locked-neighbour darkening is **by design** (the metroidvania "darkened locked land" breadcrumb,
with its fog veil + boundary wall), but the **abruptness** (a 55%-darker step, no gradient) reads
as a seam too. The bare-background **west/south** void is the un-designed, clearly-a-bug case.

### HYPOTHESIS (needs the device check to fully close)

The screenshot can't show me whether the player had roamed toward the west edge or was near
centre. The geometry says the west edge is reachable into the upper view via `frameBiasY` + the
camera's SW reach, but **evidence check #1 (roam and watch the triangle track the ground)** is
the clean confirmation. If — against the code — the triangle is screen-welded or summer-free, the
diagnosis changes; nothing in the code supports those, so confidence is high.

---

## The targeted fix (proposed — for Craig's decision, not applied here)

**Primary (kills the headline upper-left void seam): add one static "base ground" plane under the
whole world.** A single large plane spanning the world bounding box **+ a generous margin**, at
`y = −ε` (just below the biome planes, so no z-fight), in a calm ground tone (a new
`PALETTE.groundBase` constant — no magic numbers). Built **once** in the `WorldRenderer`
constructor (like the grid), unlock-independent.

- Then **beyond any biome edge the camera sees a ground-toned base, not the stark dark void** —
  the hard diagonal void-seam is gone (it becomes "ground continues, hazing out"), while the
  intentional locked dim + fog veil + boundary wall still read as "darker land beyond."
- Lowest-risk, render-only, one static mesh + one colour constant.

**Optional polish (softens the by-design locked-neighbour step too):** a subtle distance fade —
either a real `THREE.Fog` tuned to the base tone, or a vignette skirt — so the lighter→darker step
at the N/E seams is a gradient rather than a hard line. ⚠️ Fog tints *all* planes by distance, so
it's a **look change** that needs Craig's eye; the base plane alone is the safe, contained fix.

**What I'd NOT do:** clamp the camera to never show past the edge (fights the dead-zone follow +
`frameBiasY`, brittle), or oversize each biome plane (z-fight/overlap, still ends somewhere).

---

## Scope + L2 / reseed

- **Render-only.** The fix touches `WorldRenderer` (one static plane) + one `PALETTE` constant.
  **No gameplay, no sim, no `src/game/`** change. `src/game/` purity intact.
- **It IS a canvas change** → it shifts the L2 `#app canvas` baselines. That is *expected and
  desired*: this seam fix must land **first**, then the pending seasonal device-pass + reseed
  capture the **correct, seamless** look. Reseeding before the fix would bake the seam into the
  canonical baselines — which is exactly why **the seam blocks the reseed**.
- **Order:** (1) land this fix → (2) Craig confirms on device the seam's gone → (3) seasonal
  device-pass + reseed proceeds, capturing the seamless world.
- Tests: unchanged in this recon (doc-only) — suite green.

## TL;DR

- **CAUSE:** the meadow ground plane **ends** at its west/south edge (no neighbour there); beyond
  it the camera sees the bare dark `PALETTE.background` (`0x0d1f12`). At the 45° iso yaw that edge
  is a **straight diagonal**, and `frameBiasY` lifts it into view → the **darker-green upper-left
  triangle**. World-space, all seasons (incl. summer), all times. The N/E locked-neighbour seams
  are the same hard-step phenomenon (lower-left/right), darkening by design.
- **NOT:** seasonal grade, lighting/dawn terminator, shadows, or any screen-space overlay (none
  exist).
- **FIX:** a single static **base ground plane** (bbox + margin, calm tone, `y=−ε`) so the camera
  never sees the dark void past an edge; optional fog/vignette to soften the locked-neighbour step.
  Render-only; shifts baselines → folds into the pending reseed (fix first, reseed second).
- **Device checks to confirm:** roam → triangle tracks the ground (world-space); `?season=summer`
  → still there; any `?time=` → unchanged.
