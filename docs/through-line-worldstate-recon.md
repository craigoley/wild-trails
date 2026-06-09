# Through-line: recon — the aggregate world-state (world flourishing), derived from per-biome thriving, surfaced quietly

A recon/design pass for the **world-state**: a single, quiet, qualitative sense that
the *whole world* moves toward flourishing as you study its biomes (Cozy Grove's
"returning colour" at the world level). **The low-risk FOUNDATION** of the
through-line — it derives a world value from the existing per-biome thriving and
surfaces it quietly. **Design only — no code.** The census reframe + the win
capstone are **later, tone-careful slices** (not here). Cited to `file:line`. Tests
green at **507**.

---

## #1 — The per-biome thriving now (the input — REUSE) + the accessed-only question

**Source: `Thriving.ts` (pure, display-only, NEVER imported by the sim).**

```ts
thrivingForBiome(journal, biome):
  speciesScore = caught-in-biome / species-in-biome           // the universal primary signal
  if biome has NO research projects → return speciesScore     // GUARD (e.g. woodland)
  researchScore = completed-projects-in-biome / projects-in-biome
  return 0.85·speciesScore + 0.15·researchScore               // THRIVING.speciesWeight/researchWeight
```

`thrivingByBiome(journal)` folds this over `BIOME_ORDER` (the **6** biomes: meadow,
woodland, wetland, highlands, riverbank, coast). All 6 contribute a species score;
woodland has no research (species-only via the guard). The world-state **aggregates
these existing values** — no recompute, no new state.

**⚠️ Accessed-only vs all biomes (the key call):**
- **All 6 biomes** (average over the whole graph): a fresh player (only meadow
  reached) is dragged to ~`meadow/6` — even a fully-studied meadow caps the world at
  ~0.17 ("quiet"). The world can *never* feel alive until you've **reached** all six
  lands. That **penalizes unreached frontiers** — wrong for "the world you've reached
  is flourishing."
- **Accessed-only** (average over `meadow + journal.unlockedBiomes`): the world-state
  reflects the **world you've reached and studied**. A nice **ebb-and-flow** falls out
  of it: reaching a NEW biome (thriving 0) gently *lowers* the average — "there's new
  country to come to know" — then climbs back as you study it. Reaching is rewarded
  (a new land to flourish), not punished.

**Recommend: accessed-only.** It matches the design ("not penalized for unreached
lands") and paces with **both** reaching and studying. (Reuse the existing
`isAreaAccessed(journal, biome)` already exported from `researchGroups.ts:27` =
`biome === 'meadow' || journal.unlockedBiomes.includes(biome)` — the single source
the journal + research panels already use.)

> Trade-off to accept: with accessed-only, a fresh player who fully studies the
> meadow reads "the world is flourishing" off one biome. That's arguably *right*
> (your small known world IS thriving) and self-corrects the moment you reach a new
> land. If that reads too cheap on playtest, a **breadth×depth** variant (below) tempers it.

---

## #2 — The world-state derivation (reuse `Thriving.ts`)

A pure display helper (in `game/Thriving.ts`, beside `thrivingForBiome` — Node-testable,
never imported by the sim), derived at display, **no persisted field**:

```ts
/** 0..1 — how thriving the REACHED world is (the average of accessed biomes' thriving). */
export function worldFlourishing(journal): number {
  const accessed = BIOME_ORDER.filter((b) => b === 'meadow' || journal.unlockedBiomes.includes(b));
  if (accessed.length === 0) return 0;                       // defensive; meadow is always in
  return accessed.reduce((s, b) => s + thrivingForBiome(journal, b), 0) / accessed.length;
}
```

Reuses `thrivingForBiome` verbatim (no second derivation). 0..1, monotonic in study,
re-reading existing journal state.

