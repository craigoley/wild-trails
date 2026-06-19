# The Desert — Recon / Design (Layer B, B2: the first worldwide-by-design biome)

**Status:** RECON / DESIGN ONLY for the biome design. (This PR also folds in a
**trivial comment-only de-Britishing sweep** — see §7 — which is not "build":
comments + a doc, zero logic.) The biome itself is **not built**; the direction is
Craig's to decide.

**What this is:** the Desert is the **first worldwide-by-design biome** — the
recon's recommended first step into worldwide expansion (frame-light), and the
**first non-temperate climate** the game has ever had. Its teaching payload is
**desert adaptation** (how life survives heat + aridity — nocturnality,
water-scarcity, heat-avoidance) — ecology nothing in the existing 14 biomes
covers. Per [`docs/worldwide-content-recon.md`](worldwide-content-recon.md) (B2)
+ Craig's pick.

**The bar (every biome clears it):** teaches something genuinely NEW + honest
stakes + distinct from the existing 14. The Desert clears it decisively — a new
**climate** and a new **adaptation lesson**.

**CAUSE (verified) vs HYPOTHESIS (proposed)** is labeled throughout.

---

## TL;DR — the load-bearing findings

1. **Frame-light fit: CONFIRMED (CAUSE).** The Desert is a normal new **cell** on
   the contiguous grid, forking the `prereq` tree — the proven biome-slice
   (riverbank/coast/moor/pineforest/estuary pattern), **no structural change**. It
   is the natural place to introduce the recon's **optional regional label** (it's
   the first genuinely "elsewhere" biome).
2. **The day-night mechanic is the load-bearing question — and the answer mirrors
   the estuary exactly (CAUSE).** The existing phase system gates **COMPOSITION
   only** (`eligibleSpecies` filters *which* species by `activityWindow`).
   Headcount/emptiness is varied **only by SEASON** (`BIOME_SEASONAL_POP`), never by
   time of day. So:
   - "Different cast by time" (nocturnal vs day-active) → **works today, reuse**
     (the woodland already does dawn-robin / dusk-roe / night-badger).
   - "Empty furnace at noon vs teeming cool night" — the desert's *felt identity* —
     is a **HEADCOUNT** axis that nothing varies by time of day. It needs **one new
     additive lever: `BIOME_TIME_POP`**, the exact analog of `BIOME_SEASONAL_POP`
     (the estuary's crux). **Recommend building it** — it's what makes the desert
     *land*, it's small + proven-pattern, and the catch core stays untouched.
3. **Species + diets: the proven 5 cover it — NO new bait (CAUSE).** Real
   US-desert fauna (Sonoran/Mojave) map cleanly to `seeds`/`greens`/`insects`. The
   nocturnal/day-active split is the teaching.
4. **Render: easy legibility, but a real first — a NEW warm palette (sand/ochre),
   the first non-temperate look.** ⚠️ **There is no day-night world lighting today**
   (time is a HUD label + spawn logic, *not* a lit scene) — so "hot bright day vs
   cool night" is **not** rendered; nocturnality reads via the HUD clock + the
   spawn swing. A lighting shift is an **optional future enhancement** (defer).
5. **D1/D2 interplay: keep the CORE (day-night) tight; D1 (seasonal bloom) is a
   real, lovely, *deferred* hook; D2 (heat-avoidance behavior) fits the existing
   budget for free.**

**The one new piece of machinery this biome needs: `BIOME_TIME_POP`** (a
per-biome, per-phase headcount scalar — the estuary-parallel). Everything else is
the proven data slice.

---

## 1. The frame-light fit — the proven new cell + the optional region label

**CAUSE — confirmed proven slice.** Biomes are spatial cells on a contiguous 2-D
grid (`BiomeDef.bounds` = a rectangle; `adjacent` = neighbors; `prereq` = the
unlock-tree edge; `BIOME_SET_UNLOCK` = the fork map). Every biome since the
original 4 was added this way. The Desert is **the same slice** — a new
`BiomeDef` cell + a `prereq` fork + its species rows + missions. **No topology /
grid / tree change** (frame-light, exactly as the recon designed).

**Placement (free cells exist).** Occupied PITCH-cells today (col,row):
(0,0)(0,1)(0,2) (1,0)(1,1)(1,2)(1,3) (2,1)(2,2)(2,3) (3,1)(3,3) + the southern
hedgerow/copse ribbon. **Free, edge-adjacent candidates:** `(2,0)`, `(3,0)`,
`(3,2)`, `(0,3)`.

- **Recommendation (HYPOTHESIS):** fork the Desert off a **warm/dry/open** existing
  biome so the transition reads honest. Two clean options:
  - **off the Coast** (coastal scrub → desert is a real transition; e.g. Baja) —
    a cell west/adjacent to the Coast arm; or
  - **off the Moor/Alpine dry arm** (the SE exposed region) — e.g. `(3,0)`
    south of the Alpine, or `(2,0)` south of the Moor.
- A late-ish **tier** (a parallel arm, like the moor/pineforest forks), with a
  multi-condition gate on the proven `BIOME_GATE_CHALLENGES` pattern. Exact cell +
  tier is a build detail; all four free cells work.

**The optional REGIONAL LABEL (Craig's call).** The recon's framework was
*frame-light + optional regional-cluster labels*. The Desert is the **natural place
to introduce one** — it's the first biome that genuinely reads "**elsewhere**" (a
different part of the world, not the temperate region). Options:
- **(a) None** — it's just "the Desert," a new habitat (simplest; the worldwide-ness
  is implicit). **Default.**
