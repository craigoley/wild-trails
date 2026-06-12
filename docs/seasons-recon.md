# Depth arc D1 — SEASONS (recon)

*hybrid seasons: the world REFLECTS the real-world season (the "snowy December" resonance) — but the
season is **ATMOSPHERE + TEACHING, NEVER a GATE**. Nothing is ever missable.*

Per PLAN.md §4.6 (D1) + Craig's locked decision. The #1 depth/resonance move — the real-time connection.
A **major arc** (it touches render + spawn — the biggest since World Expansion), so this recon maps the
*contained* path and recommends **phasing** it. **Design only — no code.**

> ## ⚠️ THE SPINE INVARIANT (held everywhere below)
> The season is **atmosphere + teaching, never a gate.** Nothing becomes unavailable in any season —
> **every species is ALWAYS findable + catchable by studying, in every season.** The season changes the
> **texture**: the world's LOOK (the grade/mood) and which species are **characteristic / most-present**
> — expressed as **EMPHASIS (abundance weighting + a journal note), NEVER exclusion (spawn gating).** The
> swallow doesn't *vanish* in winter (a missable gate); winter *teaches* "the swallow has migrated, it's
> scarce now" while **still letting you find one** (rare-but-present). If any part of the build finds
> itself making something **unavailable by season, that's drift into the FOMO version → STOP + re-anchor.**

---

## #1 — The real-season read (a clean, contained input — the sim stays pure)

The model is the existing day-phase read (`Time.ts`): `dayPhaseAt(timeSec) → 'dawn'|'day'|'dusk'|'night'`
— a pure lookup over `TIME` constants. The season mirrors it:

```ts
// Season.ts — PURE, Node-testable (the dayPhaseAt sibling).
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export function seasonOf(date: Date, hemisphere: Hemisphere = 'northern'): Season { … }
```

⚠️ **The ONE difference from day-phase — and the purity rule it forces.** The day-phase derives from the
**pure run clock** (`game.timeSec`), computed *inside* the sim. The season derives from the **real-world
wall-clock date** (`Date.now()`) — which is **impure**, exactly like the `Date.now()` boot seed. So:

- **`seasonOf(date)` is a pure function** (date → season) — fully L1-testable, lives in `src/game/`.
- **The DATE is read at the BOUNDARY** (`main.ts`), like the boot seed — never inside `src/game/`.
- The boundary sets `game.season` as an **input field** on the game state (the way `game.dayPhase` is
  set each tick). The pure layer (spawn weighting, the journal note) **reads `game.season`** — it never
  reads the clock. **The sim stays pure; the season is just another input**, like the phase.

