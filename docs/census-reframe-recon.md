# Through-line — the CENSUS REFRAME (recon)

*the journal as a record-that-matters; IMPLIED meaning, honest facts, minimal words*

PLAN.md §4.3 — the through-line's **meaning** work, first slice (tonal, not mechanical). The
living world is built (TL1/TL2 warming + motion, world-state, CJ1/CJ2, the branched world). This
slice adds the **meaning** — but **IMPLIED, never stated**. The game already SHOWS the gull is
declining and lets you feel it; it must never TELL you to care.

> ⚠️ **This is a WRITING / RESTRAINT slice.** The risk is doing **too much** — more words = more
> preachy. Mechanically trivial (copy + light display over the existing journal); tonally
> everything. **No new mechanic, no new system, no schema bump.** The deliverable is **the words**
> (§5). The gate is **Craig's taste**, not tests. Where it helps, two versions are shown — a
> **barely-there** pick and a **slightly-more** option — so the restraint level is Craig's dial.

---

## #1 — The journal NOW (what the reframe shifts)

The Field Journal is an HTML overlay (`JournalPanel.ts`) — a card per caught species, a dimmed
"???" silhouette per un-found one, grouped by biome. The exact strings today:

| Where | Code | Reads as |
|---|---|---|
| **Top header** | `` `Field Journal — ${foundCount} of ${N} found` `` | **"17 of 22 found"** — a collection tally |
| **Biome header** | `` `${displayName} — ${found} of ${total}${locked?' · locked':''}` `` | **"Coast — 3 of 5"** — a per-biome score |
| **Thriving word** (unlocked biome) | `thrivingWord(...)` → `quiet / waking / alive / flourishing` | a soft green italic word beside the biome header (TL1 — already record-ish ✅) |
| **Card status** | `` `<div class="card-section card-status"><span class="card-label">Status</span>${info.status}</div>` `` | label **"STATUS"** (uppercase, system-y), sentence in **hopeful green** |
| **Silhouette** | `` `???` `` + `` `Not yet found` `` | the visible gap that pulls |
| **Win screen** | `${found} of ${N} creatures **catalogued**` (`WinScreen.ts` / `WIN`) | already uses the record word "catalogued" ✅ |

**The verdict:** it's **half-way there already.** The thriving word and the win-screen
"catalogued" are record-voiced; the honest `status` sentences are seeded and good. But the
**counts say "found"** (a collection score) and the **status label says "STATUS"** (a system
field). The reframe is a handful of **word swaps** + one **light display** choice — nothing more.

---

## #2 — ⚠️ The STATUS lines (the emotional core — honest facts doing the work)

The `status` values are **already the emotional payload** — honest, specific, un-preachy. A
representative spread (verbatim, `constants.ts`):

> **Herring Gull** — *"Surprisingly red-listed and in decline — the bold 'town gull' masks a real
> fall in our wild seabird colonies."*
> **Curlew** — *"Near-threatened and falling fast — and Britain is a global stronghold, so the
> curlew is the upland's biggest single stake."*
> **Twite** — *"Red-listed and declining — the twite has lost the seeding plants of the hay
> meadows and rough ground it depends on."*
> **Grey Seal** — *"A conservation success — Britain now safeguards nearly half the world's grey
> seals, back from the brink."*
> **Water Vole** — *"Britain's fastest-declining mammal — but where clean banks are kept safe from
> American mink, the water vole bounces back."*
> **Robin** — *"Common and thriving — robins do well in woods, hedges and gardens alike."*

These sentences **already do the work.** ⚠️ **The single biggest restraint call of this slice:
DO NOT rewrite them.** They are honest, plainspoken, and carry quiet weight precisely *because*
they state the fact and stop. Rewriting 30 lines to be "more moving" is the exact over-reach that
would break character. **Leave the sentences. Touch only the frame around them.**

What to touch — two minimal levers:

**(a) The label.** "STATUS" reads as a system field. A naturalist's record observes; it doesn't
report a stat. Reframe the label so the sentence reads as an **observation of the creature's real
standing**, not a game field:

| | Label | Reads as |
|---|---|---|
| now | `STATUS` | a data field |
| **v1 (recommend)** | `In the wild` | a field-note observation — quiet, naturalist |
| alt | `How it fares` | a touch more voiced |