- **(b) A region label** — "Sonoran Desert" / "the desert country," seeding a
  future *warm/arid region* cluster. Signals "you've left the temperate world."
  Cheap (a `displayName` + optional `region` metadata) — **recommend if Craig wants
  the worldwide-ness *named*** at the moment it first becomes true.

---

## 2. The day-night clock reuse — the LOAD-BEARING mechanic ⭐

### The existing time system (quoted)
- `dayPhaseAt(timeSec)` → one of four phases `dawn → day → dusk → night`
  (`TIME.cyclePeriodSec`; dawn/dusk short, day/night long).
- Per species: `activityWindow: DayPhase | 'any'`.
- `isActiveAt(window, phase) = window === 'any' || window === phase`.
- `eligibleSpecies(biome, phase)` = species whose `biome` matches **and** whose
  window includes the phase. *"This is the gate that makes time of day"* matter.

### THE CAUSE-CHECK (the load-bearing finding)
**The phase system is the COMPOSITION axis — it gates *which* species are out,
NOT *how many*.** This is precisely parallel to seasons:

| Axis | Composition (which species) | Headcount (how many / emptiness) |
|---|---|---|
| **Season** | `seasonalAbundance` (lottery weight) | `BIOME_SEASONAL_POP` → `effectiveCap` |
| **Time of day** | `eligibleSpecies` / `activityWindow` ✅ exists | **— nothing varies headcount by phase —** |

`effectiveCap(biome, season) = max(FLOOR, round(maxAnimals × BIOME_SEASONAL_POP))`
— keyed by **season only**. **There is no time-of-day headcount lever** (verified:
no `BIOME_TIME_POP`/`phaseAbundance` anywhere in `src/`).

**What that means for the desert.** With composition alone, at `day` phase the
spawner draws from the few day-active species and **still fills `maxAnimals`** — so
midday would be a *full* desert of the 1–2 heat-tolerant species, **not** the
empty, shimmering furnace that IS the desert's identity. To get *"almost nothing
stirs at noon; the desert comes alive at dusk,"* you need to vary **headcount by
phase** — exactly the gap `BIOME_SEASONAL_POP` filled for the estuary's
*"near-bare summer vs thronged winter."*

> This is the same discovery the estuary made, on the other clock: the existing
> lever was *"the wrong axis"* (composition), and the felt emptiness needed a new
> **orthogonal headcount** lever. The desert is the estuary's day-night twin.

