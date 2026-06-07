# The Research Spine — recon + slice plan (DESIGN, no build)

The back half's organizing progression structure (PLAN.md §4.1.4 / P8). Research projects
**cost credits to start** + **advance through in-game ACTIVITY** (catches/observations you'd
do anyway) + optionally need a credit **top-up**; completing one **unlocks capability**. It
is the **spine above** the existing mechanics (bait/shop/nets/diets stay; research gates
what's unlocked) and it **wraps** the §4.1c mastery-gates (the mastery-challenge stays the
real, play-demonstrated gate; research adds an activity/credit layer *around* it).

**Cardinal guardrails (settled — not re-litigated here):** TIME = in-game ACTIVITY, **never
wall-clock** (P8); knowledge demonstrated by PLAY, never bought (P1/P2/P3); no bought power /
no pay-to-catch / no grind; credits a SINK, not a lock on core progression.

**This doc is design only — no code.** Findings cite `file:line` against current main (#56).

> ⚠️ **Sequencing note:** main (`986aefa`) has §4.1c gates (#49), the §4.1a-c knowledge arc
> (#45–49), nets slice A (#51) + B0/C/W (#53–55), and L1/L2 (#52/#56). **Nets B1 (#57) — the
> biome nets + `buyNet`/the swappable acquisition — is still an open draft.** So **R1 (route
> nets through research) depends on #57 landing first**; the slice plan accounts for it.

---

## #1 — The surfaces research will touch (the map)

**The unlock chain (§4.1c).** `BIOME_SET_UNLOCK` (`constants.ts:1635`) maps biome→next;
`isBiomeGateMet(journal, biome)` (`Missions.ts:94`) = `isBiomeSetComplete` AND every
`BIOME_GATE_CHALLENGES[biome]` (`constants.ts:1649` = `{ wetland: ['research-mouse-night'] }`)
completed; `evaluateCatch` fires the unlock when met. **Unlocks are stored in
`journal.unlockedBiomes`** (persisted) and applied to the live world at boot. → Research
**wraps** `BIOME_GATE_CHALLENGES` (R2): the mastery-challenge becomes a biome project's
*knowledge requirement*; the unlock keys off the project's completion.

**The shop.** `ShopPanel` lists bait rows + a "Your Nets" gear section; buying routes through
`Economy.buyBait` / (post-#57) `buyNet`. Owning a net is **`grantTool(journal, id)`**
(`Tools.ts`) — the idempotent ownership primitive. → Research **gates what the shop offers**
("researched access") and (R1) **triggers `grantTool` instead of a shop-buy**.

**The economy.** `journal.credits` (v5); `addCredits` / `spendCredits(journal, n): boolean`
(`Economy.ts:16/23`) — the spend guard never goes negative; `creditsForCatch` earns on
catches. → Research adds a **start cost** + optional **top-up** (the new sink) via
`spendCredits`. Credits stay a sink: the *activity* (play) is what advances research, not the
credits.

**Net acquisition (the swappable path, #51/#57).** `grantTool` owns a net **independent of
what triggers it** — `buyNet` (#57) is just the shop trigger wrapping it. **Confirmed cleanly
swappable:** R1's research-completion calls `grantTool` directly (no payment), exactly as #57
was designed for.

---

## #2 — The research data model (pure, `src/game/Research.ts` + constants)

```ts
// constants.ts — static project definitions (data, like MISSIONS / SPECIES_INFO)
interface ResearchProject {
  id: string;
  name: string;
  blurb: string;                 // naturalist framing — what it studies (P2/P5)
  startCost: number;             // credits to START the project (a sink)
  activity: ResearchActivity;    // the in-game work that advances it (see #3)
  topUp?: number;                // optional credits to COMPLETE once the activity is done
  knowledgeRequirement?: string; // a §4.1c mastery-challenge id (R2) — by PLAY, never bought
  reward: ResearchReward;        // grant-tool | shop-access | biome-access | journal-layer
  prereq?: readonly string[];    // prerequisite project ids
}

type ResearchActivity =
  | { kind: 'catch-species'; species: SpeciesId; count: number }
  | { kind: 'catch-in-biome'; biome: BiomeId; count: number }
  | { kind: 'catch-in-phase'; phase: DayPhase; count: number }; // "study nocturnal life"

type ResearchReward =
  | { kind: 'grant-tool'; toolId: ToolId }       // R1 — a biome net
  | { kind: 'shop-access'; ... }                 // unlock a shop category
  | { kind: 'biome-access'; biome: BiomeId }     // R2 — wraps the §4.1c gate
  | { kind: 'journal-layer'; ... };              // R0 — an optional dex enrichment
```

**Project STATE (persisted, v6 → v7).** `journal.research: Record<string, ResearchState>`
where `ResearchState = { started: boolean; progress: number; completed: boolean }`. The
migration `up_6to7` (mirrors `up_5to6`, `Journal.ts:251`): spread v6 + `research: {}` (a
returning player has nothing started — research is opt-in). `sanitizeResearch` on load (drop
unknown ids, clamp `progress ≥ 0`, coerce booleans). The full v1→v7 chain + corrupt→fresh
tested. **Pure**: `Research.ts` is Node-testable; the panel reads it.

---

## #3 — ⚠️ Activity-progress tracking (the heart — activity, not grind/wall/timer)

**The model: research rides the EXISTING catch-event stream.** Every catch already flows a
`CatchEvent { species, biome, phase }` through `evaluateCatch` (missions). Research adds a
parallel **`evaluateResearch(journal, ev)`** at the same boundary: for each **started,
incomplete** project, if the catch matches `project.activity`, `progress += 1`; on
`progress ≥ count` (and the top-up paid, and any knowledge requirement met) → complete → apply
the reward. **No new event source, no timer, no extra input — you catch animals (the fun
thing) and research advances.**

**Why it stays activity-not-grind-not-wall-not-timer:**
- **Reward for playing, not a parallel track.** The activity IS the normal loop. *"Study the
  nocturnal life of the meadow"* advances as you **catch at night** — which the §4.1b research
  challenges + the dex already pull you to do. You don't grind a separate bar; the project
  *frames* play you're already doing.
- **Not a grind:** counts are **small (≈3–5)**, never "catch 50 frogs." The activity is
  *varied* normal play, not a number to farm.
- **Not a wall:** every activity is something reachable with the starter gear in an unlocked
  biome (anti-lockout holds — research never requires a net/credit the player can't get).
- **⚠️ Never wall-clock — and never even in-game TIME-ELAPSED.** Advancement is by **ACTIONS
  (catches)**, *not* by day-cycles passing. "Across 3 nights" would be a passive timer in
  in-game clothing (wait for cycles) — banned. The phase-based activity is *"catch N animals
  AT night"* (an action that happens to occur at night), not *"survive N nights."* This is the
  single easiest thing to get wrong; the guard in #7 pins it.

---

## #4 — ⚠️ The §4.1c wrap (knowledge-by-play preserved)

A biome's research project carries **`knowledgeRequirement: <mastery-challenge id>`** (e.g.
`research-mouse-night`). The project **completes only when ALL of:** the activity is done AND
the top-up is paid AND **the knowledge requirement (the §4.1c mastery-challenge) is
`journal.missions[id].completed`** — which is set **only by play** (`evaluateCatch` completing
the non-forced night catch, #48). So:
- **The mastery-challenge stays the real gate** — demonstrated by PLAY, *never* buyable. P1/P2/
  P3 intact: research **cannot** flatten it into "spend credits → unlock"; the credit/activity
  layer wraps *around* a knowledge gate it cannot bypass.
- **The biome unlock migrates onto the project:** `isBiomeGateMet` (R2) checks the biome's
  research **project complete** (which itself checks the catch-set + the challenge) instead of
  `BIOME_GATE_CHALLENGES` directly. The **challenge logic is unchanged** — the project just
  *reads* its completion. The #48 auto-satisfaction property (normal play doesn't auto-complete
  the night challenge) carries through untouched.

This is the delicate one — hence **R2, last, isolated** (see #5). Done wrong it becomes
pay-to-unlock; the `knowledgeRequirement`-by-`journal.missions` model makes that structurally
impossible.

---

## #5 — ⚠️ The slice plan (each slice ships standalone)

Build the research SYSTEM first (unlocking something **new + optional**, entangled with
nothing critical), THEN migrate existing unlocks onto it **one at a time**.

| Slice | What | Touches the critical path? | Ships as |
|---|---|---|---|
| **R0a** | The research **data model** + `evaluateResearch` activity-tracking + project **state** + **v6→v7** migration. Headless/pure. | **No** | A tested, headless research engine (no UI yet — wired but invisible). |
| **R0b** | The **Research panel** (UI) + a HUD toggle + **1–2 low-stakes projects** unlocking something **new + OPTIONAL** (a journal "field-notes" layer / a cosmetic dex enrichment — NOT nets/areas/§4.1c). | **No** | A self-contained, playable research loop proving the whole system, entangled with nothing. |
| **R1** | Route a **#57 biome net** through research: a "Wetland Fieldcraft" project whose reward is `grant-tool: dip-net` (the swappable path), supplementing/replacing the shop-buy. | Shop/net acquisition only (not catch/unlock) | One existing system migrated cleanly. **Depends on #57 merged.** |
| **R2** | **Wrap the §4.1c area-gate:** the wetland→highlands mastery-challenge becomes the biome project's `knowledgeRequirement`; `isBiomeGateMet` keys off the project. | ⚠️ The unlock spine — **isolated, last** | The progression spine routed through research, knowledge-by-play intact + the win still reachable. |

**Ordering R0a → R0b → R1 → R2.** Each leaves the game shippable: R0 is a brand-new optional
system (nothing else changes); R1 migrates *one* low-risk surface (net acquisition); R2 — the
spine — lands alone, fully guarded, with the win-reachability + knowledge-by-play pins. **Never
combine R1 and R2** (two migrations at once on the progression system). **R0 is split** (engine
R0a vs UI R0b) because the data-model + activity-tracking + v7 is itself a meaty, independently-
testable unit, and the panel is its own surface.

---

## #6 — The research UI (placement)

A **new Research panel** — research is a distinct system (cost/activity/reward), too rich to
bolt onto missions. It **reuses the hard-won panel architecture**: overlay → panel →
non-scrolling header with the ✕ (`addOverlayDismiss`) → bounded `.*-scroll` body (the
#28/#30/#31/#32 scroll split), exactly like `MissionPanel` / `ShopPanel` / `JournalPanel`. A
new HUD toggle (a 🔬 chip beside 📓/🎯 in the top-right cluster, `Controls.makeActionButton`).
Each project row shows: **name + blurb**, **start cost**, the **activity requirement +
progress** ("Nocturnal study — 2/4 caught at night"), the **reward**, and the state
(Start ¢N / In progress / Top-up ¢N / Complete ✓). Mobile-clear; the scroll body holds the
list. Content strings in constants.

---

## #7 — Purity, guardrails + the new L1 guards

**Pure + isolated.** `Research.ts` (logic) + the `journal.research` state are `src/game/` +
`src/state/` pure (no three/DOM) — L1/L2 depend on this. The **catch core is untouched**:
`evaluateResearch` *reads* the same `CatchEvent` missions do (no `Catch.ts`/reach/formula
change). The L1 harness (#52) + L2 hooks (#56) are untouched.

**New L1 guards (the validation stack extends to cover research):**
1. **Activity-not-timer (the cardinal pin):** a project advances on **catch events**, and does
   **not** advance from time/day-cycles elapsing (drive the headless sim with `runFrames` over
   many cycles with *no* catches → research progress is **0**). This permanently guards against
   the wall-clock dark pattern.
2. **§4.1c knowledge-by-play (R2):** a biome research project does **not** complete (so the
   biome doesn't unlock) until the mastery-challenge is met by the **night catch** — paying the
   top-up / doing the activity is **not** enough (the #48 auto-satisfaction guard, extended to
   the wrapped gate). Knowledge is never bought.
3. **Credits a sink, not a lock:** a broke player can still **complete the activity** and the
   **core progression** (the win) stays reachable without research (R0 projects are optional;
   R2's credit top-up gates a *convenience-framed* unlock whose knowledge gate is the real one)
   — pin the win-reachability through the gated path.
4. **v7 migration:** the full v1→v7 chain preserves all prior state, `research` defaults `{}`,
   corrupt→fresh.

**Suite green: 406** on this branch (incl. L1; B1 #57's +10 land when it merges).

---

## Decisions needed before building R0a

1. **R0's optional reward:** what does the proving project unlock (a journal "field-notes"
   layer / a cosmetic dex enrichment / a new bait type)? It must be **new + optional + critical-
   path-free**.
2. **Slice ordering vs #57:** R1 needs nets B1 (#57) merged — confirm R1 waits for it (R0a/R0b
   don't depend on it and can proceed regardless).
3. **The activity vocabulary:** start with `catch-species` / `catch-in-biome` / `catch-in-phase`
   (covers the proving projects + the §4.1c wrap), or add `observe`/others now? (Lean: the three
   catch-based activities — they reuse the existing `CatchEvent`; observation is a later verb.)
4. **The §4.1c wrap target (R2):** wrap only the **wetland→highlands** gate (the one
   `BIOME_GATE_CHALLENGES` entry today), confirming the win stays reachable through it.
