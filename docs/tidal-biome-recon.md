# World Expansion — TIDAL / SALTMARSH / ESTUARY (recon)

*the 5th SHELLFISH diet, the fish-diet pattern; a branch; honest declining waders*

PLAN.md §4.2 + Craig's picks: the **Tidal** biome widens the world **and** adds the **5th diet
(shellfish)** — so the dropped **oystercatcher** (cut from the Coast because *"it eats shellfish
(cockles/mussels), which the 4 diets don't honestly cover"* — `coast-recon.md:43`) finally comes home.
The recon's one job is to confirm **shellfish follows the clean fish-diet ENUM pattern (#71)** — the
only catch-adjacent part — before any build. **Design only — no code.**

> ## ⚠️ The headline: shellfish IS the fish pattern — a pure ENUM add, ZERO catch-core change
> The catch formula never branches on *which* diet: `calmMultiplier(correctBait: boolean, fleeing)`
> takes a **boolean**, and `isCorrectBaitFor` is a **generic equality** (`species.bait ===
> activeType`). So a 5th diet is **constants + an icon + a research project** — the formula, the match
> logic, and every shipped species are **untouched** (zero re-pins), exactly as fish (#71) landed. The
> one extra wrinkle is unrelated to the diet: an estuary off the tier-5 Coast needs **`Tier` widened to
> 6** (additive). No journal schema bump.

---

## #1 — ⚠️ The diet system now (the fish-diet trace — confirmed CLEAN)

Diets ARE baits: each species has one `bait: BaitId`, and the lure mechanic is generic:

| Piece | Today | Shellfish add | Catch-core? |
|---|---|---|---|
| `type BaitId` | `'seeds' \| 'greens' \| 'insects' \| 'fish'` | `\| 'shellfish'` | no — a union widen |
| `isCorrectBaitFor` (`Bait.ts`) | `species.bait === state.activeType` | *(unchanged — generic)* | **no** |
| `calmMultiplier` / `finalCatchChance` (`Catch.ts`) | `correctBait ? BAIT.correctCalm : 1` (a **boolean**) | *(unchanged — never sees the diet)* | **no** |
| `BAIT_ORDER` | `[seeds, greens, insects, fish]` | append `shellfish` (tray cycle + counts init) | no |
| `RESEARCH_GATED_BAITS` | `['fish']` | add `'shellfish'` → starts at **0** (anti-lockout) | no |
| `BAIT_DISPLAY` (`Record<BaitId,…>`) | 4 entries | + `shellfish: { label: 'Shellfish', icon: 'shell' }` (compiler forces it) | no |
| `BaitIconKind` + the procedural icon | `seeds/leaf/insect/fish` | + `'shell'` (a small clam shape in `icons.ts`) | no — render only |
| a research project | `study-aquatic-life` → `bait-access: fish` | `study-the-shellfish-eaters` → `bait-access: shellfish` | no |

> **Verdict: the clean fish-diet ENUM pattern, confirmed.** The exact touch is **~5 constant additions
> + 1 procedural icon + 1 research project**. The catch FORMULA, the generic match logic, and **every
> shipped species** are byte-unchanged (**zero re-pins**). The `Record<BaitId,…>` types (bait counts,
> `BAIT_DISPLAY`) widen at compile-time, so TS *forces* the shellfish entry — no silent gap. It does
> **not** ripple into the catch core. (If shellfish couldn't slot in cleanly, this is where I'd say so
> — it does.)

---

## #2 — ⚠️ The roster + honest diets (shellfish ONLY to true eaters — zero re-pins)

⚠️ **Shellfish is a SPECIALIST diet, not a catch-all for "shore birds."** It goes only to genuine
mollusc/shellfish feeders; the worm/invert-eaters stay `insects` (honest). **No existing species is
re-pinned** (the fish-diet discipline). Proposed **5**:

| Species | Diet | Difficulty | Gait | Honest status |
|---|---|---|---|---|
| **Dunlin** | insects (worms/inverts) | easiest (the valve, bait-less) | bird | the commonest small wader of the mud — but declining as breeders |
| **Oystercatcher** | **shellfish** (cockles/mussels) | medium — ⚠️ home at last | bird | the pied "sea-pie" with the orange bill; amber-listed, in recent decline |
| **Redshank** | insects (worms/inverts) | medium | bird | "the sentinel of the marsh" — declining fast as saltmarsh is squeezed |
| **Pied Avocet** | insects (sweeps inverts) | hard | bird | the elegant up-curved bill — a **conservation success**, the RSPB's emblem, recovered from extinction |
| **Knot** | **shellfish** (molluscs) | hardest (apex) | bird | the great smoke-like winter flocks on the mudflats; near-threatened, declining |

**Diets: shellfish ×2 (oystercatcher, knot) + insects ×3 (dunlin, redshank, avocet)** — honest. The
oystercatcher and knot genuinely eat shellfish (the diet's whole reason); the worm/invert-feeders stay
`insects`. **Nothing is mis-assigned to shellfish to pad it** (the wildcat/oystercatcher-drop
discipline). Honest **declining-wader** stakes (the real estuary crisis) balanced by the **avocet's
recovery**. CJ2 gait: all `bird` (the existing wader build; oystercatcher's long orange bill = a long
beak). Anti-lockout valve: the **dunlin** (small, common, `insects`, bait-less).

---

## #3 — ⚠️ The shellfish bait (anti-lockout — the fish-bait rule exactly)

A `study-the-shellfish-eaters` research project (mirrors `study-aquatic-life`):
`reward: { kind: 'bait-access', bait: 'shellfish' }`, **cost ~15** (an OPTIONAL credit sink, never
core-progression), activity `catch-in-biome: tidal ×4`. ⚠️ **Research-gated but NEVER required:** the
shellfish-eaters (oystercatcher, knot) are **catchable bait-less** (leaning on stealth/proximity), so a
player without shellfish bait is **never locked out** — the fish-bait rule, verbatim. The new bait
slots into the **tray** as a 5th selectable chip (starts at **0** via `RESEARCH_GATED_BAITS`,
greyed/non-selectable until unlocked) and the **Field Supply shop** offers it once the study completes —
the exact fish-bait flow (no new tray/shop code, just the enum + the project).

---

## #4 — The biome + water

A **saltmarsh / estuary / mudflat** — the most **water-heavy** biome yet: brackish **tidal pools +
mudflat channels**, reusing the **#55 `WaterDef` discs** verbatim (barrier / slide / flee-to-water —
the coast-sea pattern as scattered pools). A distinct **muted olive-mud** palette (`~0x5e6850`
saltmarsh green-brown) — clearly its own place (not the coast's sand, not the wetland's teal). Several
discs across the cell leave dry mud to roam; the shellfish-eaters work the water's edge. (No new water
mechanic — the discs are reused.)

---

## #5 — ⚠️ The branch + the gate

**Geography forces the placement.** The estuary is **river-meets-sea (brackish)** → it must neighbour
the **Coast** or the **Riverbank**. The **Riverbank is geographically FULL** (all four edges taken —
highlands/coast/pineforest/cave), so the tidal cell goes **east of the Coast** at **cell(80,120)**
(`[60,100]×[100,140]`), edge-adjacent to the Coast (W). **`BIOME_SET_UNLOCK.coast = ['tidal']`** — the
Coast was a **terminus**; this gives it its **first arm** (the world's north-east grows into the
estuary). **prereq: coast**, **tier 6** (⚠️ `Tier` widens — see #6, the `tier === prereq+1` rule).

> ⚠️ **Honest note on "the fork":** because the Coast had no prior successor and the estuary's only
> ecological neighbour is the Coast, this is a **single-successor extension** off the terminal Coast,
> **not** a multi-successor fork — so the "both breadcrumbs at the fork" pattern **doesn't apply** (one
> new path, one breadcrumb: the `unlock-the-tidal` project in the research-area panel). The world still
> **widens** (a new cell off the previously-final Coast). *If Craig specifically wants a true
> multi-successor fork, the only geometric option is forking off the **Wetland** (`wetland → [highlands,
> tidal]`) — but a freshwater wetland → a saltwater estuary is ecologically wrong; I lean the honest
> **Coast extension**.*

**The gate** — a **#92 multi-condition challenge** in the prereq **Coast**, species + bait (non-forced):
**`research-turnstone-insects`** (*"catch the turnstone over insect bait"* — a Coast species, its real
invertebrate diet) + an `unlock-the-tidal` project (cost-0 biome-access, knowledge-by-play
double-enforced — mirrors `unlock-the-coast`).

---

## #6 — Scope + L1/L2

- **Mostly DATA + the clean diet ENUM** (the fish pattern: `BaitId`/`BAIT_ORDER`/`RESEARCH_GATED_BAITS`/
  `BAIT_DISPLAY` widen + a `'shell'` icon + the `study-the-shellfish-eaters` project) + the biome data +
  reused water. **No catch-formula change, no re-pins.**
- **Two additive ENUM widens** (both compile-time, TS-forced for completeness): **`BaitId`** (+
  `shellfish`) and **`Tier`** (`1|2|3|4|5` → `…|6`, since the estuary sits past the tier-5 Coast).
  `shakeCountForTier` **clamps** (`clamp(tier,1,5)`), so tier 6 reads the tier-5 shake count — safe, no
  break.
- **No journal schema bump:** bait counts persist as `Record<BaitId, number>`, and `restoreBaitCounts`
  keeps the default for any missing key — so a pre-shellfish save loads with `shellfish = 0` (correctly
  locked). Forward/back compatible, exactly like fish (schema stays v7).
- **`src/game/` purity:** the diet is pure data; the bait logic is already generic; no sim change.
- **L2:** a new **Tidal cell** → a new additive frozen baseline (`?…&unlock=all&at=80,120`), seeded
  after Craig approves the marsh look. The existing baselines are a new-cell-away.
- **Tests:** green on this branch — **605 passing** (the recon adds no code). The build will add the
  fish-diet-style guards (**zero re-pins** — every shipped species' diet byte-identical; **shellfish
  only on the true eaters**; the **anti-lockout** bait-less valve + bait-access reward) **plus** the
  biome/branch/#92-gate/win-path/gait pins and the **`Tier` widen** is harmless (clamp).

---

## STOP — the decision before building

The catch-adjacent part is clean (shellfish = the fish ENUM pattern, zero re-pins). Craig confirms:

1. **The diet (#1/#3)** — shellfish as a clean ENUM + a research-gated, never-required bait (the fish
   rule) *(recommended)*?
2. **The roster (#2)** — Dunlin / Oystercatcher / Redshank / Avocet / Knot, with **shellfish only on the
   oystercatcher + knot** (the rest stay `insects`), zero re-pins *(recommended)*?
3. **The branch (#5)** — the **Coast extension** (`coast → [tidal]`) at cell(80,120), tier 6
   *(recommended)*, accepting it's a single-successor extension (no "both breadcrumbs"), vs. an
   ecologically-weaker Wetland fork?

After Craig confirms the clean diet + the roster + the branch, the build implements it — then Craig
playtests the marsh look + that the oystercatcher reads right, and approves it (then the new Tidal L2
baseline seeds).
