# Character look — the naturalist explorer (recon)

*redesign the player from a generic amber figure into a CONSERVATIONIST EXPLORER: a wide-brim field
hat + a backpack + earthy field colours, with the kit attached to the ANIMATED figure (the walk cycle)*

Per Craig's ask + the locked decisions: the player currently reads as a generic blocky **amber** figure
with no identity — but the game casts you as a **naturalist**. Add the procedural, zero-asset
**signifiers** of a field conservationist (silhouette + colour, NOT facial detail — at the iso camera
distance, silhouette is what reads). **DECISIONS LOCKED:** the full kit (wide-brim **HAT** + **BACKPACK**
+ **earthy** khaki/olive/tan colours); light proportion tweaks allowed *only* if they genuinely help and
are small enough not to re-break the tuned walk; stay abstract/stylised (no faces/fingers). **Design
only — no code.**

> ## ⚠️ The headline (the recon's core finding)
> **The kit attaches cleanly to the ROOT GROUP — because the head and torso are STATIC within it.** Only
> two things on the player animate: the **whole group** `g` (CJ1 bob / lean / squash) and the **four limb
> pivots** (CJ3 legs + CJ3b arms swing). The head sphere and the torso cylinder are **plain meshes
> parented directly to `g`** — they do not move independently; they just ride `g`'s transform. So the
> **HAT and BACKPACK parent to `g` at the head/back positions** (exactly like the head/torso meshes
> already do) → they inherit the bob/lean/squash as ONE with the body, and they **do NOT mis-swing**
> (they're not on a leg/arm pivot). No new pivots, **zero walk-math change**, no per-frame work (built
> once). The floating-hat / pack-swinging-like-a-limb failure is structurally avoided. And the strong
> **LEAN: kit-only, NO proportion change** — the wide brim + the pack reshape the silhouette decisively;
> the tuned walk stays 100% intact and the baseline diff stays minimal.

---

## #1 — ⚠️ The player mesh + the walk parenting + the kit attachment points

### The mesh today (`buildPlayerModel`, `src/rendering/models/builders.ts:69`)
Built **foot-origin** (lowest point y = 0), facing **+z**. The root `Group` `g` holds:

| Part | What | Parent | Position |
|---|---|---|---|
| **Leg ×2** | a hip **`Group` pivot**, each holding a cylinder offset DOWN by `legHeight/2` (foot at y=0) | child of `g` | `(±legSpread, legHeight, 0)` |
| **Torso** | a tapered cylinder **mesh** | child of `g` | `y = legHeight + bodyHeight/2` |
| **Head** | a sphere **mesh** | child of `g` | `y = legHeight + bodyHeight + headRadius·0.8` |
| **Arm ×2** | a shoulder **`Group` pivot**, each holding a cylinder offset DOWN by `armLength/2` (hand at the bottom) | child of `g` | `(±(bodyRadiusTop + armRadius·1.4), legHeight + bodyHeight, 0)` |

`buildPlayerModel` returns `{ group, legL, legR, armL, armR }` — the group + the four pivots the renderer
swings.

### The animation (`walkCycle.ts` → `EntityRenderer.sync`, `EntityRenderer.ts:130`)
Exactly **two** kinds of motion are applied:

- **CJ1 — the WHOLE group `g`:** `g.position.y = bobY`; `g.scale = (scaleXZ, scaleY, scaleXZ)` (the
  volume-preserving squash); `g.rotation.y = facing yaw`; `g.rotation.x = leanX` (the forward lean).
- **CJ3 / CJ3b — the four limb pivots:** `legL.rotation.x = +legSwing`, `legR = −legSwing` (opposition);
  `armL.rotation.x = −armSwing`, `armR = +armSwing` (contralateral). 0 at idle/freeze.

⚠️ **The head and torso meshes carry NO independent transform** — they are static children of `g`, moving
*only* because `g` bobs / leans / squashes. **That is the whole trick for the kit.**

### The kit attachment map (what parents to which animated part)
| Kit piece | Parents to | Rides | Mis-swing risk |
|---|---|---|---|
| **HAT** (brim + crown) | **`g`**, at the head's top (same parent as the head mesh) | bob + lean + squash (as one with the head) | **none** — not on a limb pivot |
| **BACKPACK** | **`g`**, at the upper back (−z), torso height | bob + lean + squash (as one with the torso) | **none** |
| **BINOCULARS / satchel** (optional) | **`g`**, at the chest (+z) / hip | bob + lean + squash | **none** |

**Why `g` and not a "head sub-group":** the head doesn't animate independently, so parenting the hat to
`g` at the head position is *behaviourally identical* to parenting it to the head — and matches how the
head/torso meshes already attach. (Optional code-tidiness: a `head` `Group` wrapping the head sphere +
the hat, returned on `PlayerModel`, reads cleaner and future-proofs a head-bob — but it is NOT required
and changes nothing visually. **Recommend: add the hat/pack as children of `g`** — the minimal, correct
move.)

