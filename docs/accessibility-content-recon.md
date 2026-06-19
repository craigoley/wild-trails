# Accessibility Content Audit — Recon (player-facing content for a generic US audience + kids)

**Status:** AUDIT ONLY. **No content changed.** This flags player-facing strings
that would be **unfamiliar or inaccessible to a generic US player or kid**, and
suggests US-accessible framing — **while keeping the real worldwide ecology** (the
teaching, P2/P3).

**Craig's goal:** players (incl. **kids**) learn about **real biomes & animals from
around the world**, but in a **US-based context & wording**. So: keep the real
species/habitats; make the unfamiliar **accessible** (define-in-place, relatable
comparisons, US-curriculum vocab).

**Distinct from the de-Britishing (done, #154/#158):** that removed British
*identity*. This is about **accessibility** — is the (now-neutral) real worldwide
content *understandable* to a US kid who's never heard of a dotterel or a heath?

**The frame (US elementary/middle science):** the biome words US kids know are
**Desert, Forest, Grassland, Freshwater, Marine, Tundra, Rainforest, Savanna**.
Good kid-science **defines terms in-place** (introduce the word + a plain gloss),
uses **relatable comparisons**, and teaches that ecosystems are **dynamic and
interconnected** (a documented misconception: kids think ecosystems are static /
all species "get along" — Wild Trails teaches the opposite, and could say so more).

**The principle (held throughout):** *keep* the real animals/biomes (learning a
new real one is the win); make them **accessible** — **define-in-place is usually
better than renaming a real term away.**

> **Scope note (state of `main`):** this audits the **14-biome / 62-species**
> roster on `main`. The **Sonoran Desert** (PR #160, open) is the first
> non-Eurasian biome — its 7 American species (kangaroo rat, roadrunner, kit fox,
> desert tortoise…) are *not* yet counted below; they materially improve the
> regional balance (see §2) and already model the good patterns (relatable
> comparisons, define-in-place).

---

## TL;DR — the shape of it

- **The copy is GOOD naturalist prose** — but pitched **upper-elementary-to-middle**,
  and it **assumes you already know the animals** for the unfamiliar ones. The
  *best* lines already use the right pattern (relatable comparisons:
  *"a turkey-sized grouse," "a cat-sized climber," "the mountain blackbird," "the
  only songbird that swims"*). The fix is to **extend that pattern**, not rewrite.
- **The biggest finding is the ROSTER, not the wording (a Layer-B input).** The 62
  species are **~100% Eurasian/Palearctic** — and **none** of the iconic US animals
  a kid expects are present (**fox, owl, raccoon, coyote, eagle, chipmunk, skunk =
  0**). "Around the world" is currently "one region." The Desert PR is the first
  step out.
- **Three biome names are genuinely unfamiliar to US kids:** **Heath**, **Hedgerow**,
  **Hazel Copse** (a few more are real-but-define-able: Highlands, Alpine Summit,
  Saltmarsh, Estuary). **No biome gets any in-place definition today** — just a
  display name.
- **One UK vocab term is pervasive: "wader" (×56)** — the US word is **"shorebird."**
- **Units are a non-issue** — there is **no metric (or any) measurement** in the
  copy (only *"a small coin"*). The opportunity is the *opposite*: **add** relatable
  US size comparisons (currently only ~5 exist).
- **One British vernacular straggler:** the onboarding *"An animal is about!"*
  (= nearby) — a de-Britishing miss + a kid-clarity snag.
- **The judgment calls are Craig's:** rename-vs-define the habitat names; the
  reading-level target; whether to add size comparisons; the roster rebalance.

---

## 1. Unfamiliar habitat / biome names

Biome `displayName`s render to the player (journal card *"Habitat: {name}"* + the
mission/route copy). **None has an in-place definition.** Per the US-kid biome
frame (Desert/Forest/Grassland/Freshwater/Marine/Tundra/Rainforest):

| Biome (`displayName`) | US-kid familiarity | Maps to | **Recommendation** |
|---|---|---|---|
| **Meadow** (`constants.ts:351`) | familiar | Grassland | **KEEP** (could note "a kind of grassland") |
| **Woodland** (360) | familiar | Forest | **KEEP** |
| **Wetland** (370) | **familiar — a taught biome** | Freshwater | **KEEP** |
| **Riverbank** (397) | familiar | Freshwater | **KEEP** |
| **Coast** (412) | familiar | Marine | **KEEP** |
| **Pine Forest** (440) | familiar | Forest | **KEEP** |
| **Cave** (455) | familiar | — | **KEEP** |
| **Highlands** (380) | UK-coded (Scottish echo); partly known | Mountains | **DEFINE-IN-PLACE** — "the high, open mountain country" (or rename → *Mountains*) |
| **Heath** (426) | ⚠️ **unfamiliar** — reads as a *name* to a US kid, or unknown | Shrubland | ⚠️ **FLAG (rename vs define)** — rename → *Shrubland*/*Scrubland* (US-curriculum-adjacent), **or** keep + define ("open ground of low, tough shrubs like heather") |
| **Saltmarsh** (469) | partly (coastal wetland) | Wetland/Marine | **DEFINE** — "a coastal marsh flooded by the tides" (consider spacing → *Salt Marsh*) |
| **Alpine Summit** (485) | "alpine" semi-known | Tundra/Mountains | **DEFINE-IN-PLACE** — "alpine: the cold, treeless tops of high mountains" (it's *alpine tundra* — a real curriculum tie) |
| **Hedgerow** (501) | ⚠️ **unfamiliar** (British farmland feature; US ≈ *fencerow*) | — | **DEFINE-IN-PLACE** (strongly) — "a long line of bushes and small trees between fields — a wildlife highway." *The hedgerow's whole lesson IS this corridor concept, so defining it teaches the point.* |
| **Hazel Copse** (516) | ⚠️ **unfamiliar** ("copse" = small woods; "hazel" = a nut tree) | Forest | ⚠️ **FLAG (rename vs define)** — define ("a copse: a small patch of trees") **or** rename → *Hazel Wood* / *Small Wood* |
| **Estuary** (532) | **US-curriculum term** (taught) | Marine/Freshwater | **KEEP + DEFINE** — "where a river meets the sea" |

> **The pattern:** the unfamiliar names are **real, teachable terms** — so the
> default is **define-in-place** (a one-line habitat gloss on entry / in the journal
> card), *not* renaming a real word away. The two to genuinely consider **renaming**
> (because they read as opaque to a US kid even with a gloss) are **Heath** and
> **Hazel Copse** — Craig's call. **There is no biome-description field today** —
> adding one (a single sentence per biome) is the highest-leverage accessibility win.

---

## 2. Unfamiliar animals + the regional-balance roster note

### 2a. Are the unfamiliar animals introduced accessibly?
Most `fieldNote`s **do** lead with a niche, and the **best** ones give a *relatable
category or comparison* — keep these as the model:

| Species | The good pattern (KEEP / extend) |
|---|---|
| Capercaillie (`constants.ts:1163`) | *"a **turkey-sized grouse**"* — ✅ perfect relatable size |
| Pine Marten (1170) | *"a **cat-sized climber** of the pines"* — ✅ |
| Ring Ouzel (1281) | *"the **mountain blackbird**"* — ✅ relatable analogue |
| Dipper (1048/1050) | *"the **only songbird that swims**"* — ✅ vivid + self-explaining |
| Twite (1106) | *"the **moorland linnet** — a **small upland finch**"* — ✅ gives the category |

**The weaker ones assume you know the animal type** (give the *niche* but not
*"what kind of animal it is"*) — **recommend: KEEP the species, add a one-clause
gloss** (the species is the teaching; just introduce it):

| Species | String (excerpt) | Why hard for a US kid | Suggested gloss (DEFINE — keep the animal) |
|---|---|---|---|
| Dotterel (`1020`) | *"the dotterel picks insects… on the very roof of the hills"* | no idea what a dotterel *is* | "a tame little **mountain plover** (a round, short-billed shorebird)…" |
| Bar-tailed Godwit (`1335`) | *"A long, slightly up-tilted bill probes the open mud…"* | "godwit"? "wader"? | "a tall, long-legged **shorebird** with a long bill…" |
| Grey Wagtail (`1041`) | *"the grey wagtail snaps up insects along stony river edges"* | "wagtail"? | "a slim, **long-tailed songbird** that bobs its tail…" |
| Rock Ptarmigan (`1006`) | *"the rock ptarmigan picks at shoots…"* | "ptarmigan"? | "a **grouse of the cold peaks** that turns white in winter…" |
| Dunlin / Knot / Redshank / Sanderling / Turnstone (tidal/estuary) | *"a … wader…"* | "wader" (UK) + obscure names | lead with **"shorebird"** + a size/feature tag |
| Stonechat / Whitethroat / Blackcap / Linnet / Yellowhammer / Reed Bunting | small brown/colored birds | obscure names | "a small **songbird**…" up front (several already do) |

> **Recommendation (#2): KEEP every real animal** (learning a new real one is the
> goal) — this is **DEFINE-IN-PLACE**, not roster-cutting. The cheap, high-value fix
> is a **lead-with-the-category** pass: open each unfamiliar species with *"a small
> songbird / a shorebird / a wild duck / a grouse…"* (and a size comparison where it
> lands). The copy **already does this well in ~8 places** — extend it to all.

### 2b. ⚠️ The roster over-indexes on ONE region (a Layer-B input — the biggest finding)
The 62 species are **~100% Eurasian/Palearctic** (British-familiar birds + small
mammals). Verified gaps for a US kid:

- **Iconic US animals a kid expects = 0:** **fox, owl, raccoon, coyote, eagle,
  chipmunk, skunk** — none present. (Deer is present as Roe/Red Deer.)
- **Other continents = 0:** nothing from **Africa, Asia, South America, Australia**
  — so "around the world" is currently **one region**.
- Several names are **near-homographs that mislead** a US kid: **"Robin"** (the
  in-game European Robin is a *different, smaller bird* than the American Robin),
  **"Tit"** (Coal/Crested Tit — the US family is *chickadee/titmouse*; also reads
  awkwardly to kids/parents), **"Badger"** (European vs American badger).

> **Recommendation: ROSTER-INPUT for Layer B.** The de-Britishing fixed the
> *framing*; the *animals* are still one region. To deliver "around the world,"
> the worldwide-biome arc (the Desert is step 1) should deliberately **spread across
> continents** *and* **include the familiar US animals** kids expect (a fox, an owl,
> a raccoon) as real species of real US habitats. **Not a copy fix — a roster/
> content-design decision for Craig.** Flag the *"Robin"/"Tit"* homograph confusion
> as a copy note (a one-line *"(not the American robin — a smaller European cousin)"*
> gloss would turn the confusion into a teaching moment).

---

## 3. Unfamiliar vocabulary / reading level

Ecology/naturalist terms used **without a gloss**. Per the principle, **define-in-place**
(introduce the word + a plain meaning) — learning *"nocturnal"/"crepuscular"* is
**good** *if defined*. Don't strip the real term.

| Term | Where (examples) | Read | **Recommendation** |
|---|---|---|---|
| **"wader" (×56)** | every tidal/estuary/coast bird | UK term — US kids/birders say **"shorebird"** | **RENAME → "shorebird"** (the single highest-frequency vocab fix) |
| **lek** | `constants.ts:1165` (capercaillie) *"his spring lek"* | undefined; obscure | **DEFINE** — "his spring **lek** (a display ground where males show off)" |
| **gorget** | `1283` (ring ouzel) *"a pale gorget"* | bird-anatomy term | **DEFINE or simplify** — "a pale **throat patch**" |
| **hawking** | `1201, 1895` *"hawking beetles and moths"* | unfamiliar verb | **gloss** — "**hawking** (catching insects in mid-air)" or "snatching insects from the air" |
| **gleaning** | `1297, 2002` | mildly advanced | gloss or "**picking** seeds/insects" |
| **dabbling / up-end** | mallard/wigeon/pintail (`994, 1351, 1356`) | duck-feeding jargon | "**dabbling** (tipping head-down to feed)" — already partly shown |
| **drake** | ducks | = male duck | "the **drake** (the male)…" (often clear from context) |
| **sett / drey / holt / form / covey** | badger `980`, etc. | animal-home words | gloss on first use ("a **sett** — the badger's burrow") — `980` already does this well |
| **insectivore / piscivore / granivore** | several fieldNotes | curriculum-adjacent | **mostly KEEP** (taught vocab) — optional gloss for the youngest |

> **Reading level:** the prose is **upper-elementary-to-middle** — em-dash-heavy,
> compound sentences, rich vocabulary. It's *good* writing, but **dense for a young
> reader**. ⚠️ **JUDGMENT CALL for Craig: pick a target grade.** If ~upper-elementary
> is the floor, a light **REWRITE-FOR-ACCESSIBILITY** pass (shorter sentences, the
> define-in-place glosses above) on the densest lines would help — **without losing
> the naturalist voice or the real facts.** Positive note: *"crepuscular"* in the
> mission copy (`4207`: *"The **crepuscular** crowd comes out at **dusk**"*) is a
> **model define-in-place** — the word + its gloss in one breath. Replicate that.

---

## 4. Unfamiliar cultural / unit references

- **Units — a NON-ISSUE (verified).** There is **no metric** (and essentially **no**
  measurement) anywhere in player copy — the *"2p coin"* was already neutralized to
  *"a small coin"* (`constants.ts:2359`). **So there's no metric-vs-imperial problem
  to solve.** ⚠️ **The opportunity is the inverse (flag for Craig):** US kids learn
  through **concrete size comparisons**, and the copy has only **~5** (*turkey-sized,
  cat-sized…*). **Adding** relatable US comparisons (*"the size of a robin / a house
  cat / a football"*) is a teaching *win*, not a units conversion. (If Craig ever
  wants real measurements, **imperial** is the US-curriculum default — his call.)
- **British vernacular straggler:** onboarding **`constants.ts:5056`** — *"An animal
  is **about**! Move closer to it."* "about" = British "nearby." → **"An animal is
  **nearby**!"** (a de-Britishing miss *and* a clarity issue for a US kid). **RENAME.**
- **Homograph cultural confusion** (see §2b): **"Robin," "Tit," "Badger"** mean
  *different* animals to a US kid — a one-line gloss turns the trap into a lesson.
- No other non-US cultural references found (the *Wind in the Willows* ref was
  already dropped in the de-Britishing).

---

## 5. The positive opportunity (lean into the teaching)

Not just flagging — where the copy can **actively teach a US kid**:

1. **Extend the relatable-comparison pattern (it already works).** *"a turkey-sized
   grouse," "a cat-sized climber," "the mountain blackbird," "the only songbird that
   swims"* are the best lines in the game. **Make every unfamiliar species open this
   way** (a category + a size/feature a kid knows). Highest-value, on-voice win.
2. **Define-in-place glosses** (the good-kid-science pattern): biome names (§1),
   jargon (§3), and the homograph animals (§2b). Each turns an *"I don't know what
   that is"* into a learned fact — the **define-the-word-then-gloss-it** move
   (`crepuscular → "comes out at dusk"` is the model).
3. **Make the ecosystem DYNAMIC + interconnected (the researched misconception).**
   Kids think ecosystems are static / all species "get along." Wild Trails already
   teaches the *opposite* via the honest conservation `status` lines (decline,
   recovery, threats) — **a real strength**. The copy could go further by making the
   **web** explicit: who eats whom, who competes, who *depends* on whom. Examples:
   - The bait = diet system already teaches *what-eats-what* — the copy could name
     the **predators/prey** ("hunted by the fox," "the kit fox lives on kangaroo rats").
   - **Keystone/connectivity moments are gold:** the hedgerow's *corridor* lesson;
     the desert tortoise *"digs burrows that shelter dozens of other creatures"*
     (#160) — these teach **interconnection**. Surface more of them.
   - Recovery/decline lines already model **"ecosystems change"** — keep + label the
     *cause* (habitat loss, a returning predator) so the dynamism reads as a *system*.
4. **"Learning a real new animal/biome" is the product's superpower** — frame it as
   such. A short, kid-facing **"what is a {biome}?"** line on first entry would make
   the whole world legible *and* feel like a nature guide (which it is).

---

## 6. Scope, recommendations & the slice plan

### Every finding categorized
| Category | Findings | Default rec |
|---|---|---|
| **(a) RENAME** (swap for a US-familiar term) | **"wader" → "shorebird"** (×56); onboarding **"is about" → "nearby"**; *possibly* **Heath**, **Hazel Copse** (Craig's call) | low-risk mechanical (wader/is-about); habitat renames are judgment calls |
| **(b) DEFINE-IN-PLACE** (keep the real term + a gloss — *the preferred move*) | biome names (Heath/Hedgerow/Copse/Highlands/Alpine/Saltmarsh/Estuary); jargon (lek/gorget/hawking/gleaning/dabbling/sett); the homograph animals (Robin/Tit/Badger); lead-with-category on unfamiliar species | the bulk of the work; **needs a biome-description field** (none exists today) |
| **(c) REWRITE-FOR-ACCESSIBILITY** (too dense) | the densest fieldNotes/behaviour lines — shorten, gloss, add comparisons | light touch; **keep the voice + facts** |
| **(d) ROSTER-INPUT** (over-indexes on one region) | the ~100% Eurasian roster; **zero** iconic US animals (fox/owl/raccoon…); **zero** from Africa/Asia/S.America/Australia | **Layer-B content design** — not a copy fix |

### ⚠️ Judgment calls flagged for Craig
1. **Habitat names — rename vs. define?** Default define-in-place; but **Heath** and
   **Hazel Copse** may warrant renaming (opaque even with a gloss). Your call per name.
2. **Reading-level target.** Pick a floor grade (~upper-elementary?) — it sets how
   far the (c) rewrite goes.
3. **Size comparisons.** Add relatable US size refs (robin/house-cat/football)? (No
   units problem to fix — this is additive teaching.) Imperial if you ever want real
   measures.
4. **The roster rebalance (the big one).** How far/fast to spread the species across
   continents *and* add the familiar US animals kids expect — a Layer-B arc.

### Proposed slices (after Craig's calls)
- **C1 — mechanical accessibility (low-risk):** *"wader" → "shorebird"* (×56),
  onboarding *"is about" → "nearby"*. Copy-only, mechanical, ship first.
- **C2 — define-in-place (the core):** add a **biome-description field** (one
  kid-facing sentence per biome, shown on entry/in the journal) + the jargon glosses
  + the homograph glosses + lead-with-category on unfamiliar species. The
  highest-value accessibility work; **keeps every real term + animal.**
- **C3 — readability polish:** the (c) rewrite on the densest lines, to the chosen
  grade, preserving voice + facts. Add the relatable size comparisons.
- **(Layer B) — roster rebalance:** the around-the-world species spread (the Desert
  is step 1) — its own content arc, Craig-directed.

### Confirmations
- **Copy/display only** — every finding is a player-visible **string** (`displayName`,
  `fieldNote`/`behaviour`/`status`, mission/onboarding text) or a proposed new
  **description field**. **No gameplay / catch / spawn / biome-logic** is implicated.
- **Audit changed nothing** — `git status` is clean; this doc is the only artifact.
- **Tests green** at audit time: `npm run build` ✓, **791/791 pass**.

---

*Audit complete. The principle held: keep the real worldwide ecology, make it
accessible (define-in-place over removing real terms). The judgment calls (units,
rename-vs-define, reading level, the roster rebalance) are Craig's. After his calls:
C1 (mechanical) → C2 (define-in-place) → C3 (readability), with the roster spread as
a Layer-B arc.*
