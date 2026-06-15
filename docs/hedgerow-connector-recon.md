# The Hedgerow — a connectivity mechanic (recon / design)

**Status:** RECON / DESIGN ONLY (no build). Investigate whether a CONNECTOR biome (a novel topology)
fits the world's actual structure, design the connectivity mechanic, scope honestly — then stop for the
architecture decision. ⚠️ A **structurally novel** arc (not a data-slice); the recon is load-bearing —
does the new pattern *fit or fight*. Labels: **CAUSE** (verified in code) vs **HYPOTHESIS** (proposed).

**Design intent:** the hedgerow teaches **habitat connectivity** (species move between patches; a
corridor lets the dormouse cross what it couldn't) — so a **linear ribbon linking two biomes**, edge
species drawn from its neighbours, and a load-bearing teaching beat (connectivity is *required*, not
decorative). The recon validates that intent against the code.

---

## 1. The world topology — does a CONNECTOR fit? **CAUSE + the verdict**

**Three layers, all verified in code:**

**(a) SPATIAL — a square grid of axis-aligned Rect cells.** A biome is a `bounds: Rect` (`BiomeDef`,
constants.ts:93). Every biome is an equal **40×40 cell** placed by `cell(cx, cy)` on a `PITCH = 40`
grid, **edge-adjacent with no gaps** (constants.ts:122-130). `currentBiome` returns the first cell a
point falls in; biomes don't overlap.

**(b) TRAVEL — a seamless clamp over the union of unlocked cells.** The player roams the *union* of
unlocked rects (`clampToUnlocked`, World.ts:315); a **full shared edge** between two unlocked cells is
marked an "open side" and **not inset**, so the player crosses it freely (`computeUnlockedRects`,
World.ts:94). **No portals — travel is just walking across a shared edge.** ⚠️ This function carries an
**explicit documented assumption** (World.ts:84-93):
> *"biome cells are axis-aligned and adjacency is FULL-EDGE (equal-size grid cells), so 'ranges
> overlap' === 'shares the whole side'. … If off-grid / partial-overlap biomes ever land, a partial
> shared edge would be wrongly marked fully open (**over-permit**) — revisit here."*

**(c) UNLOCK — a TREE, not a graph.** Each biome has **one** `prereq?: BiomeId` (constants.ts:110), and
`BIOME_SET_UNLOCK: Record<BiomeId, BiomeId[]>` maps a biome's mission-set to an array of successors —
**forks downward** (`woodland → [wetland, pineforest]`), every child appearing once. There are **no
cycles and no two-parent nodes.**

### Verdict — **a true two-existing-endpoint connector FIGHTS; a tree-node ribbon FITS-WITH-EXTENSION.**

A "bridge" between **two already-placed biomes** (a genuine second path) fights all three layers:
- **the unlock tree** — it needs a node with two prereqs / a cycle; `prereq` + `BIOME_SET_UNLOCK` can't
  express that (CAUSE);
- **the full grid** — adjacent cells already touch edge-to-edge with **no gap** to insert a ribbon, and
  any two cells you'd "bridge" are either already freely connected (share an edge) or diagonal (share
  only a corner, with other cells between) (CAUSE);
- **the full-edge clamp** — a *thin* ribbon spanning part of an edge is the exact "partial shared edge →
  over-permit" case the code warns about (CAUSE).

**The closest honest form (HYPOTHESIS, recommended): a LINEAR RIBBON as a normal TREE NODE.** A thin but
**full-width** Rect biome whose `prereq` is an existing frontier biome on one end, leading to a new
*pocket* biome (or being the corridor-place itself) on the other. Why it fits:
- **Rect bounds are general** — a thin rectangle (e.g. `[-20,20] × [20,28]`, full 40 wide × 8 deep) is
  pure data; no geometry-model change (CAUSE: `bounds` is any `Rect`).
- **Full-width keeps the clamp assumption intact** — it shares its *whole* min/max edge with the cell
  on each end, so "ranges overlap === whole side" still holds → **no `computeUnlockedRects` change**
  needed. (The ribbon is thin on the *travel* axis, full on the *shared* axis.)
- **It's a tree node** — `meadow → hedgerow → pocket` is a linear chain segment, no cycle. The "links
  two biomes" reads as *its prereq neighbour (one end) + its onward neighbour (the other end)*.
- The "linear connector" character comes from the **thin, traversed shape** + edge species + the
  dormouse beat (§2) — connectivity is taught by *traversal and a load-bearing species*, not by a graph
  cycle.

