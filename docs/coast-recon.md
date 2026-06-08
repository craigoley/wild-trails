# World Expansion — Coast recon (the 2nd new biome — water-dominant, fish-diet synergy)

The 2nd new biome (PLAN.md §4.2, after Riverbank #69 + the fish diet #71) — proving the
data-slice pattern **repeats**. Coast is water-DOMINANT (the sea), pairs with the **fish diet**
(more fish-eaters), and is a dramatic distinct PLACE. A **data slice**: a new tiled cell + species
+ a research project, reusing the #55 water, the rectangular clamp, R2's gating, the 4 diets. NO
new catch mechanic / diet / time mechanic (the **tide idea is a future enhancement** — #5).
Cards written **soul-aware** = HONEST conservation status (real biology), not soul-layer work.

**This doc is design only — no code.** Findings cite `file:line` against current main (#78).

> ## ⚠️ #1 — The large edge-sea reuses #55 verbatim — IF placed on the OUTER world edge
> Riverbank's river is 3 overlapping `WaterDef` discs (radius 6) as an interior band. The SEA is
> the same mechanic, **scaled up**: more / bigger discs covering ~half a cell. `resolveWaterSlide`
> (axis-separated: full move → X-only → Y-only → stay) bars the player from every disc and slides
> them along the shore — **identical to the pond/river, just more discs** (O(discs) per move,
> cheap). The dip-net reaches across it (the fish-eaters fled to the sea). **No new water shape or
> mechanic.**
>
> ⚠️ **The one real composition constraint:** a big water region must NOT cover a **shared seam**
> (a cell edge the player walks through to a neighbour), or it walls off the connection. Fix:
> **put the sea on the cell's OUTER edge (the world boundary)** — which is *also* thematically
> right (the coast IS the edge of the land). The LAND edge (the beach) holds the seam to the
> prereq biome. So the sea barrier composes with the clamp cleanly, unchanged.

---

## #1 (detail) — The water + clamp, quoted

`WATER: WaterDef[]` (`constants.ts`), each `{ biome, x, y, radius }` — a disc; `isInWater` /
`nearestWater` / `resolveWaterSlide` / `fleesToWater` / the dip-net gate-reach all read these.
`clampToUnlocked` (`World.ts`) confines the player to the **union of unlocked cell rects**; the
water slide runs AFTER (`Player.ts`: `clamp → resolveWaterSlide`). → **Coast's sea = a row of ~4
overlapping discs (radius ~9) along the cell's OUTER edge**, covering the seaward half; the player
roams the beach half (barred from the sea by the slide, confined to the cell by the clamp). The
discs sit well clear of the inward seam (the beach connects to the prereq biome). Reuses both
verbatim.

## #2 — ⚠️ The Coast species (honest diets + HONEST conservation status; the fish synergy)

5 species across the EXISTING 4 diets, real teaching biology + **honest** status — a high tier
(harder), with a catchable easiest (the valve). ⚠️ **Honest-diet discipline:** I dropped the
oystercatcher — it eats **shellfish** (cockles/mussels), which the 4 diets don't honestly cover
(a fudge onto "insects" would be false biology). The waders kept (turnstone/ringed plover) eat
**marine worms + sandhoppers + small inverts** — which map honestly to the "insects" (invertebrate)
diet the badger/robin/dipper already use.

| Species | Diet | Active | Water | Difficulty | Teaches + ⚠️ HONEST status |
|---|---|---|---|---|---|
| **Linnet** | seeds | day | shore scrub/dunes | **easiest** (the valve) | A small finch of coastal scrub, eating seeds. ⚠️ **Red-listed, declining** — lost seeding plants on farmland and coast (honest: say it). |
| **Brent Goose** | greens | day | grazes the shore | medium | A small dark goose that winters here, grazing eelgrass and saltmarsh. Recovering where its eelgrass beds are protected (amber). |
| **Turnstone** | insects | day | works the tideline | medium | Turns over seaweed and stones for sandhoppers and small invertebrates — the busy tideline scavenger. A winter visitor, doing okay. |
| **Herring Gull** | **fish** | day | by the sea | medium | ⚠️ **Surprisingly RED-listed, in decline** — the bold "town gull" masks a real fall in our seabird colonies (the honest, soul-aware card: abundant-seeming ≠ safe). Fish + scavenge; flees by flight. |
| **Grey Seal** | **fish** | day | ⚠️ **in the sea** (`fleesToWater`) | **hardest** (the apex, ~0.12) | ⚠️ A **conservation SUCCESS** — Britain protects ~40% of the world's grey seals, back from the brink. Hauls out on rocks, slips into the sea when alarmed (the dip-net's apex; the third+ water-diver). |

Diet coverage: seeds (linnet), greens (brent goose), insects (turnstone), **fish (gull + seal —
the fish-diet synergy)**. Honest status spans the real spectrum: **declining** (linnet, gull),
**recovering/success** (seal, goose), **stable** (turnstone) — so the soul layer later clicks into
real content. ⚠️ **Anti-lockout:** the linnet (calm seed-eater) is catchable **bait-less** with the
starter (the valve); the gull + seal are catchable **bait-less** too (fish bait eases, never gates
— the #71 bound). `SpeciesDef` + `SPECIES_INFO` cards + `SPECIES_MODEL` (bird builds; the seal on
the mammal build, large). Base rates tuned hard (seal ~0.12, the new apex), validated by the band guard.

**Bonus synergy (note):** if Coast ships **2 cover spots** (≤ `OPEN_BIOME_COVER_MAX`), it's an
**open** biome → the **throwing-net** (open-ground reach) applies on the open beach, AND the sea
makes the **dip-net** matter — **Coast is where BOTH biome nets shine.**

## #3 — The tiled cell (the rectangular clamp, unchanged)

Per #66, the per-rect clamp extends to N equal edge-adjacent cells. **Coast = `cell(40, 120)`**
([20,60]×[100,140]) — **north of Riverbank** (`cell(40,80)`), sharing the y=100 edge. Geography
reads: highlands → riverbank (the river descends) → **coast (the river meets the sea)**. The **sea
on the north (outer) edge**, the beach connecting south to Riverbank. The clamp +
`computeUnlockedRects` + the slide are byte-unchanged (a new equal cell, equal-size + edge-adjacent
— the existing assumption holds). Render: a sand/shingle ground tint + the large sea (#55 discs) +
marram-grass cover (reuse the grass cluster) + a supply post on the beach.

## #4 — ⚠️ The research gate (R2 generalized, data only)

**Coast = tier 5, prereq `riverbank`** (the new terminal). R2's pattern, by DATA only:
- **`BIOME_SET_UNLOCK`** += `riverbank: 'coast'`.
- **`BIOME_GATE_CHALLENGES`** += `riverbank: ['research-mouse-dusk']` — a **NON-FORCED mastery
  challenge, by PLAY**: catch a **fieldmouse at DUSK**. The fieldmouse is any-window, so requiring
  dusk is a deliberate field-craft CHOICE; normal progression never forces a dusk fieldmouse (the
  #48 inverse). Doable in the always-open meadow with the starter (anti-wall). ⚠️ **Constraint
  noted:** non-forced challenges need an *any-window* species at a non-default phase — only the
  **fieldmouse + rabbit** qualify, and night/dawn are taken (mouse-night, rabbit-night, rabbit-dawn),
  so dusk is the remaining slot. (A future mission-system enhancement — bait/tool-based challenges
  — would open more non-forced variety; logged, not built.)
- A **cost-0 biome-access project** `unlock-the-coast`: `reward: { kind:'biome-access', biome:
  'coast' }`, `knowledgeRequirement: 'research-mouse-dusk'`, `activity: catch-in-riverbank ×4`,
  **`cost: 0`** (Coast's species are win-required → zero wall risk, like Riverbank).
- `reconcileResearchUnlocks` / `isUnlockGateMet` / the #37 legibility + the new progress bar (#78)
  all generalize for free. Knowledge-by-play **double-enforced**. WE0's `tier`/`prereq` stays
  descriptive; `BIOME_SET_UNLOCK` is the runtime.

## #5 — ⚠️ The TIDE idea (logged for later — NOT this slice)

Tide is the natural future enhancement to Coast — a **2nd cyclic axis** (low/high tide changing
which species appear + the water extent: low tide exposes mudflat for more waders, high tide is
all sea). Like the fish diet was to Riverbank, it's a **MECHANIC change, not a data slice**: a
*second independent cycle* (the game tracks one — `timeSec → dayPhase`), tide-gated spawns, and a
**dynamic water region** (the sea extent changing) — all touching the sim. The time system has
conceptual room (a parallel cycle), but the dynamic water + tide-phase spawning are real sim work.
**Logged for a later arc; build Coast on the existing day/night only.**

## #6 — Anti-lockout + win-path + persistence + L1/L2

**Anti-lockout (pin):** the linnet (easiest) is catchable bait-less with the starter; the gull +
seal (fish-eaters) catchable bait-less (fish bait not required). **Win-path:** Coast's 5 species
are win-required (`isGameComplete` needs all of `SPECIES_ORDER`) → the gate is cost-0 + completable
→ the L1 progression-to-win **extends through Coast** (unlock + catch all 5 → the win still fires).
**Persistence:** `BiomeId`/`SpeciesId` widen at **compile time**; unlock rides `unlockedBiomes` +
`journal.research` (v7 — **no bump**); spawn/journal/L2 iterate generically. `src/game/` + state
pure. **New L1 guards:** Coast unlocks via its gate **by play** (the knowledge-by-play guard); the
easiest species catchable bait-less; progression-to-win includes Coast. **L2:** a new `coast`
deterministic scene (`?unlock=all` opens it) for the sea render baseline. **474 green** on this branch.

---

## Decisions needed before building

1. **The water** — the sea = scaled-up #55 discs on the cell's **outer (north) edge**, reused
   verbatim; the slide composes (the seam stays clear) — confirm?
2. **The species** — linnet (seeds, valve) / brent goose (greens) / turnstone (insects) / herring
   gull (fish) / grey seal (fish, apex, `fleesToWater`), with **honest** diets (oystercatcher
   dropped — shellfish doesn't map) + **honest** conservation status (red-listed linnet/gull,
   recovering seal/goose) — confirm the set + the honest framing?
3. **The cell** — `cell(40,120)`, north of Riverbank (the river meets the sea), the sea on the
   outer edge — confirm the position?
4. **The gate** — tier 5 / prereq riverbank; `BIOME_SET_UNLOCK` += riverbank→coast + the non-forced
   `research-mouse-dusk` (the constrained-but-#48-safe choice) + a cost-0 project — confirm?
5. **Tide** — logged as a future mechanic arc (not this slice) — confirm it stays out?
