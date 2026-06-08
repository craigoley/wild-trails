# Through-line TL1 — recon: the biome "thriving" world-state + a safe color-grade

The soul layer BEGINS (PLAN.md §4.3). The core idea: a world that visibly comes ALIVE as you
care for it (Cozy Grove's "returning colour"). TL1 derives a per-biome **thriving** value from how
thoroughly you've STUDIED a biome (the naturalist fantasy — **understanding heals the world**) and
gives it its FIRST safe visible expression: a **colour/warmth grade** (muted/cool when unstudied →
warm/rich as it thrives). Motion is DEFERRED to TL2 (prove the concept on the lowest-feel-risk
effect first — the audio-scar lesson). ⚠️ **Cosmetic-only** — no game behaviour changes.

**This doc is design only — no code.** Findings cite `file:line` against current main (#80).

> ## ⚠️ #1 — The thriving derivation (the heart — clean, from EXISTING state, no new field)
> Per biome, **thriving = how much of it you've catalogued**, derived purely from the journal +
> `SPECIES[].biome`:
> ```
> speciesScore(b) = (caught species whose SPECIES[id].biome === b) / (total species in b)   // 0..1
> ```
> `journal.species` already holds every caught species (`Journal`), and `SPECIES[id].biome` maps
> each to its biome — so `thriving(b)` is a **pure fold over existing state**. No new persisted
> field, computed at render/display time, **no schema bump.**
>
> **The research term (the brief's second half) — honest note:** research maps to a biome only
> *fuzzily* (a project's biome = its studied species' biome / its activity biome; woodland & some
> tiers have **no** project → div-by-zero). So I recommend **species-catalogued as the clean,
> universal PRIMARY signal**, with research as an OPTIONAL light bonus *only where a biome has a
> flagship project* (guarded) — see the decision. Species-catalogued alone already IS "how
> thoroughly you've studied the biome," and works for every biome.

---

## #1 (detail) — The cleanest derivation

A pure helper (no `three`, Node-testable) — e.g. `thrivingByBiome(journal): Record<BiomeId,
number>`:
```
for each biome b:
  total   = SPECIES_ORDER.filter(s => SPECIES[s].biome === b).length
  caught  = those with journal.species[s] present
  thriving(b) = total === 0 ? 0 : caught / total
  // OPTIONAL (decision): + a small research bonus where b has a study project, capped at 1
```
Reads `journal.species` + `SPECIES` (constants) only. **Placement:** a pure module (proposed
`src/game/Thriving.ts`) — pure logic, Node-tested — **read ONLY by the renderer + the journal
panel, never by the sim** (the cosmetic guarantee, #3). Activity-paced for free: thriving rises as
you CATCH (play), never by wall-clock (P8).

## #2 — The colour-grade render hook (a tasteful lerp, NO refactor)

⚠️ **The hook already exists.** `WorldRenderer` builds each biome's ground colour from STATE via a
colour helper (`WorldRenderer.ts:113`):
```ts
const color = biome.unlocked ? biome.def.color : dim(biome.def.color, BIOME_RENDER.lockedDim);
... new MeshStandardMaterial({ color, roughness: 1 })
```
There's already a `dim(hex, f)` helper (`:51`) and a rebuild (`rebuildDynamic` / `refresh(world)`,
triggered by main on unlock, `main.ts:349/380`). TL1 adds a **sibling colour transform**:
```ts
const color = biome.unlocked
  ? warmthGrade(biome.def.color, thriving[b])   // muted/cool (0) -> warm/rich (1)
  : dim(biome.def.color, BIOME_RENDER.lockedDim);
```
- `warmthGrade(hex, t)` = a tasteful **lerp** (HSL): raise saturation + nudge value/hue toward warm
  amber as `t: 0→1`. A pure colour helper beside `dim` — **not** a post-process, not a heavy
  effect. The UNSTUDIED state = muted/cool; FULLY-studied = warm/rich/alive.
- **Trigger (per catch):** thriving changes on a catch, so the ground colour must re-grade then.
  `refresh()` already rebuilds on unlock; add a **light `setThriving(thrivingByBiome)`** that
  updates each ground material's colour **in place** (`groundMat.color.setHex(warmthGrade(...))`,
  keeping a `biome→groundMaterial` map) — NO dispose/rebuild, cheap enough per-catch. The full
  rebuild stays for unlock (seam/fog/wall changes). The renderer is PASSED the thriving values (it
  never reads the journal — render stays a pure reader of passed state).

## #3 — ⚠️ Cosmetic-only (no behaviour change — structural)

Thriving feeds **only** the renderer (ground colour) + the journal panel (a word, #4). It is
**structurally impossible** for it to touch gameplay: `finalCatchChance(species, ctx)` takes
`{dist, tool, biome, correctBait, fleeing}` — **no journal, no thriving** (the coast/L1 tests call
it bare). Spawns, movement, `Missions`, the research spine, the catch core read **nothing** from
the thriving helper. Guaranteed by: the `Thriving` module is imported ONLY by `WorldRenderer` +
`JournalPanel` (render-side), NEVER by `GameState`/`Catch`/`Missions`/spawn. Pinned by an L1
cosmetic guard (#6).

## #4 — The light legibility (a soft journal word — NOT a HUD meter)

The JournalPanel already groups by biome (the `.journal-biome` headers). Add a soft **qualitative
thriving word** beside each biome header — a gentle indicator, NOT a number, NOT a grind-bar:

| thriving | word |
|---|---|
| 0 – 0.25 | **quiet** |
| 0.25 – 0.6 | **waking** |
| 0.6 – 0.9 | **alive** |
| 0.9 – 1.0 | **flourishing** |

e.g. a header reads **"Meadow · waking"** in a soft tint. Qualitative, unpressured (you're never
shown "67%"), and it lives where studying already lives (the dex). No HUD meter — the world itself
is the primary read; this is the quiet optional confirmation.

## #5 — ⚠️ The muted-baseline first-impression (the key feel-tuning)

Today unlocked biomes render at full `biome.def.color`. TL1 makes UNSTUDIED biomes muted → studied
ones warm — so a **new player starts in a slightly muted world**. Is that off-putting? **No — it's
the right first impression, IF tuned conservatively:**
- ⚠️ **thriving=0 must be CALM, not grey/dead.** The world should still look GOOD at zero — just
  quieter/cooler (a "still, dawn-lit morning"), with room to warm. Proposed range (conservative):
  **saturation ≈ 0.80 → 1.0** + a gentle warmth/value nudge `0 → +small` across `t: 0→1`. NOT the
  0.45 locked-dim; nowhere near washed-out.
- **It warms FAST where it matters.** The meadow (the only biome open at start) has ~6 species, so
  each of the first catches adds ≈ +0.16 thriving — the meadow **visibly warms within the first
  session**. So the muted start is brief and *is the feel*: "a quiet world waking as I study it,"
  felt from the very first creature. The locked biomes are already dimmed/fogged (unchanged), so
  TL1 only grades the OPEN biomes' warmth.
- The exact `0→1` range is **Craig's playtest tuning** — start conservative (subtle), warm up if it
  reads too flat. Lock the baseline only after the eye approves (#78 lesson).

## #6 — Scope + L1/L2 + purity

**Scope:** a pure derived value + a render colour lerp + a journal word. `src/game/` + state stay
pure (`Thriving.ts` is pure, no `three`; the grade is render-side). **No schema bump** (derived,
not persisted). **L1 — the cosmetic guard:** deriving / maxing thriving (an empty journal vs one
with every species) leaves `finalCatchChance`, spawns, and progression **byte-identical** (pin the
no-behaviour-change) + the band/win guards pass unchanged. **L2:** the colour grade is exactly what
visual regression is for — but the **baseline locks AFTER Craig approves the look** (don't lock an
unapproved grade — the #78 lesson); the build adds the grade + a thriving-scene, the baseline
captures once approved. **483 green** on this branch.

---

## Decisions needed before building

1. **The derivation** — `thriving(b) = caught-in-b / total-in-b` (species-catalogued, the clean
   universal signal). Research term: **(a)** species-only for TL1 (recommended — cleanest, every
   biome works; research folds in at TL1b/TL2), or **(b)** species-primary + a small guarded
   research bonus. Confirm?
2. **The grade** — a `warmthGrade(hex, thriving)` HSL lerp beside `dim` (muted/cool → warm/rich),
   applied at `WorldRenderer.ts:113`, re-graded per catch via a light in-place `setThriving` —
   confirm the approach (no refactor)?
3. **The muted baseline (#5)** — thriving=0 is CALM-not-dead (saturation ≈0.8, a gentle warmth
   nudge), warming fast in the meadow; the exact range tuned on playtest. Confirm a new player
   *should* start in a quiet-waking world?
4. **The legibility (#4)** — a soft qualitative word (quiet/waking/alive/flourishing) beside each
   journal biome header, no number/meter — confirm?
5. **Cosmetic-only + L2-after-approval** — thriving touches only render + the journal word; the L1
   cosmetic guard pins no-behaviour-change; the L2 baseline locks only after the playtest — confirm?