By month (Northern meteorological default): **spring** Mar–May, **summer** Jun–Aug, **autumn** Sep–Nov,
**winter** Dec–Feb. ⚠️ **Hemisphere:** default **Northern** (the roster is British wildlife, and Craig is
UK) — offer a Southern flip as a **setting** later (the function takes a `hemisphere` arg from day one so
it's a data swap, never a rewrite). Boundary-by-month keeps it dead simple; a future refinement could ease
the grade across month boundaries, but a hard month boundary is fine for v1.

**Where it plugs in:** `main.ts` computes `game.season = readTestSeason() ?? seasonOf(new Date())` once at
boot (and could refresh on focus, like the day clock) → the renderer reads it for the grade, the spawn
reads it for the weighting. **One input, two readers.**

---

## #2 — The seasonal re-grade (the soul-layer extension — reuse, don't rebuild)

TL1's warmth grade (`WorldRenderer.warmthGrade(hex, thriving)`) is an **HSL transform**: it scales a
biome's ground colour's saturation + lightness by `thriving` (muted-when-unstudied → rich-as-it-thrives).
The seasonal grade is **the same shape, a second HSL transform** — so it **COMPOSES** cleanly:

```
finalGround = warmthGrade( seasonalGrade(biome.base, season), thriving )
```

The world is **BOTH thriving AND seasonal** — compose, never replace. `seasonalGrade(hex, season)` shifts
hue/sat/light per season:

| Season | Grade (per-biome base → seasonal) | Dressing |
|---|---|---|
| **Winter** | desaturate + cool + lighten toward snow-grey | **snow ground-overlay** + bare cover |
| **Spring** | fresh, brighter green; a touch more saturation | bloom accents |
| **Summer** | lush, warm, full saturation (≈ today's look) | full |
| **Autumn** | hue toward gold/amber; warm, slightly muted | — |

- **The render path already exists.** `setThriving(...)` re-grades every unlocked ground material **in
  place** (no rebuild) on a catch. Add a sibling **`setSeason(season)`** that re-grades the same materials
  through the composed transform. Cheap, proven, contained.
- **Snow as a ground-overlay** follows the established **fog-veil / cave-dark pattern**: a translucent
  white-tint plane over a biome's ground (the cave already does a dark-ground re-grade; snow is its
  bright sibling). Per-biome opt-in (the cave underground gets no snow; the coast less; the highlands
  more) via a per-biome seasonal data block.
- **Per-biome seasonal palettes:** a small `SEASONAL` data block (the seasonalGrade HSL deltas, per
  season, optionally per-biome override) in `constants.ts` — no magic numbers in the renderer.

This is the **highest-resonance, most contained** part — the "snowy December" lands here, entirely in the
render layer, **zero gameplay touch.** (See the slicing: ship this first.)

---

## #3 — ⚠️ Seasonal EMPHASIS without exclusion (the spine — the hardest part)

**The problem:** real phenology is about *presence* changing (swallows leave, redwings arrive) — but the
hybrid says **nothing's missable.** So "characteristic of summer / scarce in winter" must be **EMPHASIS,
not a gate.**

**The mechanism — a seasonal abundance MULTIPLIER on the spawn weight (never on eligibility):**

- `eligibleSpecies(biome, phase)` stays **byte-unchanged** — the season **NEVER** gates the eligible list
  (that's the spine). Every species eligible in its biome+phase stays eligible in **every** season.
- `pickSpecies` weights by `spawnWeight`. Add a **seasonal factor**: effective weight =
  `spawnWeight × seasonalAbundance(species, season)`, where **`seasonalAbundance` is ALWAYS > 0** (a hard
  floor, e.g. `≥ 0.25`). A summer visitor: **×2.0 in summer, ×0.3 in winter** — *common-then-rare, never
  absent.*

```
summer visitor (swallow):  spring 1.0 | summer 2.0 | autumn 0.6 | winter 0.3   (rare-but-present)
winter visitor (redwing):  spring 0.4 | summer 0.3 | autumn 1.2 | winter 2.0
resident (robin, mouse):   1.0 everywhere (year-round-flat — most of the roster)
```

- **⚠️ Anti-lockout holds in EVERY season (the pin):** because the floor is > 0, every eligible species
  is **always pickable** — a player in winter can still find + study + catch a summer species (just rarer).
  **L1 pins:** for every species, in every season, `seasonalAbundance > 0` AND the species remains in
  `eligibleSpecies` (season never removes it) AND a seeded spawn loop in the off-season still yields it.
  **Never a season-locked species.**
- **The TEACHING (the honest half):** a **journal note** per seasonal species ("A summer visitor — most
  numerous Jun–Aug; scarce but still about in winter") + optionally a subtle "scarce now" hint on the
  species card in its off-season. The abundance *genuinely* shifts (like real life) **and** the content
  stays unlocked (rare ≠ gone). Honest phenology without FOMO.

**Honest roster (which species get a seasonal character vs. stay flat):** a *minority* carry a seasonal
character; **most stay year-round-flat** (residents). Candidates (drop/soften any that can't be honest
without gating):
- **Summer visitors** (common→summer, scarce→winter): swallow / swift / cuckoo / wheatear (already an
  alpine migrant) / the warblers — *if they're in the roster; only tag the genuinely migratory.*
- **Winter visitors** (common→winter): redwing / fieldfare / brent goose (already coastal) / knot (already
  tidal) / snow bunting (already alpine) — winter-weighted.
- **Residents** (flat 1.0): the mice, robin, badger, most of the roster — **no seasonal weighting at all**
  (a clean default: `seasonalAbundance` defaults to 1.0 everywhere unless a species opts in).

⚠️ **Discipline:** only tag a species seasonal if its real phenology is honest AND the emphasis-not-gate
shape holds. When unsure, leave it **flat** (year-round) — flat is always spine-safe.

---

## #4 — Season × day-phase compose cleanly (orthogonal axes)

They're **independent** and **untouched-by-each-other**:

- **Day-phase** gates **eligibility** (`eligibleSpecies(biome, phase)` — wrong time, not out). **Unchanged.**
- **Season** weights **abundance** (`× seasonalAbundance` in the pick). A **separate** axis.

So they compose with **zero special-casing**: a **summer night** (phase=night gates the nocturnal set;
season=summer weights the summer-characteristic ones up), a **winter dawn**, etc. The **phase system is
not touched** — season is a NEW orthogonal axis layered on the pick, not a change to the clock or the
phase windows. (One honest nuance to *teach, not gate*: a summer-night species in winter is rarer via the
abundance weight — never removed from the night eligibility.)

---

## #5 — ⚠️ The L2 determinism problem (the gate stays deterministic)

**The risk:** seasonal looks mean a frozen scene's appearance now depends on **when the capture runs** (its
real date) → the visual gate would **false-diff** by season. **The fix (two parts):**

1. **A `?season=` test hook** (the `?freeze`/`?seed`/`?at` pattern in `testHooks.ts`): `?season=winter`
   pins the season for a capture, overriding `seasonOf(new Date())`. `readTestSeason()` returns the pinned
   season; the boundary uses `readTestSeason() ?? seasonOf(new Date())`. **Every L2 scene pins an explicit
   `?season=`** → captures are **date-independent + deterministic.** (No-op in normal play, like the others.)
2. **New per-season baseline scenes (⚠️ flag the scope — a major baseline addition).** To actually *guard*
   the seasonal looks, add per-season variants of representative scenes. The honest options:
   - **Minimal:** add a **4-season set of ONE representative scene** (e.g. `meadow-spring/summer/autumn/
     winter`) → +3 baselines (summer ≈ today). Guards the grade + snow overlay.
   - **Fuller:** a winter (+ maybe autumn) variant of each biome where the seasonal look differs most →
     +~10–20 baselines. The biggest baseline addition yet — **size it deliberately with Craig.**
   - The existing 10 scenes each pin `?season=summer` (≈ today's look) so they **don't move** when D1
     ships (their baselines stay valid; the new seasonal scenes are additive).

Either way the **gate stays deterministic** (every scene pins its season). Recommend **minimal first**
(the 4-season meadow set), expand later — it proves the determinism + the grade without a 20-baseline reseed.

---

## #6 — Scope + L1 + persistence (the catch core untouched)

- **The touch:** a pure `seasonOf` read (`src/game/Season.ts`) + the seasonal re-grade (render:
  `seasonalGrade` + `setSeason` + the snow overlay + a `SEASONAL` constants block) + the spawn-weighting
  (`pickSpecies` gains a season-aware factor; `eligibleSpecies` unchanged) + the journal note.
- **⚠️ The catch FORMULA is untouched** — season weights **SPAWN abundance**, **never the catch odds**.
  `finalCatchChance(species, ctx)` takes no season; `Catch.ts` stays byte-unchanged (git-pinnable). The
  two axes (rarity/abundance vs. catch difficulty) stay independent, as they always have.
- **Persistence / schema:** **no schema bump.** The season is **computed from the date** (like the
  day-phase from the clock), **not stored.** Nothing new persists. (A future *hemisphere setting* would
  persist a single enum — trivial, additive, deferred.)
- **`src/game/` purity:** the season is a **pure input** — `seasonOf` is pure; the impure `Date.now()`
  stays at the boundary (`main.ts`), passed in like the seed. No `three`, no clock-reads in `src/game/`.
- **⚠️ L1 (the spine, pinned):** in **EVERY** season — every species stays in `eligibleSpecies` (season
  never removes it); every `seasonalAbundance > 0`; a seeded off-season spawn loop still yields the rarest
  seasonal species (the anti-lockout floor). **Every species findable, every season.** + `seasonOf`
  boundary pins (each month → the right season; hemisphere flip).
- **Tests:** green on this branch — **641 passing** (the recon adds no code).

---

## ⚠️ Proposed SLICING (phase the major arc — don't ship it as one PR)

Three contained slices, each independently playtestable + revertible:

- **D1a — the seasonal RE-GRADE (visual-only, ship FIRST).** `seasonOf` read + `game.season` input + the
  `seasonalGrade`/`setSeason` + the snow overlay + the `?season=` hook + the **minimal** per-season L2 set.
  **ZERO spawn/gameplay change.** The high-resonance "snowy December" win, fully contained in render +
  a pure read. Craig playtests the seasonal *look*. (The catch core, spawn, schema all untouched.)
- **D1b — the seasonal EMPHASIS (spawn weighting).** The `seasonalAbundance` multiplier (floor > 0) +
  the honest roster tags + the journal teaching note + the **anti-lockout-every-season** L1 pins. Builds
  on D1a's season read. The spine-critical slice — its own focused PR with the invariant pinned hard.
- **D1c (optional, later) — seasonal dressing/ambient.** Bloom/bare cover, seasonal ambient life (the TL2
  extension), audio mood — pure polish on top, deferrable.

**Recommendation:** **D1a first** (contained, high-resonance, no gameplay risk) → Craig approves the look →
the fixed-season baselines seed → **then D1b** (the emphasis, with the spine pinned). This de-risks the
biggest arc since World Expansion by landing the resonance win before touching spawn.

---

## STOP — the decision before building

The contained path holds the spine everywhere (emphasis never exclusion; anti-lockout every season), the
sim stays pure (season is an input like the phase), the re-grade reuses the proven warmth-grade, and the
L2 gate stays deterministic (fixed-season scenes). Craig confirms:

1. **The season read (#1)** — a pure `seasonOf(date, hemisphere)` (the `dayPhaseAt` sibling), the date
   read at the boundary, **Northern default** + a deferred Southern setting *(recommended)*?
2. **The re-grade (#2)** — compose `warmthGrade(seasonalGrade(base, season), thriving)` (BOTH thriving
   AND seasonal), snow as a ground-overlay, a per-biome `SEASONAL` block *(recommended)*?
3. **⚠️ The emphasis (#3, the spine)** — abundance **multiplier with a > 0 floor** (never exclusion);
   most species **flat**, a minority honestly seasonal; anti-lockout pinned every season *(recommended)*?
4. **The L2 determinism (#5)** — every scene pins `?season=`; start with the **minimal** 4-season meadow
   set (expand later) vs. a full per-biome winter set now? Confirm the scope.
5. **⚠️ The slicing** — **D1a (re-grade) first**, then D1b (emphasis), D1c (dressing) later — vs. one big
   PR? *(recommended: phase it.)*

After Craig confirms the approach + the slicing, the build implements the first slice (D1a, the re-grade)
— then Craig playtests the seasonal look/feel + approves (then the fixed-season L2 baselines seed).
