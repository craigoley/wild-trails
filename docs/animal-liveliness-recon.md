# Character Juice CJ2: recon — animal liveliness (gait archetypes, reusing the CJ1 walk-cycle subsystem)

A recon/design pass for **CJ2**: extend the proven CJ1 walk-cycle subsystem to the
**animals** — but animals have **different gaits** (a rabbit hops, a hedgehog
scuttles, a kingfisher darts), there are **many** (N-perf), and they **already move**
(wander/flee). **Design only — no code.** Cosmetic-by-construction and freezable like
CJ1; the new work is the **gait archetypes**, the **N-animal** integration, and
layering the visual gait **on top of** the existing logical movement. Cited to
`file:line`. Tests **521 green**.

---

## #1 — The animal render + movement now (and the velocity it can derive)

**Render — `EntityRenderer.sync` animal loop (`EntityRenderer.ts:123-134`).** Per
active animal: claim a pooled `Group` (`buildAnimalModel`, `SPAWN.maxAnimals` per
species), position it at the interpolated logical pos (`lerp(prevX,x,alpha)`, **y=0**),
`faceTravel` (yaw), and — **only for the encounter target** — `applySquash` (the
existing catch-shake squash, `:155`); otherwise `scale.set(1,1,1)`.

**Movement — `Animal.ts` (PURE, no three).** A per-animal state machine, **position-
based** (`x/y` updated, `prevX/prevY` captured for interpolation). `aiState ∈
{wander, flee, approach}` (`Animal.ts:30`); plus `headingX/Y`, `retargetTimer`,
**`inWater`** (the #55 water flag). Movement logic is fully separate from the render.

**⚠️ Key difference from the player: animals have NO `vx/vy`.** So the render
**derives velocity** from the sim-step delta: `vx ≈ (x - prevX)/SIM_DT`,
`vy ≈ (y - prevY)/SIM_DT` → `speed` + direction. And it has rich **state context**
for free: `aiState` (idle-ish wander / fast flee / toward-bait approach) and
`inWater` (swim). So the render can pick the gait *and* its intensity from data it
already reads — no new game-state field.

---

## #2 — The gait archetypes (the core — real biology, a FEW not per-species)

**3 base archetypes + a SWIM state-modifier** — each a tuned profile reusing the
walkCycle bob/squash/lean, differing in the **bob curve** + magnitudes. The gait
*teaches* real locomotion (P2/P5).

| Archetype | Motion character | Bob curve |
|---|---|---|
| **WALK / SCUTTLE** (the CJ1 reuse) | low, quick, steady — ground mammals | `0.5(1-cos 2φ)` (CJ1) |
| **HOP** | a bigger **arc'd** bob with a **pause between hops**; **squash on landing, stretch at apex** | a skewed/clamped arc (flat-low between bounds) |
| **BIRD** (still-then-dart / peck) | mostly **still** with a small alert head/tail bob; quick **darts** on movement | a fast low bob + a movement-gated dart |
| **SWIM** *(modifier: `inWater`)* | smooth, low, **no vertical bob**, a gentle horizontal undulation | minimal vertical; no squash |

**Species → archetype** (from the real window/diet table):

- **HOP:** rabbit, mountainhare (hares bound), frog.
- **WALK:** fieldmouse, hedgehog, red squirrel, badger, roe deer, water vole, otter
  *(on land)*, grey seal *(land lumber)*.
- **BIRD:** quail, robin, mallard *(land waddle)*, ptarmigan, dotterel, reed bunting,
  grey wagtail *(the tail-wag!)*, dipper *(it bobs!)*, kingfisher *(still-then-dart)*,
  linnet, brent goose, turnstone, herring gull.
- **SWIM** overrides the land gait when **`inWater`**: otter, water vole, grey seal,
  mallard, frog, brent goose, herring gull.

**Why a state-modifier for SWIM (not a 4th species tag):** the same otter *walks* on
land and *swims* in water — `inWater` already tracks which, so SWIM is a runtime
override, not a per-species choice. Likewise **`aiState === 'flee'`** scales the gait
**up** (faster cadence, bigger bob) so a flee reads as *urgent* — one modifier,
applied across archetypes. So: a species tags **one** of {WALK, HOP, BIRD}
(`SPECIES[].gait`, a pure DATA tag), and the runtime modulates it by `inWater` / flee.

> Lean confirmed: **3 archetypes + 2 modifiers**, not 22 bespoke gaits. The grey
> squirrel "bounds" (could read HOP) and roe deer "bounds" — flagged as the two
> WALK↔HOP judgment calls for Craig.

---

## #3 — N-animal perf (no per-frame allocation)

- **Per-animal gait STATE** (`walkPhase`, `idleClock`, `lean`) is stored in a
  **fixed array `WalkState[]` of size `SPAWN.maxAnimals` (= 12)**, allocated **once**,
  **indexed by the animal's slot in `state.animals`** (its stable identity — not the
  pooled *model*, which can be re-claimed to a different animal on despawn and would
  pop the phase). Reset a slot's state when its animal (re)spawns (the active-edge).