**Optional variant** (if "one biome = flourishing" reads cheap): **breadth × depth**
— `(accessed/total) · avg(accessed thriving)` — caps the world below 1 until you've
*reached* all six lands AND studied them. More "destination"-shaped, slightly less
generous early. I'd ship the simple **accessed-average** first and keep this in
reserve (it's a one-line swap, same surface).

---

## #3 — Where it surfaces (quietly — the BLEND discipline)

**The lightest surface, reusing the existing pattern:** a single qualitative line at
the **top of the Field Journal**, under the header. The journal ALREADY shows a soft
per-biome word (`JournalPanel.ts:114`, `thrivingWord` → "quiet/waking/alive/flourishing",
no number) — a world line ties them together as the witnessed, glance-not-grind read:

```
Field Journal — 7 of 23 found
The world is waking.                  ← new: one quiet line (.journal-world), no meter, no %
─────────────────────────────
Meadow — 5 of 5        flourishing
Wetland — 2 of 6       waking
…
```

- **A word, never a number/meter.** Optional + unpressured (it lives in the journal
  you *choose* to open), witnessed not grinded — "the world is better because I
  understood it."
- **The bands:** reuse `thrivingWord` (the same `THRIVING.bands`:
  quiet→waking→alive→flourishing) for **one vocabulary** — recommended (no new copy).
  *Or* a **parallel world band set** (e.g. "stirring / waking / thriving / flourishing")
  so "the world is alive" reads distinctly from "the meadow is alive" — a trivial swap;
  Craig's call on whether the world level wants its own words.
- Phrasing: `The world is {word}.` (calm, declarative). Sits as a `.journal-world`
  line directly under the header (its own quiet style: smaller, soft, italic — like
  `.journal-thriving`).

*(Alternatives considered: a line on the biome HUD title — but that's the gameplay
HUD, more "always-on/measured"; the journal is the quieter, opt-in home and already
owns the thriving vocabulary. Recommend the journal.)*

---

## #4 — Cosmetic + scope (the win arc UNTOUCHED this slice)

- **Changes NO game behavior.** `worldFlourishing` is a pure read in the display layer,
  consumed ONLY by `JournalPanel`. It is **not** imported by `GameState`/`Catch`/
  `Missions`/spawn (structurally cosmetic, exactly like `thrivingForBiome` today —
  `Thriving.ts` header: "NEVER imported by the sim"). Catch/spawn/movement/progression
  byte-identical.
- **The win condition is untouched.** `shouldCelebrateWin = !won && isGameComplete`
  (`Missions.ts`) is **not** read or modified — this slice is a readout, NOT the
  capstone. No schema bump (derived from existing thriving; no new persisted field).
- **L1 guard:** a pure unit test on `worldFlourishing` (monotonic; accessed-only;
  `0 → quiet`; all-studied-accessed `→ flourishing`) + the structural guarantee (no
  `src/game/` sim import, no state field) keeps the L1 suite green.

---

## #5 — Forward-compatible with the later slices (note, don't build)

This foundation is deliberately the **value the later slices read**:
- **The census reframe** (the journal as "a record that matters") surfaces the
  per-biome + world thriving as the record's through-line — it consumes
  `worldFlourishing` / `thrivingForBiome`, no new derivation.
- **The capstone** (the win reframed as "the world flourishes") would later relate the
  win to **this same `worldFlourishing` value** — e.g. the win screen reads/echoes it,
  or the completion is framed as the world reaching "flourishing". Crucially, the
  capstone *reframes* `shouldCelebrateWin`'s presentation; it doesn't need a *different*
  world value — it reads the one this slice derives.

So: **derive the world value here, surface it quietly; the tone-heavy meaning copy
(census, capstone) builds ON this value later** (each playtest-gated hard). Nothing
here pre-commits that tone — it's just the clean derived state + a quiet word.

---

## #6 — L1/L2 + purity

- **`src/game/` purity:** `worldFlourishing` lives in `game/Thriving.ts`, pure +
  Node-testable, no `three`/DOM. **No schema bump** (derived). The accessed predicate
  is inlined to match `researchGroups.isAreaAccessed` / `journalGroups` (a trivial
  1-liner; if we'd rather not duplicate across the game/render layers, extract a shared
  pure `isBiomeAccessed` — minor, optional).
- **L2 (no baseline diff expected):** the surface is a **Field Journal line — an HTML
  overlay**. The L2 visual gate screenshots **`#app canvas` (the world)** only
  (`e2e/visual.spec.ts:37`), not overlays → **no baseline changes** (the journal isn't
  in the capture, and nothing about the *world render* changes this slice). Confirmed:
  zero L2 regeneration.
- **Tests:** 507 green (recon only). The build slice adds the pure `worldFlourishing`
  tests + a jsdom assertion that the journal renders the world line.

---

## Decisions needed before building

1. **Aggregate** — **accessed-only average** (recommended) vs. all-6-biomes (penalizes
   unreached) vs. the breadth×depth variant (tempers "one biome = flourishing")?
2. **Surface words** — **reuse `thrivingWord`** (one vocabulary, recommended) vs. a
   parallel world band set ("stirring/waking/thriving/flourishing") so the world level
   reads distinctly from a biome?
3. **Placement** — the quiet `.journal-world` line under the Field Journal header
   (recommended) — confirm that's the right quiet home (vs. anywhere else).
