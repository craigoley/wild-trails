# Through-line — the CAPSTONE (recon)

*the win reframed as "the world is known, and it flourishes"; the census voice, implied/minimal*

PLAN.md §4.3 — the **last** through-line slice, the emotional summit. The substrate is fully built:
TL1/TL2 (the world warms + moves), per-biome thriving, the **census reframe** (#100 — the journal as a
record-that-matters; the implied/minimal voice **calibrated**), CJ1–3b (a living, walking world). The
capstone scales the census's **biome-level `known · flourishing`** pairing **up to the WORLD level, at
the win**. **Design only — no code.**

> ## ⚠️ The whole job, in one line
> Reframe the **existing** win screen from *"caught them all / your field guide is full"* (a collection
> score) to **"the world is known, and it flourishes"** (a living world *understood* + *thriving*) —
> reading the real world-state, in the calibrated census voice. **The trigger is unchanged** (you win
> at the same moment); only what winning **means** shifts. The deliverable is **the actual words +
> presentation** (§3–4) — Craig judges the tone by taste. ⚠️ This is the **one-shot peak**: the
> temptation to *say more* is strongest at the ending and most dangerous. **Err minimal. Never "you
> saved the world."**

---

## #1 — The existing win NOW (what the capstone reframes — trigger unchanged)

- **Trigger** (`Missions.isGameComplete` → `shouldCelebrateWin`, fired by `main.ts:maybeFireWin`): every
  species caught + every biome mission-set complete + top rank. ⚠️ **The capstone does NOT touch this**
  — same condition, same moment. Only the framing/words/presentation change.
- **Presentation** (`WinScreen.ts` + `style.css`): a closeable overlay. A **near-opaque dark-green veil**
  (`.win-overlay` `radial-gradient(rgba(20,44,26,.92) → rgba(6,14,8,.96))`) over a **solid dark card**
  (`.win-panel` `rgba(16,30,20,.98)`, green glow border). ⚠️ **It HIDES the living world behind it.**
- **Words** (`WIN` + `WinScreen.show`):
  > `🌿 Field Guide Complete`
  > `{N} of {N} creatures catalogued` · `Regions explored: {…}` · `Rank: Field Researcher`
  > *Every creature catalogued, every region explored, every study finished — your field guide is full.*
  > *The wild keeps turning. Roam on whenever you like — nothing here ever resets.*

The frame is **a certificate / scorecard on a dark veil**: "complete," "catalogued," "full." The
free-roam line (last) is already perfect and stays. Everything above it is the collection residue the
capstone reframes.

---

## #2 — ⚠️ The world-state read (honest "flourishes," not a claim)

There's no single world aggregate yet — `Thriving.ts` has **`thrivingForBiome`** (0..1 per biome) and
**`thrivingByBiome`** (the map). The capstone reads the world as a **fold over the unlocked biomes**:

```
worldThriving = average( thrivingForBiome(b) for b in unlockedBiomes )
worldWord     = thrivingWord(worldThriving)   // quiet → waking → alive → flourishing
```

**Is it honestly "flourishing" at a real win?** `thrivingForBiome = 0.85·speciesCatalogued +
0.15·researchDone` (or species alone where a biome has no research). At the win **every species is
recorded → speciesCatalogued = 1 everywhere**, so each biome is **0.85–1.0** (1.0 where there's no
optional research; ~0.85+ where optional research was skipped). The **average lands ≈ 0.95 → above the
0.9 "flourishing" band.** So **"flourishes" is the *honest, computed* word, not a claim** — exactly the
census's honest-status discipline, scaled up.

> **Recommendation:** the capstone **reads the live aggregate** and shows the real `worldWord`. Because
> the win condition *is* a full catalogue, that word is **"flourishing"** at any legitimate win — earned
> by the world actually being so, never asserted. *(The build should pin the average lands in the
> flourishing band at a complete journal — a one-line guard.)*

---

## #3 — ⚠️ THE ACTUAL DRAFTED WORDS (the core deliverable)

The census vocabulary — **recorded · In the wild · known · parchment** — *elevated to the world*. The
biome header reads **"Coast — known · flourishing"**; the capstone is that **same pairing at the world
scale**. ⚠️ Two restraint levels so Craig picks on device; **barely-there is the recommendation.**

### ✅ V1 — BARELY-THERE (recommended): the world, two honest facts, the invite

Over the **revealed living world** (§4), centred, quiet — **no title bar, no scorecard**:

> **The world is known, and it flourishes.**
>
> <sub>The wild keeps turning. Roam on whenever you like — nothing here ever resets.</sub>

That single line **is** the statement: *known* (you came to understand it) **and** *flourishes* (it
thrives) — two facts side by side, **no causation** ("and," never "because of you"). The free-roam line
(unchanged) carries the gentle "nothing resets."

**A rhythm variant** (same words, two beats — if one line reads too flat over the world):

> **The world is known.**
> **And it flourishes.**
> <sub>The wild keeps turning…</sub>

