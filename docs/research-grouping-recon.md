# Research panel: recon — group by area + collapse/dim not-yet-accessed areas (keep the how-to-reach breadcrumb)

A recon/design pass for grouping the research panel **by area**, showing accessed
areas fully and **collapsing/dimming not-yet-accessed areas** to a teaser + the
how-to-reach breadcrumb. **Design only — no code in this PR.** The crux is the
**gating-vs-internal hide rule** (#3): get it wrong and you either hide a
breadcrumb (silent wall) or keep showing un-actionable clutter.

Cited to `file:line`. Tests green at **498** on this branch (recon only).

---

## #1 — The panel render now (flat, ungrouped)

`ResearchPanel.refresh()` (`ResearchPanel.ts:~109`) is a **flat scroll**:

```ts
for (const id of RESEARCH_ORDER) this.list.appendChild(this.row(id));
```

`RESEARCH_ORDER` (`constants.ts:2401`) is a single ordered list of 8 ids — no area
grouping, no biome headers. Each `row(id)` renders a card (name, blurb, the unified
progress bar / activity line, the mastery line, and a Start/Complete control).

**Does a project know its AREA?** **No explicit field.** `ResearchProject`
(`constants.ts:2277`) has `activityRequirement` and `reward`, but **no `area`/`biome`
tag**. The area must be *derived*:
- `activityRequirement` (`constants.ts:2258`): `catch-in-biome{biome}` |
  `catch-species{species}` | `catch-in-phase{phase}`.
- `reward` (`constants.ts:2268`): `journal-layer` | `grant-tool` | `bait-access` |
  `biome-access{biome}` | `shop-access`.

The full map (RESEARCH_ORDER):

| Project | name | activity (where you DO it) | reward | role |
|---|---|---|---|---|
| `study-hedgehog` | The Hedgehog at Dusk | catch-species hedgehog *(meadow)* | journal-layer | internal · meadow |
| `study-after-dark` | Nocturnal Field Study | catch-in-phase night *(any)* | journal-layer | internal · meadow |
| `study-the-wetland` | The Water's Edge | **catch-in-biome wetland** | grant-tool dip-net | internal · wetland |
| `study-the-uplands` | The Open Tops | **catch-in-biome highlands** | grant-tool throwing-net | internal · highlands |
| `unlock-the-highlands` | Highlands Access | **catch-in-biome wetland** | **biome-access highlands** | **GATING → highlands** |
| `unlock-the-riverbank` | Riverbank Access | **catch-in-biome highlands** | **biome-access riverbank** | **GATING → riverbank** |
| `study-aquatic-life` | Aquatic Life | **catch-in-biome riverbank** | bait-access fish | internal · riverbank |
| `unlock-the-coast` | Coast Access | **catch-in-biome riverbank** | **biome-access coast** | **GATING → coast** |

> Note the **decoupling**: a GATING project's *activity* is in the area you ALREADY
> have, and its *reward* opens the NEXT area (Highlands Access: catch in the
> **wetland** → opens **highlands**). This is the whole key to #3.

(No woodland research project exists — the panel will only have Meadow / Wetland /
Highlands / Riverbank / Coast sections.)

---

## #2 — The access state (which areas are ACCESSED)

`journalGroups.ts:37` already defines the predicate the journal uses:

```ts
unlocked: biome === 'meadow' || journal.unlockedBiomes.includes(biome)
```

Confirmed by the data: only **meadow** is `unlocked: true` by default
(`constants.ts:171`); **every other biome** (woodland, wetland, highlands,
riverbank, coast) is `unlocked: false` and earned into `journal.unlockedBiomes`
(`Journal.ts:58`, applied to the world at boot). So:

```
isAreaAccessed(journal, biome) = biome === 'meadow' || journal.unlockedBiomes.includes(biome)
```

The ResearchPanel already receives `journal`, so it has this. **Reuse the
`journalGroups` predicate** (don't re-derive) — single source of truth.

---

## #3 — ⚠️ THE HIDE RULE (gating vs internal) — the crux

**The rule (precise):** a project is governed by **where its ACTIVITY happens**, not
what it rewards.

> **Hide** a project iff its activity is biome-locked to a **not-yet-accessed**
> area. **Keep** (show) it iff its activity is in an **accessed** area — this is
> exactly what keeps the gating breadcrumbs visible.

Per activity kind:
- `catch-in-biome{B}` → actionable iff **B is accessed**. (The only kind that hides.)
- `catch-species{S}` → actionable iff the species' home biome is accessed (only
  `study-hedgehog` = meadow today → always accessible).
- `catch-in-phase` → **never hides** (doable in any accessed area, any night).

**Walk it** for a player holding meadow + wetland (NOT highlands/riverbank/coast):

| Project | activity | accessed? | shown? | why |
|---|---|---|---|---|
| study-the-wetland | wetland | ✅ | **show** | internal, actionable |
| **Highlands Access** | wetland | ✅ | **show** | the breadcrumb to highlands (activity is in the area you have) ✓ |
| study-the-uplands | highlands | ❌ | hide | internal throwing-net study, un-actionable clutter |
| **Riverbank Access** | highlands | ❌ | hide | you can't catch in highlands yet — one step too far |
| study-aquatic-life | riverbank | ❌ | hide | internal, un-actionable |
| **Coast Access** | riverbank | ❌ | hide | two steps too far |

**This produces a clean "one-area-ahead horizon":** the breadcrumb you see is for the
**next** area (Highlands Access), whose gating activity is in the area you currently
have. Further areas (Riverbank, Coast) are just "more lands ahead" — their gating
activity is in an area you can't reach yet, so showing their breadcrumb would be a
dead end. **This is precisely the #37 "how to reach the NEXT area" guarantee** — and
the next breadcrumb is *always* visible because its activity is always in your
current area, so **no silent wall is possible**.

### Grouping (which section a project sits under)

Group by the area the project **concerns**:
- `reward.kind === 'biome-access'` → group under **`reward.biome`** (the area it
  opens — it's that area's breadcrumb). e.g. Highlands Access → the **Highlands**
  section, even though its activity is in the wetland.
- otherwise (internal) → group under its **activity biome** (`catch-in-biome.biome`),
  or the species' biome / meadow for the non-biome starters.

This makes each **locked** section self-contained: the collapsed Highlands section
holds *its own* breadcrumb (Highlands Access requirement) + a "more to study here"
teaser for the hidden internal (The Open Tops).

### ⚠️ The one data gap: `catch-in-phase` has no area

Every project derives its area cleanly EXCEPT `study-after-dark` (catch-in-phase
night → no biome anywhere). Two options:
- **(Recommended) add an explicit `area: BiomeId` to each `ResearchProject`** — a
  pure *data* tag in constants (the engine never reads it; only the panel groups by
  it). Unambiguous, future-proof, and makes the gating-vs-internal grouping explicit
  rather than inferred. **Not an engine/logic change, no schema bump.**
- (Alternative, strictly render-only) derive: `catch-in-biome`→biome,
  `catch-species`→species biome, `catch-in-phase`→default `meadow`. Works today
  (the one phase project is a meadow study) but is a fragile special-case.

Recommend the `area` tag — it's a few characters per project and removes the only
ambiguity.

---

## #4 — The collapsed / dimmed not-yet-accessed section

Lightest legible form (dimmed, non-interactive):

```
┌─ MEADOW ──────────────────────────────────────┐   (accessed → full)
│  [The Hedgehog at Dusk]  … cards …             │
│  [Nocturnal Field Study] … cards …             │
├─ WETLAND ─────────────────────────────────────┤   (accessed → full)
│  [The Water's Edge]      … card …              │
├─ HIGHLANDS · locked ──────────────────────── (dim)
│  More to study here once you arrive.           │   ← teaser (only if hidden internals exist)
│  To reach: Highlands Access —                  │   ← BREADCRUMB (the gating project, shown
│    Catch in the Wetland · 0 / 4 + prove mastery│      because its activity is accessed)
├─ RIVERBANK · locked ──────────────────────── (dim)
│  More lands ahead.                             │   ← no actionable breadcrumb yet (Riverbank
└────────────────────────────────────────────────┘      Access activity is in highlands)
```

- **Dimmed area header** with a `· locked` suffix (mirror the journal's
  `journal-biome.locked`, `JournalPanel.ts:107`).
- **"More to study here once you arrive"** — shown ONLY when that area has ≥1 hidden
  *internal* project (don't promise "more" for an area whose only project is the
  gating one). It NEVER names the species/projects (focus).
- **The breadcrumb** = the area's `biome-access` project's requirement, rendered as
  the #37 how-to-reach line — but ONLY when that gating project is *shown* (its
  activity area is accessed). For areas 2+ ahead, omit it → just "more lands ahead".
