# World Expansion — ALPINE / MONTANE SUMMIT (recon)

*the difficulty CEILING; exposure-difficulty; the anti-lockout valve in a low-cover biome*

PLAN.md §4.2 + Craig's picks: the Alpine **caps the difficulty gradient** (where Tidal *widened* the
world, the Alpine *raises the ceiling*) — the endgame mastery biome, the bare summit above the uplands.
Difficulty comes from **exposure + wariness** (the W3 natural lever — the open rock IS the challenge,
not an arbitrary stat). A **pure DATA slice**: no new mechanic, no new diet, no new render character —
the difficulty is **tuning existing knobs** (cover count, wariness/flee, base rates). **Design only — no
code.**

> ## ⚠️ The two headlines
> 1. **The anti-lockout valve in a low-cover biome is solved by a TAME valve species** — not by cover.
>    A snow bunting is biologically *confiding* (it feeds at your feet): give it a **low
>    `detectionRadius`** (it doesn't spook even when you approach exposed) + a **high `baseCatchRate`**,
>    and it's catchable **bait-less with zero cover**. The low-cover difficulty bites the **wary apex**
>    (high `detectionRadius` → spooks at range, little cover to hide → demands the throwing-net +
>    patience); the **floor stays fair**.
> 2. **"Above the Highlands" is geometrically IMPOSSIBLE** — the Highlands cell is **surrounded** on all
>    four edges (woodland / wetland / riverbank / moor). So the Alpine can't be a Highlands-adjacent 3rd
>    successor. The honest fix: **append off the MOOR** (the Highlands' own heather-flank arm) — the
>    climb still reads *Highlands → Moor → Alpine summit*, it's reachability-safe, and the difficulty
>    ceiling lives in the **species tuning**, not the tier number (no `Tier` widen needed). Details #5.

---

## #1 — The difficulty knobs now (what the Alpine tunes — no new mechanic)

Catch chance (`Catch.finalCatchChance`):
`baseCatchRate × tool × proximity(dist, netReach) × calm(correctBait, fleeing) × biomeMatch`.

The levers that make a biome HARD — all **existing tuning knobs**:

| Knob | Where | Harder = | The mechanic |
|---|---|---|---|
| **`baseCatchRate`** | `SpeciesDef` | lower | the raw odds (the highlands' dotterel is the current hardest, **0.12**) |
| **`detectionRadius`** (wariness) | `SpeciesDef` | higher | the range at which the animal **spooks → flees** (`Animal.ts`); the mountain hare is the wariest today (**5.0**) |
| **`baseFleeSpeed`** | `SpeciesDef` | higher | how fast it bolts once fleeing (harder to chase / out of net reach) |
| **the FLEE penalty** | `calmMultiplier(_, fleeing)` → `CATCH.fleePenalty` | — | a **fleeing** animal is far harder to catch — so you must catch it CALM |
| **cover** (`HIDING_SPOTS` count) | per-biome | fewer | in cover the player's detection radius is ×`STEALTH.coverFactor` (**0.45**) → the animal stays **calm** while you close in; sneaking adds ×0.6. **Less cover → harder to stay calm → the flee penalty bites.** |
| **the net** | `toolMultiplier` + `toolReach` | — | the throwing-net's longer **reach** is the OPEN-ground answer (catch from range before / while it bolts) |

⚠️ **`shakeCountForTier` clamps** (`clamp(tier, 1, 5)`, `shakesByTier` has 5 entries) — so tier ≥ 5
already gives the **max** catch-beats. The "difficulty ceiling" therefore lives entirely in the
**species knobs above**, *not* the tier number (this matters for #5).

---

## #2 — The exposure difficulty (honest, diegetic — the terrain is the challenge)

The Alpine is a **low-cover, high-wariness** biome:

- **Sparse cover** — **1** `HIDING_SPOTS` (a single boulder cluster, `kind: 'rocks'`) vs the usual 2–3.
  Open rock above the treeline: almost nowhere to hide. *(Not literally zero — the one boulder is the
  wary species' mastery foothold, #3.)*
- **Wary species** — the catches carry the **highest `detectionRadius`** in the game (≳5, spooking at
  long range) + high `baseFleeSpeed`. With almost no cover to shrink your detection radius, you trip
  their flee at range — and a **fleeing** animal eats the `CATCH.fleePenalty`.
- **The throwing-net is the answer** — its longer reach lets you catch on open ground (from range, or a
  bolting bird), which is exactly the tool the open Highlands/Coast already reward. **No new code** —
  this composes the existing cover/flee/net systems by *tuning* (low cover + wary species).

This is **honest diegetic difficulty**: the exposed summit is *itself* the obstacle (W3), not an
arbitrary penalty — you earn the hardest catches with the net + patience + the one boulder.

---

## #3 — ⚠️ The anti-lockout valve in a low-cover biome (the crux — the floor stays fair)

**The problem:** the usual valve = "the easiest species is catchable bait-less, leaning on STEALTH
(cover)." But the Alpine's difficulty *is* low cover — which weakens that route.

**The solution: a TAME valve species (low wariness), not a stealth route.** The **Snow Bunting** is
biologically *confiding* — "the snowflake" that feeds unbothered at walkers' feet on the high tops. So:

- **low `detectionRadius`** (~2.0, the lowest in the game) → it **does not spook** even when you walk up
  to it **exposed** → it stays in `wander` (not `flee`) → **no flee penalty**;
- **high `baseCatchRate`** (~0.5) → a calm, point-blank bait-less catch clears the anti-lockout bar
  **with zero cover**.

So the **FLOOR is fair**: the snow bunting is catchable bait-less despite the exposure, because its
*tameness* (not cover) carries it. **"Hardest" applies to the CEILING** — the wary apex (high
`detectionRadius` + low `baseCatchRate`) — never to making the easiest species un-catchable.

> The split that makes it work: **wariness, not cover, is the dial.** The low-cover terrain only bites
> the **high-`detectionRadius`** species (they spook at range with nowhere to hide → need the net +
> the one boulder + patience). The **low-`detectionRadius`** valve ignores cover entirely. The one
> sparse boulder is there for the wary species' mastery loop, not the valve's survival.

**L1-pinnable:** `finalCatchChance(snowbunting, {bait-less, not fleeing, point-blank}) ≥ the valve bar`
even with **no cover** — the floor clears anti-lockout (#6).

---

## #4 — The roster (honest alpine specialists; the climate-pressured "highest, last" stakes)

⚠️ The British alpine zone is genuinely **species-poor** (that's *why* it's the highest, last) — so the
roster is narrow and **insectivore-leaning** (honest, like the Cave's bats). The highlands' high-tops
trio (ptarmigan / dotterel / mountain hare) is **not** reused; the Alpine sits *above* them and is
**wider in wariness + lower in base rate** (the ceiling). Proposed **5**:

| Species | Diet | Difficulty | Gait | Honest, climate-pressured status |
|---|---|---|---|---|
| **Snow Bunting** | seeds | easiest — the **tame VALVE** | bird | the **highest-breeding British bird** — a handful of pairs on the very top, and **nowhere higher to go** as the snow-line retreats |
| **Meadow Pipit** | insects | easy–medium | bird | the small ubiquitous bird of the high ground — still common, the summit's background life |
| **Northern Wheatear** | insects | medium | bird | the bobbing white-rumped bird of the stony tops — a long-haul migrant that summers on the bare summits |
| **Golden Plover** | insects | hard | bird | the haunting whistle of the high plateau — wary, and being **pushed off the warming tops** |
| **Ring Ouzel** | insects | hardest (apex) | bird | the shy "mountain blackbird" of the crags — **declining**, a climate-and-disturbance casualty: the wariest catch |

Diets: **seeds ×1 + insects ×4** — honest (alpine birds are insect-gleaners + the seed-eating bunting;
**no raptor** — the golden eagle/raven are carrion/predators that fit no honest bait, **dropped** like
the wildcat). CJ2 gait: all `bird`. Base-rate band ~**0.50 (valve) → ~0.10 (apex)**, *below* the
highlands' dotterel (0.12) — the genuine ceiling. The apex (ring ouzel) carries the **highest
`detectionRadius`** (~5.5) — the wariest in the game. The climate-pressure thread (snow bunting *nowhere
higher*, ring ouzel/golden plover squeezed off the warming tops) is the poignant, real stake fit for
the **highest, last** biome.

---

## #5 — ⚠️ The append + the gate (the geometry finding)

**The Highlands is SURROUNDED** — `adjacent: ['woodland', 'wetland', 'riverbank', 'moor']`, all four
edges taken. **There is no free cell adjacent to the Highlands**, so a literal "above the Highlands"
3rd-successor cell **cannot be placed**. Two ways forward:

- **❌ Highlands → Alpine (the 3rd successor, as asked)** — the Alpine cell would have to sit *beyond*
  the Moor (e.g. cell(120,40)), so reaching it **requires the Moor unlocked** (it's an island behind the
  locked Moor otherwise — a **soft-lock** if a player rushes the Alpine gate before the Moor). And its
  tier would be `highlands(3)+1 = 4` — **lower** than the Tidal (6), contradicting "the ceiling." Two
  strikes.
- **✅ Moor → Alpine (recommended)** — append off the **Moor** (the Highlands' own heather-flank arm,
  currently a terminus). Place the Alpine at **cell(120,40)** (`[100,140]×[20,60]`, **east of the
  Moor**), `adjacent: ['moor']`, **prereq: moor**, **tier 5**. The climb reads **Highlands → Moor →
  Alpine summit** (the bare tops *above* the heather) — still "above the uplands," ecologically clean.
  **Reachability-safe:** the Moor is both the unlock source *and* the spatial gateway (you can't unlock
  the Alpine without the Moor, and the Moor is the way in) — no island, no soft-lock. The Moor gains its
  first successor (`BIOME_SET_UNLOCK.moor = ['alpine']`) — a clean single-successor extension (the
  coast→tidal pattern); its breadcrumb surfaces in the **research-area panel** (the Moor has no mission
  set — the Moor/Cave pattern).

> ⚠️ **Tier: NO widen needed (the answer to "tier 7?").** The Alpine is **tier 5** (`moor(4)+1`), and
> since `shakeCountForTier` clamps at 5, tier 5 already gives the **max** catch-beats — tiers 5/6/7 are
> identical for the catch loop. The **difficulty ceiling is the species tuning** (the lowest base rates
> + the highest wariness + the lowest cover), *not* the tier number. The Alpine being tier 5 (chain-
> depth) while *also* the hardest-to-catch biome is correct — tier ≠ difficulty.

**The gate** — a **#92 multi-condition challenge** in the prereq **Moor** (a hard endgame one): e.g.
**`research-grouse-greens`** (*"catch the red grouse over greens bait"* — a Moor species, its real
shoots diet; non-forced via bait) + an `unlock-the-alpine` project (cost-0 biome-access,
knowledge-by-play double-enforced — the established R2 pattern).

---

## #6 — Scope + L1/L2

- **A pure DATA slice.** Difficulty = tuning existing knobs (`baseCatchRate`, `detectionRadius`,
  `baseFleeSpeed`, the `HIDING_SPOTS` count, the throwing-net). **No new mechanic, no new diet, no new
  render character** (reuse the bird model + the `rocks` cover + the flee/stealth/net systems). `BiomeId`
  / `SpeciesId` widen at compile-time.
- **No `Tier` widen, no schema bump** (Alpine is tier 5; bait/journal state unchanged — `src/game/` +
  state pure).
- **⚠️ L1-testable difficulty (pin the floor AND the ceiling):**
  - **The floor (anti-lockout):** `finalCatchChance(snowbunting, bait-less, calm, point-blank) ≥ the
    valve band` with **zero cover** — the tame valve clears it (the crux, #3).
  - **The ceiling (not impossible):** every Alpine species' `baseCatchRate > 0`, and the apex is
    catchable **with mastery** (throwing-net + the boulder + a calm point-blank) — hard, never a wall.
  - **The win-path extends** through the Alpine (l1-guards + the capstone still fire); the dex fills.
- **⚠️ L2:** a new **Alpine cell** → a new additive frozen baseline (`?…&unlock=all&at=120,40`), seeded
  in-container after Craig approves the look (the #85 path we just set up).
- **Tests:** green on this branch — **618 passing** (the recon adds no code).

---

## STOP — the decision before building

The crux is solved (a tame valve makes the low-cover floor fair) and the geometry is surfaced. Craig
confirms:

1. **The valve (#3)** — the **Snow Bunting** as a *tame, low-wariness* bait-less valve (the floor stays
   fair despite low cover) + **1 sparse boulder** of cover for the wary species *(recommended)*?
2. **The exposure difficulty (#2)** — low cover (1 spot) + the wariest species (highest
   `detectionRadius`, lowest base rates ~0.10 apex) + the throwing-net as the answer *(recommended)*?
3. **The roster (#4)** — Snow Bunting / Meadow Pipit / Wheatear / Golden Plover / Ring Ouzel, honest
   (insect-leaning), climate-pressured, no raptor *(recommended)*?
4. **The append (#5)** — ⚠️ the Highlands is surrounded, so **Moor → Alpine** (tier 5, reachability-safe,
   *Highlands→Moor→Alpine*) *(recommended)* vs. the asked-for Highlands-3rd-successor (geometry +
   soft-lock + tier-4 strikes)? And confirm **no `Tier` widen** (difficulty is the species, not the tier)?

After Craig confirms the difficulty + the valve + the append, the build implements it — then Craig
playtests the summit (does it read as the bare, hard top; is the snow-bunting valve fair; is the apex
hard-not-impossible) and approves the look (then the Alpine L2 baseline seeds).
