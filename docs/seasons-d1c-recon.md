# Depth D1c — SEASONAL DRESSING (recon)

*seasonal visual dressing: the cover/flora re-dress (bloom/full/bare/gold) + the seasonal ambient
(pollen/leaves/snow). VISUAL-ONLY, no audio. The final seasons slice — pure polish on the complete
D1a/D1b seasons.*

Per PLAN.md §4.6 (D1c) + Craig's pick: **visual dressing only** (audio is out — the A1 "static" failure,
not re-litigated). Two pieces, both meant to ride D1a's season read (`game.season`). **Design only — no
code.**

> ## ⚠️ THE HEADLINE FINDING (it reshapes the slice)
> **The "TL2 ambient life" system does NOT exist yet.** The brief assumes the seasonal ambient *extends*
> a proven TL2 motes/particle system — but there is none. The render frame loop runs only
> `entities.sync` (CJ animal/player gaits), `scene.updateFollow`/`render`, the HUD, and the time
> indicator. The only "soul layer" actually built is **TL1** (the warmth grade) + **CJ** (the gaits); the
> cover/flora are **static props built once** (no sway, no animation). So:
> - **Piece #1 (cover/flora re-dress) IS a contained re-grade extension** — reuse the D1a `setSeason`
>   pattern (track the prop materials, re-tint in place). Low-risk, proven.
> - **Piece #2 (seasonal ambient) is a NEW per-frame particle system, not an extension** — it's the real
>   work here (new `requestAnimationFrame` code → the no-hot-loop-alloc rule + freeze-determinism apply).
> **Recommendation: SLICE them** — ship the cover re-dress first (contained), and treat the ambient as
> its own focused slice (or defer it). Details in #2 + the slicing section.

---

## #1 — Seasonal COVER / FLORA re-dress (a contained re-grade extension)

**How the props are built today** (`WorldRenderer`): the cover clusters (`addGrassCluster` /
`addFernCluster` / `addReedCluster` / `addRockCluster`, dispatched by `addCover`) and the Pine scatter
(`addPineForest`, two `InstancedMesh`es) are **static — built ONCE in the constructor**, added to
`this.group` (not the unlock-rebuilt `this.dynamic`). Each kind uses one material with a colour from
constants (`HIDING_RENDER.color`, `FERN_RENDER.color`, `REED_RENDER.color`, `ROCK_RENDER.color`,
`PINE_RENDER.*`). The props are **not tracked or re-graded** — unlike the ground, which D1a re-tints in
place.

**How D1a's ground re-grade works** (the pattern to reuse): `setSeason(season)` walks `groundMats`
(a `Map<id, {mat, base}>`) and sets each `mat.color = gradedGround(base, season, thriving)` — an in-place
re-tint, no rebuild. `gradedGround = warmthGrade(seasonalGrade(base, season), thriving)`.