**The one real topology-code task (the novel part).** Placing the ribbon needs a non-`cell()` Rect (a
`ribbon()` helper or an explicit thin `Rect`) — trivial. The risk is *only* if a **visually narrower**
corridor is wanted (a hedge lining a path narrower than the cells it joins): that's a **partial-edge**
adjacency → the documented `computeUnlockedRects` "revisit" (mark only the overlapping sub-segment
open). **Recommendation:** ship the ribbon **full-width** in slice 1 (zero clamp change); treat
partial-width as a deliberate later extension to the clamp if the look demands it.

---

## 2. The connectivity mechanic — how playing teaches it **(options + recommendation)**

Three candidate teachers; the system supports them unevenly:

- **(a) species pool "drawn from neighbours"** — ⚠️ the spawn model is **strictly one-biome**:
  `eligibleSpecies(biome, phase)` filters `def.biome === biome` and `species.biome` is a single
  `BiomeId` (Species.ts:66, constants.ts:700), re-read by the journal grouping, `signatureSpecies`, the
  seasonal/behaviour data. **Literal** multi-biome spawning (a neighbour's species appearing in the
  hedgerow) **fights** that assumption (a model change, §4). The **honest, contained** form: the
  hedgerow gets its **own edge-specialist species** (`biome: 'hedgerow'`) that *exist because two
  habitats meet* — "drawn from neighbours" as **ecology/flavour**, not literal cross-biome spawning.