### V2 — SLIGHTLY-MORE: + one quiet record line (the census voice, if v1 feels too bare)

> **The world is known.**
> **And it flourishes.**
> *Every creature recorded; every place, come to know.*
> <sub>The wild keeps turning…</sub>

The added line is the **census record voice** (recorded / come to know) — honest, no boast. ⚠️ This is
the **most** I'd add; a scorecard of counts/rank would pull back toward "score."

### The phrasing ballot (Craig's ear — the lead line)

| | Line | Note |
|---|---|---|
| **A (rec)** | **"The world is known, and it flourishes."** | the task's framing; the pairing, one breath |
| B | "The world is known." / "And it flourishes." | the two-beat rhythm |
| C | "A world come to know — and flourishing." | softer, more lyrical |
| D | "Known. And flourishing." | most terse (risks cryptic) |

⚠️ **Forbidden register** (the cringe that deflates it): *"You saved the world," "You restored nature,"
"Thanks to you…," "A world reborn."* The flourishing is the **world's own**; the knowing is **yours** —
keep them parallel, never causal. **Trust the player to feel it.**

---

## #4 — ⚠️ The presentation (the flourishing WORLD carries it)

**The key finding:** today the win **occludes** the world (the opaque veil + solid card). The capstone's
one real presentation move is to **REVEAL it** — the warm, alive, thriving world (TL1/TL2, still
*moving* behind via CJ2/TL2) **is the statement**; the words are minimal accompaniment.

- **Drop the dark veil to a gentle wash.** `.win-overlay` backdrop `rgba(…,.92→.96)` → a soft
  ~`rgba(8,18,10,.28)` vignette (world clearly visible), or a subtle radial darkening only behind the
  text for legibility.
- **Dissolve the solid card.** Replace `.win-panel`'s opaque `rgba(16,30,20,.98)` box with **text over
  the world** — the lines centred with a soft text-shadow (the title already has one), no heavy framed
  certificate. A whisper of backing behind the words if needed for contrast, not a panel.
- **Keep the world LIVE, not frozen.** Don't freeze — let the biome keep breathing behind the words (a
  *living* world is the point). The player is wherever they finished; that warm biome shows through.
- **Reuse everything** — same overlay element, same dismiss-to-free-roam, same fire path. This is a
  **CSS + copy** shift, **not** a bespoke cinematic. The 🌿 can stay as a tiny quiet mark or go (lean: go
  — the world is the flourish).

> The shift in one sentence: **from a certificate that hides the world → to the living world itself,
> with a quiet line over it.**

---

## #5 — The `known · flourishing` tie (the through-line ARRIVED)

The census (#100) made **"known"** (a biome studied) + **"flourishing"** (a biome thriving) a
**biome-level pairing** in the journal header. The capstone closes the loop at the **world level**: the
**whole world** known *and* flourishing — **the same two words, the same restraint, scaled up.** This is
**not a new idea** — it is the through-line's idea, *completed*: the journal taught you to read a place
as *known · flourishing*; the ending shows you the **world** that way. The win should feel like **the
census's meaning, arrived** — the quiet record voice reaching its summit without raising its volume.

---

## #6 — Scope + the L2 note

- **Copy + presentation on the EXISTING win**, reading the world-state. **No new mechanic, no new win
  condition, no engine change, no schema bump.** `WinScreen.ts` (words + read the aggregate),
  `constants.ts` (`WIN` copy + maybe a tiny `worldThriving` helper in the pure `Thriving.ts`), `style.css`
  (the veil/card → reveal). `src/game/` stays pure (the aggregate is a pure fold; the renderer reads it).
- **⚠️ L2:** the win overlay is **NOT in any visual baseline** — the 6 frozen scenes spawn at the start
  with an *incomplete* journal, so the win never fires in them. **No baseline diff, no regen.** *(If the
  build adds a new `?win=1`-style frozen scene to capture the capstone, that's a NEW additive baseline,
  seeded after Craig approves the look — but the existing 6 are untouched either way.)*
- **Tests:** green on this branch — **572 passing** (the recon adds no code).

---

## STOP — the WORDS + presentation are Craig's call (the one-shot peak)

This is the single moment the game makes its emotional statement, felt **once**. **The words are the
design; the gate is Craig's taste.** Before any build, Craig judges:

1. **The words (#3)** — V1 barely-there *(rec)* / V2 + the record line? And the lead-line phrasing
   (A "…known, and it flourishes" *rec* / B two-beat / C lyrical / D terse)?
2. **The presentation (#4)** — reveal the living world behind a gentle wash, words over it, no card *(rec)*?
3. **The scorecard** — **drop** the counts/rank entirely *(rec — collection residue)*, or keep one quiet line?

After Craig picks, the build implements that version — then ⚠️ **device-felt before merge** (a one-shot
feel beat, **non-negotiable, no green-only merge** — Craig is the manual gate). The restraint *is* the
emotion.
