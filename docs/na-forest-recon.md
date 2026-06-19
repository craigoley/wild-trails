# North American Eastern Deciduous Forest — Recon / Design (worldwide rebalance R2)

**Status:** RECON / DESIGN ONLY. **No code changed.** Designs the **NA Eastern
deciduous forest** — worldwide rebalance **R2**, the **iconic-US-fauna fix** + the
**European-vs-American biogeography lesson** (the robin homograph). Findings are
**CAUSE** (verified from the roster/code) vs **HYPOTHESIS** (proposed design). The
decisions are **Craig's**.

**⚠️ BUILD-GATE:** R2 **builds only after the Savanna (PR #165) is Craig-confirmed.**
R2 *reuses* the savanna's patterns — the **6th `meat` diet**, the region-cluster
label, the palette approach, the new-`ModelKind` approach. The savanna is
device-pending, so this recon **designs against** those patterns, but the build
waits so R2 inherits the **confirmed** versions, not draft ones. **Recon-only now.**

**Builds on:** [`worldwide-roster-rebalance-recon.md`](worldwide-roster-rebalance-recon.md)
(R2 is the confirmed second slice — "the NA forest, the US-fauna fix, biogeography
teaching"), the [savanna build](https://github.com/craigoley/wild-trails/pull/165)
(R1 — the patterns), and the [accessibility audit](accessibility-content-recon.md)
(the iconic-US-fauna gap + the robin homograph trap).

---

## ⚠️ THE PRINCIPLE (the line, again): real CO-OCCURRING fauna, no blender

Every species below is a real animal of the **Eastern North American deciduous
forest** that genuinely **co-occurs** there. No padding with non-co-occurring
"American animals" (a grizzly is Western montane → excluded; an alligator is
Southern wetland → excluded). One real place, its real cast.

---

## TL;DR — the design

1. **R2 is the proven frame-light slice, and LIGHTER than the savanna (CAUSE).**
   - **No new diet** — the NA-forest fauna eat the proven diets **+ `meat`** (which
     the savanna already added); only the **owl** honestly needs `meat`.
   - **No giant mammals** — a black bear / deer are large but **not giraffe-tall**;
     the **generic quadruped** covers them (no new `ModelKind` like the savanna's
     giraffe/elephant). The lightest worldwide slice yet.
2. **It's the iconic-US-fauna FIX (#2/#4 — the audit's headline):** finally the
   animals a US kid *knows* — **raccoon, black bear, white-tailed deer, blue jay,
   gray squirrel, the American robin, a barred owl.**
3. **The R2 special — the biogeography lesson (#4):** the existing **European
   Woodland** and this **NA forest** are *sibling* temperate forests on two
   continents, and the **European Robin ↔ American Robin** is the perfect hook —
   **same name, different birds** — turning the audit's homograph *confusion* into
   *content*. Lands via the region labels + the `SPECIES_INFO` copy.
4. **The ONE real design risk (#6 — flag for Craig):** unlike the obviously-distinct
   savanna/desert, the NA forest **shares the European Woodland's habitat type AND
   its green palette** (CAUSE: the existing forests are all greens — Woodland
   `0x244f2c`, Pine `0x1b3a2e`). The distinctness must come from the **iconic fauna**
   + the **region label** + a **tuned palette** — best lever: lean into the
   world-famous **Eastern-US autumn** (fiery fall foliage, distinct from the European
   gold). The "reads distinct" question is R2's crux.
5. **Sacred:** the catch core, frame-light (zero clamp change), single-biome, real
   co-occurring ecology — all held. **No new mechanic** (meat already exists).

---

## 1. The frame-light fit + the savanna-pattern reuse (#1, CAUSE)

A normal new **cell + `prereq` fork** — the proven data-slice (riverbank → … →
desert → savanna). **No structural change.**

**Placement — anchors the North American region cluster.** The **Sonoran Desert**
(`(0,3)`, merged) is *already North American* — so the NA forest **clusters with the
desert** as the second NA biome. Options:
- **(a) Fork off the Desert** (the NA anchor) — desert → a NA-forest arm (a parallel
  arm to the savanna, like highlands → riverbank + moor). Groups the two NA biomes;
  a free desert-adjacent cell (e.g. west of the desert). **Recommended** — it seeds
  the NA cluster cleanly.
- **(b) Fork off the Savanna** (the linear worldwide chain) — savanna → NA-forest. A
  continent jump (Africa → NA), but a simple single-successor extension.
- Tier ~7–8 (a late worldwide biome). Exact cell is a build detail; free cells exist.

**Reuses from the Savanna (#165) — the build-gate dependency:**
| Pattern | From #165 | R2 use |
|---|---|---|
| **The `meat` diet** | the 6th `BaitId` + the shellfish-bait acquisition pattern | reused for the **owl** (no new diet) |
| **Region-cluster label** | "African Savanna" displayName + (R0) region grouping | "North American Forest" — anchors the **NA** cluster |
| **The palette approach** | a new ground `color` + an instanced prop scatter | a deciduous-forest palette + broadleaf-tree scatter |
| **New-`ModelKind` approach** | giraffe/elephant builders | **likely NOT needed** — the generic quadruped covers bear/deer |

> **CAUSE — lighter than the savanna:** no new diet (meat exists), no new ModelKind
> (no giraffe-tall animal). R2 is the cheapest worldwide slice — mostly data + copy
> + a palette/prop pass.

---

## 2. The real co-occurring Eastern-NA roster (#2 — the US-fauna FIX)

All `biome: 'na-forest'` (id TBD), real Eastern-NA-deciduous **co-occurring** fauna,
**iconic + recognizable** to a US kid. A curated **7** (matching the desert/savanna):

| Species | Diet (honest — see §3) | Role | Iconic note |
|---|---|---|---|
| **Eastern Gray Squirrel** | `seeds` | the **valve** (common, calm) | the famous one — *and* the European-invasive story (§4) |
| **White-tailed Deer** | `greens` | the calm big herbivore | every US kid's "deer" |
| **Raccoon** | `insects` (omnivore forager) | the iconic mammal | the "masked bandit" |
| **American Robin** | `insects` | ⚠️ the **homograph** (§4) | the *American* robin — a big thrush |
| **Blue Jay** | `seeds` | the acorn-caching seed-disperser | unmistakably American |
| **Black Bear** | `greens` (omnivore — §3) | the big draw | the iconic forest bear (modest model) |
| **Barred Owl** | `meat` (§3) | the **apex** + the food web | "who-cooks-for-you" — the forest predator |

**Extended cast (for a richer roster or future tuning), all co-occurring:** eastern
chipmunk (`seeds`), Virginia opossum (`insects`), wild turkey (`seeds`), red fox
(`insects` — §3). *(All real Eastern-NA-deciduous; pick to taste.)*

- ⚠️ **The blender forbidden (pinned):** no Western/Southern ringers — a **grizzly**
  (Western montane), a **roadrunner** (desert — it's the *desert's*), a **moose**
  (boreal). Eastern-deciduous co-occurrence only.
- **Single-biome** each. **Anti-lockout valve:** the gray squirrel (`seeds`, common,
  calm → a comfortable bait-less catch, the proven valve rate).
- **D1b coverage:** keep an `'any'`/night species so every phase has a cast — the
  **raccoon** (`'any'` — nocturnal but a fine round-the-clock floor) + the **barred
  owl** (`night`, the predator hunts the dark) cover dawn/night; the squirrel/deer/
  jay/robin are `day`.

---

## 3. The diet honesty per predator/omnivore (#3 — `meat` only where honest)

The savanna established `meat` for **true** carnivores (the lion). The NA forest's
predators/omnivores are subtler — the honest calls:

| Species | Real diet | Honest game diet | Reasoning |
|---|---|---|---|
| **Black Bear** | omnivore — **~85% plants** (berries, nuts, greens) + some insects/carrion | **`greens`** | ⚠️ **NOT `meat`** — a black bear is a *forager*, not a predator; framing it as a meat-eater is dishonest. Its real primary diet is plants. |
| **Barred Owl** | a **strict small-mammal predator** (mice, voles, frogs) | **`meat`** | ⚠️ a mouse is *meat*, not an insect — now that `meat` exists, it's **more honest** than stretching the kit-fox `insects` proxy to cover mouse-hunting. The forest's apex predator. |
| **Red Fox** | omnivore-leaning-carnivore — rodents **+ lots of insects/fruit** | **`insects`** | the proven **kit-fox small-prey proxy** fits — the fox genuinely eats many invertebrates; it's not a pure meat-hunter like the owl. (A nice honest *contrast*: the owl = `meat`, the fox = `insects`.) |
| **Raccoon** | omnivore — grubs, crayfish, fruit, eggs | **`insects`** (or `fish`) | a broad forager — `insects` (invertebrates) fits; `fish` (crayfish) is also defensible. **Flag** the pick. |
| **Opossum** | omnivore — insects, carrion, fruit | **`insects`** | the broad forager proxy. |

> **The §3 principle held:** `meat` used **only** where genuinely a meat-eater the
> proxy can't honestly cover (**the owl** — a mouse-hunter); the proven proxy
> (`insects`) where it honestly fits (fox/raccoon/opossum — broad omnivores); and a
> careful **`greens`** for the black bear (an honest forager, not a fake predator).
> **No NEW diet** — `meat` (from the savanna) + the proven 5 cover the whole forest.

---

## 4. The biogeography teaching — the R2 special (#4, confusion → content)

**The lesson:** the **European Woodland** (existing — red squirrel, robin, badger,
roe deer) and this **NA forest** are the *sibling temperate deciduous forests* on
two continents — the **same habitat, different cast**. The audit's **homograph
traps become the teaching:**

- **The Robin (the headline):** the existing Woodland's **European Robin** (a small
  orange-breasted bird) and the new NA forest's **American Robin** (a *large thrush*,
  unrelated despite the name). The `SPECIES_INFO` copy makes it explicit:
  *"The American robin is a big thrush, much larger than the little European robin —
  the early settlers just borrowed the name for the new bird's red breast."* **Same
  name, two birds, two continents** — a real biogeography lesson a kid *gets*.
- **The Gray Squirrel (the sequel):** the eastern gray squirrel is **the famous
  invasive that pushed out Europe's red squirrel** — the existing Woodland's *Red
  Squirrel* (declining) and this forest's *Gray Squirrel* (thriving, and the cause)
  are a real, vivid two-continent story. The copy can link them.
- **The Badger / Deer (the pattern):** European badger vs American badger (different
  animals); roe deer vs white-tailed deer (different deer) — the same "same word,
  different animal" pattern, reinforcing that **names travel, animals don't.**

**How it lands in-game (HYPOTHESIS):**
- **The region labels** (R0 — the savanna's region-cluster pattern) make the
  two-continent structure *legible*: the journal reads *Europe → … → North America*,
  so the two forests sit in **named different regions** — the player *sees* "two
  forests, two continents."
- **The `SPECIES_INFO` copy** carries the explicit homograph/biogeography glosses
  (above) — define-in-place, US-framed, accessible.
- **(Optional) a journal/research beat** — a light "two forests" comparison card
  could surface it actively, but the copy + labels likely suffice (don't over-scope).

> This is R2's distinctive **teaching value** — no other slice has it. It directly
> redeems the accessibility audit's homograph finding.

---

## 5. Teaching + accessibility (#5 — the audit's accessibility WIN)

The NA forest is the **most recognizable** biome for a US kid — *finally, the
animals they know.* The accessibility discipline travels with it:
- **Lead-with-the-familiar:** these species need *less* glossing than the Eurasian
  ones — but keep the define-in-place for the less-obvious (the **barred owl** — "a
  round-headed owl of the woods"; the **opossum** — "the only marsupial in North
  America, it 'plays dead' when scared").
- **US size comparisons:** the black bear "about as heavy as two grown men"; the
  gray squirrel "the size of your forearm"; the white-tailed deer "shoulder-high to
  an adult."
- **Honest US conservation stakes (the eastern-forest *recovery* story):** unlike the
  savanna's decline narratives, the Eastern US forest is a **comeback** — white-
  tailed deer, black bear, and wild turkey **recovered** from near-loss as the
  forests regrew in the 20th century. A genuinely *hopeful*, true story (and a nice
  tonal complement to the savanna/desert stakes).
- **The food web:** the **barred owl** (apex) over the squirrels/chipmunks/mice; the
  raccoon/fox as omnivore-predators — predator-prey, in a forest a kid knows.

---

## 6. The render + the "reads distinct from the European Woodland" RISK (#6 — the crux)

**⚠️ CAUSE — the one real R2 design risk:** the savanna/desert were *obviously*
distinct (golden grass / ochre sand vs. temperate greens). The NA Eastern deciduous
forest **shares the European Woodland's habitat type** (both are temperate broadleaf
woods) **AND would share its green palette** — the existing forests are all greens
(**Woodland `0x244f2c`, Pine `0x1b3a2e`, Copse `0x2a4420`**). A plain green NA forest
would look **near-identical** to the European Woodland. Distinctness must be *designed*.

**The distinctness levers (in order of strength):**
1. **The iconic FAUNA does most of the work (CAUSE).** A **raccoon** or a **black
   bear** is unmistakably American — the player *knows* it's not the European wood
   the instant one appears. This is the primary distinguisher.
2. **The region label** (R0) — the journal/HUD names it "North America," making the
   two-forest structure explicit.
3. **A tuned palette — lean into the iconic Eastern-US AUTUMN (the best visual
   lever).** The New England **fall foliage** (fiery red/orange) is world-famous and
   **distinct from the European wood's gold**. The game already has a seasonal
   foliage system (`SEASONAL_FLORA` — the woodland golds its bracken). The NA forest
   can:
   - take a subtly **warmer/redder** ground + a distinct broadleaf-tree green, **and**
   - lean its **autumn** re-tint toward **fiery red-orange** (vs. the European wood's
     gold) — the signature "American fall." This is the cleanest distinctness win.
   - **Flag for Craig:** how hard to lean the palette — a subtle shift (safe) vs. a
     bold autumn identity (distinctive but a departure from "summer is the baseline").
4. **Prop shape** — fuller, rounder broadleaf canopies (oak/maple) vs. the woodland's
   trees; optional fallen-leaf-litter ground accents.

**Legibility:** if the broadleaf scatter is dense → the Pine/#109 entities-on-top
discipline (atmosphere only, entities draw over). Recommend **open-ish deciduous**
(legible, like the woodland) — not a dense canopy.

**The mammals:** black bear / white-tailed deer are large but **not giraffe-tall** →
the **generic quadruped** (scaled + colored — dark bear, tan deer) reads fine. **No
new `ModelKind` needed** (unlike the savanna). *If* a bear/deer want more distinct
silhouettes, a modest `'bear'`/`'deer'` kind is a small optional addition — **flag**,
but the quadruped likely suffices. The owl → `'bird'`.

**Baselines:** the new palette + props → **a reseed after Craig's device approval**
(the known rhythm). The "reads distinct" call is **the device-gate question.**

---

## 7. Scope, slicing, and the SAVANNA-CONFIRM build-gate (#7)

**The slice (the proven frame-light data-slice — lighter than the savanna):**
- A `na-forest` `BiomeDef` cell + a `prereq` fork (off the Desert — the NA anchor) +
  `BIOME_SET_UNLOCK` + an `unlock-the-na-forest` research project (the proven
  pattern) + cover + missions.
- The 7-species roster (proven diets + the owl's `meat`) + `SPECIES_INFO` (the
  biogeography copy) + `SPECIES_MODEL` (generic quadruped + bird) + `SPECIES_BEHAVIOR`.
- The deciduous palette + the broadleaf-tree scatter + the autumn-lean (the
  distinctness, §6).
- **No new diet** (meat exists), **no new `ModelKind`** (probably) → the **lightest
  worldwide slice**.

**⚠️ THE BUILD-GATE (the dependency):** **R2 builds only after the Savanna (PR #165)
is Craig-confirmed.** R2 inherits the savanna's **`meat` diet**, **region-label**,
**palette**, and **`ModelKind`** patterns — building before #165 confirms risks
inheriting *draft* patterns that Craig may revise on device. **Recon now; build
after the savanna lands.**

### Decisions for Craig
| # | Decision | Options | Recommendation |
|---|---|---|---|
| (i) | **The "reads distinct" lever** (§6 — the crux) | fauna+label only · + a subtle palette shift · + a bold autumn identity | **Fauna + label + a tuned autumn-lean** (the fall foliage is the iconic, safe distinctness) |
| (ii) | **Placement** | fork off the Desert (NA cluster) · off the Savanna (linear) | **Off the Desert** (anchors the NA cluster cleanly) |
| (iii) | **The owl's diet** (§3) | `meat` (honest predator) · `insects` (kit-fox proxy) | **`meat`** (a mouse-hunter is honestly a meat-eater; meat now exists) |
| (iv) | **The black bear's diet** (§3) | `greens` (honest omnivore) · `meat` | **`greens`** (a bear is ~85% plants — an honest forager, not a fake predator) |
| (v) | **A bear/deer `ModelKind`?** | generic quadruped · a modest new kind | **Generic quadruped** (lighter; no giraffe-problem) — add a kind only if the silhouette needs it |
| (vi) | **The biogeography beat** (§4) | copy + labels only · + a journal comparison card | **Copy + labels** (don't over-scope; the robin/squirrel copy carries it) |

### Sacred (confirmed CAUSE)
- **Real co-occurring ecology** — Eastern-NA-deciduous only (no Western/Southern
  ringers; the blender forbidden). **Single-biome** model. **Catch core** untouched
  (`finalCatchChance` reads the diet value — `meat` already exists). **Frame-light**
  — a new cell + fork (zero clamp change). **No new mechanic** (meat from the savanna
  + the proven 5).
- **Tests green** at recon time: `npm run build` ✓, **805/805 pass** (recon changed
  nothing).

---

*Design complete. R2 is the iconic-US-fauna fix + the biogeography lesson, the
lightest worldwide slice (no new diet, no new ModelKind) — its one real challenge is
reading distinct from the European Woodland (the fauna + the iconic American autumn
answer it). The forks (§7) are Craig's. ⚠️ R2 BUILDS after the Savanna (#165) is
device-confirmed, inheriting its confirmed patterns. Next after R2: R3 (the NA
beaver-pond wetland — more US fauna + the ecosystem-engineer lesson).*
