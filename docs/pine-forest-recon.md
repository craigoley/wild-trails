# World Expansion — PINE FOREST / BOREAL (recon)

*the dense-canopy CLOSED-woods biome; a branch; the occlusion/legibility problem*

PLAN.md §4.2 + Craig's picks: **Pine Forest** (the visually-distinct dense woods — the world is mostly
**open**; a closed canopy is a genuinely new *place* and *look*), **branched** (the 2D world grows
wider). The data-slice pattern is proven 4× (Riverbank / Coast / fish / Heathland) — **but Pine's
defining feature is dense VERTICAL geometry (trees), which is a RENDER change, not a ground-palette
swap.** That's why this is recon-first. **Design only — no code.**

> ## ⚠️ The headline finding: there are NO trees in the game yet
> Every "cover" prop is **low understory** — grass blades, **ferns** (the *Woodland* is bracken, not
> trees!), reeds, rocks — all placed only at the 2–3 `HIDING_SPOTS` per biome
> (`WorldRenderer.addCover`). Nothing is tall; nothing is dense; nothing is a tree. So Pine's pines are
> **genuinely new geometry**, and — viewed down the **35.26° iso camera** (`CAMERA`, ortho) — the first
> props tall enough to **occlude the player/animals**. That occlusion is the real problem this recon
> solves (#2). Everything else (species, the branch, the gate) is the proven additive data slice.

---

## #1 — The prop system now, and the dense-pine approach

- **Props today** (`WorldRenderer`): per-biome **cover clusters** at `HIDING_SPOTS` — `addCover()`
  dispatches on `spot.kind` (`grass`/`ferns`/`reeds`/`rocks`), filling each spot's small radius
  (~2–2.5u) with a deterministic **golden-angle spiral** of low meshes. 2–3 spots per biome, ~10–30
  small meshes total. **All low**; none read as "forest."
- **The dense-pine approach (new, but contained):** add a **biome-wide PINE SCATTER** — a *separate*
  decorative layer (not the cover spots) of **zero-asset procedural pines**: a thin **trunk** (cylinder)
  + **1–2 stacked cones** for the conical boreal canopy. Scattered across the Pine cell with the same
  deterministic golden-angle/jittered placement (no RNG), built **once**. This is an *addition* to the
  prop system, **not a render refactor** — same `WorldRenderer`, same flat-shaded materials, same
  build-once-static pattern. (Pine keeps its **own low cover spots** like every biome — reuse `ferns`
  or a new low `needles` kind — so the **stealth system is untouched**, #4.)

---

## #2 — ⚠️ THE OCCLUSION / LEGIBILITY PROBLEM (the crux — solved)

**The problem, concretely.** The camera looks down a fixed **35.26° iso pitch** (`atan2(20, 20√2)`),
orthographic. Props and entities share one depth buffer. A tree **taller than the player** sitting on
the **camera-near side** (+x/+z) of an entity will **draw over it** — you'd lose the player/animal
behind a trunk/canopy. Today this never bites (props are low); **tall pines are the first real
occluders.** "Dense" must mean *reads dense* while the player + animals stay **always visible**.

**The solution — a layered fix (recommended: 1 + 2 together):**

**1. Entities ALWAYS ON TOP (the legibility guarantee).** Set the player + animal model materials to
`depthTest: false` (+ a high `renderOrder`) so they **composite over the forest** — you can *never*
lose them behind a tree, at any density. This is the standard "always see your character" iso
technique, and it's a **two-line change** at model-build (`builders.ts` `flatMat`). It makes legibility
**structural**, not tuning-dependent.
> ⚠️ **Blast radius:** this is a *global* render change (entities draw over props in **every** biome).
> In practice the existing props are low and rarely overlap an entity, so the visible change is
> minimal — **but the build must re-check the 6 existing L2 baselines and regen any that shift** (#6).
> *(If we want it Pine-only to keep existing baselines provably untouched, gate `depthTest:false` to
> when the player is in Pine — slightly more code; flagged as the conservative alternative.)*

**2. SUGGESTION of density (reduce occlusion at the source).** The pines are a *stylised hint*, not
photoreal 15 m conifers:
- **Modest height** — ~**1.6–2.4u** (≈1.5–2× the ~1.1u player), so a canopy band sits *above* the
  entities rather than burying them.
- **A clearing at the play centre** — keep the spawn/interior sparse; **denser toward the cell edges**
  (trees **frame** the play space, not **cover** it). Reads as "a forest you move through in
  clearings."
- **Thin trunks + an airy canopy** — density from *many trunks* + the conical band, not a solid dome.

**3. (Optional polish, deferred) camera-near fade** — fade pines that fall between the camera and the
player. Pine-scoped, but per-instance opacity fights instancing (#3); **not needed** once #1 guarantees
legibility. Note it and skip it for v1.

> **The verdict:** #1 (entities on top) *guarantees* you always see what you're catching; #2 makes the
> forest read dense without trying to. Together: **dense-forest feel, zero hidden gameplay.**

---

## #3 — ⚠️ Perf (mobile — a forest of meshes)

A naïve forest = dozens of trees × 2–3 meshes each = hundreds of draw calls → mobile risk. **Use
`InstancedMesh`:** one instanced trunk + one instanced canopy → the **whole forest is ~2 draw calls**
regardless of tree count. The pines are **static** (built once), so instancing is a perfect fit (set
each instance's matrix at build, never per-frame). **Cap ~40–60 trees per cell** (plenty for a dense
read at this scale). Zero-asset (cylinder + cones), no per-frame allocation. The existing per-spot
cover props stay as individual meshes (few). **This runs fine on the iPhone** — instancing is *the*
mobile technique, and 2 draw calls + ~120 instances is trivial.

---

## #4 — Visual-only (the catch core untouched — pinned)

The pines are **atmosphere, full stop:**
- **NOT cover** — the stealth/`HIDING_SPOTS` system is untouched; Pine has its own *low* cover spots
  like every biome. (A tree is not a hiding spot.)
- **NOT collision** — movement still clamps to the biome **rect** (`clampToUnlocked`), exactly as
  today; trees don't block. You walk "through" a trunk's footprint (acceptable for a decorative,
  legibility-first iso forest).
- **The catch/movement core reads LOGICAL positions** (`finalCatchChance`, proximity, the sim) — the
  trees are render-only and the sim never sees them.

⚠️ **Pin: Pine adds NO new movement/catch mechanic.** The only render-side touch beyond data is the
pine scatter + the entities-on-top compositing. `src/game/` stays pure. *(This honours "one
catch-touching change at a time" — Pine touches nothing in the catch core.)*

---

## #5 — The species + the branch + the gate (the proven data slice)

**The roster — 5 honest Caledonian-pinewood species** (⚠️ **red squirrel is already a Woodland
species** — locked to one biome, so it can't be reused; it stays in the Woodland and *thematically
bridges* to the pines):

| Species | Diet | Difficulty | Gait | Honest status |
|---|---|---|---|---|
| **Scottish Crossbill** | seeds (conifer cones) | easiest (the valve) | bird | the UK's **only endemic bird** — found nowhere else |
| **Coal Tit** | seeds | easy–medium | bird | doing well; a pinewood regular |
| **Crested Tit** | insects | medium | bird | a **pinewood specialist**, tiny restricted range |
| **Capercaillie** | greens (shoots/blaeberry) | hard — ⚠️ the hero | bird | **on the brink in Scotland** — the soul-layer's biggest stake |
| **Pine Marten** | greens (berries are a real staple) | hardest (apex) | walk | a genuine **recovery** — back from near-loss |

Honest diets within the four baits (**no fish** — a dry forest; **no wildcat**, whose carnivore diet
fits none of seeds/greens/insects/fish — flagged & dropped to keep diets honest). The **crossbill**
(calm seed-eater) is the **bait-less anti-lockout valve**. CJ2 gaits by tag (four `bird` + the marten's
`walk`).

**⚠️ The branch.** The Highlands node is **surrounded** (woodland W, wetland S, riverbank N, moor E —
no free edge), so Pine forks off **Woodland**: a clean **2-way fork** `Woodland → { Wetland,
PineForest }`, giving the broadleaf wood its second arm. Place Pine at **cell(0, 80)** —
`[-20,20]×[60,100]`, NW, edge-adjacent to **Woodland** (S) and **Riverbank** (E). *"The broadleaf wood
deepens into the old Caledonian pine forest."* Tier 2. `BIOME_SET_UNLOCK.woodland = ['wetland',
'pineforest']` (additive — the existing Woodland→Wetland arm unchanged; **pin no regression**), and
**both breadcrumbs legible at the fork** (the Heathland pattern via the research-area panel).
> *Alternative for harder pacing:* place it off the **Moor/Riverbank** (NE, tier 5) if Craig wants the
> wary pine species gated later — flagged; I lean **Woodland** (ecology + a clean 2-way fork + the red
> squirrel bridge).

**The gate** — a **multi-condition challenge (#92)**, activity in the **prereq Woodland** (the #37
breadcrumb, never a wall), non-forced via bait: e.g. **`research-squirrel-seeds`** — *"catch the red
squirrel over seed bait"* (a Woodland species, its real diet — the exact pattern the Heathland recon
flagged for a woodland fork). An `unlock-the-pineforest` project mirrors `unlock-the-moor` (cost-0
biome-access, double-enforced knowledge-by-play).

---

## #6 — Scope + L1/L2

- **Mostly DATA + the pine-render addition.** Data: `BiomeId`/`SpeciesId` widening (compile-time),
  `BIOMES.pineforest`, the 5 species (def/info/model), cover spots, supply post, the
  `research-squirrel-seeds` challenge + `unlock-the-pineforest` project, the `BIOME_SET_UNLOCK` fork.
  Render: the `InstancedMesh` pine scatter + the entities-on-top compositing. **No catch/movement
  change, no new mechanic, no schema bump.** `src/game/` + state pure.
- **⚠️ L2 baselines:**
  - The **new Pine cell** → a **new additive frozen scene** (`?seed=…&unlock=all&at=0,80`), seeded
    **after Craig approves the dense look** (the #85 workflow). The existing 6 are a new-cell-away,
    untouched by the *data*.
  - **The entities-on-top render change** is global → it **may** shift the existing baselines (likely
    negligible — existing props rarely occlude entities). **The build must run the visual project and
    regen only what actually diffs** (or scope `depthTest:false` to Pine to keep them provably
    untouched — the conservative option in #2).
- **Tests:** green on this branch — **578 passing** (the recon adds no code). The build will add the
  Heathland-style guards (branch additive + both breadcrumbs; the multi-condition gate's #48
  both-failure-modes; anti-lockout crossbill bait-less; win-path extends through Pine; gait tags;
  no schema bump) + a render-perf note (instanced, capped).

---

## STOP — the decision before building

The new wrinkle is solved on paper; Craig confirms the approach:

1. **The occlusion fix (#2)** — entities **always-on-top** (`depthTest:false`, global) + **suggestion-
   of-density** pines *(recommended)*. Global on-top, or Pine-scoped to protect existing baselines?
2. **The dense look (#2/#3)** — modest pines (~1.6–2.4u), clearings + denser edges, **instanced**
   (~40–60 trees). Approve the "stylised hint of density," not photoreal?
3. **The branch (#5)** — fork off **Woodland** at cell(0,80) *(recommended)*, or a higher-tier
   placement off the Moor/Riverbank?
4. **The roster (#5)** — the 5 (Crossbill / Coal Tit / Crested Tit / Capercaillie / Pine Marten), honest
   diets, **no wildcat**, red squirrel stays in the Woodland?

After Craig confirms the dense-canopy + occlusion solution + the branch, the build implements it — then
Craig playtests **the dense forest feel + that the player/animals stay visible**, and approves the look
(then the new Pine L2 baseline seeds).
