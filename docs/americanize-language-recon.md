# Americanize Language — Recon / Audit (Layer A, recon only)

**Status:** RECON ONLY. No copy changed in this pass. This doc scopes the
US-English pass precisely so the implementation slices can land safely.

**Scope (per PLAN.md S4.8):** the game accumulated an accidental **British/UK
identity** from UK-sourced wildlife research. Craig is US-based and never asked
for Britain. This audit covers **Layer A — language & framing** of
**player-visible copy** only. It is **NOT** Layer B (the worldwide-content
reshape — swapping the species roster / biomes), which is a later design arc.

**What's in scope:** text the **player reads** — rendered strings, labels,
status/description/behaviour copy, mission text, taglines.
**What's out of scope:** variable names, internal IDs, file names, code
comments (comments noted as low-priority only). Renaming an identifier like
`biome: 'moor'` is risky churn — only the *displayed* text matters. Where an
internal ID **leaks** to the player as a display name, it is flagged below.

---

## TL;DR — the shape of it

- **Almost all** the British surface lives in **one file**: `src/utils/constants.ts`
  (the `SPECIES_INFO` status/behaviour copy + the `SPECIES` description/profile
  copy + mission text). One stray label lives in `src/rendering/JournalPanel.ts`.
  Everything else (renderers, game modules, `index.html`, start screen) is clean.
- The work splits cleanly into **two slices of very different risk**:
  - **A1 — MECHANICAL spellings** (`behaviour→behavior`, `grey→gray`,
    `favour→favor`, `travelling→traveling`, etc.). Safe, near-mechanical. The
    real ecology is untouched — only orthography changes. **~40–45 strings.**
  - **A2 — CONTENT-LADEN framing** (the `Britain`/`British` identity assertions,
    the UK conservation-listing vocabulary, UK place/institution specificity).
    Needs careful rewrite to **keep the real ecological fact** while dropping the
    UK-specificity. **~36 strings carry `Britain`/`British` alone.**
- **The title card is already neutral** — `START_SCREEN.tagline` =
  *"Wander the wild, track its creatures, and fill your field guide."* No
  geographic claim. Good news: there is no top-level "this game is set in
  Britain" tagline to fix; the identity leaks are distributed through the
  teaching copy.
- **No measurement units** appear in player copy → the **metric-vs-imperial
  question is essentially moot** (one exception: a "2p coin" size comparison).
