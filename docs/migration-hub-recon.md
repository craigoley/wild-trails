# Recon — the estuary MIGRATION HUB

**A biome whose identity is dramatic SEASONAL ABUNDANCE** — near-empty in summer,
thronged in autumn/winter with Arctic migrant waders, always-findable. Depth made
spatial: the one biome that *requires* D1 Seasons to mean anything.

> **RECON / DESIGN ONLY — no code in this PR.** This maps the migration hub against
> the proven systems and pressure-tests the crux: does the existing `seasonalAbundance`
> lever stretch *dramatic* enough, or does the hub need a small additive extension?
>
> Each finding is labelled **CAUSE** (verified in code, file:line) or **HYPOTHESIS**
> (a design proposal to be proven by a build). The headline is **#1**.

---

## #1 — THE ABUNDANCE LEVER (the crux) ⚠️

### What exists today (CAUSE — verified)

The seasonal-abundance system is two data tables + one pure function:

```ts
// src/utils/constants.ts:225
export const SEASONAL_ABUNDANCE_FLOOR = 0.25;

// src/utils/constants.ts:229
export const SEASONAL_ABUNDANCE: Record<SeasonalTag, Record<Season, number>> = {
  'summer-visitor': { spring: 1.0, summer: 2.0, autumn: 0.6, winter: 0.3 },
  'winter-visitor': { spring: 0.5, summer: 0.3, autumn: 1.2, winter: 2.0 },
};
```

```ts
// src/game/Spawn.ts:35
export function seasonalAbundance(species: SpeciesDef, season: Season): number {
  if (!species.seasonTag) return 1;                  // residents — flat 1.0, no weighting
  return Math.max(SEASONAL_ABUNDANCE_FLOOR, SEASONAL_ABUNDANCE[species.seasonTag][season]);
}
```

How spawn reads it (CAUSE — `src/game/Spawn.ts:46`):

```ts
export function pickSpecies(eligible: SpeciesDef[], season: Season, rng: Rng): SpeciesDef | null {
  let total = 0;
  for (const s of eligible) total += s.spawnWeight * seasonalAbundance(s, season);
  let roll = rng.next() * total;
  for (const s of eligible) {
    roll -= s.spawnWeight * seasonalAbundance(s, season);
    if (roll < 0) return s;
  }
  ...
}
```

The five tagged migrants today (CAUSE — `seasonTag` grep):
`quail` (summer-visitor), a high-tops summer visitor, `brentgoose` (coast, **winter-visitor**),
`knot` (tidal, **winter-visitor**), and a long-haul African summer migrant.

### ⚠️ The pressure-test: the lever is on the WRONG AXIS for "thronged vs empty"

This is the headline finding, and it is the opposite of comfortable.

**CAUSE — `seasonalAbundance` is a *relative lottery weight*, not an absolute
population control.** It changes *which* species is drawn when a spawn fires; it does
**not** change *how many* animals roam, nor *how often* one spawns. Two facts pin this:

1. **The pool is a fixed cap, season-blind.** `SPAWN.maxAnimals = 12`
   (`constants.ts:2327`) — a hard pool size; "spawning never grows it."
2. **The cadence is a constant, season-blind.** `SPAWN.intervalSec = 2.5`
   (`constants.ts:2329`); the loop fires one `trySpawn` every 2.5 s
   (`GameState.ts:376-378`), and a full pool simply refuses (`'pool-full'`,
   `Spawn.ts:92`). Neither the cap nor the interval reads `season`.

So the mudflat **saturates to 12 animals in every season**. The abundance lever only
re-distributes the *composition* of those 12 (and of the refill stream as catches free
slots). Turning a winter-visitor from `2.0` (winter) to `0.3` (summer) makes it a
*rarer draw*, not a *rarer presence* — the 12th slot just fills with something else.

**Verdict on the existing lever, against the hub's stated identity:**

| The hub wants… | The existing lever delivers… | Fit |
| --- | --- | --- |
| **Empty summer** (lone stragglers on bare mud) | a *full* mudflat of 12, just composed of residents | ✗ wrong axis |
| **Thronged winter** (clouds of waders) | a *full* mudflat of 12 — same headcount as summer | ✗ wrong axis |
| **Composition turnover** (winter = Arctic migrants; summer = the resident handful) | exactly this, dramatically, within the floor | ✓ already works |