- No Start/Complete controls in a collapsed section (it's not actionable).

Reuses the existing `describeActivity` (`ResearchPanel.ts:26`) for the breadcrumb
text — no new copy engine.

---

## #5 — ⚠️ The animals / journal (the 2nd surface)

**Current behavior** (`JournalPanel.ts` + `journalGroups.ts`): the journal is
**already grouped by biome**, and **already marks not-accessed biomes**:
- each biome header shows `"{Biome} — X of N found"` + a `· locked` suffix when not
  accessed (`JournalPanel.ts:107-108`, `journal-biome.locked`);
- every not-yet-found species renders as a **nameless silhouette** (`???`),
  including in locked biomes (`JournalPanel.ts:120`) — names are never leaked.

So the journal **already does a horizon treatment**: a locked biome shows *that*
there are species there (the count + N `???` slots) without revealing them — the
deliberate §5.5 "visible gap that pulls."

**Recommendation: scope THIS slice to the research panel only; treat the journal as
a SEPARATE follow-up decision.** Rationale:
- The research panel's problem was **un-actionable clutter** (projects you can't do).
  The journal's locked-biome silhouettes are **not clutter** — they're nameless
  teasers with no action, i.e. already the intended "horizon" form.
- Applying the research-style collapse to the journal would **trade away the §5.5
  pull** (it currently reveals the *count* of species ahead via the silhouette
  slots). Whether to hide that count (collapse a locked biome to a single "more
  species here once you arrive" line) is a real design call that changes a
  deliberate mechanic — **Craig's decision, and a different surface/more work.**

**Decision needed:** does Craig want the journal's locked biomes collapsed to a
teaser (losing the silhouette-count pull), or left as-is (§5.5)? Recommend **left
as-is / follow-up slice** — this slice fixes the research clutter, which is the
actual playtest complaint.

---

## #6 — Scope + L1/L2 + "the gating still works"

- **Render-layer** (+ the optional `area` data tag, #3). The grouping/hiding reads
  `journal.unlockedBiomes` (the access predicate, #2). **No engine/gating change**:
  `evaluateResearch` / `isResearchReady` / `completeResearch` / the unlock dispatch
  are untouched. No new state, no schema bump, no timer. `src/game/` stays pure.
- **⚠️ Does hiding a project break starting/completing it?** The engine is
  independent of the panel:
  - `evaluateResearch` (`Research.ts:132`) advances **every started** project on a
    catch, whether or not it's shown — so progress never stalls from a hide.
  - `canStartResearch` (`Research.ts:72`) has **no area guard today** — so a player
    *can* currently pre-start an internal not-accessed project (pay the cost, then
    can't progress it until they reach the area). Hiding it removes its Start button
    → it can't be pre-started until its area is accessed. That's a **mild UI
    behaviour change, and arguably a fix** (don't let players sink credits into a
    project they can't work on). It does **not** break completion: a `catch-in-biome
    X` project can only *progress* while in biome X, which requires X accessed, which
    means it's shown — so a started project is always visible when it can advance.
  - **Safety guard to include in the build:** show a project if **`started` OR its
    activity area is accessed**, so any pre-existing in-progress project (old save)
    is never hidden mid-flight.
  - **Core progression is never hidden:** the next-area gating breadcrumb is always
    shown (its activity is in the current area), so "how do I advance" is never a
    silent wall.
- **L2 baseline:** the visual baselines screenshot **`#app canvas` (the world) only**
  (`e2e/visual.spec.ts:37`) — there is **no research-panel scene**, so this
  HTML-overlay change **diffs no existing baseline** (nothing to regenerate; the
  gate won't break). If Craig wants the grouped panel under visual regression, that's
  a separate "add an overlay scene" task (same gap noted for the HUD/research-bar).
- **Tests:** 498 green (recon only). The build slice adds tests pinning: grouping by
  area; the gating breadcrumb stays visible while internal not-accessed projects
  hide; the collapsed section shows teaser + breadcrumb (or "more lands ahead"); the
  engine/derivation untouched.

---

## Decisions needed before building

1. **The `area` tag** — add an explicit `area: BiomeId` per project (recommended,
   clean) vs. derive-with-meadow-fallback (strictly render-only but special-cases
   `catch-in-phase`)?
2. **The hide rule** — confirm "hide iff activity biome not accessed (+ show if
   `started`)" and the **one-area-ahead breadcrumb horizon** (next area's breadcrumb
   shown; areas 2+ ahead show only "more lands ahead").
3. **The journal/animals (#5)** — this slice is **research-panel only**; the
   journal's locked-biome silhouettes stay as the §5.5 horizon (recommended), OR
   you want them collapsed too (a separate follow-up slice that changes a deliberate
   mechanic). Confirm.
