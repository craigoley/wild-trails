# World Expansion — Riverbank recon (the first new biome — design + integration)

The first slice where the world *grows* (PLAN.md §4.2, after WE0 #67's tier/prereq metadata).
Riverbank is a **data slice**: a new tiled cell + species + a research project to reach it (R2's
gating, generalized — confirmed #66). It ships on the **existing 3 diets** (the fish diet is a
later §4.1.5 companion, **not** bundled) and **reuses** the water mechanic (#55) + the dip-net
(#57) — Riverbank is the *synergy* biome. **No new catch mechanic, diet, or clamp/water change.**

**This doc is design only — no code.** Findings cite `file:line` against current main (#67).

---

## #1 — ⚠️ Riverbank as a PLACE + the species (the naturalist heart, P2/P5)

**Identity:** a stretch of **flowing fresh water** — a clear, fast river reach with stony riffles
and grassy banks — distinct from the Wetland's still **pond**. The teaching axis is *moving water*:
specialists that walk the streambed, bob on midstream rocks, dive off the bank. Tier 4+ (harder
than the Highlands), but with a catchable easiest (the anti-lockout valve).

**Four species, the existing 3 diets, a difficulty spread, each teaching real biology:**

| Species | Diet | Active | Water? | Difficulty | What it teaches |
|---|---|---|---|---|---|
| **Reed bunting** | seeds | day | bankside reeds | **easiest** (the valve) | A seed-eater of the reedy wet margins; the male's black head + white collar. *The "you can always catch one" species.* |
| **Water vole** | greens | day | ⚠️ **flees INTO water** | medium | "Ratty" of *Wind in the Willows* — a bankside herbivore that **dives off the bank with a "plop"** to escape (reuses `fleesToWater`; the **dip-net matters again** — the synergy). Declining (American mink). |
| **Grey wagtail** | insects | day/dawn | by the water | medium-hard | A fast-water insectivore that **constantly bobs its tail**; vivid **yellow** underneath despite the "grey" name (the misleading-name lesson). |
| **Dipper** | insects | day | ⚠️ in-stream | **hardest** (rare) | The only songbird that **walks underwater** on the streambed hunting larvae; white bib, bobs on midstream rocks; a clean-water indicator. |

Diet coverage: seeds (reed bunting), greens (water vole), insects (wagtail + dipper). The water
vole's `fleesToWater` is the deliberate **dip-net call-back** — Riverbank re-uses the W/B1 lateral
condition in a new place. Each `SpeciesDef` (biome `riverbank`, `tier` 4–5, a `baseCatchRate` on
the difficulty curve, diet, activity window, color/size) + a `SPECIES_INFO` card (fieldNote /
behaviour / status — the #45 teaching). **Exact tuning is a build detail, validated by the
anti-lockout guard (#5).**

## #2 — The water REUSED exactly (no new mechanic)

`#55` water = `WATER: WaterDef[]` (`constants.ts`), each `{ biome, x, y, radius }` — a **disc**;
`isInWater` / `nearestWater` / `resolveWaterSlide` (axis-slide barrier) / the `fleesToWater` flee
+ `WATER_FLEE_BIAS` / the dip-net's gate-reach over water (B1) all read these discs. → Riverbank
**reuses this verbatim**: add `WaterDef` disc(s) in `riverbank` (a couple of overlapping discs read
as a short **river reach**; the *render* draws a flowing band — `WATER_RENDER` elongated/repeated —
but the **collision is the existing disc mechanic**). The **water vole** carries `fleesToWater:
true` (reusing the frog's behaviour). **No new water shape or mechanic** — "river" is a *visual*
distinction over the same disc water. The dip-net (B1) becomes relevant again (the vole fled across
the water). The composition order (clamp → water-slide, `Player.ts:115`) is **untouched**.

## #3 — The tiled cell (the rectangular clamp, unchanged)

Per WE0 + #66: the rectangular per-rect clamp already extends to N **equal, edge-adjacent** cells
(the seam-stitching connects them; it's O(N) over `unlockedRects`). Riverbank is a **new
`cell(cx, cy)`** (same `halfSize 20`) tiled **edge-adjacent to the Highlands** (the tier neighbour
— e.g. `cell(40, 80)`, north of Highlands `cell(40,40)`, reading as the river descending from the
high ground; the exact position is a build pick, the constraint is *equal + edge-adjacent to an
already-unlocked cell*). The clamp + `computeUnlockedRects` + the water-slide are **byte-unchanged**
— Riverbank slots in as data. Render: a new ground `color` + the river + a prop (reuse the reed
cluster, or a new bankside prop — zero-asset, like the others); a `SUPPLY_POSTS` entry. (Geometry
and the *unlock* gate are decoupled — the cell can neighbour Highlands while its gate is the chain
below.)

## #4 — ⚠️ The research gate (WE0 metadata + R2 generalized, knowledge-by-play intact)

Riverbank is **tier 4, prereq `highlands`** (the new terminal of the chain). The gate is R2's
pattern, extended by **data only** (no gating code):
- **`BIOME_SET_UNLOCK`** += `highlands: 'riverbank'` (the existing unlock logic reads this — see
  below).
- **`BIOME_GATE_CHALLENGES`** += `highlands: ['research-river-ready']` — a **new mastery challenge,
  by PLAY** (a research-challenge mission like `research-mouse-night`): demonstrate **water-habitat
  readiness** with *existing* content (candidate: catch a wetland water species — the mallard/frog —
  in a set window; doable with the starter, so it's anti-wall). Exact requirement = a build pick.
- A **biome-access research project** `unlock-the-riverbank`: `reward: { kind:'biome-access', biome:
  'riverbank' }`, `knowledgeRequirement: 'research-river-ready'`, an `activity` (catch-in-highlands
  ×4 — the investment), **`cost: 0`** (Riverbank is on the **win path** — see #5 — so zero wall risk,
  exactly like R2's Highlands; the credit sink stays in the optional projects).
- **`reconcileResearchUnlocks` + `isUnlockGateMet` + the #37 `unlockLines`** already iterate this
  generically — Riverbank's unlock + its "Reach new lands" line + research step appear **for free**.
  ⚠️ **Knowledge-by-play, double-enforced** (R2): `research-river-ready` (by `journal.missions`) is
  required by the project's `knowledgeRequirement` **and** the dispatch's `isUnlockGateMet` re-check
  — credits/activity can't bypass it.

**Does the runtime read WE0's `tier`/`prereq` metadata?** Recommendation: **no — keep the metadata
descriptive, extend `BIOME_SET_UNLOCK`** (the proven runtime source; WE0's consistency guard then
validates `prereq`/`tier` against it). Wiring the runtime onto the metadata is a separate
behavior-risky refactor not needed here. So Riverbank sets `tier: 4`, `prereq: 'highlands'`
(consistent metadata) **and** extends `BIOME_SET_UNLOCK` (the runtime) — neutral + clean.

## #5 — Anti-lockout + difficulty (on the win path)

**Riverbank is on the win path:** `isGameComplete` requires `foundCount === SPECIES_ORDER.length`
(ALL species) — so its species are win-required → its gate must be completable (hence **cost 0** +
the activity reachable + the challenge by-play, R2's anti-wall). And its **easiest species (reed
bunting) must be catchable BAIT-LESS with the STARTER net** (the valve, like every biome — pinned by
a new band guard on the Riverbank roster). The harder species (dipper) lean on bait/the dip-net but
are never *required*-to-be-hard past catchable. **The L1 progression-to-win extends through
Riverbank** (it unlocks via its gate + its species are catchable → the win stays reachable).

## #6 — Persistence + L1/L2

**No schema bump (rides v7).** `BiomeId` **widens** to include `'riverbank'` (a **compile-time**
union change, not persisted-schema); unlock state stays `journal.unlockedBiomes` (a `string[]` —
holds the new id) + `journal.research` (the new project). `sanitizeUnlocked` already drops unknown
ids (forward/back-compat). `SpeciesId` widens similarly; `SPECIES`/`SPECIES_INFO`/`SPECIES_ORDER`/
`BIOME_ORDER`/spawn (`species.biome`)/`groupSpeciesByBiome` all iterate **generically** — Riverbank
species integrate as data. `src/game/` + state stay pure.

**New guards.** L1: (a) Riverbank **unlocks via its research gate, by play** (credits/activity alone
don't — the knowledge-by-play guard on the new gate, like R2's); (b) the **easiest Riverbank species
is catchable bait-less** with the starter (the band, like Guard 2); (c) **progression-to-win
includes Riverbank** (the full chain → win, extending L1 Guard 3 through the new biome). The WE0
current-4 guard still holds (the 4 unchanged). L2: a new **deterministic scene** for Riverbank
(`?unlock=all` opens it — `applyTestScene` is config-driven — for the visual baseline + the river
render). **447 green** on this branch.

---

## Decisions needed before building Riverbank

1. **The species set** — reed bunting (seeds, valve) / water vole (greens, `fleesToWater`) / grey
   wagtail (insects) / dipper (insects, hardest)? (Confirms the 3-diet coverage + the water-vole
   dip-net synergy. Swap dipper↔kingfisher? — kingfisher is **fish**, so it waits for §4.1.5.)
2. **The water** — reuse the disc mechanic (river = overlapping discs, rendered as a band); the
   **water vole** flees into it (`fleesToWater`) — confirm no new water mechanic?
3. **The gate** — `tier 4`, `prereq highlands`; extend `BIOME_SET_UNLOCK` (highlands→riverbank) +
   a **by-play mastery challenge** (`research-river-ready`, water-readiness with existing content) +
   a cost-0 biome-access project (R2 generalized; metadata stays descriptive) — confirm the shape +
   the mastery challenge's exact requirement?
4. **The cell** — a new equal cell edge-adjacent to the Highlands (`cell(40,80)`?) — confirm the
   position (clamp unchanged either way).