- The render loop already iterates the ≤12 animals; CJ2 adds, per active animal: a
  velocity derive, a `stepGait` (a handful of `sin/cos`), and 3 transform writes —
  into **one reused `out` scratch** (no alloc). So the whole-screen cost is **≤12 ×
  (CJ1's trivial per-frame cost)** = still negligible on mobile (Three already
  recomputes each animal's matrix every frame).
- Bounded N (12), zero per-frame allocation → no rAF jank.

---

## #4 — Cosmetic + the flee/catch separation (pinned, extended from CJ1)

**The gait is a VISUAL transform on the pooled MODEL, layered on top of the logical
movement:**
- The model's **`position.y` = the bob** (vertical), while its **x/z = the lerped
  LOGICAL position** (the horizontal wander/flee). So the hop is *purely vertical* (+
  squash/lean) **on top of** the logical horizontal motion — they **compose, never
  entangle**. The animal's logical `x/y` (`state.animals[idx]`) is never touched.
- **Catch reads the LOGICAL position:** `nearestCatchable(animals, player.x, player.y,
  …)` + `dist = hypot(animal.x - player.x, …)` (`Encounter.ts`) use `animal.x/y` — the
  logical pos, **not** the bobbed model. **Flee-to-water** (`Animal.ts`, #55) reads
  `animal.x/y/inWater` — render-independent.
- **The structural guarantee (verified):** `src/game/` + `src/state/` import **no**
  renderer / `three` / `walkCycle` (grep-clean) — the game layer *cannot* read the
  hop. So the visual gait can't touch catch-range or flee. ⚠️ Pin: a catch attempt's
  in-range outcome is identical regardless of the (render-only) gait phase (trivially
  true — the sim never sees it; guard against a future "read the model" mistake).
- **Encounter priority:** when an animal **is the encounter target**, the existing
  catch-shake `applySquash` (`:155`) **takes priority** over the gait (the catch
  animation must read clearly); otherwise the gait applies. Pin the precedence.

---

## #5 — Freeze → neutral + L2 (baselines stay put)

- On **`frozen`**, every animal gait → **neutral pose** (no bob/squash/lean), exactly
  like CJ1 — the animal sits at its logical lerp, scale 1 → **identical to today's
  render**.
- **L2 stability:** the visual scenes are **`?seed=N` (the spawn RNG is seeded →
  deterministic animal positions) + `?freeze=1` (motion paused)**. CJ2 adds **no**
  motion to a frozen frame (neutral), so the animals render byte-identically →
  **the existing baselines do NOT change** (no regen, no flake on animal motion *or*
  spawn — spawn was already deterministic). Confirmed: same clean coexistence as
  CJ1/TL2.

---

## #6 — Scope + purity + the cosmetic guard

- **Reuse `walkCycle.ts`:** generalize `stepWalkCycle(state, speed, dt, frozen, out)`
  → `stepGait(state, speed, profile, dt, frozen, out)` where `profile: GaitProfile`
  carries the per-archetype params + a `kind` ('walk'|'hop'|'bird'|'swim') selecting
  the bob curve. **`CHARACTER_JUICE` becomes the PLAYER profile** (CJ1 unchanged in
  behaviour — it's just "the walk profile"); the animal archetypes are sibling
  profiles (`GAIT_PROFILES` in constants). All **pure, Node-testable** (no three/DOM).
- **`src/game/` + state stay pure** — the gait derives from the animal's derived
  velocity + `aiState`/`inWater` (read-only), entirely render-side. **No schema bump**
  (computed; the `gait` tag is static DATA on `SPECIES`, never persisted).
- **L1 cosmetic guard:** the pure gait math per archetype (hop arcs + landing squash;
  bird stillness; volume-preserving squash; flee/inWater modifiers; `freeze →
  neutral`; conservative bounds) **+** the structural guarantee (game imports no
  renderer; catch/flee read logical pos), with the existing animal/catch/L1 suites
  unchanged.
- **Tests:** 521 green (recon only).

---

## Decisions needed before building

1. **The archetype set** — confirm **3 base (WALK / HOP / BIRD) + 2 modifiers (SWIM on
   `inWater`, faster on flee)**, vs. more/fewer.
2. **The species mapping** — confirm the table; in particular the **WALK↔HOP** calls
   for **red squirrel** and **roe deer** (both "bound").
3. **Conservative magnitudes** — err subtle per archetype (HOP is the biggest motion
   = the rubbery-risk, like CJ1's squash); each a separate `GAIT_PROFILES` knob.
4. **walkCycle generalization** — OK to refactor `stepWalkCycle` → `stepGait(profile)`
   with `CHARACTER_JUICE` as the player profile (CJ1 behaviour byte-identical)?
