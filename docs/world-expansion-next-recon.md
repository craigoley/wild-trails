# World Expansion — the NEXT biome: recon + proposal (the S4.2 unblock, now ready)

The next slice of World Expansion (PLAN.md §4.2). Riverbank (#69) + Coast proved the
**data-slice pattern** repeats. This recon designs the **7th biome** — and it's the
*first* to use the **multi-condition challenge** unblock (#92) for its gate, which is
the exact blocker the Coast logged. **Design only — no code.** Cited to `file:line`
against current main (#96). Tests **530 green** on this branch.

> ## ⚠️ The headline: this is the moment the world was waiting for
> The Coast's gate comment is explicit (`constants.ts:2406`):
> *"This uses the **LAST free non-forced slot** … the **NEXT biome needs a
> mission-system enhancement** for more non-forced-challenge variety (logged)."*
> That enhancement **shipped in #92** (multi-condition challenges: `species + optional
> phase + optional bait`). So the next biome's mastery gate is a **multi-condition
> challenge** — e.g. *"catch the {species} using {bait} bait"* — fresh non-forced
> gate-fuel. The arc is unblocked exactly as planned.

---

## #1 — The world now (the proven data-slice; no schema bump)

`BIOMES` (`constants.ts:166`) is equal square cells (`PITCH = 40`), a **column running
north to the sea**:

```
              COAST      (40,120)   ← the sea (terminus)
              RIVERBANK  (40, 80)
  WOODLAND    HIGHLANDS  (40, 40)
  (0,40)
  MEADOW      WETLAND    (40,  0)
  (0, 0)
```

`BiomeDef` already carries `{ bounds, color, unlocked, adjacent, tier, prereq }`
(`constants.ts:88`). Adding a biome is **purely additive data** (the agent confirmed):
a new tiled cell + ~5 species + a research-gated access project + a ground color +
cover spots + a supply post + (optional) water. **No schema bump** —
`journal.unlockedBiomes` is an unbounded `string[]`, `BiomeId` widening is compile-time
only, `sanitizeUnlocked` is forward/back compatible (`Journal.ts:194`). The per-rect
clamp + #55 water-slide already handle **any** equal-cell polyomino.

**24 species across 6 biomes** (meadow 4 / woodland 4 / wetland 2 / highlands 3 /
riverbank 6 / coast 5). The win (`Missions.ts:276`) = all species + all biome sets +
top rank; a new biome's species auto-join it (no hard-coded count). **Rank headroom is
huge** — ~340 achievable vs the 120 top threshold — so **adding ~5 species + missions
needs NO ceiling bump.**

---

## #2 — ⚠️ The structural decision: a LINE or a BRANCH? (where the world goes)

`BIOME_SET_UNLOCK` is **single-successor** (`Partial<Record<BiomeId, BiomeId>>`,
`constants.ts:2384`) — the world is currently a **line** ending at the Coast (the sea).
So the geography of the 7th biome forces a real choice:

- **(A) Append after Coast (tier 6, line stays linear)** — tile a 7th cell adjacent to
  Coast (west/east of `(40,120)`). *Trivial* (one more link in the chain), but it keeps
  the world a thin column, and "a habitat reached *after* the sea" is narratively
  backwards for most habitats.
- **(B) BRANCH the chain — grow a second arm (recommended)** — give an *earlier* biome
  a **second** successor, so the world becomes a 2D landscape instead of a longer line.
  e.g. **Woodland → {Wetland, Moor}**: the Moor tiles at `(0, 80)` — edge-adjacent to
  **Woodland** (S, its prereq) *and* **Riverbank** (E) — the left column climbs into the
  uplands as a parallel arm to the right column. The per-rect clamp already stitches it;
  the only change is letting one biome unlock **two** (a small structural edit: the
  `prereq` field is already per-biome, so two biomes *can* share a prereq — the one thing
  to extend is `BIOME_SET_UNLOCK`'s single value → support a branch).

**Recommend (B).** "World expansion" should make the world *wider*, not just *longer* —
a branching polyomino is more explorable, and the clamp/water/render all already support
it. The one structural task is confirming the unlock data + the #37 unlock-lines handle a
biome whose prereq already has a successor (a small, contained change). *(If you'd rather
keep it dead-simple this slice, (A) ships with zero structural change — flagged.)*

---

## #3 — The proposal: HEATHLAND / MOOR (the recommended 7th biome)

**Why the Moor** (over the alternative, a Caledonian Pine Forest):
- A **globally significant** British habitat — Britain holds a large share of the
  world's heather moorland & lowland heath — so the **soul-aware conservation cards**
  land on real, weighty stories.
- **Visually distinct**: purple heather + tawny grass (a *new* ground palette, ~`0x6a4a6e`
  / heather-purple) — unmistakably its own place, like the Coast's sand.
- **Ecologically right as a branch (B):** moorland sits between the broadleaf wood and the
  bare highlands — `(0,80)` (above Woodland, beside Riverbank) reads perfectly.
- **Open & dry** → like the Highlands/Coast it's **cover-sparse (2 spots)**, so the
  **throwing-net shines** (reuses the existing net synergy); **no water** (a dry moor →
  no new water mechanic, like Coast reused, even less). No new bait/net/diet — a clean
  reuse slice.

**The roster — 5 species, honest diets (seeds/greens/insects; no fish on a dry moor),
real conservation spectrum** (the Coast's honest-status discipline):

| Species | Diet | Difficulty | Gait | Teaches + ⚠️ honest status |
|---|---|---|---|---|
| **Twite** | seeds | easiest (the valve) | bird | "the moorland linnet" — a small upland finch. ⚠️ **Red-listed, declining** (lost seeding plants). |
| **Stonechat** | insects | medium | bird | The gorse-top sentinel ("tac-tac" like two stones). A genuine **recovery** story — doing well. |
| **Red Grouse** | greens | medium | bird | Crops heather shoots; the **British-endemic** moor bird, found nowhere else — a nuanced managed-landscape status. |
| **Curlew** | insects | hard | bird | ⚠️ The **hero card**: its bubbling call IS the moor — **near-threatened**, and Britain is a *global stronghold* (the soul-layer's biggest real stake). |
| **Red Deer** | greens | hardest (apex) | walk | Britain's **largest land mammal**, the monarch of the moor — recovered/overabundant in places (a "success, with caveats"). |

Diets: seeds (twite), greens (grouse, deer), insects (stonechat, curlew) — honest, no
fudged fish. The twite (calm seed-eater) is the **bait-less anti-lockout valve**; the
curlew + deer are the high-tier challenge (catch-band ~0.12–0.5 like the Coast).

> Alternative habitat if you prefer: **Caledonian Pine Forest** (pine marten, crossbill,
> crested tit, capercaillie) — also strong, but red squirrel already lives in the
> Woodland, and the Moor's purple + its conservation stories are the bigger win.

---

## #4 — The gate (the S4.2 unblock in action)

Mirror the `unlock-the-coast` template (`constants.ts:2567`) exactly, with a
**multi-condition** mastery challenge:

```ts
'unlock-the-moor': {
  area: 'moor', name: 'Moorland Access', cost: 0,
  activityRequirement: { kind: 'catch-in-biome', biome: <prereq>, count: 4 }, // in an ACCESSED biome
  knowledgeRequirement: 'research-<a multi-condition challenge>',             // by PLAY (#92)
  reward: { kind: 'biome-access', biome: 'moor' },
}
```

- **The challenge** is a fresh multi-condition one whose **activity is in the prereq
  biome** (so it's the #37 *breadcrumb*, never a wall — the multi-condition recon's
  rule). For Moor-off-Woodland (B), e.g. **"catch the red squirrel using seed bait"**
  (woodland species, its real diet — non-forced via bait, teaches the squirrel's diet)
  — or reuse an existing one (`research-hedgehog-insects`). I'd author a fresh,
  thematically-apt one.
- **Double-enforced knowledge-by-play** (the project's `knowledgeRequirement` + the
  dispatch's `isUnlockGateMet` re-check) carries over per biome — no new gating code.
- `BIOME_SET_UNLOCK` + `BIOME_GATE_CHALLENGES` get the new entry (per #2's branch note).

---

## #5 — Scope, L1/L2, purity

- **Pure data slice** (`constants.ts` tables) + the small unlock-branch edit (#2).
  `src/game/` + state stay pure. **No schema bump.** No new catch mechanic/bait/net
  (the Moor reuses everything — the cleanest possible expansion, like the Coast).
- **L1 guards** (the gate): extend the progression-to-win guard *through* the Moor (the
  full chain → win), and balance-band its 5-species roster (the catch-band like the
  Coast tests). A new **#48-inverse** pin for its gate's multi-condition challenge.
- **⚠️ L2:** the Moor is a NEW cell → the **world canvas changes** (a new region renders),
  so unlike the cosmetic CJ/TL slices this **DOES** add a baseline — an **additive new
  frozen scene** (`?seed=7&freeze=1&unlock=all&at=<moor>`), seeded after Craig approves
  the look. The existing 5 baselines are **unchanged** (the Moor is a new cell, not a
  change to the others).
- **Feel/look** (the new purple ground + the roster reading right) is Craig's playtest;
  the progression/balance is test-gated.

---

## Decisions needed before building

1. **Chain shape (#2)** — **branch** the world (recommended: a 2D landscape, the Moor as
   a parallel arm off the Woodland/Highlands) vs. **append** after the Coast (simplest,
   stays a line)?
2. **The habitat (#3)** — **Heathland/Moor** (recommended) vs. Caledonian Pine Forest vs.
   another British habitat?
3. **The roster (#3)** — confirm the 5 (Twite / Stonechat / Red Grouse / Curlew / Red
   Deer), honest diets (no fish), the conservation spectrum?
4. **The gate challenge (#4)** — a fresh multi-condition challenge (activity in the prereq
   biome) — confirm authoring one (e.g. red-squirrel + seed bait) vs. reusing an existing.
5. **Cells per slice** — one biome this slice (the established cadence), with further
   biomes as future slices to fill out the branched world?
