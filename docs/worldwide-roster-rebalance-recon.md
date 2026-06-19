# Worldwide Roster Rebalance — Recon / Design (the full arc, sliced)

**Status:** RECON / DESIGN ONLY. **No code changed.** This designs the **full
worldwide roster rebalance** — enrich/reframe the existing biomes to honest real
places AND add new worldwide biomes — held to the **real-co-occurring-ecology**
principle, and **sliced incrementally** so the biggest content arc stays tractable.
Findings are **CAUSE** (verified from the roster/code) vs **HYPOTHESIS** (proposed
design). The decisions are **Craig's**.

**Per PLAN.md S4.8-B + the accessibility audit (S4.9):** the roster is ~100%
Eurasian — "around the world" is one region, with **zero** of the iconic US /
other-continent animals a kid expects. Craig's call: the **full** rebalance.

**Builds on:** [`worldwide-content-recon.md`](worldwide-content-recon.md)
(established **frame-light** + the endemic resolutions + B1/Desert), the
[accessibility audit](accessibility-content-recon.md) (the iconic-fauna gap + the
homograph traps), and the [gameplay-arc review](gameplay-arc-review-recon.md) (the
"system-dynamics teaching is implicit" gap — which the iconic predator-prey biomes
directly answer).

---

## ⚠️ THE PRINCIPLE THIS RECON HOLDS (the line)

**Real animals live in real PLACES, together.** The honest forms:
- **(a)** a biome = a **specific real place** with its **real co-occurring** fauna;
- **(b)** new biomes = **new real places**.

**The forbidden form (the blender):** piling non-co-occurring worldwide species
into one generic biome — *ecological falseness* (the chocolate-broccoli the game
avoids, breaking P2/P3). **Every proposal below is checked against this:** each
biome's cast is real species that genuinely co-occur in **one** real place.

---

## TL;DR — the design

1. **CAUSE: the existing 14 biomes are ALREADY honest real ecosystems** — real
   **co-occurring** Eurasian (+ ~15 cosmopolitan) species. The Pine Forest's
   crossbill + tits + capercaillie + marten *do* co-occur in a real boreal forest;
   the Meadow's mouse + rabbit + quail + hedgehog *do* co-occur in a real European
   meadow. **They are not a blender — they're real European places that just aren't
   labeled "European."**
2. **The key fork (#2) → STRONG REC: KEEP the existing biomes** (own them as their
   real region — Europe/Palearctic; **no species swaps**) **and add worldwide
   breadth via NEW biomes.** Swapping shipped, real, beloved, co-occurring fauna out
   for NA equivalents would *destroy* honest ecology to chase breadth — backwards.
   The clean, additive, honest path is **grow the world**, not rip it out. The only
   "reframe" the existing biomes need is the cheap **regional-cluster label** (+ the
   accessibility homograph glosses) — *naming* their real region, not changing it.
3. **The new biomes are the whole game (#3):** each a real place with real
   co-occurring **iconic** fauna. Priority by iconic-recognizability + teaching +
   diet-fit: **(1) African Savanna** (lion/zebra/giraffe — the world animals every
   kid names; the most *visible* food-web + migration), **(2) North American Forest**
   (the iconic-US-fauna fix — raccoon/fox/chipmunk/deer/black bear; teaches
   biogeography), **(3) NA Wetland / beaver pond** (beaver the ecosystem-engineer),
   **(4) Arctic Tundra** (polar bear/Arctic fox — the cold bookend to the Desert),
   **(5) Tropical Rainforest** (biodiversity; heavier art).
4. **The ONE real new-mechanic flag:** the iconic apex **predators** (lion, cheetah,
   jaguar, polar bear, wolf) eat large prey — which the **5 proven diets**
   (seeds/greens/insects/fish/shellfish) don't cover. → Ship each new biome's iconic
   **herbivore/insectivore/omnivore** cast first (proven diets, zero new mechanic —
   already richly iconic: zebra/giraffe/elephant; raccoon/deer/squirrel), and
   **flag a 6th "meat" diet** as the decision that unlocks the apex predators across
   *all* predator biomes at once. *(A lion can't honestly eat "insects" — so unlike
   the kit fox/roadrunner small-prey proxy, the big cats genuinely need the new diet
   or deferral.)*
5. **Frame-light + the catch core stay sacred (CAUSE):** every new biome is the
   **proven data-slice** (a new `BiomeDef` cell + a `prereq` fork + species rows +
   missions + a reseed). Single-biome model, the catch formula, the topology — all
   untouched. (The meat diet, *if* chosen, is the one additive mechanic — a 6th
   `BaitId`, the proven shellfish-bait pattern.)
6. **It slices ONE biome per PR** (the Desert template) — tractable, each shippable,
   ordered by value.

---

## 1. The roster mapped by real biogeographic range (CAUSE)

Classified all 62 current species (the Desert's 7 NA species, PR #160, would add to
the Nearctic column). **The pattern: ~15 genuinely cosmopolitan, ~47 Eurasian.**

### Genuinely Holarctic / cosmopolitan — honest *anywhere* (15)
Mallard · Rock Ptarmigan · Brent Goose (Brant) · Ruddy Turnstone · Herring Gull ·
Grey Seal · Red Crossbill · Dunlin · Red Knot · Snow Bunting · Northern Wheatear ·
Bar-tailed Godwit · Grey Plover (= Black-bellied Plover, US) · Pintail · Sanderling.
→ **These are honest in the existing biomes *and* would be honest in a NA biome** —
they're the natural "bridge" species (a NA forest could share the cosmopolitan
mallard with the European wetland without lying).

