# Worldwide Content — Recon / Design (Layer B, recon only)

**Status:** RECON / DESIGN ONLY. **No code or copy changed.** This doc resolves
the existing world's geography (#1/#2), designs the worldwide-expansion framework
(#3), and surfaces the direction forks for Craig — as one coherent design. The
**direction is Craig's to pick**; this lays out the space with tradeoffs + a
recommendation each.

**The principle (sacred):** real ecology is the teaching engine (P2/P3).
"Worldwide" = **real species + biomes from real places across the globe,
US-framed** — *more* true (real ecology from multiple real places), **NOT**
generic/invented. The existing real species **stay real**; the world **opens up**.

**Builds on:** [`docs/americanize-language-recon.md`](americanize-language-recon.md)
(Layer A, merged in #154). Layer A neutralized the British *framing* and
explicitly **deferred the species-level endemics to here**.

---

## TL;DR — the findings & the recommendations

1. **CAUSE (verified, not hypothesis): the roster is already Palearctic/temperate,
   not "British."** Of 62 species, **~15 are genuinely Holarctic/cosmopolitan**
   (present in North America too — Mallard, Rock Ptarmigan, Brant/Brent Goose,
   Turnstone, Herring Gull, Grey/Gray Seal, Dunlin, Red Knot, Snow Bunting,
   Northern Wheatear, Bar-tailed Godwit, Grey/Black-bellied Plover, Pintail,
   Sanderling, …), and **almost all the rest are widespread Eurasian-temperate**
   species — real animals of a real temperate region. **Only TWO are
   species-level UK locks:** the **Scottish crossbill** (a true endemic) and the
   **red grouse** (the British/Irish form of a Holarctic species).
2. **So the existing world does NOT need relocating.** It is honestly **"a
   temperate region"** already (cosmopolitan + Eurasian species). The fix is
   *resolve the 2–4 deferred endemic-framed cards*, **not** rebuild the 14 biomes.
3. **Two of the four "deferred endemics" aren't endemics at all.** Capercaillie
   and crested tit are **widespread Eurasian species** — only their *British
   populations* were the framing. They reframe like any Layer-A place-line (KEEP
   the species, drop "Scotland/Britain"). Only Scottish crossbill (and arguably
   red grouse) is a real roster decision.
4. **The world already HAS a spatial frame** — biomes are tiled cells on a
   contiguous 2-D grid, walked between, gated by a `prereq` tree. New biomes are
   new edge-adjacent cells forking the tree (the proven hedgerow/estuary pattern).
   → **Recommendation for "what worldwide means": FRAME-LIGHT** — more real-habitat
   cells, each true, on the same abstract naturalist's world. It fits the proven
   topology with **zero structural change**. A *regional-cluster* framing is a
   cheap optional layer on top; a literal *world-map* frame fights the grid (flagged).
5. **Difficulty and geography are already separate axes.** `tier` is the
   *unlock-ladder depth*; catch *difficulty* is per-species tuning
   (`baseCatchRate`/`detectionRadius`/`baseFleeSpeed`/cover), explicitly decoupled
   ("the difficulty is the SPECIES tuning … never the tier number"). A tropical
   biome isn't "harder," it's "elsewhere" — it forks the tree at some tier and
   tunes its own species. **No new organizing axis is needed.**
6. **The catch core stays untouched.** `finalCatchChance(species, ctx)` reads
   only species data + constants. Worldwide content is **DATA + the proven
   biome-slice** — no engine/formula change for frame-light. (A literal world-map
   frame would be the one thing that needs new structure — another reason to avoid it.)

**The shape of the build:** **B1 — resolve the existing geography** (the 2–4
endemic cards: copy + at most one species swap; the Layer-A finish). Then **B2+ —
the first worldwide biome** (per the chosen direction). Recon → decide → build.

---

# PART A — Resolve the existing world's geography (#1/#2)

## A1. The roster CAUSE-check — cosmopolitan vs Eurasian vs endemic (#2)

The accidental "British" identity was **framing, not roster**. Classifying all 62
species by real range:

### Genuinely Holarctic / cosmopolitan — present in North America too (~15)
These are honest *anywhere* in the temperate/Arctic Northern Hemisphere. Several
even have US common names that differ (noted) — a worldwide frame could adopt them:

| Species (in-game name) | Real range | US note |
|---|---|---|
| Mallard | Holarctic | same |
| Rock Ptarmigan | circumpolar (incl. AK/Canada) | same |
| Brent Goose | Holarctic coasts | **"Brant"** in US |
| Turnstone | worldwide shores | Ruddy Turnstone |
| Herring Gull | Holarctic | same (abundant in US) |
| Grey/Gray Seal | N. Atlantic (incl. NE US/Canada) | same |
| Dunlin | Holarctic (breeds AK) | same |
| Knot | hemispheric migrant | **Red Knot** (Delaware Bay) |
| Snow Bunting | circumpolar (winters N US) | same |
| Northern Wheatear | breeds AK/NE Canada | same |
| Bar-tailed Godwit | breeds Alaska (record migrant) | same |
| Grey Plover | worldwide shores | **"Black-bellied Plover"** in US |
| Pintail | Holarctic (incl. NA) | Northern Pintail |
| Sanderling | every sandy beach on Earth | same |

### Widespread Eurasian-temperate — real species of a real temperate region (~45)
Field mouse, rabbit, quail, hedgehog, red squirrel, robin (note: a *different*
bird from the American Robin), badger, roe deer, common frog, reed bunting, water
vole, grey wagtail, dipper (the American Dipper shares the niche + the
"only songbird that swims" fact), kingfisher, otter, linnet, twite, stonechat,
curlew, red deer (conspecific with the NA elk/wapiti), coal tit, pine marten,
4× bats, European eel (the American Eel shares the Sargasso story), redshank,
avocet, meadow pipit, golden plover, ring ouzel, bank vole, harvest mouse,
yellowhammer, whitethroat, hazel dormouse, blackcap, wigeon, shelduck, ringed
plover, oystercatcher. **All real, all honest as "a temperate region."** A handful
have no American members (hedgehog, dormouse — no native Americas dormice) — they
read as **Old-World** species, which a worldwide frame *welcomes* (real Eurasia).

### Species-level UK locks — the real roster decisions (only 2)
| Species | Why it's a lock | |
|---|---|---|
| **Scottish Crossbill** | a *true* endemic — found only in Scotland | the hard one |
| **Red Grouse** | the British/Irish endemic *form* of the (Holarctic) Willow Ptarmigan | soft — the species is worldwide |

> **CAUSE confirmed:** "British identity" = the *framing copy* (resolved in Layer
> A) + **2 endemic species**, on a roster that is otherwise cosmopolitan/Eurasian.
> The world is already honestly temperate. This is a *resolve*, not a *rebuild*.

## A2. The deferred endemics — resolved, each with options + a recommendation (#1)

Layer A deferred four cards. **Two are not endemics** (correct this framing error):

### (i) Capercaillie — NOT an endemic → reframe, KEEP species
A widespread **Eurasian boreal grouse** (Scandinavia, the Alps, Russia, the
Scottish relicts). The "on the brink in Scotland / lost from Britain" copy is
**UK-population framing**, not species identity.
- **Rec: KEEP the species; reframe the copy** like any Layer-A place-line →
  *"a giant grouse of the old pine forests; in places reduced to a few thousand,
  a flagship of boreal-forest conservation."* Real, worldwide, honest.
- (`constants.ts:1166` status, `:2020` profile.)

### (ii) Crested Tit — NOT an endemic → reframe, KEEP species
Widespread across **European conifer forests**; only its *British* population is
Caledonian-restricted. The species is not endemic.
- **Rec: KEEP the species; reframe** → *"a pinewood specialist of old conifer
  forests, tied to mature stands with rotten stumps to nest in."* Drop
  "in Britain … Caledonian … Scottish Highlands."
- (`constants.ts:1159` status, `:2002` profile.)

### (iii) Red Grouse — a real form of a worldwide species → KEEP, broaden the frame
The **Willow Ptarmigan** (*Lagopus lagopus*) is **Holarctic** — Alaska, Canada,
Scandinavia, Russia. "Red grouse" is its reddish, non-whitening British/Irish
form. The teaching fact ("a grouse of the heather/tundra, bursts up underfoot")
is worldwide.
- **Options:** (a) **KEEP** as red grouse, reframe to the broader identity
  (*"the British form of the willow ptarmigan, a moorland grouse"*) — but that
  re-introduces "British"; or (b) **re-cast as Willow Ptarmigan** (the worldwide
  species, present in North America) — keeps the niche + the moor, drops the lock;
  or (c) KEEP the name, drop the endemic claim (*"a moorland grouse of the heather
  uplands"*).
- **Rec: (c)** — keep the familiar "red grouse" name and the moor card, **drop the
  "British endemic — found nowhere else" claim** (it's the *form* that's local,
  not an endemic species). Cheapest honest fix; no roster slot change.
- (`constants.ts:1123` status, `:1912` profile.)

### (iv) Scottish Crossbill — the ONE real roster decision
A **genuine endemic** (Scotland only — the game's "Britain's ONLY endemic bird,
found nowhere else on Earth"). You cannot drop the place without losing the fact.
- **Options:**
  - **(a) KEEP as real** — *if* the worldwide frame includes a real
    Caledonian/old-Scots-pine node, it's simply a real place, honestly taught
    (endemism is a *beautiful* ecology lesson). Honest, zero roster churn.
    **Depends on the framework** (see Part B): a frame that embraces "real places
    anywhere, incl. Scotland" KEEPS it happily.
  - **(b) SWAP → Red Crossbill** (*Loxia curvirostra*) — the **cosmopolitan**
    crossbill (Holarctic, common in North American conifers). Same niche, same
    "uniquely crossed bill prises cone scales" teaching, **no endemic-lock**. Keeps
    the Pine-Forest roster slot; loses the (real, lovely) endemism hook.
  - **(c) DROP** — not recommended; it's the Pine-Forest valve species and earns
    its slot.
- **Rec: depends on the direction (flag for Craig).** If the world stays "real
  habitats incl. a real Scotland" → **KEEP (a)** (endemism is great teaching). If
  the world leans North-America-forward / wants zero UK locks → **SWAP to Red
  Crossbill (b)**. Either is honest; pick with the framework.
- (`constants.ts:1145` status, `:1968` profile, `:1955` `displayName: 'Scottish Crossbill'`.)

> **Net:** of the "four deferred endemics," **three reframe with copy only**
> (capercaillie, crested tit, red grouse) and **one is a genuine fork** (Scottish
> crossbill: keep-as-real vs swap-to-red-crossbill), and *that* one depends on the
> Part-B direction. No other species in the roster is a UK lock (grep-confirmed).

## A3. The existing biomes' geographic identity (#2)

**The 14 shipped biomes do NOT need relocating or renaming (mostly).** They are an
abstract, contiguous naturalist's world tiled with **real temperate habitats** —
all of which exist across the Northern Hemisphere:

- **Already worldwide-neutral display names (keep):** Meadow, Woodland, Wetland,
  Riverbank, Coast, Pine Forest, Cave, Saltmarsh, Estuary, Alpine Summit, Hedgerow,
  Hazel Copse. (Pine Forest reads as boreal forest — circumpolar; the internal
  "Caledonian" is a *comment*, not player-visible.)
- **The two to flag (Layer-A deferred display names):**
  - **`Moor`** — UK/Eurasian-flavored, but moorland exists in North America
    (e.g. coastal heath, alpine moor) and globally. *Real term; mild flavor.*
    **Rec: keep** unless Craig wants `Heath`/`Upland Heath`.
  - **`Highlands`** — reads as the *Scottish* Highlands. **Rec: keep** (generic
    "highlands" is a real landform) **or** rename to `Highlands`→`High Country` /
    `Mountains` if Craig wants zero Scottish echo. (Display-name string only; the
    `biome:'highlands'` id stays — no identifier churn.)
- **No relocation.** The world becomes, explicitly or implicitly, **"a temperate
  region"** (it already is). Worldwide *expansion* then adds habitats from *other*
  climates/continents (Part B) — the existing temperate core is the honest anchor.

## A4. The framing finish (what Layer A deferred) (#3)

After the endemics resolve, the **only** remaining geographic-identity copy is the
12 `Britain/British/Scotland/Caledonian` strings — **all four endemic cards**
(status + profile twins) + the `Scottish Crossbill` display name. Resolving A2
above clears every one:
- capercaillie / crested tit / red grouse → copy reframe (3 species × 2 strings).
- Scottish crossbill → copy reframe if KEEP, or rename + recopy if SWAP.

**After B1, grep for `Britain|British|Scotland|Caledonian` in player strings → 0.**
That closes the Americanization arc end-to-end (Layer A framing + Layer B roster).

---

# PART B — Design the worldwide-expansion framework (#3)

## B4. What "worldwide expansion" means structurally — options + rec (#4)

**The constraint (verified from the code):** biomes are **spatial cells on a
contiguous 2-D grid** (`BiomeDef.bounds` = a rectangle; `adjacent` = neighbor
cells; you *walk* between them). Unlock is a **`prereq` tree** + `BIOME_SET_UNLOCK`
fork map. Every biome added so far (riverbank, coast, moor, pine forest, cave,
saltmarsh, alpine, hedgerow, copse, estuary) is **a new edge-adjacent cell forking
the tree** — a pure data slice, no engine change.

This matters: **the world is already an abstract, juxtaposed landscape** (a cave
cell sits next to a coast; a desert cell beside a meadow is no stranger than what
ships today). It is *not* a literal map of one real region. So:

| Option | What it is | Fit to the grid | Cost |
|---|---|---|---|
| **(a) FRAME-LIGHT** ⭐ | New cells = more real habitats from anywhere on Earth, forking the tree. No explicit geography; "the world" is implicitly a tour of real habitats. | **Native** — the proven pattern, zero structural change. | **Lowest** — each biome is the same data slice the hedgerow/estuary proved. |
| **(c) REGIONAL CLUSTERS** | Same contiguous grid, but new cells *grouped + labeled* by real region (a "North American wetlands" arm, a "tropics" arm). A light framing/copy layer on top of (a). | Good — clusters are just sub-trees with a shared label; the grid is unchanged. | **Low–medium** — adds a `region` label + journal grouping; optional map flavor. |
| **(b) GEOGRAPHIC FRAME** | Biomes explicitly *located* on a world map; you travel between real regions (a meta-map above the cell grid). The deepest "worldwide" reading. | **Fights the grid** — needs a new meta-map layer, region-to-region travel, and breaks the single contiguous-walk model. | **High** — new structure (the one thing that needs an engine/model change). |

> **Recommendation: FRAME-LIGHT (a)**, with **regional-cluster labeling (c) as an
> easy, optional enrichment** if Craig wants the worldwide-ness *named*. Rationale:
> it keeps expansion the cheap data-slice the existing world proved; "real habitats
> from across the world" is **true without a literal map**; and it preserves the
> calm, seamless roam (no mode-switch to a map screen). **(b) is the trap** — it's
> the most literal reading but the only one that breaks the topology + the catch-
> core purity. Flag (b)'s cost; recommend against unless Craig specifically wants a
> travel-the-globe meta-game (a different product).

> **Honesty note for frame-light:** juxtaposing a Sonoran desert cell beside a
> temperate meadow is geographically "impossible," but the game is already an
> abstract teaching world (cave-next-to-coast). The *species and ecology in each
> cell stay 100% real* — which is the principle. If the juxtaposition ever feels
> off, (c)'s regional labels resolve it cheaply ("you've reached the desert
> country") without a map.

## B5. The difficulty-gradient + unlock fit (#5)

**Resolved cleanly by the existing design:** geography and difficulty are **already
separate axes.**
- `tier` (0–7) = the **unlock-ladder depth** (how deep in the `prereq` tree).
- Catch **difficulty** = **per-species tuning** (`baseCatchRate`,
  `detectionRadius`, `baseFleeSpeed`, biome cover) — the alpine biome's own comment
  is explicit: *"the difficulty is the SPECIES tuning … never the tier number
  (`shakeCountForTier` clamps at 5)."*

So **"worldwide" does NOT strain the gradient.** A tropical biome isn't "harder"
— it forks the tree at whatever tier (probably mid/late, as a parallel arm like the
moor/pineforest), and its species get their own honest tuning (a tame valve + a
wary apex, the proven per-biome shape). **No new organizing axis is needed**; the
`BIOME_SET_UNLOCK` fork pattern extends unchanged. If Craig wants region clusters
(c), a `region` label is *descriptive metadata*, not a new gate.

## B6. The first worldwide-biome candidates (make it concrete) (#6)

Each must clear the proven bar: **teaches something NEW + honest stakes + distinct
from the existing biomes.** Now able to be *anywhere real*. (Illustrative — to show
the space, **not** to build.)

1. **North American Wetland / Everglades-style marsh** — *new ecology, familiar
   shape.* Distinct from the temperate Wetland: warm freshwater marsh — a wading
   bird (e.g. a heron/egret), a turtle, a new diet angle. **Hook:** the same
   "wetland" word, a *different* continent's cast — shows worldwide-ness directly.
2. **Desert (Sonoran / arid scrub)** — *a genuinely new climate + adaptation
   lesson.* Heat/water-scarcity ecology: a desert rodent (kangaroo rat), a reptile
   (lizard/tortoise), a seed-cache specialist. **Hook:** crepuscular/nocturnal
   activity to beat the heat — a new *why-now* teaching (pairs with the day/night
   clock). Clearly distinct; no existing biome is arid.
3. **Tropical Rainforest patch** — *vertical ecology + biodiversity density.*
   A canopy frugivore, an insectivore, a forest-floor forager. **Hook:** layered
   habitat (canopy vs floor) + the highest species density — a "so much packed in"
   lesson. (Heavier art lift — flag.)
4. **African Savanna / grassland** — *grazing-herd ecology at scale.* A grazer, a
   ground bird, a burrower. **Hook:** the great open grassland + herd behavior —
   distinct from the intimate Meadow. (Charismatic megafauna tempting but watch the
   honest-diet/catch-scale discipline.)

> **Recommendation for the *first* one: the Desert (#2)** — it's the most clearly
> "new" (a climate no existing biome covers), teaches a fresh adaptation
> (heat/water/nocturnality, which *reuses* the existing day-night clock), and is an
> achievable art lift (sparse, low cover — like the alpine). It proves "worldwide"
> with maximum teaching-per-biome and minimum new tech. (Craig's call — listed with
> the others to show the space.)

---

# PART C — The decisions, purity, and scope

## C7. The direction forks — surfaced for Craig (the recon's key output) (#7)

Each is **Craig's call**; the recommendation is a default, not a decision.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **(i)** | **Scottish crossbill** (the one real endemic fork) | KEEP as real (needs a real Caledonian/old-pine node) · SWAP → Red Crossbill (cosmopolitan, same niche) · DROP | **Depends on (ii).** Frame embraces real-places-incl.-Scotland → **KEEP**; zero-UK-locks/NA-forward → **SWAP**. |
| **(i-b)** | Capercaillie / crested tit / red grouse | (not endemics) reframe copy, keep species | **Reframe** (copy only) — confirm these are *not* roster changes |
| **(ii)** | **What "worldwide" means** | frame-light · regional-clusters · geographic-frame | **Frame-light** (+ optional cluster labels). Avoid the geographic-frame (breaks topology + purity). |
| **(iii)** | Habitat display names | keep `Moor`/`Highlands` · rename (`Heath`/`High Country`/`Mountains`) | **Keep** (real landforms); rename only if you want zero Scottish/UK echo (string-only) |
| **(iv)** | How far / how fast | resolve-existing-only first (B1) · existing + first worldwide biome (B1+B2) | **B1 first** (close the Americanization arc), then B2 once the direction + first biome are picked |
| **(v)** | The first worldwide biome | Desert · NA wetland · Rainforest · Savanna | **Desert** (most clearly new, reuses the clock, light art) — but your pick |

## C8. The catch core + real-ecology + purity (sacred) (#8)

**Confirmed: worldwide content is DATA + the proven biome-slice. The catch formula
is untouched.**
- `finalCatchChance(species, ctx)` reads **only** `species.baseCatchRate` ×
  proximity × calm × `biomeMatch` — all from constants. New species = new data
  rows; new biomes = new `BiomeDef` cells + `BIOME_SET_UNLOCK` forks. **No engine
  change** for frame-light/clusters.
- **Real ecology preserved (P2/P3):** every new species/biome is a *real* animal /
  *real* habitat from a *real* place — **multiple real places, not generic.** The
  honest-diet discipline (bait = real diet), the one-biome species model (a species
  lives in one biome — the hedgerow/estuary lesson, enforced by `biomeMatch`), and
  the tame-valve/wary-apex per-biome shape all carry over **unchanged**.
- **The one thing that would need a model change:** a **geographic-frame (B-option
  b)** — a world-map meta-layer, region travel, possibly multi-region species.
  **Another reason to recommend frame-light** (it keeps the core pure). Flag this
  as the boundary: pick frame-light/clusters → **zero structural change**; pick
  geographic-frame → a real engine arc.
- **No L2/visual-baseline impact until new biomes RENDER.** B1 (copy + at most a
  species name/data swap) is non-visual or a journal-card change; **B2+ new biomes
  reseed** on the known rhythm (the hedgerow/estuary cadence).

## C9. Scope + the slice sequence (#9)

**Recon vs. build boundary:** this doc **designs + decides**; the builds come after
Craig picks (i)–(v).

- **B1 — Resolve the existing geography** *(small; mostly the Layer-A finish)*
  - Reframe capercaillie / crested tit / red grouse copy (3 species × status+profile).
  - Scottish crossbill: KEEP-reframe **or** SWAP→Red Crossbill (name + data +
    copy) per (i).
  - Optional: `Moor`/`Highlands` display-name decision per (iii).
  - **Result:** grep `Britain|British|Scotland|Caledonian` in player strings → **0**;
    the Americanization arc closes. Copy/data only; tests green; **no reseed**
    (unless the crossbill swap changes its render color/model — a tiny data tweak).
- **B2+ — The worldwide-expansion framework + the first new biome** *(per the chosen
  direction)*
  - Frame-light (rec): a new `BiomeDef` cell + `BIOME_SET_UNLOCK` fork + its species
    rows + missions — the proven data slice. (+ optional `region` label if clusters.)
  - The first biome (rec: Desert) — its own `constants.ts` block + pure module if it
    needs a new mechanic, on the established pattern. **Reseed when it renders.**
  - Geographic-frame (only if Craig picks it): a separate, larger arc — the world-map
    layer + region travel. Scoped on its own, **not** bundled with frame-light.

**Build order:** **B1 (resolve) → decide (i)/(ii)/(v) → B2 (first worldwide biome)
→ B3+ (more biomes/regions).** Each B2+ biome is the cheap proven slice; reseed on
render.

---

## Confirmations

- **Recon only — no code/copy changed.** `git status` shows only this doc added.
- **Tests green** at recon time: `npm run build` ✓, **791/791 tests pass**, lint ✓.
- **CAUSE vs HYPOTHESIS labeled:** the roster classification (A1) and the
  topology/difficulty/catch-core findings (B4/B5/C8) are **verified from the code**;
  the framework *recommendations* (frame-light, Desert-first, the endemic recs) are
  **proposed design** for Craig to decide.

*Design complete. The direction is Craig's to pick (C7). After the calls, B1
(resolve-existing) → B2+ (worldwide expansion) implement it.*
