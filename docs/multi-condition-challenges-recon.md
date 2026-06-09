# challenges: recon — multi-condition non-forced challenges (compose species/phase/bait), the S4.2 unblock + richer research

A recon/design pass for **multi-condition** mastery challenges: composing the
EXISTING axes (species / phase / bait) into one challenge ("catch X at [phase] using
[bait]"). It adds **no new condition machinery** — it RECOMBINES existing axes, which
is *harder to auto-satisfy* (good for #48) and opens combinatorially more slots
(the exhausted free-phase vocabulary is the S4.2 blocker). **Design only — no code.**
The #48 non-forced property is load-bearing; cited to `file:line`. Tests **507 green**.

---

## #1 — The challenge system now (definition + eval + the #48 guard)

**A mastery challenge is a `MISSIONS` def whose `requirement.kind === 'research'`**
(`constants.ts:2277` region; the `research-*` defs at `:2159`+). The requirement
(`constants.ts` `MissionRequirement`) is already **2-condition**:

```ts
| { kind: 'research'; species: SpeciesId; phase: DayPhase; count: number }
```

**Eval** — `meets(req, ev)` (`Missions.ts:~`), an AND over a single catch:

```ts
case 'research':
  return ev.species === req.species && ev.phase === req.phase;   // BOTH dimensions
```

**The `CatchEvent` (`Missions.ts:37`)** carries `{ species, biome, phase }` — **no
bait field** (the gap multi-condition must fill, see #2). Progress lives in
`journal.missions[id] = { progress, completed }` (a count, kind-agnostic).

**The #48 NON-FORCED guard is a DESIGN PROPERTY pinned by a TEST inverse, not a
runtime check.** The property: the challenge targets an **`activityWindow: 'any'`**
species at a *specific* phase, so catching it at that phase is a **choice** (it's
catchable at all hours) — not the only option. The inverse test
(`coast.test.ts:113`, `research-challenge.test.ts:12`) simulates the **normal
set-completion catches** + the species caught at OTHER phases and asserts the
challenge is **NOT** completed; a separate test asserts it **completes on the
deliberate catch** (`research-challenge.test.ts:101` — "reliably completable: an
'any'-window species"). Both failure modes are already covered for the
phase-only case.

**Why the vocabulary is exhausted:** only **two** species are `any`-window —
**fieldmouse** (meadow, seeds) and **rabbit** (meadow, greens). Every other species
is phase-LOCKED (dawn/dusk/day/night). With only two any-window species × three free
phases (night/dawn/dusk), the phase-only challenge slots are spent
(`research-mouse-night/dusk`, `research-rabbit-night/dawn`).

---

## #2 — The multi-condition shape + the #48 generalization

**Shape — extend `research` with an OPTIONAL `bait` axis and make `phase`
optional** (at least one of phase/bait beyond species):

```ts
| { kind: 'research'; species: SpeciesId; phase?: DayPhase; bait?: BaitId; count: number }
```

**Eval — an AND that skips absent conditions** (so existing defs are byte-identical):

```ts
case 'research':
  return ev.species === req.species
    && (req.phase === undefined || ev.phase === req.phase)
    && (req.bait  === undefined || ev.bait  === req.bait);
```

- Existing `research-*` (phase set, bait undefined) → the bait clause is skipped →
  **behaviour unchanged** (backward compatible, no migration).
- New **species + bait** (phase undefined): "catch X using [bait]".
- New **species + phase + bait** (all set): "catch X at [phase] using [bait]".

**The one piece of new plumbing (NOT a catch-core change):** `meets` needs
`ev.bait`, so **`CatchEvent` gains `bait: BaitId | null`** (the bait that was the
ACTIVE lure at the catch, or null if bait-less). It's populated at the **boundary**:
a transient `game.lastCaughtBait` (mirroring `lastCaughtSpecies/Biome/Phase`, set in
`resolveOutcome` *before* `clearActiveBait`), read into the event at `main.ts:351`.
This enriches the event DATA only — **`Catch.ts` (odds / multi-shake resolution) is
untouched**; catch behaviour is identical.

**The #48 generalization (clean):** `meets` requires **ALL present** conditions, so a
catch missing any one (wrong/absent bait, wrong/absent phase) does **not** complete
the challenge. The non-forced property therefore holds *more* strongly: the bare
catch never satisfies a multi-condition challenge — you must **add the bait choice
(and/or the phase choice)**, i.e. apply the knowledge. The inverse test pattern
generalizes verbatim (simulate normal catches that lack the specific combo → assert
not-completed; one deliberate combo → completed).

**Why bait is the unlock (the key insight):** for a **phase-LOCKED** species,
"catch it at [its phase]" is *forced* (it only spawns then → auto-satisfied → fails
#48). The **bait axis is the only non-forced lever for those species** — you can
always catch bait-less (the anti-lockout valve), so requiring a *specific diet bait*
is a deliberate, knowledge-applying choice. So multi-condition doesn't just add
slots — it makes **the ~22 phase-locked species** eligible as challenge subjects for
the first time.

---

## #3 — The condition COUNT (non-forced vs legible balance)

**Lean: TWO conditions as the default; THREE reserved for a few rich/late gates.**

| Shape | Reads as | Non-forced via | Legibility |
|---|---|---|---|
| species + phase *(existing)* | "Catch the field mouse **at night**." | the phase (any-window species) | ✅ clear |
| **species + bait** *(new default)* | "Catch the hedgehog **using insect bait**." | the bait (catch is possible bait-less) | ✅ clear |
| species + phase + bait *(reserve)* | "Catch the field mouse **at night using seed bait**." | both | ⚠️ still readable, but the ceiling |

**Recommendation:** make **species + bait** the primary new vocabulary — it's a clean
2-condition read AND it's where the slot-expansion lives (every phase-locked species
× its diet). Keep **species + phase + bait** (3) as the *capability* for a small
number of maximally-non-forced late gates, used sparingly (three conditions risks an
obscure-checklist feel if overused). Text stays the natural-language template
**"Catch the {species} [at {phase}] [using {bait} bait]."** — the #37 legibility is a
fill-in-the-blanks sentence, never a checklist.

---

## #4 — 2–3 specific new challenges (real applied biology, #48 non-forced, completable)

All grounded in the actual species table (window + diet):

**1. `research-hedgehog-insects` — "Catch the hedgehog using insect bait." (meadow)**
   - Hedgehog: meadow, **dusk-locked**, diet **insects** (a dusk insectivore). 2-condition (species+bait).
   - **Applied biology:** insect bait teaches its insectivore diet — the flagship of the new
     capability (a phase-locked species made non-forced *via bait*).
   - **#48 inverse:** a hedgehog caught bait-less / with seeds or greens does NOT complete it;
     only insect bait active does.
   - **Completable:** meadow (reachable from start), insect bait shop-obtainable.

**2. `research-otter-fish` — "Catch the otter using fish bait." (riverbank)**
   - Otter: riverbank, **dusk-locked**, diet **fish** (a dusk piscivore). 2-condition.
   - **Applied biology:** fish bait teaches piscivory; uses the §4.1.5 research-gated **fish
     bait** — natural late-biome gate fuel.
   - **#48 inverse:** an otter caught without fish bait does NOT complete it.
   - **Completable — ⚠️ ordering constraint:** fish bait unlocks via `study-aquatic-life`, so
     this challenge must be sequenced **after** that unlock (else it's a de-facto wall). Flag
     for any gate that consumes it.

**3. `research-mouse-night-seeds` — "Catch the field mouse at night using seed bait." (meadow)**
   - Field mouse: meadow, **any-window**, diet **seeds** (the round-the-clock seed-eater).
     3-condition (species+phase+bait) — the maximally-non-forced exemplar.
   - **Applied biology:** the all-hours seed forager, fed seeds, *at night* — two applied facts.
   - **#48 inverse:** a mouse by day with seeds does NOT complete it (wrong phase); at night
     bait-less does NOT (no bait); only night + seeds does.
   - **Completable:** meadow + seeds (the starting bait).

*(Greens variant available if a third 2-condition is preferred over the 3-condition exemplar:
`research-roedeer-greens` — "Catch the roe deer using greens bait" — the dusk browser, woodland.)*

---

## #5 — The #48 guard generalized (both failure modes; catch core untouched)

Each new challenge gets the **two-sided** pin (the build-slice L1 guards):

- **Not auto-satisfiable** (the #48 inverse): simulate the relevant **set-completion +
  normal catches** (which don't carry the specific bait/phase combo) → assert
  `completed === false`. Because `meets` ANDs all present conditions, a normal catch
  lacking the bait/phase can't complete it. *(Stronger than phase-only: the bare catch
  never satisfies a bait challenge — you must deploy the diet bait = apply knowledge.)*
- **Not never-completable** (the anti-wall): assert the **deliberate combo completes**
  (`evaluateCatch` with the species + the bait [+ phase]). Confirms the combination is
  achievable (species spawns in a reachable biome at the required phase; the bait is
  obtainable — incl. the **otter/fish ordering** caveat).

**Catch core untouched:** challenges evaluate *on* a catch; `Catch.ts` (odds + the
multi-shake resolution) is not read or changed. The only catch-adjacent addition is the
transient `lastCaughtBait` → `CatchEvent.bait` plumbing (#2) — event data, not behaviour.

---

## #6 — Scope + L1/L2 + schema + the S4.2 unblock

- **Scope = mission/challenge-system (the eval + the defs) + the event-bait plumbing.**
  `src/game/` stays pure (no three/DOM). The new challenges are static `MISSIONS` defs in
  `constants.ts`.
- **Schema — NO bump, additive:** the requirement is a **static def** (constants), never
  persisted; `journal.missions[id]` stays `{ progress, completed }` regardless of the
  requirement's shape. `CatchEvent.bait` is **transient** (per-catch). Existing `research-*`
  defs are byte-identical (the bait clause is skipped). **No migration.**
- **L1 guards (new):** per challenge — the #48 inverse + the completability + the eval
  correctness (right species + right bait [+ phase] → complete; any one wrong → not). Plus a
  regression pin that the existing phase-only `research-*` are unchanged.
- **L2:** none — this is pure game logic (no render/overlay), so no visual baseline is touched.
- **⚠️ S4.2 UNBLOCK (confirmed):** a future biome's unlock gate (`requiredChallenges`,
  `escalating-gates.test.ts:136`) can now name a **fresh multi-condition challenge** instead of
  a spent free-phase one — the combinatorial space (≤24 species × {phase?} × {4 baits?}) is far
  larger than the exhausted two-any-window-species × three-phases. The slots problem is solved.

---

## Decisions needed before building

1. **Condition count** — confirm **species+bait (2) as the default**, with species+phase+bait (3)
   reserved/sparing (the recommendation), vs. an all-3 approach.
2. **The specific set** — confirm the 2–3 (hedgehog+insects, otter+fish, mouse+night+seeds), or
   swap the 3-condition exemplar for the roe-deer+greens 2-condition.
3. **The `lastCaughtBait` plumbing** — confirm OK to add the transient field +
   `CatchEvent.bait` (the one boundary change; `Catch.ts` untouched).
4. **Ordering** — confirm any future gate using `research-otter-fish` is sequenced **after** the
   fish-bait unlock (the anti-wall caveat).