**The contained re-dress (reuse, don't rebuild):**
- **Track the prop materials** in a `propMats` map (id/biome + `{mat, base}`), exactly like `groundMats`,
  as each cover/pine material is built. Then **`setSeason` re-tints the props too**, through
  `seasonalGrade(base, season)` (the foliage warms to gold in autumn, washes pale/brown in winter,
  freshens in spring). One line per material in the existing `setSeason` loop. **No prop-system rebuild.**
- **A `SEASONAL_FLORA` constants block** (per-biome, per-season): the seasonal tint strength + the
  bloom/bare opt-ins (so the renderer reads it — no magic numbers; the meadow blooms, the alpine doesn't).
- **What bloom / bare / gold mean concretely (tasteful, not heavy):**
  - **Gold (autumn):** a tint pass on the foliage props toward amber (the `seasonalGrade` autumn tint,
    already defined in D1a, applied to props) — **zero new geometry**, just the re-tint. The cleanest win.
  - **Bloom (spring/summer):** a **few** sparse accent prims (small bright flower-dot cones/spheres,
    8–12 per meadow cover spot) added at build, **toggled visible** only in spring/summer (a `bloomProps`
    list, like the snow overlays). Tasteful = sparse + small; only the bloom biomes (meadow, maybe
    woodland edges) opt in.
  - **Bare (winter):** the winter `seasonalGrade` (desaturate + lighten) on the foliage reads as
    frost-washed; optionally **hide a fraction** of grass blades (toggle visibility) for a thinner winter
    tuft. Reuse the toggle pattern (no rebuild).
- ⚠️ **Discipline:** the *tint* path (gold/bare) is free (it's the existing `seasonalGrade` applied to one
  more set of materials). The *bloom accents* add a little geometry (built once, toggled) — keep them
  **sparse + per-biome opt-in.** Reuse the proven track-materials + toggle-visibility patterns.

---

## #2 — ⚠️ The seasonal AMBIENT (the atmospheric heart — but a NEW system)

**There is no TL2 ambient to parameterize** (the headline finding). So this piece **builds** a minimal
ambient-particle layer — the most involved part of D1c, and genuinely new `requestAnimationFrame` code.
The contained, fleet-safe design:

- **A single bounded particle pool** — one `Points` cloud (or a small `InstancedMesh` of quads) of a
  **fixed** count per active biome, positions seeded ONCE into a buffer; advanced each frame by mutating
  the existing buffer (a downward/drift step with wrap-around). ⚠️ **ZERO per-frame allocation** (the
  hot-loop rule — the buffer + the Points object are created once; the frame loop only writes floats).
  A new `AmbientRenderer` with an `update(dt, season)` call added to the frame loop (sibling to
  `entities.sync`).
- **Seasonal variants** (a `SEASONAL_AMBIENT` block — what drifts + how + colour/density per season):
  - **spring** — pale pollen/seed-fluff, slow upward-ish drift, low density.
  - **summer** — fine insect/mote shimmer, gentle, mid density (the "full life" read).
  - **autumn** — **falling leaves** (amber/brown, a slow tumbling fall) — only where there are trees
    (woodland/pine; see the per-biome map).
  - **winter** — **drifting snow** (white, slow downward sway), the strongest beat.
- **⚠️ Snow PARTICLES compose with the D1a snow GROUND overlay — coordinate so it's not busy.** The
  ground overlay already reads "snow on the ground"; the particles add "snow in the air." Keep the
  particle density **modest** (the ground does the heavy lifting) so the two compose into one wintry read,
  not a blizzard. A `SEASONAL_AMBIENT.winter.density` tuned low, dialled on device.
- **Freeze (the L2 gate):** under `?freeze` the ambient pins to a **static deterministic frame** (the
  particle buffer seeded from the scene seed, NOT advanced) — exactly how CJ freezes to neutral. So the
  seasonal baselines stay byte-stable (#3).

⚠️ Because this is **new per-frame code** (bounded pool, no-alloc, freeze-static), it deserves its **own
focused slice** with those pins, rather than riding the contained cover re-dress. (See slicing.)

---

## #3 — Freeze → neutral (the L2 gate stays deterministic)

- **The cover/flora re-dress is static** — re-tinted materials + toggled bloom/bare props sit at a fixed
  state per season (no animation). Trivially deterministic under `?freeze`. ✓
- **The ambient particles must freeze to a static frame** — under `?freeze`, seed the particle buffer
  from the scene seed and **do not advance it** (the `update` is skipped/zeroed when frozen, like
  `entities.sync(..., frozen)` → neutral). So a frozen seasonal scene is byte-stable for the baseline. ✓
- Both follow the established freeze discipline (the L2 hooks already pin `?freeze` + `?season=`).

---

## #4 — Scope + L2 (pure render; the folded baseline reseed)

- **Pure render** — `WorldRenderer` (the prop re-tint + bloom/bare toggles) + a new `AmbientRenderer` (if
  the ambient slice is built) + `constants.ts` (`SEASONAL_FLORA`, `SEASONAL_AMBIENT`). **No gameplay /
  spawn / catch / schema touch; `src/game/` pure** (the dressing reads `game.season`, D1a's input — no
  `three` in `src/game/`).
- **L2 — folds into the PENDING D1a seasonal baselines.** D1a left `meadow-spring/autumn/winter`
  **unseeded** (held for Craig's approval). D1c **dresses those scenes**, so the dressing folds into the
  SAME reseed — they're seeded ONCE, already dressed (no double reseed). ⚠️ The existing **10 summer
  baselines stay put** (summer dressing ≈ today + the summer ambient; if the summer ambient is non-empty,
  the 10 summer scenes would diff — so under `?freeze` the ambient is static, and if summer adds visible
  motes the 10 baselines reseed too; **flag: keep the summer ambient subtle/none so the 10 don't move**,
  or accept a 10-scene reseed). Possibly **+1–2 seasonal scenes** for a biome whose dressing differs
  notably (woodland autumn leaves) — keep minimal.
- ⚠️ **Decision point:** if the summer ambient is visible, the 10 summer baselines move (a bigger reseed).
  Recommend the summer ambient be **subtle or off** so summer ≈ today (the 10 stay put), the seasonal
  dressing showing in spring/autumn/winter.

---

## #5 — ⚠️ The per-biome honest / tasteful dressing map

Honest = no tropical bloom in the alpine; the cave has no season at all. Tasteful = sparse, per-biome
opt-in, reusing the prop/ambient systems.

| Biome | Spring | Summer | Autumn | Winter |
|---|---|---|---|---|
| **meadow** | bloom (sparse flowers) + pollen | full, mote shimmer | mild gold tint | snow tint + light snow |
| **woodland** | fresh green + pollen | full | ⚠️ **falling leaves** (gold tint) | bare + snow |
| **pineforest** | fresh | full | **falling leaves** (the broadleaf edge); pines stay green | snow on the boughs/ground |
| **wetland / riverbank** | fresh reeds | full | reeds brown-gold | reeds bare + snow |
| **coast / tidal** | — (subtle) | full | mild | cool wash + light snow |
| **moor / highlands** | — | full heather/grass | gold-brown | snow (heavier) |
| **alpine** | ⚠️ **austere year-round** (bare scree) — NO bloom ever | austere | austere | snow (heaviest) |
| **cave** | ⚠️ **NONE** — underground, no season, no snow, no ambient (already `SNOW_BIOMES.cave=false`) | none | none | none |

- **Falling leaves only where there are trees** (woodland / pine). **Snow particles in the cold surface
  biomes**, never the cave. **Bloom only in the meadow** (+ maybe woodland) — not every biome bursts into
  flowers. **The alpine stays austere** (the difficulty-ceiling read) — winter snow, never bloom. This is
  the honest-omission discipline (the same one that kept the wildcat/oystercatcher out, and `dunlin`/
  `snowbunting` flat in D1b).

---

## #6 — Scope confirmation + tests

- **Pure render**, builds on D1a's `game.season` (no gameplay/spawn/catch/schema touch; `src/game/`
  stays pure; no `three` enters `src/game/`). The catch core, the day-phase, D1a/D1b, TL1, CJ, the
  character, the L1 harness — all untouched.
- **Tests:** green on this branch — **674 passing** (the recon adds no code). The build adds render
  tests (the prop re-tint composes via `seasonalGrade`; the per-biome dressing map; the bloom/bare
  toggles; the ambient freezes to static) + the folded baseline reseed.

---

## ⚠️ Proposed SLICING (the headline finding forces it)

- **D1c-i — the COVER/FLORA re-dress (contained, ship FIRST).** Track the prop materials + re-tint via
  `setSeason` (the proven D1a pattern) + the bloom/bare toggles + the `SEASONAL_FLORA` block + the
  per-biome map. **Reuses proven systems, static, freeze-trivial.** Folds into the pending seasonal
  baselines. The low-risk, high-readability win (gold autumn foliage, frost-washed winter, meadow bloom).
- **D1c-ii — the seasonal AMBIENT (a NEW bounded particle system, separate slice OR defer).** The
  `AmbientRenderer` (fixed pool, no per-frame alloc, freeze-static) + `SEASONAL_AMBIENT` (pollen / motes /
  falling leaves / drifting snow) + the snow-particle/ground-overlay coordination. New per-frame code —
  its own focused PR with the no-alloc + freeze pins, or **deferred** if the re-dress already lands the
  seasonal resonance.

**Recommendation:** **D1c-i first** (it's the true "reuse the proven system" piece and lands most of the
seasonal dressing). Then decide on **D1c-ii** (the ambient) as a separate slice once the re-dress is on
device — it's the atmospheric cherry, but it's net-new per-frame code, so it earns its own careful pass.

---

## STOP — the decision before building

⚠️ The brief assumed the ambient extends a TL2 system that **isn't built** — so the honest scope is: the
**cover re-dress is the contained reuse**, the **ambient is a new system**. Craig confirms:

1. **The cover/flora re-dress (#1)** — track the prop materials + re-tint via `setSeason` (the D1a
   pattern) + a `SEASONAL_FLORA` block; **gold = a tint pass** (free), **bloom = sparse accent props**
   (meadow), **bare = winter tint + thinned blades** *(recommended)*?
2. **⚠️ The ambient (#2) — it's a NEW system, not a TL2 extension.** Build the bounded ambient-particle
   layer (pollen / motes / **falling leaves** / **drifting snow**, snow-particles coordinated with the
   D1a ground overlay) — **as its own slice (D1c-ii)**, or **defer** it and ship the re-dress alone?
3. **The per-biome map (#5)** — meadow bloom, woodland/pine autumn leaves, cold biomes snow, **alpine
   austere**, **cave none** *(recommended)*?
4. **The summer-baseline question (#4)** — keep the **summer ambient subtle/off** so the existing 10
   baselines **don't move** (recommended) — or accept a 10-scene reseed for a visible summer ambient?
5. **⚠️ The slicing** — **D1c-i (cover re-dress) first**, then D1c-ii (ambient) separate/deferred — vs.
   one PR? *(recommended: slice it — the ambient is new per-frame code.)*

After Craig confirms the dressing + the per-biome map + the slicing, the build implements the first slice
(D1c-i) — then Craig playtests the seasonal dressing, approves → the seasonal baselines (D1a + D1c
together) seed.
