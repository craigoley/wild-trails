# Chip-tap detail sheet — recon / design

**Status:** RECON / DESIGN ONLY (no build). Map the data, confirm the tap target, design the
bottom sheet — then stop for Craig's decision. **Display-only** (surfaces existing data).

Tapping the play-screen target chip (e.g. "Roe Deer · 0/1") opens a **bottom sheet** with the
species' **where / how / why**. Most data exists; the one new thing is making the passive chip a
tap target without breaking roam.

---

## 1. The tap target (the one new thing) — and the roam-gesture boundary

### How the chip renders today
`src/rendering/TargetChip.ts` builds one `div.hud-target` (a portrait + `name` + `p/c`), in the
top-left passive stack. Its CSS (`style.css:1612`) is **`pointer-events: none`** — *"a passive
label — never blocks play."* It's hidden under `body.modal-open` (`style.css:1066`), pulses with
`.is-near`, and rebuilds only on signature change.

### Why a naive tap "works against" us today
The roam gesture decides ownership at `touchstart` by **target type only**
(`Controls.isRoamTouchTarget`, `Controls.ts:50`):

```ts
export function isRoamTouchTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLCanvasElement; // ONLY the WebGL canvas starts a roam
}
```

Because `.hud-target` is `pointer-events: none`, a touch on the chip **passes through** and its
`e.target` becomes the **canvas behind it** → `isRoamTouchTarget` returns true → **the tap starts
a roam.** That's *why* the chip is "passive" today: tapping it currently roams the world.

### The clean fix (tap target without breaking roam) — CAUSE-matched, low-risk
Two small changes, both render-layer:

1. **`.hud-target { pointer-events: auto }`** — now a touch on the chip **targets the chip**, not
   the canvas. The roam handler is canvas-only, so it **skips** the chip touch automatically
   (`onTouchStart` returns early when `!isRoamTouchTarget(e.target)`, `Controls.ts:285`). No roam
   handler change needed — the gesture boundary is already target-based and already correct.
2. **A `pointerdown` listener on the chip** that opens the sheet, mirroring the action buttons
   (`Controls.makeActionButton`): `e.preventDefault()` + a `touchstart` `stopPropagation()` for
   defensive parity (the roam handler already ignores it, but this matches the established button
   pattern and stops any synthetic double-tap).

**Result:** a tap on the chip opens the sheet; a drag elsewhere on the canvas still roams; a drag
that *starts* on the chip simply doesn't roam (a tiny dead-zone, exactly like starting a drag on
the CATCH button). **No roam-handler change, no gesture conflict** — the ownership rule
(canvas-only) does the work.

⚠️ **Tap-size note:** the chip is ~38px tall (30px thumb + padding) — just under the 44px HIG
minimum. Recommend bumping its hit area (padding / min-height ≥44px) when it becomes tappable.
It lives top-left (not the prime thumb zone), but the *sheet* it opens is bottom-anchored and
thumb-reachable — the tap is a one-off; the reading happens at the bottom.

**Open question for Craig:** open on `pointerdown` (immediate, matches buttons) vs a `click`/tap
(guards against an accidental drag-through)? Recommend **pointerdown** — consistent, and the
pointer-events fix already prevents the drag-through-to-roam case.

---

## 2. The data map (each field — source, and whether it must be derived)

The chip's tracked target is resolved in the main loop (`main.ts:570`):
`trackedId = resolveTracked(trackedOverride, journal, game.currentBiome)`, then
`targetForMission(trackedId, journal, …)` → `{species, progress, count}`. The sheet reads the
**same** `trackedId` (see §4) → its species is the chip's species.

