# D2 — individual animal life / behavioral ethology (recon / design)

**Status:** RECON / DESIGN ONLY (no build). Map the proposed ethogram architecture against the
ACTUAL animal/AI code, confirm the contained path, scope honestly — then stop for the architecture
decision. A MAJOR arc; recon-first.

**Proposed architecture (from the research — validated below, not assumed):** a small SHARED
ethogram of STATES (rest / forage / vigilance / preen / [vocalize] / flee) + per-species TIME-BUDGET
WEIGHTS over those states + a SIGNATURE behavior or two per species (the dipper bobs, the wagtail
wags). A species' character = its weighting + signature. The state machine drives WHICH gait / WHERE
/ the dwell; CJ renders the locomotion. JIZZ (the behavioral signature) is the bridge to D3.

⚠️ **Ordering:** D2 builds **after** the pending seasonal reseed closes — the L2 gate must be UP
(fresh, correct baselines) before D2's new motion, so D2's own reseed captures behavior on top of an
already-seamless world. Don't interleave D2 with the open seasonal reseed.

---

## 1. The current animal AI (the foundation) — **CAUSE (verified in code)**

Animals already run a **pure, seeded state machine** in `src/game/Animal.ts` — exactly the substrate
the ethogram needs.

**The struct + the loop.** `updateAnimal(animal, player, world, rng, dt, lure, stealthFactor)` is
PURE (no `three`/DOM), called once per active animal per fixed sim step from `GameState.ts:404`:
```ts
const fledNow = updateAnimal(a, game.player, game.world, game.rng, dt, lure, game.stealth.factor);
```
The pool is fixed-size (`SPAWN.maxAnimals`), allocated once; nothing allocates per frame.

**The states today** — `AnimalAIState = 'wander' | 'flee' | 'approach'`:
- **WANDER** — a seeded random-walk: re-pick a heading every `ANIMAL.wanderRetargetSec` (2.0s) at
  `ANIMAL.wanderSpeed` (1.2), clamped to the home biome (re-rolls heading on hitting the edge).
- **FLEE** — `dist ≤ effectiveDetectionRadius` → move directly away at `baseFleeSpeed`; hysteresis
  `ANIMAL.fleeReleaseBuffer` (1.5) stops threshold flicker; the frog's `fleesToWater` blends toward
  water.
- **APPROACH** — matching-diet bait within `BAIT.lureRadius` → move toward it (overrides flee).

**Where decision lives:** `src/game/` (pure), seeded `rng` passed in — deterministic. The species
TABLE (`constants.ts` `SPECIES`) drives it via data tags: `detectionRadius`, `baseFleeSpeed`, `bait`,
`gait`, `fleesToWater`, `biome`.

**The gait/CJ layer is RENDER** (`src/rendering/walkCycle.ts` + `EntityRenderer.ts`), and it's
**speed-driven**:
```ts
const speed = Math.hypot(a.x - a.prevX, a.y - a.prevY) / SIM_DT;
const profile = a.inWater ? GAIT_PROFILES.swim : GAIT_PROFILES[SPECIES[a.species].gait];
const t = stepGait(g, speed, profile, dt, frozen, a.aiState === 'flee', this.walkOut);
```
`stepGait` is pure math; idle when `speed≈0`, the walk/hop/bird/swim curve when moving; `frozen →
neutral`. A per-animal `WalkState` pool holds the accumulators. **The renderer reads** position,
derived speed, the gait tag, `aiState === 'flee'`, and `frozen` — nothing else.

**Takeaway:** the behavior layer sits on a clean, pure, seeded SM, with a speed-driven render gait
that already responds to whatever speed the sim produces. The ethogram is an *extension*, not a
rewrite.

---

## 2. The ethogram state machine — does it fit? **CAUSE (fits) + HYPOTHESIS (feel tuning)**

**CAUSE — it fits the exact existing pattern.** A pure behavior SM = states + per-species DATA
weights + seeded RNG at the boundary is *precisely* what `updateAnimal` already is. No new
infrastructure.

**The contained integration — a NEW `behavior` field ORTHOGONAL to `aiState`:**
- `aiState` (`wander | flee | approach`) stays the **catch/flee/bait spine — flee + approach
  byte-unchanged**.
- `behavior` (the ethogram: `rest | forage | vigilance | preen | locomote | [vocalize]`) runs **only
  while calm** (`aiState === 'wander'`). It subdivides the wander time into ethogram states, choosing:
  - the **speed** for the step (rest/vigilance/preen → ~0 → the existing idle gait; forage → a slow
    amble; locomote → the existing wander move),
  - the **dwell** (how long in each state, drawn from the per-species time-budget weights with the
    seeded rng — the same shape as `wanderRetargetSec`),
  - the **signature** beat (see §5).