⚠️ **The one caveat — the squash:** `g.scale` scales *everything* in `g`, including the kit. That is
**correct** — the hat/pack squash-and-stretch **with** the body as a single unit (a hat that stayed rigid
while the body squashed would look detached). Confirmed: the kit attaching to `g` **rides the walk
without disturbing it** — it parents to existing structure, adds no math, and is built once.

---

## #2 — The kit (zero-asset procedural shapes + the earthy palette)

All shapes are a few low-poly primitives at `MODEL_SEGMENTS` (8) facets — the existing flat-shaded look.
`builders.ts` already imports `Cylinder` / `Cone` / `Sphere` / `Capsule`; the pack wants a **`BoxGeometry`**
(a 1-line import) for a clean canvas-bag read.

- **THE HAT (the key explorer cue)** — a **wide-brim bush/field hat** = two prims on the head:
  - **Brim:** a `CylinderGeometry(brimR, brimR, brimThick, SEG)` disc — `brimR ≈ headRadius · 1.9`
    (clearly wider than the head: the signature silhouette), `brimThick ≈ 0.03`. Sits at the head's
    mid/top.
  - **Crown:** a short `CylinderGeometry(crownTopR, crownBotR, crownH, SEG)` (or a squashed half-sphere)
    on top of the brim — a low rounded dome.
  - Tone: olive/tan field-hat (`~0x8a7d52` olive-khaki, or `~0x9c7a48` tan).
- **THE BACKPACK (the field-kit signifier)** — a **rounded box** on the upper back:
  - A `BoxGeometry(packW, packH, packD)` (`~0.22 × 0.28 × 0.14`) at the torso's back (−z), centred around
    the upper-torso height, nudged −z so it sits *behind* the body. Optionally 2 thin
    `CylinderGeometry` **straps** over the shoulders (+z front) to tie it on — keep minimal.
  - Tone: canvas brown / dark khaki (`~0x5c4a2e`), with the lid/straps a touch darker.
- **THE FIELD COLOURS (replace the flat amber `0xffb347`)** — field clothes via the body/accent:
  - **Torso (shirt/jacket):** khaki-olive `~0x7d7a4e`. **Legs (trousers):** tan/stone `~0x9a8a66` (or keep
    the brown boots accent `0x6b4a24` and make the legs trousers). **Head (skin):** a neutral tan
    `~0xc8a06e` (abstract, no features). The hat + pack carry their own earthy tones above.