- **(b) the dormouse LOAD-BEARING beat (P1)** — a species present **only** because the corridor exists
  (the hazel dormouse can't cross open ground; it travels the hedge). The catch + research/mission
  system supports this **cleanly** (it's a species + a mission/research — the proven slice). This is the
  *honest* connectivity lesson: the mechanic **is** the lesson (a creature you can only find/help via
  the corridor), not a card that says "corridors matter."
- **(c) traversal** — you physically **walk the narrow ribbon** between its two ends. The clamp already
  supports continuous traversal across unlocked cells (CAUSE), so this is **free** — and it teaches
  connectivity *spatially* (the corridor is literally the route).

**Recommendation:** **(c) traversal + (b) the dormouse load-bearing beat** are the teachers; **(a) is
flavour** (hedgerow-tagged edge species). The lesson lands because you *traverse a thin corridor* to
reach a creature that *exists only because the corridor does* — P1-honest, no model change.

---

## 3. The edge species — honest & neighbour-drawn **(CAUSE on the one-biome question)**

Real hedgerow edge specialists, **distinct from every existing pool** (honest additions, not re-skins):
- **hazel dormouse** — the load-bearing corridor species (Priority Species, vulnerable; can't cross open
  ground). Diet: hazelnuts + berries → **`seeds`** or **`greens`** (existing diets — no new bait).
- **bank vole** (`seeds`/`greens`), **harvest mouse** (`seeds`), **yellowhammer** (`seeds`),
  **whitethroat** (`insects`). All map to the proven 5-diet discipline; none needs a new bait.

⚠️ **The one-biome question (CAUSE):** `species.biome` is a single id, and `eligibleSpecies` /
`isInsideBiome` / `speciesInBiome` / the journal all read it. So **don't** make a hedgerow species also
"belong to" the meadow/wood — give each a single `biome: 'hedgerow'`. `hedgehog` (already `meadow`) and
`pipistrelle` (already `cave`) are *tempting* hedgerow animals but reusing them would force the
multi-biome change — **avoid**; the new edge specialists above are honest and keep the one-biome model.
**If Craig wants literal neighbour-drawn (a species in two biomes), that is a separate, larger model
change** (one-biome → multi-biome, rippling through Spawn/Species/journal/behaviour) — recommended
**against** for honesty + containment.

---

## 4. The catch core + the slice pattern **(CAUSE — untouched; the novel part isolated)**

- **CAUSE — `finalCatchChance` is untouched.** A new biome is **data** (a `BiomeDef` + species defs) +
  **topology** (the ribbon Rect + the clamp). The formula reads `baseCatchRate` / `biome` / `tool` —
  all data; a new biome adds **no formula term**. (Same as every §4.2 biome before it.)
- **What's DATA vs NOVEL:** the species, diets, hiding spots, supply post, unlock gate, render props are
  the **proven data-slice** (one-biome species, the established patterns). The **only novel code** is
  the **ribbon topology** — a thin full-width Rect biome + (if narrow) the partial-edge clamp handling.
  Everything else is the slice that's shipped 10× already.
- **The multi-biome flag (§3):** the *only* place the connector could force a model change is "draw the
  pool from neighbours" literally. Keeping the hedgerow's species single-biome (`'hedgerow'`) keeps the
  whole thing additive. **Flagged, recommended single-biome.**

---

## 5. The research-gate + the teaching **(P8 / P2 — the proven gate + honest stakes)**

- **Unlock via the proven gate.** The hedgerow is a tree node: `prereq` = its near-end biome (e.g.
  `meadow` or `woodland`), unlocked by that biome's mission-set (`BIOME_SET_UNLOCK[prereq]` gains the
  hedgerow) — optionally a research-wrapped gate (the #92 multi-condition / #37 breadcrumb), exactly
  like the Highlands. No new unlock mechanism.
- **Teaching in the unlock (HYPOTHESIS).** The "Reach New Lands" breadcrumb + the unlock copy can carry
  the lesson: *"A hedge-line runs from the meadow into the wood — restore the corridor to open it."* The
  route itself is the teaching.
- **Honest conservation status (real stakes).** Hedgerows are a UK **Priority Habitat**, much of it in
  **poor / declining condition** (grubbed out for field enlargement); the dormouse is a **declining
  Priority Species**. This plugs straight into the existing **warmth/thriving grade** (§4.3): the
  hedgerow can read *degraded* and **thrive as you study/restore it** — the corridor-restoration beat is
  the through-line/census stake. No new mechanic; it reuses the warmth grade + the census framing.

---

## 6. Scope · render · L2 · slicing **(CAUSE + the legibility flag)**

- **`src/game/` purity (CAUSE):** the topology lives in `World` (pure) + the ribbon `Rect` (data). No
  `three` in `src/game/`.
- **⚠️ RENDER legibility (the Pine #109 lesson).** A hedge ribbon repeats the Pine risk: tall, dense
  shrub geometry could **hide the player/animals in a narrow corridor**. Pine solved it with
  **instanced, `depthTest:false` entities-on-top** (entities composite over props) + a kept-clear play
  centre. The hedgerow must do the same: **hedge the SIDES of the traversable ribbon** (a hedge *lining*
  the corridor, not filling it), instanced like the pines, with entities drawn over it — so a hedge can
  never hide a catch. Recon-first: this is the render design to validate before building.
- **⚠️ L2 / reseed.** A new biome → new deterministic scene(s) → **new canvas baselines** (a reseed
  after Craig's device approval — the known rhythm; the seam-fix/D2 cadence). The ribbon's thin shape +
  the hedge render are new captures.
- **Proposed slicing (the novel topology first/hardest):**
  - **Slice 1 — the ribbon TOPOLOGY:** a thin **full-width** Rect biome placed on the grid, prereq +
    unlock wired, **traversable** (the clamp already handles it full-width), rendered as a hedge-*lined*
    corridor (instanced, entities-on-top). **The structural risk lives here** — L1 tests pin the clamp
    over the ribbon (no over-permit, seamless traversal end-to-end).
  - **Slice 2 — the edge species DATA:** bank vole / harvest mouse / yellowhammer / whitethroat +
    the dormouse, honest single-biome diets (the proven slice).
  - **Slice 3 — the connectivity TEACHING beat:** the dormouse load-bearing mission/research + the
    unlock copy + the conservation/restore (warmth-grade) framing.

**Tests today:** unchanged (doc-only) — suite green.

---

## TL;DR

- **#1 (CAUSE + verdict):** the world is a **square grid** + a **full-edge seamless clamp** + a **tree
  unlock**. A true two-existing-endpoint connector **fights** all three (cycle / no gap / partial-edge
  over-permit). The **closest honest form** that **fits-with-extension**: a **linear ribbon as a tree
  node** — a thin **full-width** Rect, `prereq` on one end, a new pocket (or itself) on the other. The
  only novel code is the ribbon Rect (+ partial-edge clamp handling *only if* a narrower-than-cell look
  is wanted; ship full-width to avoid it).
- **#2:** teach connectivity by **traversal** (walk the corridor) + the **dormouse load-bearing beat** (a
  creature found only because the corridor exists — P1). "Drawn from neighbours" stays **flavour**.
- **#3:** new **single-biome** edge specialists (dormouse / bank vole / harvest mouse / yellowhammer /
  whitethroat), proven diets. Literal multi-biome spawning **fights** the one-biome model — avoid.
- **#4 (CAUSE):** `finalCatchChance` **untouched**; everything but the ribbon topology is the proven
  data-slice. The only model-change risk is multi-biome species — flagged, recommended single-biome.
- **#5:** unlock via the **proven gate** (a tree node + mission-set, optional research-wrap); the unlock
  copy + the **warmth/thriving grade** carry the honest hedgerow/dormouse conservation stakes.
- **#6:** ⚠️ render the hedge **lining** the corridor (Pine #109 entities-on-top legibility); new biome →
  **reseed** after device approval. Slice **1 topology → 2 species → 3 teaching**.