### Widespread Eurasian / Palearctic — real, but Old-World-specific (~47)
The rest — Field Mouse, Rabbit, Quail, Hedgehog (no hedgehogs in the Americas),
Red Squirrel, **European Robin** (≠ American Robin — a homograph), **European
Badger**, Roe Deer, Common Frog, Reed Bunting, Water Vole, Grey Wagtail, Common
Kingfisher, Eurasian Otter, Linnet, Twite, Stonechat, Curlew, Red Deer (≈ NA elk),
Coal/Crested **Tit** (US ≈ chickadee/titmouse), Capercaillie, Pine Marten, 4× bats,
European Eel (shares the Sargasso story with the American Eel), Oystercatcher,
Redshank, Avocet, Meadow Pipit, Golden Plover, Ring Ouzel, Bank/Harvest mouse,
Yellowhammer, Whitethroat, Hazel Dormouse, Blackcap, Wigeon, Shelduck, Ringed
Plover, Red Grouse (the British form of the Holarctic willow ptarmigan).

### The CAUSE that drives everything
**Each existing biome's cast is real species that co-occur in a real European/
Palearctic place.** They are honest ecology *now* — just unlabeled. So the rebalance
is **additive** (add real new places), not **corrective** (the existing isn't wrong).

> **Per-biome note:** every biome is a coherent real co-occurring set (e.g. Pine
> Forest = a real boreal/Caledonian forest cast; Hedgerow = a real farmland-edge
> cast; Estuary = a real tidal-flyway cast). None is a blender today. The cosmopolitan
> species (mallard, the waders/shorebirds, the ptarmigan) are the ones honest in
> *multiple* regions — useful as shared bridges, not requiring change.

---

## 2. The existing-biome reframe — the keep-vs-swap fork (#2, the honest-vs-blender crux)

For each existing biome, three options:
- **(a) SPECIFY-AND-SWAP** to a new region — e.g. Woodland → an Eastern-NA forest,
  *swapping out* the European robin/badger/squirrel for raccoon/fox/chipmunk.
- **(b) KEEP as its real region** (own it as Europe/Palearctic) + add the NA version
  as a **new** biome.
- **(c) ALREADY honest-generic** (cosmopolitan-only) — no reframe.

| Existing biome | Real region of its cast | Verdict |
|---|---|---|
| Meadow, Woodland, Hedgerow, Hazel Copse, Heath | Eurasian-specific co-occurring fauna | **(b) KEEP as European** |
| Wetland, Riverbank | mostly Eurasian (mallard cosmopolitan) | **(b) KEEP** |
| Highlands, Alpine, Pine Forest | Eurasian montane/boreal (+ cosmopolitan ptarmigan/bunting) | **(b) KEEP** |
| Coast, Saltmarsh, Estuary | **mostly cosmopolitan** shorebirds/seabirds | **(c) ALREADY honest-generic** (or lightly label) |

### ⚠️ THE FORK FOR CRAIG — and a STRONG recommendation
- **Path A (SWAP existing → new regions):** changes shipped content; **rips out real,
  beloved, honest co-occurring European fauna** to chase breadth; re-opens every
  co-occurrence decision; risks the blender if done carelessly. **Not recommended.**
- **Path B (KEEP existing as their real region + ADD new regions as new biomes):**
  additive, low-churn, **preserves the honest European ecology already shipped**,
  and delivers worldwide breadth + the iconic fauna **cleanly** via new real places.
  **STRONGLY RECOMMENDED.** ⭐

**The only "reframe" Path B needs (cheap, honest, accessibility-aligned):**
1. **Regional-cluster labels** (the prior recon's optional layer) — name each biome's
   real region: the existing 14 = *Europe / temperate Eurasia*; the new ones =
   *Africa / North America / the Arctic / the Neotropics*. This makes the
   worldwide-ness **explicit and honest** (each biome's region is named) **without a
   single species swap.** A `region` field + journal grouping — pure data.
2. **The homograph glosses** (S4.9): the **European Robin** gets *"a small European
   bird — not the American Robin you know, but a cousin"*; the **Tits** → note the
   chickadee/titmouse kinship; the **Badger** → European vs American. Turns the
   confusion the audit flagged into a **biogeography lesson** ("same name, different
   bird, different continent").

> **Net (#2):** **KEEP every existing biome and species** (they're real, co-occurring,
> honest European ecology); add the *region label* + the *homograph glosses*; deliver
> worldwide via **new biomes**. Zero blender, zero rip-out. *Path A is the fork to
> reject — present it, recommend against it.*

---

## 3. The new worldwide biomes (#3) — real places, real co-occurring iconic fauna

Each is **one real place** with **real co-occurring** fauna, **iconic/recognizable**
to a US kid (S4.9), teaching something **new**, on the **proven frame-light slice**.
*(Fauna lists are illustrative-but-honest — each set genuinely co-occurs in the named
place. Final rosters tune to ~5–8, single-biome, the proven valve/apex shape.)*

### ⭐ (1) African Savanna (the Serengeti / East-African grassland) — HIGHEST VALUE
- **Real co-occurring fauna:** zebra, wildebeest, giraffe, African elephant,
  Thomson's gazelle, ostrich, warthog · **+ predators:** lion, cheetah, spotted
  hyena (the meat-diet flag, §4-mech).
- **Teaching hook (NEW):** the great **grazing herds + the most visible food web on
  Earth** (lion hunts zebra — predator-prey *seen*) **+ the great migration** (pairs
  with the estuary's migration theme; the dynamic-ecosystem lesson the arc-review
  wanted). This is the single best answer to "make interconnection explicit."
- **Diets:** herbivores → **greens** (zebra/giraffe/elephant/gazelle/wildebeest),
  insect/omnivore → **insects** (ostrich, warthog). The **lion/cheetah/hyena need the
  6th "meat" diet** (§4-mech) — ship the herbivore cast first, predators with the meat
  diet.
- **Iconic-recognizability: MAXIMUM** (lion/zebra/giraffe = the world animals every
  kid names). **Frame-light:** a normal new cell. **Art:** open grassland (easy,
  like the estuary/desert) + big-silhouette herbivores.

### ⭐ (2) North American Forest (Eastern US / Appalachian deciduous) — THE US-FAUNA FIX (#4)
- **Real co-occurring fauna:** raccoon, Virginia opossum, white-tailed deer, eastern
  gray squirrel, eastern chipmunk, red fox, American robin, blue jay, wild turkey,
  black bear.
- **Teaching hook (NEW):** **biogeography** — the *same habitat type* as the
  (European) Woodland, a *different continent's cast*. Directly teaches "same biome,
  different place, different animals," and **resolves the robin homograph by
  contrast** (here's the *American* robin).
- **Diets — fits the proven 5:** seeds (gray squirrel, chipmunk, blue jay, turkey),
  greens (white-tailed deer, black bear-omnivore), insects (robin, opossum), fish/
  small-prey (raccoon → 'fish'/'insects', the proven small-prey proxy; red fox →
  'insects', like the existing kit fox). **No new diet needed.**
- **Iconic-US: lands the audit's gap** (raccoon, fox, chipmunk, deer, black bear,
  the American robin). **Frame-light:** a sibling to the Woodland (a natural
  regional-cluster pairing — "the woodland, in North America").

### (3) North American Wetland / Beaver Pond (NA freshwater marsh)
- **Real co-occurring fauna:** American beaver, muskrat, North American river otter,
  painted turtle, great blue heron, red-winged blackbird, American bullfrog, wood duck.
- **Teaching hook (NEW):** the **beaver as ecosystem engineer / keystone species** —
  it *builds* the wetland that the others depend on (the clearest "interconnection"
  lesson; pairs with the hedgerow's connectivity).
- **Diets — fits the proven 5:** greens (beaver, muskrat), insects (blackbird,
  bullfrog), fish (heron, otter), greens (wood duck). **No new diet.**
- **Iconic-US:** beaver (very iconic), heron, turtle, otter.

### (4) Arctic Tundra (NA / Eurasian high Arctic)
- **Real co-occurring fauna:** caribou/reindeer, Arctic fox, snowy owl, lemming,
  musk ox, Arctic hare · **+ polar bear** (coastal — the meat-diet flag).
- **Teaching hook (NEW):** **extreme cold adaptation** — the bookend to the Desert's
  heat adaptation (the two climate extremes; reuses the snow/seasonal systems).
- **Diets:** greens (caribou, musk ox, hare, lemming), the small predators (Arctic
  fox/snowy owl → 'insects' small-prey proxy). Polar bear → the meat diet.
- **Iconic:** polar bear, Arctic fox, snowy owl, caribou. *(Distinct from the existing
  Alpine: a flat polar tundra vs. a rocky summit; honest, not a dupe.)*

### (5) Tropical Rainforest (Amazon / Neotropical) — later
- **Real co-occurring fauna:** capybara, three-toed sloth, howler monkey, toucan,
  scarlet macaw, giant anteater, poison dart frog · **+ jaguar** (meat flag).
- **Teaching hook (NEW):** **vertical layering** (canopy vs floor) + the **highest
  biodiversity**. **Iconic:** toucan, sloth, monkey, jaguar.
- **Lower priority:** heavier art (dense, layered — the pine/hedgerow legibility
  problem) + the predator-diet issue. A great *later* slice.

> **Co-occurrence check (the sacred line) — PASSED:** every cast above is real
> species of **one** real place (Serengeti / Eastern-US forest / NA marsh / Arctic
> tundra / Amazon). No blender. Where a tempting species is from a *different* real
> place (e.g. the meerkat is Kalahari, not Serengeti — so it'd seed a *separate*
> southern-Africa biome, not pad the savanna), it's **excluded** to keep each biome
> honest.

---

## 4. The iconic-US-fauna gap (#4 — the audit's headline) + the diet mechanic

- **The fix:** the **NA Forest (#3.2)** + the **NA Wetland (#3.3)** + the shipped
  **Desert** (#160) land the iconic US animals honestly — raccoon, red fox, eastern
  chipmunk, white-tailed deer, gray squirrel, black bear, American robin, blue jay,
  wild turkey, **beaver**, heron, river otter, painted turtle (+ the Desert's kangaroo
  rat, roadrunner, kit fox, desert tortoise). **Via real NA biomes — never faked into
  a Eurasian one.**
- **⚠️ The one new-mechanic decision — a 6th "meat"/"prey" diet (BaitId):** the
  proven 5 diets can't honestly feed the apex **predators** (lion, cheetah, jaguar,
  polar bear, wolf). Unlike the kit fox/roadrunner (small prey → honestly maps to
  'insects'), **a lion cannot eat "insects"** — the big cats need a real meat diet or
  deferral. **Two paths (Craig's call):**
  - **(A) Ship a 6th `BaitId` ('meat')** — the proven shellfish-bait pattern (a new
    bait, research-gated, never required). Unlocks the apex predators across *all*
    predator biomes at once. The one additive mechanic in the whole arc.
  - **(B) Herbivore-first** — each new biome ships its iconic herbivore/omnivore cast
    (proven diets); the apex predators wait for the meat diet. The savanna is still
    richly iconic without the lion (zebra/giraffe/elephant) — but "a savanna with no
    lion" is the cost. **Rec: decide the meat diet up front** (it's load-bearing for
    the savanna's icon); if yes, it slices *with* the savanna.

---

## 5. Accessibility integration (#5, tie to S4.9-A)

The new fauna serves **both** goals at once — that's the win:
- **Iconic-by-design:** the new species are the *recognizable* ones the audit wanted
  (lion, zebra, raccoon, beaver, polar bear) — accessibility delivered by *content
  choice*, not just copy.
- **Define-in-place glosses** travel with each new biome (the S4.9-A discipline): a
  one-line "what is a {biome}?" (savanna / tundra / rainforest are all US-curriculum
  biome words — they *define well*), the lead-with-category for any less-familiar
  species, and **US size comparisons** (giraffe "as tall as a two-story house,"
  prairie dog "the size of a squirrel").
- **The homograph glosses** (§2) are the bridge: the NA Forest's *American* robin next
  to the Woodland's *European* robin makes the biogeography legible.
- **The region labels** (§2) make "around the world" explicit for a kid — the journal
  reads as a world tour of real places.

> **"Worldwide + accessible" are the same move here:** real iconic fauna in named real
> regions, glossed in place.

---

## 6. The incremental slice sequence (#6 — making the big arc tractable)

**ONE biome (or one reframe) per slice — the proven Desert/frame-light data-slice +
reseed. Never a mega-rewrite.** Ordered by value (iconic + the US-gap + teaching):

| Slice | What | Why this order | New mechanic? |
|---|---|---|---|
| **R0** | **Region labels + homograph glosses** (the existing-biome reframe, §2) | cheap, honest, makes everything that follows legible; **no species touched** | none (a `region` field + copy) |
| **R1** | **African Savanna** (herbivore cast) | **max iconic value** + the food-web/migration teaching | none (proven diets) — *unless the meat diet ships here* |
| **R1.5** *(decision)* | **The 6th "meat" diet** + the savanna's lion/cheetah | unlocks every apex predator arc-wide | **yes** (one 6th `BaitId`) |
| **R2** | **North American Forest** | **the iconic-US-fauna fix** + biogeography teaching | none |
| **R3** | **NA Wetland / beaver pond** | more US fauna + the keystone/engineer lesson | none |
| **R4** | **Arctic Tundra** | the cold bookend to the Desert | meat (polar bear) or herbivore-first |
| **R5** | **Tropical Rainforest** | biodiversity; **heavier art → last** | meat (jaguar) or defer |

- **Each slice (R1+):** real co-occurring fauna · single-biome · proven diets (or the
  flagged meat) · the proven `BiomeDef` cell + `prereq` fork + missions · **catch core
  sacred · frame-light (zero structural change) · a reseed on render** (the known
  rhythm). **Reseed only when a biome renders** (R0 is copy/data → no reseed).
- **The Desert (PR #160)** is R1-precedent already in flight — its `BIOME_TIME_POP`
  lever + NA fauna proved the pattern.

---

## 7. The decisions for Craig + the sacred guardrails (#7)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **(i)** | **Existing-biome fate** (the crux fork, §2) | **KEEP** as European + add new regions · SWAP existing → new regions | **KEEP** ⭐ — additive, honest, preserves shipped real ecology; reframe = region labels + glosses only |
| **(ii)** | **The meat diet** (§4) | ship a 6th `BaitId` · herbivore-first/defer predators | **Decide up front** — it's load-bearing for the savanna's lion (the iconic draw) |
| **(iii)** | **Which new biomes + order** (§3/§6) | savanna · NA forest · NA wetland · tundra · rainforest | **Savanna first** (max iconic) **or NA-forest first** (the US-gap) — your pick; rainforest last (art) |
| **(iv)** | **Region-cluster labels** (§2/§5) | add `region` labels · stay implicit | **Add** — cheap, makes worldwide explicit + honest (and aids the kid "world tour") |
| **(v)** | **How far** | a couple of marquee biomes · the whole 5+ arc | **Slice it** (§6) — ship R0 + R1, then reassess; it's a long, additive runway |

### Sacred (confirmed CAUSE)
- **Real co-occurring ecology** — every biome = one real place's real co-occurring
  fauna (the blender stays forbidden). **Single-biome model** untouched (90 species,
  one `biome` each). **Catch core** untouched (`finalCatchChance` reads only species
  data). **Frame-light** — new biomes are the proven data-slice + a `prereq` fork
  (zero topology/clamp change). The **only** additive mechanic in the whole arc is the
  optional **6th "meat" diet** (the proven shellfish-bait pattern, never required).
- **Tests green** at recon time: `npm run build` ✓, **791/791 pass** (recon changed
  nothing).

---

*Design complete. The line held: real co-occurring ecology, no blender. The big arc
is **KEEP-existing + add real new places**, sliced one biome per PR, ordered by iconic
value + the US-fauna gap, with the 6th "meat" diet the one flagged decision. The forks
(§7) are Craig's. After the calls: R0 (labels/glosses) → R1 (savanna) → R2+ slice it.*