- **flee/approach OVERRIDE behavior** (a fleeing animal isn't foraging) — when `aiState` leaves
  `wander`, the ethogram is suspended and resumes on return to calm.

**Why it composes cleanly (CAUSE):** the render gait is *speed-driven*, so rest/forage/locomote need
**no gait code** — they just produce different speeds and the existing `stepGait` responds (rest →
idle, forage → slow walk). The state machine *replaces the single fixed `wanderSpeed`/2s-heading*
with a richer, weighted dwell over the same movement primitives.

**HYPOTHESIS — the feel tuning.** The exact dwell durations, transition probabilities, and how
vigilance reads (see §4) want a playtest; the *architecture* is sound (CAUSE), the *numbers* are
HYPOTHESIS (Craig's device eye, like every feel slice).

---

## 3. The per-species data — additive & honest? **CAUSE (additive, species-level)**

**CAUSE — additive, the established data-slice pattern.** `SpeciesDef` already carries additive tags
(`gait`, `bait`, `detectionRadius`, `seasonTag`, `fleesToWater`). D2 adds two more in the same shape:
- a **time-budget weighting** over the ethogram states, e.g. `budget: { rest: 0.2, forage: 0.5,
  vigilance: 0.25, preen: 0.05 }` (normalized weights — the heron mostly stand-scan, the mouse
  dart-forage, the deer graze-with-vigilance),
- a **signature** tag, e.g. `signature: 'bob' | 'wag' | 'none'` (or a tiny list).

A **default** weighting + `'none'` signature lets the ~49 species roll out **incrementally** (untagged
species run the default budget). No per-species CODE — pure data in `constants.ts`, like `seasonTag`.

**Honest scope (CAUSE):** the data is **species-level** ("the heron ambush-forages", "the dipper
bobs") — shared by every individual of that species. **NOT** named-pet personalities; there is no
per-individual "this one is shy". (A small *seeded per-individual jitter* on the weights is a possible
later refinement — still data-driven distribution, not authored personalities — and is explicitly out
of scope for the core.)

---

## 4. The catch core — untouched? **CAUSE (byte-unchanged) + a flagged honest option**

**CAUSE — the catch reads only `aiState === 'flee'`.** `finalCatchChance` reads exactly one
state input, `ctx.fleeing`, and **every call site derives it identically**:
```ts
fleeing: animal.aiState === 'flee'   // Encounter.ts:75, GameState.ts:369, GameState.ts:461
```
`calmMultiplier(correctBait, fleeing)` → `fleeFactor = fleeing ? CATCH.fleePenalty : 1.0`.

**The contained path keeps it byte-unchanged.** Because `behavior` is **orthogonal** to `aiState` and
the calm sub-states never set `aiState='flee'`, `ctx.fleeing` stays `false` for a calm animal —
*exactly* as today's wander. So `finalCatchChance` is byte-unchanged **and its input value is
unchanged**. Only `flee` (untouched) reads as fleeing.

**⚠️ FLAG — the one honest place behavior *could* touch odds (HYPOTHESIS / Craig's call):** "a
vigilant animal is harder to approach" is real and already-modeled — but it must route through an
**existing input**, never a new formula term:
- **(a) honest, recommended-later:** a `vigilance` state transiently raises the **effective detection
  radius** (a scanning animal notices you sooner → transitions to `flee` sooner via the *existing*
  trigger). This changes the animal's STATE that the formula already reads — `finalCatchChance`
  untouched.
- **(b) slice-(i) default:** catch **fully byte-unchanged**; vigilance is purely visual (a head-up
  scan pose), no odds effect.

⚠️ **Do NOT** let `behavior` set `ctx.fleeing` directly or add a "behavior" multiplier — that would
change odds opaquely. Route any odds effect through (a) the detection radius only. **Recommendation:**
slice (i) ships (b) (catch byte-unchanged); (a) is a deliberate, separately-tunable later option.

---

## 5. The D3 bridge (the jizz seam) — **CAUSE (build it as a readable signal)**

**CAUSE.** D3 (identify-by-behavior) will read the animal's *current behavior* + the species
*signature*. D2 should expose `behavior` as a **readable field on the Animal struct** (exactly as the
renderer already reads `aiState` / `inWater`), plus the species `signature` data. The "jizz" = the
species' weighting + signature, surfaced as (1) the static data tag and (2) the live `behavior` state.

Build D2's behavior **as that readable signal now** — e.g. a tidy `currentSignature(animal)` /
`animal.behavior` read — forward-compatible with D3's observation, **without** building D3's
identify UI. Zero extra cost; it's the field D2 needs anyway, just kept clean and public.

---

## 6. Scope / freeze / slicing / ordering — **CAUSE**

**`src/game/` purity (CAUSE).** The behavior SM is PURE (seeded `rng`, data weights), L1-testable like
`updateAnimal`. The render reads `behavior` like it reads `gait`/`aiState`/`inWater` — no `three` in
`src/game/`.

**Freeze-determinism (CAUSE — the explicit L2 rule).** `?freeze=1 → l2Frozen` and the accumulator
**never advances** (`main.ts:369: if (!l2Frozen) accumulator += dt`) → `game.update` is never called →
the sim is **paused at the seeded INITIAL state**. Therefore:
- the behavior SM only RUNS in live play; the frozen capture shows the **seeded initial behavior** —
  so the initial behavior assigned at spawn must be **deterministic** (drawn from `game.rng` in
  `spawnAnimal`). It is, if assigned there.
- any D2 **signature render motion** (dipper bob, wagtail wag) MUST collapse to **neutral under
  `frozen`** (like `stepGait`'s `frozen → neutral`), so the frozen L2 capture is byte-stable.
- a just-spawned animal has `prevX === x` → derived speed 0 → the idle gait already, so under freeze
  the gait is neutral-ish; the only baseline shift is from a changed **at-rest pose** or a
  non-neutral signature.

**L2 baselines (CAUSE).** D2 is visible motion in **live play**; the *frozen* captures move only if
the at-rest/initial pose or a signature changes the initial frame. Either way, treat D2 as a **canvas
change → it folds into a reseed**.

**Ordering (CAUSE, per the brief).** D2 lands **after** the pending seasonal reseed closes — the gate
UP, fresh baselines in place — so D2's reseed captures behavior on the already-seamless world. Don't
interleave.

**Proposed slicing (a major arc → its own PRs, the established phased pattern):**
- **(i) the pure ethogram engine** — the `behavior` field + a small shared state set (start ~4:
  `rest / forage / vigilance / locomote`) + the seeded transitions/dwell + freeze-determinism + the
  speed→gait mapping. A **default** weighting for all species (the layer exists; behavior uniform
  until ii). **Catch byte-unchanged.** L1 tests (seeded determinism, freeze→neutral, flee/approach
  still override, catch inputs unchanged).
- **(ii) the per-species data + signatures** — the time-budget weights + signature tags across the
  ~49 species (the data slice) + the signature RENDER motions (bob/wag) with `frozen → neutral`. This
  is the visible "character" slice — **the baseline-shifting one (its reseed here)**.
- **(iii) the D3 seam** — formalize/expose the readable signature signal (`currentSignature`) for D3
  to consume; minimal, forward-compatible, no D3 UI.
- *(optional later: `vocalize` as an audio-seam state; per-individual seeded weight jitter; the
  vigilance→detection honest-odds option from §4a.)*

**Tests today:** unchanged (doc-only) — suite green.

---

## TL;DR

- **#1 (CAUSE):** animals already run a **pure seeded SM** (`updateAnimal`, states `wander/flee/
  approach`) in `src/game/`; the render gait is **speed-driven** (`stepGait`, profile by `gait` tag,
  `frozen→neutral`). The ethogram extends this, doesn't rewrite it.
- **#2 (CAUSE):** add a `behavior` field **orthogonal** to `aiState`. It runs **while calm**, sets the
  step's speed/dwell (rest/forage/vigilance/locomote) — the speed-driven gait responds for free;
  flee/approach override it. Fits cleanly; feel tuning is HYPOTHESIS.
- **#3 (CAUSE):** per-species **time-budget weights + a signature tag** — additive data (like
  `seasonTag`/`gait`), ~49 species taggable, default-friendly. Species-level character, **not**
  individual personalities.
- **#4 (CAUSE):** catch reads only `aiState === 'flee'` → keep `behavior` orthogonal and
  `finalCatchChance` is **byte-unchanged with unchanged inputs**. The one honest odds option
  (vigilance) routes through the **detection radius**, never the formula — flagged, deferred.
- **#5 (CAUSE):** expose `behavior` + the species `signature` as a **readable signal** now (the jizz)
  — the D3 identify-by-behavior seam, without building D3.
- **#6 (CAUSE):** pure + L1-testable; **freeze → neutral / seeded-initial** (the L2 rule); it's a
  canvas change → **reseed**; **lands AFTER the seasonal reseed** (gate up). Slice **i** engine →
  **ii** data+signatures → **iii** D3 seam.