- **Two judgment calls for Craig** (don't blind-replace): (a) the **habitat
  display names** (`Moor`, `Hedgerow`, `Hazel Copse`) — real worldwide terms or
  UK-coded? (b) the **`grey`→`gray` in species common names** (`Grey Wagtail`,
  `Grey Seal`, `Grey Plover`) — orthography vs. species-naming convention.
- **Layer-A / Layer-B boundary:** several species are *literally* British
  endemics whose teaching fact IS the Britishness (Scottish Crossbill is
  "found nowhere else on Earth"; capercaillie "lost from Britain"). You cannot
  neutralize the framing without touching the species fact — those are **flagged
  as A/B-boundary** items to defer or handle with Craig, not auto-reframe.
- **Confirmed copy-only:** this is text + framing. **No gameplay, catch, spawn,
  detection, or economy logic is in scope** — every finding is a string value or
  a rendered label.

---

## 1. BRITISH SPELLINGS — *MECHANICAL (safe)*

These are pure orthography. The ecology/meaning is identical; only the spelling
changes. Safe to mechanize **in player strings** (skip comments/identifiers).

### 1a. `-our` → `-or`

| File:Line | String (excerpt) | Fix |
|---|---|---|
| `constants.ts:1016` | status: *"…cold winters **favour** their pale coat."* | favour → favor |
| `constants.ts:1093` | *"…it patrols the tideline and **harbours**…"* | harbours → harbors |
| `constants.ts:1533` | *"…snuffle for earthworms, their **favourite** food."* | favourite → favorite |
| `constants.ts:1648` | *"…the female who is brighter **coloured**…"* | coloured → colored |

> **Note — `behaviour` (the SPECIES_INFO field).** The interface key
> `behaviour: string` (`constants.ts:921`) is a **code identifier — OUT of
> scope** (don't rename; it's not read by the player). But it **leaks to the
> player as a label** in `JournalPanel.ts:163`:
> `<span class="card-label">Behaviour</span>` → render **"Behavior"**.
> That rendered label is the one player-visible `-our` outside constants.ts.
> Fixing the displayed label does **not** require renaming the field key.

### 1b. `grey` → `gray`  *(29 occurrences; mostly player-visible)*

Pervasive in descriptive copy — *"turns blue-**grey** then white"*,
*"a **grey** wader"*, *"long blue-**grey** legs"*, *"silver-**grey** plover"*
(e.g. `constants.ts:1015, 1041, 1098, 1101, 1239, 1246, 1269, 1327, 1342, 1706,
1854, 2204, 2222, 2468, 4528`). Descriptive uses are **safe mechanical**:
grey → gray.

> ⚠️ **JUDGMENT CALL (see §6):** `grey` also appears inside **species common
> names** — `Grey Wagtail` (`displayName` 1694), `Grey Seal` (1841),
> `Grey Plover` (2456). Those are proper-name conventions, not free prose.
> American checklists do write *Gray*, but the North-American name for *Grey
> Plover* is actually *Black-bellied Plover* — i.e. species naming has its own
> rules. **Flag the name-level greys for Craig; mechanize only the descriptive
> greys without a human sign-off.**

### 1c. doubled-`l` (`-lling`/`-lled`) → single-`l`

| File:Line | String (excerpt) | Fix |
|---|---|---|
| `constants.ts:934` | *"…**tunnelling** runways through the thatch."* | tunnelling → tunneling |
| `constants.ts:1801` | *"…**travelling** in loose chattering flocks…"* | travelling → traveling |
| `constants.ts:2412` | *"…**travelling** only along connected hedges."* | travelling → traveling |
| `constants.ts:4305` | *"…it **travelled** the hedge to this isolated copse…"* | travelled → traveled |

### 1d. other spellings checked — **none found in player copy**

Swept and **clean**: `-ise/-isation/-yse` verbs (realise/organise/analyse),
`-re` (centre/metre/fibre — the only `centre` hits are code comments at 2839,
3101, 3333), `whilst/amongst/learnt/spelt/towards`, `aluminium/tonne`,
`mould/plough/draught/defence/licence/practise/kerb/tyre/manoeuvre/sulphur/cosy`.
(`burnt-orange` at 1115 is standard US too — not a finding.)

**Slice A1 total: ~40–45 player strings**, concentrated in `constants.ts`
+ 1 label in `JournalPanel.ts`.

---

## 2. BRITISH VERNACULAR / PHRASING

Light. Most candidate words turned out to be standard English.

| File:Line | String (excerpt) | Read | Suggestion |
|---|---|---|---|
| `constants.ts:5056` (ONBOARDING) | *"An animal is **about**! Move closer to it."* | mildly British ("about" = nearby/around) | "An animal is **nearby**!" |
| `constants.ts:2359` | *"…weighing less than a **2p coin**…"* | UK currency size-ref | "less than a **nickel**" (US) or unit-free ("a few grams" / "a small coin") |

> **`rather` is NOT a finding.** Every occurrence (937, 950, 1196, 1451, …) is
> the standard *"runs rather than flies"* construction, not the British
> intensifier *"rather lovely."* Leave as-is.
>
> **Units question — effectively moot.** A unit sweep found **no
> metres/kilometres/miles/feet** in player copy. The only quantity comparison is
> the "2p coin" above. So there is **no metric-vs-imperial decision to make**
> beyond reskinning that one coin reference. (Flagged anyway in §6 for
> completeness.)

**Slice: small — 2 strings.** The "2p coin" is content-laden-ish (pick a US
referent); the onboarding "about" is mechanical.

---

## 3. UK INSTITUTIONAL / CONSERVATION FRAMING — *CONTENT-LADEN (careful)*

This is the **teaching copy** — it carries **real ecological facts that must
survive** the reframe. The pattern: drop the **UK-specific institution / listing
system**, keep the **conservation truth** (the species really is declining /
recovering / threatened).

### 3a. Named institutions — RSPB

| File:Line | String (excerpt) | Fact to keep | Neutral reframe |
|---|---|---|---|
| `constants.ts:1240` | *"…recovered so well it became the **RSPB's** own emblem."* | the avocet self-recovered from extinction | *"…recovered so well it became a symbol of conservation success."* |
| `constants.ts:2204` | *"…back from British extinction, the **RSPB's** emblem."* | same | *"…back from the brink, a conservation-success emblem."* |

### 3b. UK statutory listing vocabulary — `amber-listed` / `red-listed` / `Priority Species|Habitat`

These are **UK BoCC / UK BAP** categories. The *meaning* (declining / of concern)
is real; the *label* is UK-specific. Replace with neutral status language.

- **`amber-listed`** (5×): `constants.ts:1345, 1359, 1366, 2468, 2504` —
  → *"of conservation concern"* / *"a species in moderate decline."*
- **`red-listed`** (3×): `constants.ts:1094, 1784, 1836` —
  → *"of serious conservation concern"* / *"in steep decline."*
- **`Priority Species` / `Priority Habitat`** (2×): `constants.ts:1287` (comment —
  low-pri), `constants.ts:2412` (*"A vulnerable, declining **Priority Species**."*)
  → *"a priority for conservation"* (lowercase, generic) / drop the capitalized
  UK term.

> ✅ **KEEP — these are IUCN/global, not UK:** `Near-threatened`, `Vulnerable`,
> `Endangered`, `Red List` (IUCN), `Arctic`, `internationally important`,
> `flyway`. These are worldwide conservation language and read fine in US
> English. Do **not** strip them — they carry the real stakes.

### 3c. The recovery / decline narratives — *keep the fact, drop the UK frame*

The grey-seal and avocet **recovery stories are real ecology** — the reframe must
**preserve the recovery**, only removing "Britain":

- `constants.ts:1101` *"Britain now safeguards nearly half the world's grey
  seals, back from the brink."* → *"Strong protection has brought it back from
  the brink — a real conservation success."* (the half-the-world's-seals stat is
  UK-specific; drop or generalize.)