The curve is **not too gentle on its own axis** — a winter-visitor swings `2.0 → 0.3`
(≈6.7× relative draw-rate vs an equal-weight resident), which is plenty dramatic for
*turnover*. But turnover is not *abundance*. **The existing lever cannot, at any data
value, make the estuary look emptier in summer** — because emptiness is governed by
`maxAnimals` / `intervalSec`, which it never touches. Steeper data values do **not**
unlock the hub; they only sharpen the composition swing.

### The recommendation: an ADDITIVE STRETCH on a new, second axis

**HYPOTHESIS.** To express the hub's identity honestly, add a small **per-biome
seasonal *population* scalar** — a separate, additive lever that modulates the
*effective active cap* (absolute headcount), leaving the existing composition lever
untouched. Proposed shape (pure data + one read in the cadence):

```ts
// constants.ts — NEW, additive, Partial Record (no exhaustiveness ripple)
export const BIOME_SEASONAL_POP: Partial<Record<BiomeId, Record<Season, number>>> = {
  estuary: { spring: 0.5, summer: 0.2, autumn: 0.85, winter: 1.0 },
  // every other biome omitted → flat 1.0 (today's behaviour, byte-unchanged)
};
export const SEASONAL_POP_MIN_ACTIVE = 2; // ⚠️ never-empty floor (anti-lockout)
```

```ts
// Spawn.ts — the cadence reads an EFFECTIVE cap, not the raw maxAnimals
function effectiveCap(biome: BiomeId, season: Season): number {
  const mult = BIOME_SEASONAL_POP[biome]?.[season] ?? 1;
  return Math.max(SEASONAL_POP_MIN_ACTIVE, Math.round(SPAWN.maxAnimals * mult));
}
// in trySpawn: if (activeAnimalCount(pool) >= effectiveCap(biome, season)) return 'pool-full';
```

Result on the estuary: **winter ≈ 12 (thronged), summer ≈ 2–3 (lone stragglers on bare
mud).** This is the dramatic, *spatial* depth the brief asks for — and it is the *only*
way to get it, because headcount is a different axis from composition.

Why this is safe (the three sacred constraints all hold — HYPOTHESIS, to be pinned):

- **floor > 0 / always-findable.** The cap floors at `SEASONAL_POP_MIN_ACTIVE = 2`
  (never 0 → the mudflat is never literally empty). Eligibility stays season-independent
  (`eligibleSpecies` is biome + phase only, `Spawn.ts:88`), so even a 2-slot summer
  estuary can still, over time, surface an Arctic straggler — the floor-weighted lottery
  gives it a non-zero draw among those 2 slots. **No exclusion, ever.**