### THE DESIGN — two layers (compose them)
- **(A) Composition — REUSE, byte-unchanged.** Give desert species nocturnal /
  crepuscular `activityWindow`s (most `night`/`dusk`/`dawn`; a few `day`/`any`).
  `eligibleSpecies` + `isActiveAt` are untouched (the game already runs
  nocturnal/crepuscular species — dormouse `night`, badger `night`, hedgehog
  `dusk`). This alone teaches *"different animals at different times."*
- **(B) Headcount — ONE NEW LEVER: `BIOME_TIME_POP`** (the estuary-parallel; the
  one new mechanic). A per-biome, per-phase cap scalar that modulates
  `effectiveCap`, **same spine as `BIOME_SEASONAL_POP`**:
  ```ts
  // sketch — NOT built; the exact analog of BIOME_SEASONAL_POP
  export const BIOME_TIME_POP: Partial<Record<BiomeId, Record<DayPhase, number>>> = {
    desert: { dawn: 0.85, day: 0.2, dusk: 0.9, night: 1.0 }, // furnace noon → alive night
  };
  // effectiveCap gains a 2nd ≤1 multiplier: maxAnimals × seasonScalar × timeScalar,
  // floored at TIME_POP_MIN_ACTIVE (≥ 2). Omitted biome ⇒ ?? 1 ⇒ byte-unchanged.
  ```
  - **THE SPINE (mirrors the estuary's):** every value `≤ 1` → only scales the cap
    *down* (the pool array never grows, no new allocation); a **floor `≥ 2`** keeps
    the desert **never literally empty** → catch never locked out.
  - **D1b honored — always-findable (the sacred floor):** a nocturnal species is
    **more active at night, not ABSENT by day** (floor > 0 on both the eligibility
    side — keep a few `'any'`/`'day'` desert species — and the headcount side). No
    time-exclusion. You can *always* find *something*; you find *more, and the
    nocturnal cast,* at night.
  - **Catch core untouched** — `BIOME_TIME_POP` is a spawn-cap scalar; it never
    touches `finalCatchChance`. (Same as `BIOME_SEASONAL_POP`.)

> **Recommendation (HYPOTHESIS):** build **both** — (A) composition makes the *cast*
> nocturnal; (B) `BIOME_TIME_POP` makes the *emptiness felt*. (B) is the load-bearing
> piece that makes the desert's identity land, and it's a small, proven-pattern,
> well-fenced lever. *If* Craig wants to ship leaner first, (A) alone still teaches
> nocturnality-by-composition — but the desert won't *feel* like a furnace at noon
> without (B). **The recon's call: (B) is worth it — it's the whole point.**

---

## 3. The species — honest desert fauna, the proven diets (NO new bait)

**Pick a real US desert (US-framed, worldwide-true): the Sonoran / Mojave
(American Southwest).** Iconic, real, well-documented, and "worldwide + US-framed"
in one. (CAUSE: the 5 diets — `seeds`/`greens`/`insects`/`fish`/`shellfish` — and
the relevant 3 cover desert food webs cleanly.)

| Species (real) | Diet → proven bait | Activity | Role / hook |
|---|---|---|---|
| **Kangaroo rat** | seeds (caches seeds; never drinks — metabolic water) | **night** | the desert icon; the nocturnal-adaptation poster animal |
| **Black-tailed jackrabbit** | greens (desert shrubs) | dusk/dawn | big ears = heat radiators (adaptation teaching) |
| **Desert cottontail** | greens | dawn/dusk | the gentle valve (common, calm) |
| **Cactus wren** | insects | day | the heat-tolerant day-active bird (a daytime anchor) |
| **Desert lizard** (e.g. whiptail / desert iguana) | insects | day | ectotherm — *needs* the sun (the day-active contrast) |
| **Desert tortoise** | greens (wildflowers, cactus) | dawn/dusk | ⚠️ a real conservation hero (threatened — see §4) |
| **Roadrunner** | insects (small-prey proxy) | day | charismatic; eats lizards/insects → maps to `insects` |
| **Kit fox** | insects (small-prey proxy) | **night** | the nocturnal apex (wary, the hard catch) — *or defer* |

- **NO new bait needed (CAUSE).** Granivores → `seeds`; herbivores → `greens`;
  insectivores/small-prey carnivores → `insects` (the proven small-prey proxy, as
  the existing roster already does for mixed feeders). **Flag:** strict carnivores
  (kit fox, roadrunner eating lizards) map to `insects` as the small-prey proxy —
  honest enough, and consistent with how the temperate roster handles it. If Craig
  prefers zero carnivore-stretch, favor the granivore/herbivore/insectivore set and
  defer the kit fox.
- **Single-biome (`biome: 'desert'`)** — the proven one-biome model (`biomeMatch`).
- **The nocturnal/day split IS the teaching:** ~5 nocturnal/crepuscular (kangaroo
  rat, kit fox, jackrabbit, cottontail, tortoise) vs ~3 day-active heat-tolerant
  (cactus wren, lizard, roadrunner) — so *when* you visit changes *what* you meet,
  and *how full* the desert is (§2).

---

## 4. The new-climate teaching (the payload — P2/P3)

**The lesson nothing temperate teaches: how life survives heat + aridity.**

- **Nocturnality — the time mechanic IS the teaching (the core).** You *learn it by
  doing*: come at noon, the desert is a near-empty furnace; come at dusk/night, it's
  alive with kangaroo rats and a kit fox. *Animals avoid the killing heat by going
  out at night* — taught through the §2 mechanic, not a wall of text.
- **Heat-avoidance + water-scarcity (the copy + the D2 behavior).** The kangaroo rat
  never drinks (metabolic water from seeds); the jackrabbit's huge ears shed heat;
  the tortoise shelters in burrows through the worst of it; the ectothermic lizard
  *needs* the sun. Real, vivid adaptation — the teaching copy carries it (US-framed).
- **Honest conservation stakes (real US desert stories).** The **desert tortoise**
  is genuinely threatened (habitat loss, disease, road mortality, off-road
  vehicles); desert springs/aquifers face **groundwater extraction**; solar-farm +
  sprawl pressure. The desert has *real* honest stakes (the soul-aware register the
  game already uses) — not invented.

---

## 5. D1 (seasons) / D2 (behavior) interplay — what's worth it vs deferred

- **D1 — SEASONS (real, lovely, but DEFER).** Deserts *do* have seasons — the spring
  **wildflower bloom**, the summer **monsoon** — genuine ecology. The hooks exist
  (`seasonalAbundance` for a bloom-time abundance bump; the `AmbientRenderer` for a
  bloom particle/flora re-dress). **Recommendation:** keep the desert **D1-light at
  first** — the *core* is the day-night nocturnality, and stacking a seasonal bloom
  on top of a new climate + a new lever over-scopes B2. **Flag the desert bloom /
  monsoon as a real, deferred enhancement** (a natural later slice; it would make
  the desert seasonally alive too — but it's additive, not load-bearing).
- **D2 — BEHAVIOR (fits for free).** Desert character *is* heat-avoidance: still,
  sheltering, low-activity by day; alert nocturnal foraging at night. This is the
  **proven per-species D2 budget** (`SPECIES_BEHAVIOR`/`ETHOGRAM`) — lean the desert
  species' budgets toward *"low/still by day, active by night,"* using the existing
  data, **no new D2 machinery**. Cheap and on-theme — include it.

---

## 6. The render — the new climate visually (+ L2)

- **Legibility: EASY (CAUSE) — like the estuary/alpine, not the pine/hedgerow
  hiding problem.** Open, sparse, flat arid ground → entities read clearly. No dense
  cover to fight.
- **A NEW PALETTE — the first non-temperate look (a real visual departure).** Warm
  **sand / ochre / pale dust** ground (vs. the temperate greens). This is the first
  time the world leaves the green family — it *signals* "elsewhere" before a word is
  read. (The `BiomeDef.color` + the ground tint; the proven per-biome color slot.)
- **Sparse instanced props (the proven entities-on-top pattern):** scattered
  **cacti** (saguaro/cholla silhouettes), **rocks**, dry **scrub** — instanced like
  the pine scatter / cover, low count (open desert), zero-asset procedural geometry.
- ⚠️ **The day-night VISUAL does not exist today (CAUSE).** Scene lighting is
  **static** (`SceneManager`: a fixed ambient + directional key + hemisphere fill);
  the day-night cycle renders **only as a HUD label/glyph** (`TimeIndicator` —
  "Day ☀️ / Night 🌙"), *not* as a lit scene (the cave does "dark" via ground color,
  not lighting). So **"hot bright day vs cool night" is NOT rendered.**
  **Recommendation:** the desert's nocturnality reads via **the HUD clock + the
  spawn swing** (you see the desert empty at noon / alive at night, and the HUD says
  why) — **no new lighting system for B2.** A genuine day-night *lighting* shift
  (warm noon → cool-blue night) is a tempting **future enhancement**, but it would
  be the game's *first* lit day-night, and it **multiplies the L2 baselines**
  (phases × scenes) — **defer it to its own slice.**
- **L2 / baseline:** the desert's new palette + props are **new canvas scenes** →
  **a reseed after Craig's device approval** (the known rhythm — same as every new
  biome). No existing baseline moves (the desert is additive). `src/game/` purity
  holds (the lever is pure data; the render reads it).

---

## 7. Scope, slicing, and the comment sweep

### Build sequence (after Craig's decisions)
1. **The biome cell + the lever:** the `desert` `BiomeDef` (placement + color) +
   the `prereq` fork + `BIOME_TIME_POP` (the one new lever, with its floor) +
   `effectiveCap`'s second multiplier. *Pure data + a surgical Spawn.ts tweak.*
2. **The species:** the desert roster (single-biome, proven diets, the nocturnal/
   day split via `activityWindow`) + the D2 heat-avoidance budgets.
3. **The teaching copy:** US-framed adaptation + honest stakes (§4).
4. **The render:** the sand/ochre palette + sparse instanced props → **reseed** on
   device approval.
5. **(Deferred):** the D1 desert bloom/monsoon (§5); the day-night lighting shift
   (§6) — each its own later slice.

### The comment sweep — FOLDED IN (it was cheap)
The B1 PR (#158) closed *player-visible* de-Britishing but left **stale British
references in CODE COMMENTS**. They're trivial one-liners and *misleading* (e.g.
*"the roster is British wildlife"* is now false) — leaving them **re-seeds the
British assumption** for future devs. So this PR **folds in the cleanup** (comments
only — zero logic, zero player impact):

- `constants.ts` — 9 comments de-Britished: `Caledonian → boreal` (×5: lines 436,
  729, 1139, 1949 + the pine roster), `British → temperate/neutral` (estuary flyway
  524, the hemisphere roster note 581, the red-deer 1936, the quail seasonTag 1452,
  the harvest-mouse size 2357).
- **Result: `grep Britain|British|Scotland|Scottish|Caledonian` in non-test `src/`
  = 0.** The de-Britishing is now complete in shipped code *and* comments.
- *(4 references remain in **test descriptions** — `describe(...)` strings like
  "honest Caledonian-pinewood" — test-internal, not shipped/player-visible. Cosmetic;
  trivially sweepable in the build slice. Listed for transparency.)*

### Sacred (confirmed)
- **Catch core untouched** — `BIOME_TIME_POP` is a spawn-cap scalar; `finalCatchChance`
  byte-unchanged. **Frame-light** — no grid/tree change. **Real ecology** — real
  Sonoran/Mojave species + real adaptation + real conservation stakes (P2/P3).
- **Tests green at recon time:** `npm run build` ✓, lint ✓, **791/791 pass** (the
  comment sweep is non-functional).

---

*Design complete. The load-bearing call is §2 — the desert wants the
`BIOME_TIME_POP` lever (the estuary's day-night twin) to make "empty noon, alive
night" land. Direction (placement, the region label, the lever, the species set,
the D1/lighting defers) is Craig's to pick. After the calls: the build slice (§7)
implements it; reseed on render.*