**(b) The colour (the quiet-weight question).** Today every status is **hopeful green**
(`.card-status { color: rgba(174,255,196,.85) }`). For a *recovering* species that's right — but
on a **declining** line the reassuring green subtly **editorialises the fact hopeful**, softening
exactly the weight we want it to carry. ⚠️ The fix is **NOT** a warning colour / red / a ⚠️ badge
(that's the lecture). It's the opposite — make it **calm and neutral** so the **words stand
unframed** and do their own work:

- **v1 (barely-there):** keep the green. Label-only change. *(Lowest-touch; ships the reframe with
  one word.)*
- **v2 (recommend):** recolour status from hopeful-green to a **calm parchment/ink** tone (the
  same warm off-white as the field note) — neither hopeful nor grim. The declining gull and the
  recovering seal then read in the **same quiet voice**, and the *sentence* is the only thing
  carrying the difference. This is *less* dressing, not more — fully in keeping with restraint.

> **Recommendation: v2.** Recolouring to neutral is the truest "let the fact sit there" move — and
> it's quieter than what's there now, so it can't read as preachy.

---

## #3 — ⚠️ The biome "UNDERSTOOD" state (comprehension, not completion)

Today a fully-catalogued biome reads **"Coast — 5 of 5"** — a perfect score. The reframe: when a
biome is fully studied, the **count gives way to a quiet word of comprehension** (you've come to
*know* this place — not "100%", not "✓ complete"). The number is a pull while there's a gap; once
the gap closes, a **word** is the right close.

⚠️ **Draft the word — Craig picks.** In place (with the existing thriving word beside it):

| Word | Renders | Note |
|---|---|---|
| **known** | `Coast — known` · *flourishing* | warm; "I know this place now" |
| **recorded** | `Coast — recorded` · *flourishing* | the census/record voice |
| documented | `Coast — documented` · *flourishing* | precise, a touch clinical |
| understood | `Coast — understood` · *flourishing* | the brief's word; slightly abstract for a *place* |

**Note the happy interplay with the thriving word** (which stays): a complete biome reads
**"Coast — known · flourishing"** — *your* comprehension (known) beside *the world's* vitality
(flourishing). Two different things, no redundancy. It reads as a record that matters.

> **Recommendation: lead with `known`** for the place (comprehension/warmth), and use `recorded`
> for the species counter (§4, the act). Two registers: you **record** each creature; you come to
> **know** each place. *(If Craig wants one vocabulary everywhere, `recorded` works for both.)*

Incomplete biomes are **unchanged** ("Coast — 3 of 5") — the gap still pulls.

---

## #4 — The overall FRAME (collection → record)

The top header **"…of 22 found"** is the most collection-score-ish string in the journal. "found"
is a hunter's tally; **"recorded"** is a naturalist's. One word turns the whole frame:

| | String | |
|---|---|---|
| now | `Field Journal — 17 of 22 found` | a tally |
| **v1 (recommend)** | `Field Journal — 17 of 22 recorded` | a record (and `catalogued` already lives on the win screen — same family) |
| alt | `Field Journal — 17 of 22 catalogued` | exact match to the win-screen word |

Plus the matching silhouette line: **`Not yet found` → `Not yet recorded`** (one word, keeps the
vocabulary consistent).

**v2 (slightly-more), only if v1 feels too thin** — a one-line subtitle under the title, the
*only* added prose this slice would carry:

> `Field Journal`
> <sub>a record of the living world</sub>

…or `a census of the living world`. ⚠️ This is the **most** I'd add — a five-word subtitle is the
ceiling before "stating the meaning." **Recommend shipping WITHOUT it** (the word swaps alone
carry the frame); hold the subtitle as Craig's dial-up.

---

## #5 — ⚠️ THE ACTUAL DRAFTED COPY (the deliverable)

Everything above, as the real strings. **The barely-there column is the recommendation;** the
slightly-more column is Craig's dial.

| # | Element | NOW | ✅ Barely-there (recommend) | Slightly-more (dial-up) |
|---|---|---|---|---|
| a | Top counter | `… 22 found` | `… 22 recorded` | + subtitle `a record of the living world` |
| b | Silhouette | `Not yet found` | `Not yet recorded` | — |
| c | Biome (incomplete) | `Coast — 3 of 5` | *(unchanged)* | — |
| d | Biome (complete) | `Coast — 5 of 5` | `Coast — known` | `Coast — known` |
| e | Status label | `STATUS` | `In the wild` | `In the wild` |
| f | Status colour | hopeful green | hopeful green | **calm parchment** (let the fact stand) |
| g | Status sentences | *(honest, seeded)* | **UNCHANGED** ⚠️ | **UNCHANGED** ⚠️ |
| h | Thriving word | `quiet/waking/alive/flourishing` | *(unchanged ✅)* | — |

**The whole reframe, as a player would read a completed Coast card-and-header:**

```
Field Journal — 22 of 22 recorded

Coast — known                                   flourishing
  ┌───────────────────────────────────────────────────────┐
  │ Herring Gull                                           │
  │ A big, bold gull that takes fish and scavenges the     │
  │ shore by day…                                          │
  │ Diet: Fish   Habitat: Coast   Active by day            │
  │ BEHAVIOUR  Loud and clever, it patrols the tideline…   │
  │ DID YOU KNOW  …                                        │
  │ IN THE WILD  Surprisingly red-listed and in decline —  │
  │   the bold "town gull" masks a real fall in our wild   │
  │   seabird colonies.                                    │
  │ Caught ×3 · first 10/06/2026                           │
  └───────────────────────────────────────────────────────┘
```

Nothing tells you to care. "**recorded**", "**known**", "**in the wild**", and the unflinching
honest line — the meaning is **implied** by the frame and **carried** by the fact. That's the
slice.

**Net change: ~5 words swapped + 1 colour value + 1 small "complete-biome" branch.** That is the
entire writing surface.

---

## #6 — Scope, purity, forward-compat

**Pure copy + light display over the existing journal.** No new mechanic, no engine change, **no
schema bump** — the data already exists: `SPECIES_INFO[].status` (the honest lines), `foundCount`
+ the per-biome `found/total` (biome completion). The "understood" state is **derived** at render
(found === total), like the thriving word — **no persisted field.**

- **Touch points (build slice):** `JournalPanel.ts` (counter string, the complete-biome branch,
  the card label), a small copy block in `constants.ts` (`PANEL_LABELS` / the status label / the
  completion word), `style.css` (the one status-colour value, if v2/f), and `Not yet recorded`.
  Optionally align the silhouette/win wording — but the **win-screen reframe is the capstone's
  job** (below), so leave `WinScreen`/`WIN` untouched this slice.
- **`src/game/` purity preserved.** `Thriving.ts` stays pure and sim-isolated; all new words live
  in `constants.ts` + the rendering layer. No `three` under `src/game/`.
- **L2:** the journal is a **DOM overlay** — the visual-regression baselines capture the **3D
  canvas**, not the HTML panel. **No world-canvas baseline diff** expected. *(Confirm: the build
  slice changes no scene/biome colour, so the 5 existing baselines are untouched.)*
- **Tests:** green on this branch — **543 passing** (the recon adds no code).

**⚠️ Forward-compat with the CAPSTONE** (the next §4.3 slice — *the win reframed as "the world
flourishes"*): the voice this slice sets is the voice the capstone inherits. Three things carry
forward:
1. **The record vocabulary** (`recorded` / `known`) — the capstone's win copy shifts from "Field
   Guide Complete / catalogued" toward the same quiet register.
2. **The honest-status-carries-weight principle** — the capstone celebrates without a lecture, the
   same way.
3. **The comprehension-beside-vitality pairing** — this slice already shows it at the biome scale
   (**"known · flourishing"**); the capstone **scales it to the whole world** (every biome
   flourishing → *the world flourishes*). The win screen becomes the biome header, writ large.

*(Don't build the capstone — just inherit this voice.)*

---

## STOP — the COPY decision is Craig's

This is a writing slice: **the words ARE the design.** Before any build, Craig judges the **tone**:

1. **Status label** — `In the wild` (rec) / `How it fares` / keep `STATUS`?
2. **Status colour** — recolour to calm parchment (rec, v2/f) / keep hopeful green (v1)?
3. **Biome "understood" word** — `known` (rec) / `recorded` / `documented` / `understood`?
4. **Counter word** — `recorded` (rec) / `catalogued`?
5. **The subtitle** — ship without it (rec) / add `a record of the living world`?

After Craig picks the words, the build slice implements them (then Craig playtests the **feel** —
does the journal read as a record-that-matters: **moving, not preachy**).