- **It scales the cap *down*, never up.** The pool array stays size `maxAnimals = 12`;
  we simply stop filling it earlier. **No new allocation, no per-frame alloc, the
  bounded pool is honoured** (see #6).
- **Catch untouched.** This is a *spawn-cadence* read only. `finalCatchChance` has no
  population term — abundance ≠ catch difficulty (the D1b spine).

**Use BOTH levers together** for the full effect:
*composition* (existing `seasonTag`, steep winter-visitor curves on the migrants + a few
flat residents) **×** *headcount* (new `BIOME_SEASONAL_POP`). Winter = a *full* mudflat
of *mostly Arctic migrants*; summer = a *near-bare* mudflat of *a few residents*. Both
honest, both floor-safe.

> **One-line answer to the brief's question:** the abundance lever does **not** stretch
> dramatic enough on its own — not because the curve is gentle, but because it is the
> *composition* axis, and the hub's identity ("empty vs thronged") is the *headcount*
> axis, which nothing currently varies by season. The hub needs the additive
> `BIOME_SEASONAL_POP` stretch. It is small (one Partial table + one cap read), it is
> floor-safe, and it leaves the catch core and the existing D1b composition lever
> byte-unchanged.

---

## #2 — SPATIAL FIT

**CAUSE — the coast/estuary corner already exists.** The grid (square full cells, edge-
adjacent, `cell(cx,cy)`, `PITCH = 2·CELL`):

- `coast` — `cell(PITCH, PITCH*3)` = [20,60]×[100,140], tier 5, prereq `riverbank`.
- `tidal` (the saltmarsh/estuary) — `cell(PITCH*2, PITCH*3)` = [60,100]×[100,140],
  tier 6, prereq `coast`, `adjacent: ['coast']`. **Currently terminal** in
  `BIOME_SET_UNLOCK` (no key).

**HYPOTHESIS — place the migration hub as a clean fork-node EAST of tidal**, extending
the coastal row one more cell out to sea:

- `estuary` — `cell(PITCH*3, PITCH*3)` = **[100,140]×[100,140]**, tier 7, prereq `tidal`,
  `adjacent: ['tidal']`.
- Unlock: add `tidal: ['estuary']` to `BIOME_SET_UNLOCK` (tidal stops being terminal);
  `estuary` itself terminal (no key → unlocks nothing → no cycle).
- `prereq: 'tidal'` mirrors the set inverse (the proven WE0 metadata pattern).

This is the **PROVEN node topology** — a normal full cell on a full edge — **not** the
hedgerow's novel thin ribbon. **CAUSE:** a full-cell, full-edge successor needs **zero**
clamp change — `computeUnlockedRects` assumes full-edge adjacency, which this satisfies
exactly (the hedgerow recon proved the ribbon was the *only* shape that stressed the
clamp; a normal cell does not). `World.ts` / `clampToUnlocked` byte-unchanged.

Open biome? **CAUSE — `isOpenBiome` is the `≤ OPEN_BIOME_COVER_MAX` hiding-spots test.**
The estuary is open mudflat (few/no hides) → it will register as an **open biome** (the
throwing-net condition), like the coast. Good: it matches the flat big-sky render (#6).

---

## #3 — SPECIES + DIETS

### ⚠️ Overlap: most of the brief's named cast ALREADY EXISTS (one-biome model)

**CAUSE — verified by grep.** The one-biome-per-species model (`species.biome` is a
single id, read by Spawn/Species/Journal) means a species lives in exactly **one** biome
and cannot be reused. Of the brief's proposed roster:

| Brief proposes | Status in code | Biome (locked-in) |
| --- | --- | --- |
| **knot** | exists, `winter-visitor` | `tidal` (`constants.ts:2094`) |
| **dunlin** | exists | `tidal` (`:2025`) |
| **redshank** | exists | `tidal` (`:2060`) |
| **curlew** | exists | `moor` (`:1802`) |
| **brent goose** | exists, `winter-visitor` | `coast` (`:1674`) |
| bar-tailed godwit | **net-new** | — |
| wigeon | **net-new** | — |

So **5 of the 7 named migrants are already in the dex** — and the existing `tidal`
saltmarsh is, in substance, *already an estuary wader biome* (knot + dunlin + redshank +
oystercatcher + avocet, with knot already a winter-visitor). The migration hub must
therefore use a **NET-NEW, non-overlapping** cast — it cannot duplicate knot/dunlin/
redshank/curlew/brent goose.

### HYPOTHESIS — an honest net-new estuary migrant roster (single-biome each)

All `biome: 'estuary'`. Diets from the **5 proven baits only** (no new bait): shellfish/
worm waders follow the Tidal #71 `shellfish`/`insects` pattern; wildfowl grazers take
`greens` (the brent-goose pattern) or `seeds`.

**DRAMATIC migrants** (steep `winter-visitor` curve + the new `BIOME_SEASONAL_POP` swing
— the "clouds in winter" cast):

| Species | Bait | seasonTag | Note |
| --- | --- | --- | --- |
| **Bar-tailed Godwit** | `shellfish` | winter-visitor | the headline Arctic migrant — non-stop from the tundra |
| **Grey Plover** | `insects` (worms) | winter-visitor | high-Arctic breeder, here only in the cold months |
| **Wigeon** | `greens` | winter-visitor | grazing wildfowl in winter rafts |
| **Pintail** | `seeds` | winter-visitor | elegant winter dabbler |
| **Sanderling** | `insects` | winter-visitor | runs the tide-line; clockwork-Arctic |

**RESIDENTS** (no `seasonTag` → flat 1.0; the "lone stragglers" who hold the summer
mudflat so it's never bare):

| Species | Bait | Note |
| --- | --- | --- |
| **Shelduck** | `shellfish` | breeds on the estuary; present year-round |
| **Ringed Plover** | `insects` | a resident/passage wader of the shingle edge |

(Roster count is the build's to finalise — 5–7 species, mirroring tidal/coast sizes. The
resident pair is load-bearing: with the `BIOME_SEASONAL_POP` summer floor of ~2 active,
summer surfaces *mostly these two* on bare mud = the "stragglers" read, while every
winter-visitor stays findable via the season-independent eligibility + the lottery floor.)

⚠️ **Single-biome model — the hedgerow lesson.** Each species is one `biome: 'estuary'`
id. No multi-biome species (the model doesn't support it and the hedgerow recon flagged
it). Distinguish the **DRAMATIC** migrants (steep abundance) from the **RESIDENTS** (flat)
purely by presence/absence of `seasonTag`.

---

## #4 — CATCH CORE + D1b (both sacred — CAUSE, verified)

A biome is **data + topology**, never a formula term. Confirmed unchanged by this design:

- **`finalCatchChance` UNTOUCHED.** No biome/season/abundance term. The hub adds species
  rows + a biome cell + (the one new) spawn-cap read — *not* a catch-formula edit.
  (`Catch.ts` reads `ctx.fleeing = aiState === 'flee'`; no population input.)
- **`eligibleSpecies` stays season-INDEPENDENT.** `Spawn.ts:88` gates on **biome +
  phase only** — the season is *never* in the eligibility gate. Every estuary species is
  findable in every season; the season only weights the *pick* and (new) the *cap*.
- **`seasonalAbundance > 0` floor holds.** `Math.max(SEASONAL_ABUNDANCE_FLOOR, …)`
  (`Spawn.ts:37`) — the dramatic composition swing **never reaches exclusion**. The new
  `BIOME_SEASONAL_POP` adds its own `SEASONAL_POP_MIN_ACTIVE ≥ 2` floor on the *cap* (the
  mudflat is never literally empty).
- **Anti-lockout holds even in summer.** Season-independent eligibility × the abundance
  floor × the ≥2 active-cap floor = a summer estuary still spawns, still surfaces every
  species over time (just sparse + resident-dominated). No content is *ever* season-gated.

The existing season-emphasis L1 pins (`season-emphasis.test.ts`: every species/season
`seasonalAbundance ≥ FLOOR`; residents flat 1.0; visitors peak in the right season) keep
passing untouched, and the build adds analogous pins for the new cap-floor (every biome/
season, `effectiveCap ≥ SEASONAL_POP_MIN_ACTIVE`; the estuary winter cap > summer cap).

---

## #5 — TEACHING (P2 — migration as a *place*)

The hub's teaching beat is **migration named as it happens** — the dex/mission copy says,
on a winter catch, *"the knot has come from the Arctic for the winter"* — turning the
abundance swing the player *feels* into a fact they *learn*. Existing infrastructure
(CAUSE): `SEASONAL_NOTE` already prints the honest phenology line on a tagged species' dex
card (`JournalPanel.ts:170`), e.g. *"A winter visitor — arriving as the cold draws in…
scarce (though never quite gone) by summer."* Every estuary winter-visitor inherits it
free.

**HYPOTHESIS — the conservation stakes (honest, warmth-graded):** the estuary's
`SPECIES_INFO` / mission wrap carries the real shorebird-decline story —

- **The flyway.** These birds are not local; they are the British end of the **East
  Atlantic Flyway**, fuelled tundra-to-estuary. The mudflat is a *stopover and
  wintering ground*, not a home — depth made spatial *and* temporal.
- **Stopover loss.** Estuaries are reclaimed, barraged, and built over; a lost mudflat
  is a broken link in a chain thousands of miles long.
- **Sea-level rise / coastal squeeze.** The intertidal feeding flats are pinched between
  rising seas and hard sea-walls — the very mud the waders need is vanishing.
- **Climate & timing.** Warming shifts *when* and *whether* the Arctic migrants come —
  the abundance swing the player learns to expect is itself under threat.

**Unlock copy (HYPOTHESIS).** The estuary unlocks off the tidal set — copy frames the
step *out onto the open mud*: from the brackish saltmarsh creeks to the great tidal flats
where the whole flyway gathers. The teaching beat lands on the first winter visit: the mud
that was bare in summer is *thronged*.

**Warmth grade (CAUSE — reused).** The THRIVING through-line already grades a studied
biome's ground warmth + a soft journal word; the estuary inherits it (study the flyway →
the mudflat reads as cared-for). No new system.

---

## #6 — SCOPE / RENDER / L2 / SLICING

**Render (HYPOTHESIS — the EASY case).** Open mudflat: flat, sparse, big-sky. Legibility
is *trivial* here — the inverse of the Pine #109 / hedgerow problem. Few or no cover props
(→ open biome, throwing-net), a muted wet-mud ground tint (cooler/darker than tidal's
olive), the reused #55 water as broad tidal sheets at the seaward edge. No instanced
forest, no clearing carve-out. The "clouds of waders" are **animals, not props** — so they
flow through the **bounded pool**: even thronged-winter tops out at `maxAnimals = 12`
active (the cap, #1), **no per-frame allocation**, the pool array is pre-sized. The
*feeling* of a throng comes from 12 saturating a small open arena + composition variety,
not from more entities.

**src/game purity (CAUSE).** The one new mechanic (`BIOME_SEASONAL_POP` → `effectiveCap`)
is pure data + a pure read in `Spawn.ts` — **zero three.js**, Node-testable, in keeping
with the hard rule. The render is the only impure piece and it only *reads* state.

**L2 / baselines (CAUSE — the reseed dance).** A new biome → a new visual scene
(`estuary-mudflat`, an `at=120,120` capture) + likely 1–2 seasonal estuary scenes to pin
the *dramatic* swing (`estuary-summer` near-bare vs `estuary-winter` thronged — the one
place the headcount swing is the whole point). New scenes ⇒ **reseed after device
approval**: dispatch `e2e-visual.yml` with `update_snapshots=true` (in-container), then a
**human-authored** nudge commit to clear the auto-merge "exit if the workflow authored the
last commit" guard (documented in `e2e/README.md`, per #139).

**Exhaustiveness ripple (CAUSE — the hedgerow lesson, ~23 pins).** Adding `estuary` forces
keys on the FULL Records: `BIOMES`, `SPECIES`, `SPECIES_INFO`, `SPECIES_MODEL` (tsc will
surface each); the new species ripple roster-count magic numbers (journal "X of N",
panel-organization's `journal-biome` length, the win-condition helpers
`l1/harness.ts catchRemainingSpecies` + `win-condition.test fullyCompletedJournal`), the
fork tests (`BIOME_SET_UNLOCK.tidal` now `['estuary']`; estuary terminal), unlock-lines,
locked-region walls/dim-fog, and the species-info SYNTHESIS time-cue regex. Partial
Records (`SEASONAL_FLORA`, `SNOW_BIOMES`, `BIOME_SET_UNLOCK`, and the new
`BIOME_SEASONAL_POP`) do **not** force keys. Budget ~20–25 pins, all legitimate
additive-growth reflections.

**Proposed slicing (HYPOTHESIS):**

1. **Slice A — the biome + the additive abundance stretch.** The `estuary` cell +
   topology + the net-new species + diets + `BIOME_SEASONAL_POP` + `effectiveCap` (the
   *crux* lever) + the spawn-cap L1 pins + the open-mudflat render. This is the playable
   identity: walk onto bare summer mud, return in winter to a throng. **Opens as DRAFT**
   (visual/feel → device gate, then the reseed).
2. **Slice B — the teaching layer.** The flyway / stopover-loss `SPECIES_INFO`, the
   migration-named mission beat, the unlock copy, the warmth-grade wrap. Pure
   data/copy on top of a proven A.

---

## TL;DR

- **The crux (#1):** the existing `seasonalAbundance` lever is the *composition* axis (a
  relative lottery weight on a fixed, season-blind pool of 12). It already swings
  composition dramatically and floor-safely — but it **cannot** make the mudflat *emptier*
  in summer, because headcount is governed by `maxAnimals`/`intervalSec`, which no system
  varies by season. The hub's "empty vs thronged" identity needs a **small additive
  second lever** — a per-biome `BIOME_SEASONAL_POP` cap scalar (floor ≥ 2 active) — used
  *alongside* the existing composition lever. floor>0 / no-exclusion / catch-untouched all
  hold.
- **Topology (#2):** a clean full-cell fork-node east of tidal (tier 7, prereq tidal) —
  proven node shape, zero clamp change.
- **Species (#3):** most of the brief's named cast (knot/dunlin/redshank/curlew/brent
  goose) **already exists** (one-biome model). The hub needs a NET-NEW migrant roster
  (bar-tailed godwit, grey plover, wigeon, pintail, sanderling + resident shelduck/ringed
  plover), 5 proven baits, single-biome each.
- **Sacred (#4):** catch core + D1b spine untouched; always-findable holds even in a
  2-slot summer.
- **Teaching (#5):** migration named as a place — the flyway, stopover loss, coastal
  squeeze; reuses `SEASONAL_NOTE` + THRIVING.
- **Scope (#6):** easy open-mudflat render; the throng is the bounded pool (no per-frame
  alloc); reseed after device approval; ~20–25 additive pins; slice biome+abundance, then
  teaching.
