# UX bugfix — diagnosis (recon)

*5 panel/HUD bugs from Craig's device screenshots. ⚠️ A BUG-FIX pass: each bug's CAUSE is found before
any patch. All display-layer (panels / HUD / thumbnail render) — no gameplay, no engine. **Diagnosis
only — no fix yet.***

Each bug is labelled **CAUSE** (verified in the code) vs **HYPOTHESIS** (likely, confirm on device).

> ## ⚠️ The headline (P1) + a scope correction
> - **P1 is a RENDERING choice, not a logic bug — but the naive "hide the card" would BREAK unlocking.**
>   The access research (`unlock-the-pineforest`, …) is **genuinely startable while the biome is locked**
>   — that's *how you unlock it* (Start it → do its activity → the biome opens). So its card + an enabled
>   **Start** correctly appear under "PINE FOREST · LOCKED". Simply hiding the card/Start removes the only
>   way to start the access research → the biome becomes un-unlockable. The clean fix **relocates** the
>   access card to the **accessed prereq area** (where its activity is done + it's actionable), leaving
>   the locked biome with **only a breadcrumb** — rendering-only, the engine untouched.
> - **⚠️ Scope correction: these fixes have ZERO L2 baseline impact.** The L2 baselines screenshot
>   `#app canvas` only; the panels, the HUD chip, and the thumbnails are all **DOM overlays** (the
>   thumbnail RTT renders offscreen → a DOM `<img>`). So **no reseed is needed** for P1–P5 — the pending
>   seasonal reseed (which moved the *canvas*) is entirely separate.

---

## P1 — LOCKED biomes show the full access card + a "Start" button (shots 1–2)

**CAUSE (verified).** The Research panel groups projects **by `area`** (the *target* biome). A locked
area renders its **visible** project rows *fully* — `ResearchPanel.refresh`:
```ts
for (const id of g.visibleIds) this.list.appendChild(this.row(id)); // a FULL row — incl. the Start control
```
`visibleIds` comes from the **hide rule** (`researchGroups.isProjectVisible`): *shown iff its activity
area is accessed OR it's started.* The gating project's **activity** is in the **prereq** biome (e.g.
`unlock-the-pineforest`'s activity = catch-in-**woodland**). So when the prereq is accessed (i.e. the
biome is **next-reachable**), the gating project is `visible` → rendered as a full row under the **locked
target** header, **with an enabled Start** (`canStartResearch` is true once the prereq is met). Farther
biomes (prereq *not* accessed) → the gating project is hidden → only the teaser `"More lands ahead."`
shows. **That inconsistency is the one-area-ahead horizon — Riverbank/Coast/Moor are beyond it.**

⚠️ **It is NOT a logic bug.** The access research must be **Started** (`startResearch`) for its activity
to count (`canStartResearch` → `startResearch` → the bar fills → the biome unlocks). So the Start button
under a locked biome is *functional* — it's the unlock mechanism. **Hiding it naively breaks unlocking.**

**FIX (rendering-only) — relocate + breadcrumb.** Change the *display* grouping so a **gating
(biome-access) project renders under its ACTIVITY area** (the accessed prereq, where you do the work +
can Start), not under its locked target. The **locked biome** then shows **only** its breadcrumb:
`PINE FOREST · LOCKED — Reach by completing "Pine Forest Access" in the Woodland.` (name + LOCKED + the
one-line how-to-reach; **no card, no Start**). The full *internal* study cards appear when the biome
unlocks (unchanged). ⚠️ **Engine/gating/projects untouched** — only `researchGroups` (which area a card
displays under) + the locked-section render change. *(Alternative — auto-start the access research so no
Start is needed — is MORE invasive: it changes the research flow. Not recommended.)*

---

## P2 — "Reach New Lands" cards: broken, overlapping multi-column layout (shot 5)

**CAUSE (verified).** The unlock breadcrumb (`MissionPanel.appendUnlockBlock` → `unlockLines`) builds a
row with a **goal**, a **progress** ("0 of 3"), and **stacked sub-lines** (the `✓ Research: Night Shift`
challenge + the `Highlands Access (0/4)` research):
```html
<div class="unlock-line"> <div class="unlock-goal">…</div> <div class="unlock-prog">0 of 3</div>
  <div class="unlock-research">✓ … Night Shift</div> <div class="unlock-research">… Highlands Access 0/4</div> </div>
```
But `.unlock-line` is **`display:flex` (ROW) + `justify-content:space-between`** — and the sub-lines set
`width:100%` *hoping* to drop to their own line. In a **row** flex with no `flex-wrap`/`column`, a
`width:100%` item just **collides** with the goal+prog on the same baseline → the overlapping, unreadable
columns. (The portrait work didn't touch this; the unlock block has no portrait.)

**FIX (CSS-only).** Make `.unlock-line` a **column**: a header row (`goal` + `prog` via a small inner
flex with `space-between`), then the `.unlock-research` sub-lines **stacked below**, each full-width,
properly spaced (the requirement → the progress → the ✓ challenge → the research, top to bottom,
readable). No DOM/data change needed (or a thin wrapper div around goal+prog).

---

## P3 — the rendered thumbnails are too DARK to read (shots 1–2, 6)

**CAUSE (verified — the root) + HYPOTHESIS (the compounders).** The thumbnail RTT
(`thumbnailRenderer.ts`) renders into a plain `new WebGLRenderTarget(S, S)` and `readRenderTargetPixels`
→ a dataURL. ⚠️ **The render target has no sRGB colour space**, so the readback returns **LINEAR**
pixels — *darker + flatter* than the **sRGB-encoded** live canvas (three's `WebGLRenderer` applies the
sRGB output transform on display, but a raw render-target readback does NOT). So the SAME model that
reads fine in the live scene comes out **dark** in the thumbnail. **This is why the thumbnails are dark
but the journal `.card-swatch` (a flat species colour, no render) reads fine.** Compounded by
`THUMBNAIL.background = 0x2a2f26` (dark) + modest light (`ambient 0.6` / `key 1.05`) → a dark animal on a
dark bg.

> ⚠️ **Re the "mission thumbnails read fine, research dark" observation:** both panels use the **same**
> RTT thumbnail, so the root cause hits both equally — the difference is likely the **species shown**
> (lighter vs darker animals) or the row-bg contrast, not the render path. **Confirm on device after the
> sRGB fix** (it brightens all RTT thumbnails uniformly).

**FIX.** Set the render target's texture to **sRGB** so the readback matches the live render —
`target.texture.colorSpace = SRGBColorSpace` (the root fix). **+** a small lift for legibility: a
**lighter thumbnail background** (so the dark animals separate) and/or a touch more **key+fill light** —
all in `THUMBNAIL` (no magic numbers). Display-only.

---

## P4 — the target CHIP shows a WRONG-BIOME target (shot 6: Roe Deer in the Meadow)

**CAUSE (verified).** `defaultTrackedMission` **already** prefers the current biome's first active goal —
but its **fallback** (when the current biome has none) returns the **first incomplete non-standalone
mission in `MISSION_ORDER`**, regardless of biome or progress:
```ts
for (const id of MISSION_ORDER) {
  if (!isTrackable(id, journal)) continue;
  if (first === null) first = id;                                   // ← the fallback = the FIRST one
  if (SPECIES[speciesForChallenge(MISSIONS[id].requirement)].biome === biome) return id;
}
return first;
```
The Meadow set (`meadow-survey` / `-dawn` / `-dusk`) is **non-standalone**, so a fresh Meadow tracks a
Meadow goal correctly. The Roe-Deer bug appears once the **Meadow set is COMPLETE** and the player is
working through the Woodland: in the Meadow (no active Meadow goal), the fallback returns the first
incomplete — `woodland-dusk` (catch-species **roedeer**) — even at 0 progress. So the chip points to a
**0-progress Woodland** target while you stand in the Meadow.

**FIX.** Two honest options for "no goal in the current biome" (Craig's call):
- **(a) Fall back to NEAREST-to-complete** (the mission with the most progress toward its count) instead
  of "first in MISSION_ORDER" — so the fallback is at least a goal you're *close* to, never a random
  0-progress one. *(Matches Craig's "falling back to nearest-complete".)*
- **(b) HIDE the chip** when the current biome has no active goal — "the goal for where you are" → if
  there's none here, show nothing. Cleanest "no wrong-biome ever," but no carrot in a finished biome.

**Recommend (a)** (a meaningful fallback) — pure (`trackedTarget.ts`), display-only. Confirm a/b with Craig.

---

## P5 — text overflow: the count wraps; the Start overlaps (shot 1)

**CAUSE (verified).** The research activity line (`.research-activity` / the access card's `"Catch in the
Woodland · 0 / 4"`) has **no `white-space: nowrap`**, so the count breaks across lines (`0 /` ⏎ `4`). And
`.research-row` is `display:flex` (`portrait | info | control`) — on a narrow screen, with the slice-(i)
portrait now taking width, the **info + the Start control cram** and the Start overlaps the text.

**FIX (CSS-only).** `white-space: nowrap` on the activity count (and the `.research-progress-label`);
keep `.research-info { min-width: 0; flex: 1 }` and give the control a `flex: 0 0 auto` + a gap so it
never overlaps; let the row wrap the control beneath on very narrow widths if needed. *(P1's relocate
also removes the access card from the locked biome — P5 still applies to the access card under its
accessed prereq area + any long activity line.)*

---

## #6 — Scope (all display-layer)

- **All 5 are DISPLAY-layer** — panels (`ResearchPanel` / `MissionPanel` / `researchGroups` /
  `unlockLines`), the HUD chip (`trackedTarget`), the thumbnail render (`thumbnailRenderer`), + CSS.
  ⚠️ **NO gameplay/catch/spawn/mission-engine change** — the access challenges, the gating logic
  (`canStartResearch` / `reconcileResearchUnlocks` / `isBiomeGateMet`), and the missions are **untouched**;
  this fixes how they **display**, not what they **do**.
- **P1 is rendering-only** (the verified worry): the access research stays startable + the unlock path is
  preserved — the card just **relocates** to its accessed prereq area; the locked biome shows a
  breadcrumb. The engine never sees it.
- **`src/game/` purity:** the pure helpers that change (`trackedTarget`, maybe `researchGroups`/
  `unlockLines` if they move — they're pure presentation transforms) stay data-only; the thumbnail/CSS
  are render. No `three` in `src/game/`.
- **⚠️ L2: ZERO baseline impact.** The L2 baselines screenshot `#app canvas` only; panels + HUD +
  thumbnails are all **DOM** → **no reseed needed** (the pending seasonal canvas reseed is separate).
- **Tests:** green on this branch — **715 passing** (the recon adds no code). The fixes add: the P1
  relocate/breadcrumb (researchGroups pins), the P4 nearest-complete fallback (trackedTarget pin), the
  thumbnail sRGB (render — device-validated), and the CSS (P2/P5 — DOM tests where pinnable).

---

## STOP — the decision before fixing

Each cause is found. Craig confirms:

1. **P1** — the **relocate-the-access-card + breadcrumb-only locked biome** (rendering-only; keeps the
   access research startable) *(recommended)* — vs. any other framing?
2. **P2** — the single-**column** stacked unlock-line (goal+prog header, then the stacked challenge/
   research lines) *(recommended)*?
3. **P3** — **sRGB the RTT readback** (the root fix) + a lighter thumbnail bg / a touch more light
   *(recommended)*?
4. **P4** — fall back to **nearest-to-complete** *(recommended)* vs. **hide the chip** when the current
   biome has no goal?
5. **P5** — `nowrap` the count + the control spacing *(recommended)*?

After Craig confirms, the build implements all 5 in **one display-layer bugfix PR** (no engine, no
reseed).