- `constants.ts:1854` (same fact, description form) — same treatment.
- `constants.ts:1240 / 2204` (avocet) — keep "returned by itself and recovered,"
  drop RSPB (see 3a).

**Slice A2 — institutional: ~12–13 strings**, all needing a sentence-level
rewrite that retains the ecological claim.

---

## 4. UK PLACE-SPECIFICITY — *CONTENT-LADEN (careful)*

### 4a. `Britain` / `British` in player copy — **the big one (~36 occurrences)**

These assert the setting/region. Each needs a neutral reframe that keeps any real
fact. Representative (not exhaustive — full list is every `Britain|British` hit in
quoted strings in `constants.ts`):

| File:Line | String (excerpt) | Reframe approach |
|---|---|---|
| `constants.ts:1037` | *"**Britain's** fastest-declining mammal…"* | *"one of the fastest-declining mammals…"* |
| `constants.ts:1050 / 1724` | *"The only **British** songbird that swims…"* | *"One of the few songbirds that swims…"* |
| `constants.ts:1101 / 1854` | *"**Britain** now safeguards nearly half the world's grey seals"* | see §3c |
| `constants.ts:1123` | *"A **British** endemic of the managed moor…"* | ⚠️ A/B-boundary — endemism IS the fact (see below) |
| `constants.ts:1130 / 1929` | *"**Britain** is a global stronghold…"* (curlew) | *"a global stronghold for the species"* (drop nation) or A/B-defer |
| `constants.ts:1134` | *"**Britain's** largest wild land mammal."* (red deer) | *"one of the largest wild land mammals here."* |
| `constants.ts:1219 / 1240` | *"declining as a **British** breeder" / "extinct as a **British** breeder"* | *"as a local breeder"* / *"locally extinct, then recovered"* |
| `constants.ts:1297 / 1630 / 2357 / 2359` | *"**Britain's** smallest/tiniest rodent" / "only native hare"* | *"a tiny rodent" / "a hare of the high tops"* (drop superlative-by-nation) |
| `constants.ts:1327` | *"…stays to winter in **Britain**…"* | *"…increasingly stays to winter here…"* |
| `constants.ts:1345 / 1352 / 1359 / 2486` | *"**British** estuaries / total"* | *"these estuaries" / "the regional total"* |
| `constants.ts:1204` | *"lost most of its **British** range…southwestern caves"* | *"lost most of its range…"* (drop "British"; "southwestern" is fine generic) |

