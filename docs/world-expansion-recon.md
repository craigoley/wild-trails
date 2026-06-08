# World Expansion — recon + slice plan (the tier/ring world-model refactor)

More biomes (PLAN.md §4.2). The cardinal discipline: the FIRST slice is **behavior-neutral**
(re-express the current 4 biomes in the new model with ZERO behavior change — like B0 was for
reach), proven against L1/L2, before anything new is added. Unlocks route through the **research
spine** (§4.1.4) — a new biome is *researched* into access (R2's Highlands pattern), not just
gated.

**This doc is design only — no code.** Findings cite `file:line` against current main (#65).

> ## ⚠️ The headline finding (changes the shape of the arc)
> The brief frames this as **grid → tier/ring**, implying a radial-clamp refactor. But the recon
> shows the grid does **not** force spatial-adjacency unlocks today: **`adjacent` is render-only**
> (which locked biomes to draw + the walls), and **`BIOME_SET_UNLOCK` is already a linear
> difficulty chain** (meadow→woodland→wetland→highlands), now research-wrapped at the last gate
> (R2). Geometry and unlock-logic are **already decoupled.** So the refactor we actually need is a
> **MODEL/metadata** change (tier + research-gate per biome), **not** a geometry/clamp change.
> **I recommend keeping the rectangular per-rect clamp** — it already extends to N tiled cells
> (it's O(N) over `unlockedRects`, the seam-stitching works for equal edge-adjacent cells), and a
> radial clamp would needlessly complicate the #55 water-slide (axis-separated, rectangular-
> assuming). This **drops the brief's WE1 (radial clamp)** and de-risks the arc substantially.

---

## #1 — The world model now

`BIOMES` (`constants.ts:125`) is a **2×2 grid of equal square cells** (`WORLD.halfSize = 20`,
so `PITCH = 40`): `cell(cx, cy)` returns a `Rect` half-size 20 at a centre. Meadow `cell(0,0)`
(origin, unlocked), Woodland `cell(0,40)`, Wetland `cell(40,0)`, Highlands `cell(40,40)` (locked).
Each `BiomeDef` = `{ id, displayName, bounds: Rect, unlocked, adjacent: BiomeId[], color }`.
`BIOME_ORDER` is the deterministic iteration order; `BiomeId` is a 4-member union.
`currentBiome(world, x, y)` (`World.ts`) = the first biome whose `bounds` `rectContains` the
point. **`adjacent` drives RENDERING only** (the locked-but-visible dim/fog/wall, `BIOME_RENDER`).
**Unlocks** are the separate linear `BIOME_SET_UNLOCK` chain (`constants.ts:1687`), fired by
`evaluateCatch` + (the last gate) the R2 research reconcile.

## #2 — The movement clamp now (+ composition order)

`clampToUnlocked(world, x, y, margin, out)` (`World.ts`) confines a point to the **union of the
unlocked rects** (`world.unlockedRects`): per rect it computes the in-margin box (open SEAMS —
sides shared with another unlocked rect — are NOT inset, so adjacent cells meet seamlessly), and
returns the point if inside any, else the nearest clamped point across all rects. The rect list
+ its open-side flags are cached by `computeUnlockedRects`/`recomputeUnlockedBounds` (rebuilt on
unlock only). **Composition (`Player.ts:115-119`), order is load-bearing:**
```
desired (nx,ny) -> clampToUnlocked(..., PLAYER.radius)  -> resolveWaterSlide(from, clamped, radius)
```
i.e. **clamp to bounds FIRST, then the #55 water barrier** (axis-separated slide off the pond).
Roam-drag (the input intent) and supply-freeze (movement frozen while the shop is open) sit
*above* this in `updatePlayer`. **The per-rect clamp + the water-slide both assume rectangular,
equal, edge-adjacent cells** — keeping that assumption is what lets the model extend cheaply.

## #3 — The tier/ring model (re-expresses the 4 unchanged, extends to N)

**Geometry stays rectangular cells** (so the clamp + water-slide are untouched). The "tier/ring"
is the *unlock organization*, expressed as metadata + an outward-tiled layout:

```ts
interface BiomeDef {
  id; displayName; bounds: Rect; unlocked; color;     // unchanged
  tier: number;                 // 0 = hub (Meadow); 1, 2, … = difficulty rings outward
  prereq?: BiomeId;             // the biome whose unlock precedes this (the chain, explicit)
  // `adjacent` stays render-only (the dim/fog/wall) — derivable from the cell layout.
}
```
- **The current 4 map directly:** Meadow tier 0 (hub, origin cell); Woodland tier 1
  (`prereq: meadow`); Wetland tier 2 (`prereq: woodland`); Highlands tier 3
  (`prereq: wetland`, research-gated). Their **`bounds` are byte-identical** to today
  (`cell(0,0)/(0,40)/(40,0)/(40,40)`) — WE0 is behavior-neutral.
- **Layout for N:** a new tier's biome is a **new equal cell tiled edge-adjacent** to an unlocked
  cell (so the per-rect clamp connects it into the walkable polyomino). "Ring" = a tier's cells
  placed around the unlocked region's perimeter; it's a per-biome **data** decision (`cell(cx,cy)`
  at a free edge), not a geometry primitive. The clamp/seam-stitching handle it unchanged as long
  as cells stay **equal-size + full-edge-adjacent** (the existing assumption).

So: **tier + prereq metadata + research-gated unlocks + outward-tiled equal cells** — rectangular
throughout, no radial clamp.

## #4 — ⚠️ The slice plan (each slice shippable; the current 4 provably unchanged)

| Slice | What | Behavior change? | Proven by |
|---|---|---|---|
| **WE0** | The model refactor: add `tier` + `prereq` to `BiomeDef`; re-express the current 4 (existing bounds + tiers); make `adjacent`/unlocks read from the new metadata producing IDENTICAL behavior. **No new biome, no geometry/clamp change.** | **NONE** (like B0) | L1/L2 + a NEW **current-4-bounds/clamp-unchanged** guard |
| ~~WE1 (radial clamp)~~ | **DROPPED** — the rectangular per-rect clamp already extends to N cells; radial would complicate the water-slide for no gain (see headline). | — | — |
| **WE-each** (WE1, WE2, …) | **One new biome per slice:** a new tiled equal cell (new `bounds`) + its species set + its **research project** (biome-access, the R2 pattern) + its `tier`/`prereq` + the `BIOME_SET_UNLOCK`/`BIOME_GATE_CHALLENGES` entry. Research-gated; the spine absorbs the unlock; the #37 block extends automatically. | Additive only (a new region; the existing 4 untouched) | L1 progression-to-win extended through the new biome; the catch-balance band on the new roster |

**Ordering WE0 → WE-each.** WE0 is the cardinal behavior-neutral first slice (the whole point —
prove the 4 are identical in the new model before adding anything). Then each biome is its own
additive, research-gated content slice. **WE0 and the dropped WE1 do not split further** — WE0 is
metadata-only (small); there is no separate clamp slice.

## #5 — Research-gating a new biome (R2 generalizes cleanly)

R2's machinery is already generic — confirmed it extends to arbitrary biomes:
- `reconcileResearchUnlocks` (`Missions.ts`) iterates `RESEARCH_ORDER` for **any** `biome-access`
  project that's complete + `isUnlockGateMet` + not-yet-unlocked → unlocks it. No per-biome code.
- A new biome adds **data only:** a `BIOME_SET_UNLOCK` source→target entry, a
  `BIOME_GATE_CHALLENGES` entry (its mastery challenge, by play), and a research project with
  `reward: { kind: 'biome-access', biome }` + `knowledgeRequirement` (the challenge). The
  **double-enforced knowledge-by-play** (the project's `knowledgeRequirement` + the dispatch's
  `isUnlockGateMet` re-check) carries over per biome.
- The **#37 legibility** (`unlockLines` → `requiredResearch`/`requiredChallenges`) already iterates
  the gate data generically — a new biome's "Reach new lands" line + research step appear for free.

→ Each new biome's access is a research project exactly like the Highlands. No new gating code.

## #6 — Persistence + L1/L2

**No schema bump (rides v7).** Unlocked state is `journal.unlockedBiomes: string[]` (holds
arbitrary biome ids already) + the research state is `journal.research` (keyed by project id,
generic). New biomes add ids to these — no shape change. `BiomeId` widening is a **compile-time**
type change (the union grows), not a persisted-schema change; `sanitizeUnlocked` already drops
unknown ids (forward/back compatible). `src/game/` + state stay pure (the model is data + pure
helpers; no three/DOM).

**Guards.** Existing L1: progression-to-win (Guard 3 — the full unlock chain → win),
catch-balance band (Guard 2), determinism/movement (the harness + `per-rect-clamp.test`). L2: the
deterministic scenes (`?unlock=all`, the locked-region visuals). **NEW guard for WE0** (the
cardinal one): **the current 4 biomes' `bounds` are byte-identical + the clamp behaves identically
through the refactor** — a pinned table of the 4 rects + a clamp regression over the current world
(several points: inside, at a seam, outside each face) asserting the new model produces the same
clamp result as today. This is the behavior-neutral proof, mirroring B0's "starter reach
unchanged" pin. Per new biome (WE-each): extend the progression-to-win guard through it +
balance-band its roster. **442 green** on this branch.

---

## Decisions needed before building WE0

1. **The clamp stays rectangular** (drop the radial WE1) — confirm? (My strong recommendation:
   the grid/unlocks are already decoupled; rectangular extends to N; radial risks the water-slide.)
2. **`tier` + `prereq` on `BiomeDef`** as the model (tier 0..N, prereq = the chain made explicit;
   `adjacent` stays render-only) — confirm the shape?
3. **WE0 is metadata-only + behavior-neutral** (no geometry change), gated by the new
   current-4-unchanged guard — confirm the cardinal first slice?
4. **New biomes are equal cells tiled edge-adjacent outward**, each a research-gated content slice
   (R2 pattern) — confirm the per-biome slicing? (And: roughly how many new biomes does §4.2
   target — for the tier ladder's shape?)
