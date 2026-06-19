# Full Gameplay-Arc Review — Recon (the whole arc, holistically)

**Status:** RECON / REVIEW ONLY. **Nothing changed.** A holistic "does the whole
arc hold together" pass across the 14-biome / 62-species game on `main` (the Sonoran
Desert, PR #160, is not yet merged). Findings are labeled **CAUSE** (traced in
code / computed from the real formula) vs **HYPOTHESIS** (proposed, needs a device
playtest), and triaged **BUG / TWEAK / ENHANCEMENT** with impact-vs-effort.

**Judged against the North Star:** the player becomes a **naturalist** who
understands animals as parts of a living, interconnected ecosystem *and* comes to
care about it (P1 intrinsic, P2 system, P3 no trivia, P4 no grind/FOMO, P5 animals
alive, P7 conservation = heart, P8 progress by studying).

**Method:** traced the spine + onboarding directly; fanned out three reviewer
agents (UX, teaching, balance); **then verified every high-severity claim against
the real code/formula** — which materially corrected several. The corrections are
called out, because honest triage is the point.

> **No `PLAN.md` in the repo** — the S4.4 backlog referenced in the brief isn't
> checked in. I used the `docs/*-recon.md` set (39 recons) + the code as the
> backlog source; deferred items are cross-referenced from there.

---

## TL;DR — the honest headline

- **The arc is fundamentally SOUND.** The spine is coherent (no dead-ends, no
  orphaned content, the unlock logic is correct), the catch core is sacred and
  untouched, onboarding teaches by doing, and the early game is genuinely strong.
- **Two REAL, small balance gaps (TWEAK, not BUG):** the **Wetland** and
  **Highlands** are the *only* biomes lacking a comfortable bait-less "valve" — their
  easiest species computes to **0.28 / 0.21** bait-less vs **0.59–0.83** everywhere
  else. *Verified by computing the real formula.* **With bait (free, taught) both
  are trivial (0.99 / 0.75)** — so it's a "leans on bait harder than peers" gap, not
  a lockout. A tiny `baseCatchRate` bump closes it.
- **The biggest finding is the TEACHING SCAFFOLDING, and it's an ENHANCEMENT, not a
  bug:** teaching is **front-loaded**. The early biomes (Meadow/Woodland/Wetland/
  Hedgerow) have rich *mission* scaffolding that teaches time-of-day/connectivity
  **by doing**; the **10 later biomes have no "set" missions** (just "catch N") and
  carry their (excellent, honest) climate-crisis / migration / old-growth teaching
  in **passive copy** + the unlock research-challenge. The content is *there*; the
  *active teaching* thins out late.