### 4b. Scotland / Scottish / Caledonian (12 occurrences) — *A/B-boundary*

`constants.ts:1145, 1159, 1166, 2002, 2020` + `displayName 'Scottish Crossbill'`
(1955). These are **bound to the species identity** (Scottish crossbill, capercaillie
in "Caledonian pinewoods"). See the Layer-A/B note below — flag, don't auto-reframe.

### 4c. Cultural reference

- `constants.ts:1686` *"the water vole — **"Ratty" of The Wind in the Willows**…"*
  — a British children's-lit reference. Keep (it's globally known) or drop the
  literary aside; **flag for Craig** (charm vs. neutrality call).

### 4d. Biome `displayName`s that read as places — **internal IDs that LEAK**

These render to the player (`JournalPanel.ts:160` — *"Habitat: {displayName}"*).
The internal id (e.g. `biome:'moor'`) is out of scope, but the **display name is
player-visible**:

| `displayName` (line) | Player-visible? | UK-coded? → §6 judgment call |
|---|---|---|
| `Highlands` (380) | yes (journal header) | UK-coded place-name flavor (Scottish Highlands); could → "Highlands" generic or "High Country" |
| `Moor` (426) | yes | UK-coded-ish but a real worldwide landform — **flag** |
| `Hedgerow` (501) | yes | **real US term too** — likely keep |
| `Hazel Copse` (516) | yes | "copse" is real US-usable; "hazel" ties to UK dormouse fact — flag |
| `Saltmarsh` / `Estuary` / `Pine Forest` / `Alpine Summit` / `Coast` / `Meadow` / `Woodland` / `Wetland` / `Riverbank` / `Cave` | yes | **all neutral worldwide terms — keep** |

> No display-name **renaming of IDs** is proposed. If Craig wants a different
> displayed habitat word, it's a **display-name string edit**, not an identifier
> rename — keep the `biome:'moor'` id, change only the `displayName`.

**Slice A2 — place: ~36 `Britain/British` strings + the Scotland cluster
(A/B-boged) + a handful of display-name decisions.**

---

## 5. GEOGRAPHIC-IDENTITY LEAKS (highest priority — copy that STATES the setting)

**Good news: there is no top-level identity assertion.** The title card / tagline
/ onboarding do **not** claim Britain:

- `START_SCREEN` (`constants.ts:5033`): title *"Wild Trails"*, tagline *"Wander
  the wild, track its creatures, and fill your field guide."* — **neutral.** ✅
- `ONBOARDING` (`constants.ts:5048`): mechanic prompts only — **neutral** (bar the
  "about" vernacular in §2). ✅
- `index.html`: title *"Wild Trails"* — **neutral.** ✅

The identity leaks are therefore **distributed through the teaching copy**, not
concentrated in a banner. The strongest are:

| File:Line | String — *asserts the player is in / of Britain* |
|---|---|
| `constants.ts:1145 / 1968` | *"**Britain's** ONLY endemic bird — found nowhere else on Earth"* |
| `constants.ts:1166 / 2020` | *"could be lost from **Britain** a second time"* |
| `constants.ts:1929` | *"our largest wader…**Britain** is its global stronghold"* |
| `constants.ts:1253 / 2249` | *"the highest-nesting bird in **Britain**"* |

The **UK-collective "our"** is a subtler identity leak — it presumes a British
narrator/reader:

- `constants.ts:1094 / 1836` *"a real fall in **our** wild seabird colonies"*
- `constants.ts:1929` *"**our** largest wader"*