### LEAD — ✅ all exists
| Field | Source |
|---|---|
| Portrait | the slice-(i) cached thumbnail — `thumbUrl(species)` (the same getter `main.ts:576` passes the chip + panels) |
| Name | `SPECIES[species].displayName` |
| Catch progress | `targetForMission(trackedId, journal)` → `{progress, count}` (the chip's exact numbers) |

### WHERE — ✅ all exists (a pure read of the species def)
| Field | Source |
|---|---|
| Habitat / biome | `SPECIES[species].biome` → `BIOMES[biome].displayName` |
| Phase | `SPECIES[species].activityWindow` → `ACTIVITY_LABEL[window]` — `"Active at dusk"` … `"any" → "Active all day"` (`constants.ts`, the `ACTIVITY_LABEL` map) |

### HOW — ✅ diet/bait exists; ⚠️ the behaviour/cover TIP must be DERIVED
| Field | Source |
|---|---|
| Diet / bait | `SPECIES[species].bait` (a `BaitId`) → `BAIT_DISPLAY[bait].label` — e.g. `"Greens"`, `"Seeds"`, `"Insects"`, `"Fish"`, `"Shellfish"`. ✅ |
| Behaviour / cover tip | ⚠️ **No dedicated tip field exists.** There IS `SPECIES[species].profile` (a short journal "did-you-know" line), but it's *confirmation flavour*, not a how-to-catch tip. |

**Proposal — DERIVE a short tip from existing mechanical data (no new lore authored):**
- **Wariness** from `detectionRadius` (a real field): high → *"Wary — approach slowly, from
  cover."*; low → *"Bold — lets you get close."* (one threshold, a constant.)
- **Bait** from `bait`: *"Bring **Greens** — the right bait calms and lures it."*
- **Water bolt** from `fleesToWater` (optional field): *"Bolts for water — a dip-net helps."*

These are all **facts already in the data** (the catch mechanic), just phrased — not invented
prose. `profile` can optionally ride along as a one-line flavour under the lead. Final tip wording
+ the `detectionRadius` threshold are Craig's call.

### WHY — ✅ exists; the linkage is a reverse-scan of the existing mapping
The chip's target **is a mission** (`trackedId`), so the **primary WHY is that mission** —
guaranteed consistent with the chip:
- Title / text: `MISSIONS[trackedId].title` + `.description`
- Progress: `journal.missions[trackedId]` → `{progress, completed}` vs `requirement.count`

**A species can serve MULTIPLE active challenges.** To list the others, **reverse the
`speciesForChallenge` mapping** (no new data):
- Missions: scan `MISSION_ORDER`, keep the trackable/active ones (`!completed`,
  non-`standalone` — the `isTrackable` rule already in `trackedTarget.ts`) whose
  `speciesForChallenge(MISSIONS[id].requirement) === species`.
- Research: scan `RESEARCH_ORDER`, keep `started && !completed` whose
  `speciesForResearch(id) === species`, with `RESEARCH_PROJECTS[id].name` + its progress.

**Recommendation:** lead WHY with the **tracked mission** (the chip's own goal), then optionally a
quiet *"Also serves:"* list of the other active challenges. (Biome/phase representative targets —
the signature species — resolve their WHY to the "catch in the meadow" / "catch at dusk" mission
the same way; the reverse-scan finds it.)

---

## 3. The bottom sheet (design)

A **new lightweight bottom sheet** (not the centered-panel scaffold), reusing the proven dismissal
plumbing:

- **Anchoring:** rises from the bottom edge, covers the lower ~half/two-thirds; a **light scrim**
  over the rest so the **world stays visible above** (spatial context — not a full-screen modal).
- **Structure (progressive disclosure):**
  - **Lead:** portrait + name + catch progress (+ optional `profile` flavour line).
  - **WHERE** · **HOW** · **WHY** — three tight, scannable sections (icon + label + a line or two).
- **Dismissal (never a trap):** reuse `addOverlayDismiss(root, sheet, isOpen, close)` →
  **scrim/backdrop tap + ✕ + Escape**, plus a **drag-handle** affordance at the top of the sheet
  (visual handle; a swipe-down-to-close can come later — the scrim tap already guarantees an
  obvious exit).
- **Layering:** reuse `body.modal-open` by adding `detailSheet.isOpen()` to the `modalOpen` poll
  (`main.ts:480`). That hides the gameplay HUD + buttons + chip while open (no stray CATCH/BAIT
  behind the sheet) — but the **canvas/world is not hidden by `modal-open`**, so the world still
  reads above the light scrim. The roam is naturally suppressed too: the scrim covers the canvas,
  so a touch on it is a non-canvas target → no roam.
  - ⚠️ Decision for Craig: full `modal-open` (HUD hidden, world visible — recommended, consistent
    + safe) vs an even lighter touch (leave the HUD up). Recommend `modal-open` for the no-stray-
    tap safety the other panels rely on.

It's a **new sheet class** (`DetailSheet` in `src/rendering/`) — the centered overlay scaffold
doesn't fit a bottom sheet, but the **dismissal + modal-open** plumbing is reused as-is.

---

## 4. "Which species" — consistency with the chip

The sheet, on open, captures the **same tracked target the chip shows**: the main loop already
computes `trackedId = resolveTracked(trackedOverride, journal, game.currentBiome)` every frame
(`main.ts:570`). The sheet opens against **that** `trackedId` (the boundary hands it the current
tracked mission, exactly as it hands the chip), so the sheet details **exactly the species the
chip portrays** — including a biome/phase **representative** (the signature species) when the
tracked challenge is a biome/phase kind. Single source of truth → the chip and the sheet can never
disagree.

---

## 5. Scope + L1 / L2

- **Display-only.** It SURFACES existing data: the species defs, missions, research, and journal
  are **READ, never written**. No catch / spawn / mission / gameplay change.
- **No schema bump.** The sheet is session UI (open/closed state in memory) — like the chip's
  `trackedOverride`, no persistence.
- **`src/game/` purity:** the assembly is a **pure helper** — `speciesDetailFor(species, journal)
  → { where, how, why }` in `src/game/` (imports only `constants` + `Journal` types; no `three`),
  unit-testable. The sheet **render** is DOM in `src/rendering/DetailSheet.ts`; the **tap wiring**
  is the chip listener (rendering/input). Mirrors the existing `catchTarget.ts` (pure data) +
  `TargetChip.ts` (DOM) split.
- ⚠️ **L2 / reseed:** the sheet is a **DOM overlay** (like every panel + the chip). The L2 visual
  baselines screenshot **`#app canvas` only** → a DOM overlay has **ZERO canvas baseline impact**
  → **no reseed**, same as all the HUD/panel work. The `pointer-events: auto` flip + the chip
  hit-area bump are CSS on a DOM element, also no canvas impact.
- **Tests:** unchanged in this recon (doc-only) — suite green. The build would add: pure tests for
  `speciesDetailFor` (each section's data; the WHY reverse-scan; the derived HOW tip), a chip
  tap-target test (the listener fires / `pointer-events`), and a sheet open/dismiss test.

## TL;DR

- **Tap target (#1):** the chip is `pointer-events: none`, so taps fall through to the canvas and
  roam. Fix = `pointer-events: auto` + a `pointerdown` listener. The roam handler is **canvas-only**
  (`isRoamTouchTarget`), so it auto-skips the chip — **no gesture conflict, no roam-handler change.**
  Bump the chip to a ≥44px hit area.
- **Data (#2):** LEAD + WHERE + diet/bait + WHY all **exist** (species def + `ACTIVITY_LABEL` +
  `BAIT_DISPLAY` + `MISSIONS`/`RESEARCH` + journal). The **HOW behaviour tip is the only gap** —
  **derive** a short one from `detectionRadius` / `bait` / `fleesToWater` (mechanical facts, no new
  lore). WHY = the tracked mission (consistent), plus an optional reverse-scan for other active
  challenges targeting the species.
- **Sheet (#3):** a new lightweight bottom sheet (lead + WHERE/HOW/WHY), reusing `addOverlayDismiss`
  (scrim/✕/Escape) + a drag-handle, with `body.modal-open` (HUD hidden, world visible above a light
  scrim).
- **Consistency (#4):** opens against the **same `trackedId`** the chip uses — never disagrees.
- **Scope (#5):** display-only, no schema, `src/game/` pure helper, **ZERO L2/reseed impact** (DOM
  overlay).