- **OPTIONAL signature — binoculars:** a small `BoxGeometry` (`~0.1 × 0.06 × 0.05`) at the chest (+z),
  dark (`~0x2a2a2e`), maybe two tiny cylinder barrels. ⚠️ Reads as a chest blob at distance — **propose
  but lean OPTIONAL** (the hat + pack + colours already carry the identity; add binoculars only if Craig
  wants the extra cue and it doesn't clutter the silhouette).

⚠️ **No-magic-numbers:** every new dim/colour goes in a **`PLAYER_MODEL.kit`** sub-block (+ the palette
swaps) in `constants.ts` — the builder reads them, exactly like the current `PLAYER_MODEL`.

---

## #3 — ⚠️ The proportion question (conservative — the tuned-walk tradeoff)

**Current proportions** (`PLAYER_MODEL`): `legHeight 0.34`, `bodyHeight 0.46`, `headRadius 0.17`,
`bodyRadiusTop 0.12 / Bottom 0.17`, total height ~1.1u — a slim upright figure.

**Which proportions feed the WALK?** Critically, `walkCycle.ts` reads **NO `PLAYER_MODEL` dimension** —
bob/squash/lean are **absolute world units** and the swings are **angles**. The only coupling is
geometric: the visible foot travel ≈ **`legHeight · sin(legSwing)`**. So:

- **`legHeight`** is the **one** walk-coupled proportion — change it and the *visible* stride length
  changes at the same swing angle (the tuned step would read longer/shorter). ⚠️ **Do NOT touch it.**
- **`bodyRadius*` / `headRadius` / `bodyHeight`** do **NOT** feed the walk math — changing them is
  **walk-safe** (only a silhouette + a baseline diff).

**⚠️ RECOMMENDATION: KIT-ONLY, no proportion change.** The wide brim + the back-pack already transform the
silhouette decisively into "explorer" — silhouette is what the iso camera reads. Keeping the proportions
**keeps the tuned walk 100% intact** and **minimises the baseline diff**. *If* Craig wants a touch more
"rugged field build," the **safe** lever is a slightly **wider torso** (`bodyRadiusBottom 0.17 → ~0.19`),
which is **walk-safe** (it never enters `walkCycle`) — offer it as an optional, no-re-tune tweak.
**Never** change `legHeight` (that re-tunes the visible stride and risks the CJ-walk feel).

---

## #4 — ⚠️ The walk still works (the regression risk)

- **Kit-only path (recommended):** **zero** walk-math change. No `PLAYER_MODEL` walk-coupled dim moves,
  no `CHARACTER_JUICE` change — the kit just bobs/leans/squashes with `g`. CJ1 (bob/lean), CJ3 (leg
  opposition), CJ3b (arm contra-swing) read **identically**, now with a hat/pack riding along. The
  **#101 frequency guard** (`walk-frequency.test.ts` — the bob ≤ 4 Hz at maxSpeed) is **untouched and
  still passes** (it depends on `strideRate`/speed, neither of which moves).
- **If the optional walk-SAFE torso-width tweak is taken:** still **no** walk-math change
  (`bodyRadius` never feeds `walkCycle`) → the frequency guard holds, the gait reads the same; only the
  silhouette (and the baseline) shift.
- **Pin (the build):** with the kit on, CJ1/CJ3/CJ3b still read right — because the hat/pack are
  static-in-`g`, they compose cleanly with the limb swings (the legs/arms swing *under* a body that
  carries the kit). A builder test pins the kit parts are children of `g` (not of a limb pivot) — the
  structural guarantee against mis-swing.

---

## #5 — Cosmetic + freeze→neutral + ⚠️ the ALL-scenes L2 reseed

- **Cosmetic by construction:** the kit is **render-only** — child meshes of the render `Group`; the
  **sim never sees the renderer**, so the logical position / movement / proximity / catch are byte-
  unchanged. **No schema bump.**
- **Freeze → neutral:** on `?freeze`, `g` is the neutral rest pose (bob 0, scale 1, lean 0, limbs
  straight); the kit, parented to `g`, sits in that same neutral pose (the hat/pack at rest). The frozen
  capture stays **deterministic + byte-stable** (today's static capsule + the now-static kit).
- **⚠️ THE BASELINES — the all-scenes reseed (#85):** the player **looks different** now (the kit + the
  new colours, ± the optional torso width), and **the player is in EVERY L2 scene** → **ALL 11 baselines
  WILL diff** (`meadow-day-start`, `wetland-water-pond`, `meadow-cover-hide`, `riverbank-river`,
  `coast-shore`, `moor-heather`, `pine-forest`, `cave-dark`, `tidal-saltmarsh`, `alpine-summit`, + the
  staged mechanic views). This is a **much bigger reseed than a single new-biome scene** — it's the
  **approve-then-RESEED** workflow: after Craig approves the new look on device, **all 11 baselines
  regenerate in-container** in one `e2e-visual.yml` dispatch (the `alpine-summit` baseline — still
  pending its own approval — folds into the same pass).

---

## #6 — Scope (render only)

- **Render-only:** `builders.ts` (`buildPlayerModel` + the kit shapes, + a `BoxGeometry` import) +
  `constants.ts` (the `PLAYER_MODEL.kit` sub-block + the palette swaps + any optional torso width). **No
  logic / catch / sim change, no schema bump.** `src/game/` purity untouched (this is `src/rendering` +
  `src/utils` constants only — no `three` enters `src/game/`).
- **Tests:** green on this branch — **635 passing** (the recon adds no code). The build adds a small
  builder test (the kit parts parent to `g`; the still-player silhouette is the figure + kit) + the
  all-scenes reseed; the CJ/#101 walk pins stay green.
- ⚠️ **THE FEEL-PR DISCIPLINE (flag prominently):** this is a **LOOK slice** — the build PR **must NOT
  auto-merge before Craig's device approval** (does it read as a conservationist explorer; does the kit
  move right with the walk?). Unlike the data-slice biome PRs (tests-gate, auto-merge fine), a
  silhouette/feel change **needs eyes on a device first**. Open the build **DRAFT + playtest-gated** and
  flag it loudly so the pipeline doesn't sweep it; the baselines reseed **only after** approval.

---

## STOP — the decision before building

The kit attaches cleanly (it parents to `g`, rides the walk, can't mis-swing) and the proportion tradeoff
is mapped. Craig confirms:

1. **The kit (#2)** — a wide-brim **HAT** (brim disc + crown) + a **BACKPACK** (rounded box, optional
   straps) + the **earthy palette** (khaki/olive/tan, replacing the amber) *(recommended)*? And the
   **binoculars** — include the optional chest cue, or keep it to hat + pack + colours *(lean: skip
   unless wanted)*?
2. **The proportions (#3)** — ⚠️ **KIT-ONLY, no proportion change** (keep the tuned walk 100% intact,
   minimise the baseline diff) *(recommended)* — or the optional **walk-safe** sturdier torso
   (`bodyRadiusBottom → ~0.19`, never `legHeight`)?
3. **The reseed (#5)** — acknowledge that approving the new look triggers an **ALL-11-baselines** reseed
   (the player is in every scene) — the bigger #85 pass *(confirm)*?
4. **The feel-PR discipline (#6)** — the build opens **DRAFT + playtest-gated**, **NOT** auto-merged
   before your device approval (this is a LOOK slice, not a data slice) *(confirm)*?

After Craig confirms the kit + the proportions, the build implements it (render-only) — then Craig
playtests the LOOK (does it read as a conservationist explorer; does the hat/pack move right with the
walk) and approves → **all 11 baselines reseed**.