→ Reframe to third person: *"the region's"* / *"a real fall in wild seabird
colonies."*

> These overlap §4a (they're the same `Britain` strings) but are called out
> separately because they're the **highest priority**: they don't just use a
> British spelling, they **state the wrong place identity**.

---

## 6. SCOPE, RISK & SLICE PLAN

### Mechanical vs. content-laden split

| | Strings (≈) | Files | Risk | Nature |
|---|---|---|---|---|
| **A1 — spellings (mechanical)** | ~40–45 | `constants.ts`, `JournalPanel.ts` | **Low** — orthography only, ecology untouched | `behaviour→behavior` (1 label), `grey→gray` (descriptive), `favour/favourite/harbours/coloured`, `travelling/tunnelling/travelled` |
| **A2 — framing (content-laden)** | ~50 (36× `Britain/British` + ~13 institutional + place/`our`) | `constants.ts` | **Medium** — must **keep the ecological fact**, drop only UK-specificity; sentence-level rewrites | RSPB/amber-/red-listed/Priority, `Britain/British`, UK-collective `our`, "2p coin" |
| **A/B-boundary (defer / Craig)** | ~12 | `constants.ts` | **High to auto-touch** — the Britishness IS the species fact (endemics) | Scottish crossbill / capercaillie / "British endemic" / Caledonian — these belong with the Layer-B roster decision |

**Total player-visible British surface: ~90 strings, ~98% in one file
(`src/utils/constants.ts`).** The single outlier is the `Behaviour` label in
`JournalPanel.ts:163`.

### Confirmed: COPY-ONLY (no gameplay touched)

Every finding is a **string value** (`status:`, `description:`, `behaviour:`,
`title:`, `displayName:`, prompt text) or a **rendered label**. **No** catch /
spawn / detection / economy / season / world-gen logic appears in the audit.
`git status` is clean — **this recon changed no code or copy**; only this doc is
added.

### Proposed slices

1. **A1 — Spellings** (mechanical, low-risk, fast). The `behaviour→behavior`
   rendered label + `grey→gray` (descriptive only) + the `-our`/`-lled` set.
   Lands as a clean, near-mechanical diff with no meaning change. *Ship first.*
2. **A2 — Conservation & place framing** (content-laden, careful). Reframe
   RSPB/listing vocabulary and the `Britain/British`/`our` assertions to neutral
   conservation language **while preserving every real ecological fact** (the
   recoveries, the declines, the Arctic migrations, IUCN status). Sentence-level
   review per string. *Ship second, after Craig signs off the judgment calls.*
3. **(Defer) A/B-boundary** — the endemic-species facts (Scottish crossbill,
   capercaillie) where Britishness is inseparable from the species. Handle with
   the Layer-B roster arc, not here.

### ⚠️ JUDGMENT CALLS FLAGGED FOR CRAIG (don't assume)

1. **`grey` → `gray` in species *names*** (`Grey Wagtail`, `Grey Seal`,
   `Grey Plover`): orthography vs. species-naming convention (the US name for
   "Grey Plover" is "Black-bellied Plover"). Mechanize descriptive `grey`; **hold
   name-level `grey` for your call.**
2. **Habitat display names** — keep `Hedgerow` (real US term), but `Moor`,
   `Hazel Copse`, `Highlands`? Real worldwide landforms vs. UK-coded flavor.
   Your call on which displayed habitat words to neutralize (id stays either way).
3. **Units** — there are essentially none in copy; only the **"2p coin"** size
   ref needs a US referent (nickel?) or to go unit-free. Confirm you don't want
   metric anywhere else.
4. **Cultural reference** — *"Ratty" of The Wind in the Willows* (water vole):
   keep the charm or drop for neutrality?
5. **The endemic facts** — confirm the Scottish-crossbill / capercaillie
   "British endemic" lines are **deferred to Layer B**, not reframed in A2 (you
   can't neutralize them without changing the species' truth).

---

*Recon complete. No copy changed. Awaiting Craig's calls on the §6 items before
the A1 → A2 implementation slices.*