- **The North Star is STATED and partly built (HYPOTHESIS-level observation):** the
  game teaches **natural history** (what eats what, where, when, why declining)
  superbly and honestly — but **system *dynamics*** (food-web cascades, "if X goes,
  Y starves") are mostly implicit. It's a **snapshot diorama**, not a cascade sim.
  That's a scope/altitude call for Craig, not a defect.
- **UX is well-scaffolded but missing two things a mobile game expects:** **haptic/
  audio catch feedback** and consistent **safe-area-inset** usage; plus a few
  touch-target polish tweaks.
- **I corrected three over-stated agent claims:** the "missing-valve LOCKOUT BUG,"
  the "mountainhare/ring-ouzel BROKEN," and "the late biomes teach nothing" were all
  inflated — see the corrections inline.

---

## 1. The progression spine (traced end-to-end) — CAUSE

**The path holds; the logic is correct.** Traced through `Missions.ts`
(`evaluateCatch` / `reconcileResearchUnlocks` / `isUnlockGateMet` /
`isBiomeGateMet`) and the constants tree:

```
Meadow(hub) ─► Woodland ─► Wetland ─►(escalated: set + research-mouse-night + R2)─► Highlands
   │   └► Hedgerow ─► Hazel Copse                         │
   │                                          ┌───────────┴── Moor ─► Alpine Summit
   └► (Woodland) ─► Pine Forest               Riverbank ─► Coast ─► Saltmarsh ─► Estuary
                                                 └► Cave
```
- **Early gates are gentle** (catch-set completion); **later biomes are research-
  gated** (an `unlock-the-X` project + a non-forced mastery challenge by play —
  P8: progress by *studying*). The fork tree (`BIOME_SET_UNLOCK`) is correct and
  order-independent.
- **No dead-ends / orphaned content found.** Every biome is reachable; the win is
  the **full Field Journal** (catch every species), computed purely from journal
  state (P8, the census/capstone reframe) — no grind counter.
- **Pacing — CAUSE:** the front of the arc (Meadow→Wetland) is well-paced (gentle
  gates, rich teaching). **The mid-game FORK is the high point** — Highlands forks
  to Riverbank+Moor, Woodland to Pine, Riverbank to Coast+Cave — giving the player
  real *choice* (good). **HYPOTHESIS — a late-game drag:** the deep chain
  (Coast→Saltmarsh→Estuary, all research-gated, each "catch 4 in the prereq + a
  mastery challenge") is *repetitive in shape* — five biomes gated by the same
  "catch-4-in-prereq + one mastery catch" template. It's not a grind (counts are
  small), but the **gates stop teaching anything new** after the pattern is learned.
  → **ENHANCEMENT** (vary the late gates' teaching), med impact / med effort.
- **The "vacuous-set" gate hazard** (the bug caught & fixed in the Desert PR #160):
  a gentle gate off a biome whose catch-set is vacuous unlocks immediately. The
  deep biomes are correctly research-gated, so it's contained — **note it as a
  standing invariant** (a new biome must be research-gated, or fork off a biome with
  a real non-standalone set). *No live bug on `main`.*

---

## 2. Onboarding / the first 5 minutes — CAUSE (mostly strong)

**The teach-by-doing machine is good (`Onboarding.ts`).** `move → approach → catch
→ journal → missions → done`, advanced by the player's *situation* (moved, animal
nearby, catch armed, caught), never gating play (P1 intrinsic). Bait is taught
separately by a demand-driven hint. The first catch flows into the journal reward,
then the mission direction, a beat apart. **This is the right shape.**

Gaps (HYPOTHESIS — needs a kid on a device):
- **Bait/diet discovery (the core teaching) is only taught reactively** (the
  baitHint fires on demand). A brand-new player might not connect "bait = the
  animal's real diet" until prompted. Since bait is what makes the harder biomes
  catchable (§3), this is the **highest-leverage onboarding clarification.**
  → **ENHANCEMENT**, high impact / low effort (one explicit bait beat in the
  onboarding chain).
- **The touch hint is generic** (*"Drag to roam · CATCH · BAIT"*) and doesn't
  mention the top-right panel buttons (journal/missions/research) — a new player may
  not discover them. → **TWEAK**, med/low.
- **No catch-result feedback beyond the flash** (see §5) — the *first* catch (the
  highest-stakes moment) lands without a haptic/sound. → **ENHANCEMENT**, see §5.

---

## 3. Difficulty + balance — CAUSE (verified against the real formula)

I recomputed the **actual** bait-less catch chance (the alpine-test "valve" probe:
`net, dist 0.5, home biome, no bait, not fleeing`) for every claimed problem
species, using the real constants (`proximityMax 1.3`, `biomeMatchBonus 1.0`,
`correctCalm 3.5`). **The valve bar is bait-less > 0.3.**

| Species (role) | bait-less | with correct bait | verdict |
|---|---|---|---|
| hedgehog (Meadow valve) | **0.83** | 1.00 | ✓ valve |
| snowbunting / dunlin / twite (valves) | **0.59** | 1.00 | ✓ valve (snowbunting test-pinned >0.3) |
| **mallard (Wetland — easiest)** | **0.28** | 0.99 | ⚠️ below valve bar |
| frog (Wetland) | 0.24 | 0.83 | hard bait-less; fine with bait |
| **ptarmigan (Highlands — easiest)** | **0.21** | 0.75 | ⚠️ below valve bar |
| mountainhare (Highlands apex) | 0.18 | **0.62** | intended-hard; **fine with bait** |
| ring ouzel (Alpine apex / the ceiling) | 0.12 | **0.42** (+ throwing net, unfactored) | intended ceiling |
| greyseal / otter (apexes, fish-locked) | 0.14 / 0.18 | 0.50 / 0.62 | intended apexes |

### The ONE real, actionable balance finding — TWEAK
**CAUSE: the Wetland and Highlands are the only biomes lacking a comfortable
bait-less valve.** Every other biome's easiest species clears 0.3 bait-less
(0.59–0.83); these clear only **0.28 / 0.21**. This is a genuine anti-lockout-valve
*gap* (P4) — but **not a lockout**: with the correct bait (5 of each free from start,
taught by the hint) both are trivial (0.99 / 0.75), and the multi-shake resolution
means even 0.21 catches with a few tries.
- **Rec:** a tiny bump on the easiest species — **mallard 0.24→0.30**, **ptarmigan
  0.18→0.30** — would give both a true bait-less valve, matching every peer biome.
- **TWEAK** (species-data tuning; the catch formula stays sacred). **High impact /
  trivial effort.** Flag for Craig: is the bait-lean *intended* difficulty for these
  two, or an oversight? (The Wetland is *early* — a bait-lean there is the riskier
  one for a new player who hasn't learned bait yet.)

### ⚠️ Corrections to the balance agent (over-stated — do NOT propagate as bugs)
- **"Missing-valve LOCKOUT BUG"** → **overstated.** It's a valve *gap*, closed by
  bait; severity is TWEAK, not a critical lockout. (Verified: with-bait 0.75–0.99.)
- **"mountainhare / ring ouzel / greyseal BROKEN / uncatchable"** → **wrong.** These
  are the **intended difficulty ceiling/apexes** (the Alpine recon explicitly
  designs the ring ouzel as "the CEILING — hard, never a wall, catchable WITH
  MASTERY"). With bait they're 0.42–0.62, and the ring ouzel's intended tool (the
  **throwing net**, a higher multiplier I didn't even factor) lifts it further.
  **Working as designed.** The only honest question is the *feel* — a device
  playtest call (HYPOTHESIS), not a code bug.

### The population-floor "wrong time" check — CAUSE (holds)
The estuary's seasonal headcount can drop the active cap to **2** (summer:
`round(12 × 0.2)` floored at `SEASONAL_POP_MIN_ACTIVE = 2`). **Verified safe:**
eligibility is season-*independent* (`eligibleSpecies(biome, phase)` — no season),
so all species stay findable; the floor guarantees ≥2 active. A player never hits
"too empty to play." *Tight but correct* — flag `SEASONAL_POP_MIN_ACTIVE` as
**load-bearing** (any future time-of-day pop lever, e.g. the Desert's, must keep the
floor). **No bug.**

### Economy — CAUSE (P4 held, no grind)
Catch = 3cr, new species = 10cr, biome complete = 25cr; bait = 2cr (start with 5,
max 9). A single biome's completion funds bait many times over. **No grind.** Fish/
shellfish bait is research-gated but **never required** (other species in those
biomes are catchable bare) — a *completionist* gate, not a progression wall. Fine.

---

## 4. The teaching arc — CAUSE (front-loaded) + HYPOTHESIS (system vs natural history)

### CAUSE — teaching scaffolding is front-loaded (verified mission counts)
| Biome | species | "set"/teaching missions | teaching shape |
|---|---|---|---|
| Meadow | 13 | **3 set + 6 research** | ✅ rich: survey + dawn/dusk/night + multi-condition |
| Woodland | 9 | **4 set** | ✅ window-locks + the tracking beat |
| Wetland | 5 | **3 set** | ✅ survey + windows |
| Hedgerow | 6 | **2 set** | ✅ connectivity by *map topology* (the best lesson) |
| Highlands, Moor, Pine, Cave, Alpine, Riverbank, Coast, Saltmarsh, Estuary, Copse | 4–9 | **0 set** | ⚠️ "catch N" + the unlock mastery-challenge + copy |

**The strong, distinct lessons land:** time-of-day (Meadow, *by doing*),
habitat-layering + tracking (Woodland), **connectivity (Hedgerow — taught by being
*forced* to walk the corridor to the Copse; the game's best system-teaching)**,
the cave's "outside the day-cycle" twist, the unlock mastery-challenges (catch the
ptarmigan over *greens* = its real diet — applied, P3).

**The unevenness (CAUSE):** the **later biomes carry the richest *content*** — the
Alpine's climate-squeeze ("nowhere higher to go"), the Pine's old-growth/capercaillie
crisis, the Estuary's Arctic-flyway migration, the Cave's critically-endangered eel —
but it lives in **passive `status`/`fieldNote` copy**, not in *active missions*. So
the teaching **transitions from "learn by doing" (early) to "learn by reading"
(late)** — exactly when the *concepts* get most interesting.
- **Rec — ENHANCEMENT (high impact / med effort):** add **one optional, non-gating
  "study" mission per late biome** that surfaces its hook (e.g. Alpine: "catch the
  snow bunting — the bird with nowhere higher to go"; Estuary: already has the nice
  flyway beat — extend the pattern). This turns passive copy into an *active* beat
  without changing balance or gating (P4-safe).

### ⚠️ Correction to the teaching agent
Its "Highlands/Moor/Pine/Cave/Alpine teach **nothing**, the player learns nothing"
is **overstated.** Those biomes *do* teach — via the **unlock mastery-challenge**
(diet-by-play), the **rich SPECIES_INFO copy** (the honest conservation status is
genuinely strong teaching), and the **catch experience**. What they *lack* is the
early biomes' *active mission scaffolding*. It's an **unevenness/ENHANCEMENT**, not
a teaching void.

### HYPOTHESIS — natural history vs. system dynamics (the North-Star altitude call)
The game teaches **natural history** (diet, niche, phenology, decline) **honestly
and richly** — and the conservation `status` lines already model the *dynamic*
truth (decline *and* recovery, with causes), which directly counters the kid
misconception that ecosystems are static. **But the *interconnection* (food-web
cascades — "lose the old pines → lose the capercaillie") is mostly implicit.** The
diet/bait system *could* teach the food web explicitly but currently gates catches.
The world is a **snapshot diorama** (the wild as it is), not a **cascade simulation**
(player actions ripple). Making interconnection *explicit* is a real opportunity —
but it's a **scope/altitude decision for Craig** (a few copy beats vs. a simulation
arc), not a defect. The deferred features (D1 seasons, D2 behavior, TL2 ambient
life) are what would make the system *felt*, not just read (see §6).

---

## 5. UX / friction / polish — CAUSE (code) + HYPOTHESIS (device feel)

The UI is **well-scaffolded** (safe-area CSS exists, no modal traps, correct
z-layering, the catch-target chip→detail-sheet flow is clean). The real gaps:

| Finding | Cat. | Impact / Effort | Notes |
|---|---|---|---|
| **No haptic/audio catch feedback** — the catch resolves on a visual flash only; the highest-stakes moment (esp. the *first* catch, on a kid's phone) lands silently | **ENHANCEMENT** | **High / Med** | the #1 mobile-game-feel gap (the audio engine exists — wire a success/fail cue + `navigator.vibrate`) |
| **Inconsistent `env(safe-area-inset)` usage** across panels/badges (some clear the notch, some don't) — risk of clipping behind the Dynamic Island on iPhone | **BUG** (HYPOTHESIS — verify on device) | **Med / Low** | the agent cited specific lines (`style.css`) — *verify the exact selectors before fixing*; the general inconsistency is real |
| **CATCH button has no press feedback** (no active-state flash/scale) — rapid kid taps feel unconfirmed | **TWEAK** | **Med / Low** | a 50ms active state |
| **BAIT/HIDE buttons 64×64** — near the Apple-HIG 44px floor but the cluster is tight for small hands | **TWEAK** | **Low / Low** | bump to ~72 or widen the hitbox |
| **CATCH % text updates every frame** (can thrash) | **TWEAK** | **Low / Low** | debounce ≥5% |
| **Target chip hidden entirely when a panel is open** — lose track of your quarry while checking the journal | **ENHANCEMENT** | **Low / Low** | dim instead of hide |
| **Bait icons hard to distinguish at 16px** (seeds vs insects vs shell) — a kid-clarity issue | **TWEAK** | **Low / Med** | larger or labeled |

> These are **HYPOTHESIS on severity** (a device playtest confirms which bite). The
> safe-area one is the only candidate **BUG** — and only if it actually clips on
> Craig's iPhone; verify the selectors first (the agent's line numbers are
> unverified). **None traps the player or breaks a catch.**

---

## 6. Completeness / gaps / deferred — CAUSE (cross-ref the recon set)

### Content gaps (CAUSE)
- **Thin rosters:** Wetland (5), Pine Forest (5), Highlands (4), Copse (3). The
  Copse (3) and Cave (5) are *intentionally* small (a remnant; a tight cave); the
  **Wetland (5, early) and Pine Forest (5, content-rich theme)** feel under-
  populated for their role. → **ENHANCEMENT**, low effort (add 1–2 real species),
  med impact. *(Also a Layer-B input: the roster is ~100% Eurasian — see
  `docs/accessibility-content-recon.md` — the worldwide spread + the familiar US
  animals are the bigger content arc.)*
- **No apex predator / food-web capstone** (no fox/owl/eagle) — honest for a UK
  temperate roster, but it means no top-of-web teaching. Ties to the roster arc.

### Deferred features (cross-referenced from `docs/`)
| Deferred | Recon | What it'd add | Teaching impact |
|---|---|---|---|
| **D1b seasonal abundance** (D1a re-grade shipped) | `seasons-recon.md` | species abundance shifts by season | **HIGH** — makes the Estuary's *migration* **felt** (thronged winter / bare summer), not just read |
| **D2 behavioral ethology** (rest/forage/vigilance) | `d2-behavioral-ethology-recon.md` | animals with daily routines | **HIGH** — animals as *alive/working* (P5), not static presences |
| **TL2 ambient life** (swaying grass, motes) | `tl2-ambient-life-recon.md` | thriving biomes visibly "alive" | **MED** — visual metaphor for ecosystem health |
| **Day-night world lighting** | (desert recon defers it) | a lit night | **MED** — nocturnality seen, not just labeled |
| **The Desert (PR #160) + worldwide spread** | `worldwide-content-recon.md`, `desert-biome-recon.md` | new climate + the first non-Eurasian biome + the `BIOME_TIME_POP` lever | **HIGH** — adaptation teaching + roster balance |

**Highest-leverage deferred items for the North Star:** **D1b (seasons)** and **D2
(behavior)** — they convert the *read* teaching (migration, animal life) into *felt*
teaching. They're real arcs, not quick wins.

---

## 7. Triage + recommendations (ranked impact-vs-effort)

**Honest severity — almost nothing here is a true BUG.** The arc is sound; the
findings are tuning + enhancement.

### Do first — high impact / low effort (TWEAKs + one near-bug)
1. **Wetland + Highlands valve bump** (mallard 0.24→0.30, ptarmigan 0.18→0.30) —
   the one real balance gap; gives every biome a bait-less valve. **TWEAK.** *(Verify
   the design intent with Craig first — is the bait-lean deliberate?)*
2. **Wire haptic + audio catch feedback** — the biggest mobile-feel gap; the audio
   engine already exists. **ENHANCEMENT**, high/med.
3. **One explicit bait/diet beat in onboarding** — the core teaching, currently only
   reactive. **ENHANCEMENT**, high/low.
4. **Verify + fix the `safe-area-inset` inconsistency on Craig's iPhone** — the only
   candidate **BUG**; confirm it actually clips before touching. Med/low.

### Do next — med impact / med effort (ENHANCEMENTs)
5. **One optional "study" mission per late biome** (Highlands/Moor/Pine/Cave/Alpine/
   Estuary) — turns the rich passive copy into an active teaching beat; non-gating
   (P4-safe). Closes the front-loaded-teaching gap.
6. **Add 1–2 species** to the Wetland and Pine Forest (thin rosters for their role).
7. **Vary the late-game gates** so the deep chain stops repeating one template.
8. **UX polish batch:** CATCH press-feedback, BAIT/HIDE hitbox, chip-dim-on-modal,
   bigger bait icons, CATCH-% debounce.

### Arcs — high impact / high effort (Craig's roadmap calls)
9. **D1b seasonal abundance + D2 behavior** — make the system *felt* (the North-Star
   payoff). The load-bearing deferred work.
10. **The worldwide roster spread** (the Desert is step 1) + the accessibility/
    define-in-place pass (`accessibility-content-recon.md`) — "around the world," kid-
    accessible. The big content arc.
11. **(Scope call) Explicit interconnection teaching** — food-web/cascade beats vs. a
    light copy pass. Decide the altitude.

### What is sacred / untouched
The **catch formula** (`finalCatchChance`), the **proven biome-slice + research-gate
patterns**, the **anti-lockout floor invariant**, and **single-biome species**. Every
balance rec above is *input* tuning (species constants), never the formula.

---

## Confirmations
- **Review changed nothing** — `git status` clean; this doc is the only artifact.
- **Tests green** at review time: `npm run build` ✓, **791/791 pass**.
- **CAUSE vs HYPOTHESIS labeled throughout;** the high-severity agent claims were
  **verified against the real formula/data** and **three were corrected down** (the
  valve "lockout," the "broken" apexes, "the late biomes teach nothing").

*Review complete. The arc holds together; the wins are a couple of valve tweaks,
mobile catch-feel, and converting the rich late-game copy into active teaching beats
— with seasons/behavior + the worldwide roster as the bigger arcs. Triage is Craig's.*
