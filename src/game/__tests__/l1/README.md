# L1 — headless deterministic simulation guards

**L1 is the high-value validation layer** (PLAN.md §4.0). It seeds the RNG, feeds a
scripted input, steps the *real* sim headlessly (no browser), and asserts on game
**STATE** — so **LOGIC + BALANCE outcomes are verified automatically** and manual
playtesting shrinks to **FEEL only**.

It's enabled by the pure/seeded architecture: `createGameState(seed)` + `update(game,
intent, dt)` already drive the whole sim without the renderer, and all randomness flows
through a seedable `createRng(seed)` (never `Math.random`).

## What's here

- **`harness.ts`** — a thin, **pure** driver. Adds no game behavior:
  - `runFrames(seed, script, frames)` → runs `frames` fixed-timestep `update()` steps
    with the scripted intent each frame; same seed + script → identical state.
  - `applyCatch(journal, event)` — mirrors main's catch boundary (`recordCatch` +
    `evaluateCatch`) so missions / unlocks / the win can be driven from catch events.
  - `complete{Meadow,Woodland,Wetland}Set` / `completeNightForagerGate` /
    `catchRemainingSpecies` — scenario helpers (the catch events for each milestone).
- **`l1-guards.test.ts`** — the starter guard set:
  1. **Auto-satisfaction regression** (Craig pinned): normal catch-set progression must
     NOT auto-complete the night-forager research challenges (the #46 bug, now permanent).
  2. **Catch-balance band**: 2000 seeded bait-less attempts on an easy species sit in the
     anti-lockout valve band (~0.5–0.9) — the valve the gear arc must not break.
  3. **Progression-to-win**: the full gated chain unlocks each biome in order and the win
     fires — incl. BOTH Highlands gate orderings (#49 order-independence).
  4. **Catch-core invariant**: the starter net is the neutral 1.0 multiplier + reach 2.6
     (a gear slice that accidentally shifts the curve FAILS here).

## Adding a scenario

1. Add the catch events / input script as a helper in `harness.ts` (keep it pure — no
   `three`, no DOM).
2. Add a `describe`/`it` in a `*.test.ts` here that drives it and asserts on state.
3. **Determinism is mandatory**: fixed seeds; compare floats with tolerances (never
   exact `===`). A flaky test masks real failures — don't ship one.

## Scope

L1 guards **LOGIC + BALANCE**. **FEEL** (does it play well, is the layout right, does it
feel fair on a real device) stays **Craig's playtest** — L1 doesn't replace it. L2
(rendering/contract) and L3 (end-to-end) are later PRs.
