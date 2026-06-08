# HUD redesign — recon + layout proposal (mobile thumb-zone + fix the overlap)

A recon/design pass for a **holistic HUD layout** redesign. The HUD grew by
accretion — each arc bolted on a control (HIDE, research toggle, mute, a 4th bait
chip) at hand-picked `position: fixed` offsets — and now **overlaps and crowds on
mobile**. This is a **render/CSS-only** layout pass: it repositions/restyles
controls and must **not** change what any control does.

**This document is design only — no code ships in this PR.** Claims are cited to
`file:line`; collisions are computed for a **390×844** iPhone (logical px) since
that's where the screenshot pain is.

---

## #1 — The current HUD structure

Three sources build the overlay; **every element is independently
`position: fixed`** with hand-tuned offsets (no shared layout container reserves
space):

**Top-left — time + credits** (`TimeIndicator.ts`, `HUD.ts`)
- `.hud-time` `top:12 left:12` — phase pill + a 72×36 sky arc (≈ top 12→90).
- `.hud-credits` `top:84 left:12` — credits readout (sits right at the arc's
  bottom, ~88px).

**Top-center — title + count** (`HUD.ts:62-68`, CSS `style.css:73,87`)
- `.hud-biome` `top:14 left:50% translateX(-50%)` — uppercase biome name.
- `.hud-status` `top:40 left:50% …` — `Caught N`.

**Top-right — the toggle cluster** (`Controls.ts:96-114`, CSS `style.css:340`)
- `.hud-topright` `top:12 right:12`, a **flex row, gap:10**, of **four** 46px
  buttons: `📓 🎯 🔬 🔊` (journal / missions / research / mute).
- Width = 4×46 + 3×10 = **214px** → spans **x 164→378**, y 12→58.

**Bottom-right — the action cluster** (`Controls.ts:84-93`, CSS `style.css:316`)
- `.action-catch` `right:28 bottom:96` **92×92** → x 270→362, y(bottom) 96→188.
- `.action-bait` `right:132 bottom:64` **64×64** → x 194→258, y 64→128.
- `.action-hide` `right:132 bottom:138` **64×64** → x 194→258, y 138→202.

**Bottom-left — the bait tray** (`Controls.ts:138`, CSS `style.css:1050`)
- `.bait-tray` `left:12 bottom:16`, **`flex-wrap` + `max-width:64vw`** (≈ 250px),
  `gap:8`. Chips are `icon + "1 Seeds" + ×N`, ~90–110px each. 3–4 chips **wrap to
  a 2nd row** → the tray grows **up and right** to ≈ x 12→262, y(bottom) 16→~90.

**Bottom-center — the instruction strip** (`Controls.ts:128`, CSS `style.css:1198`)
- `.touch-hint` `left:50% bottom:16` — *"Drag to roam · CATCH · BAIT · tap a chip
  to pick bait"*, color `rgba(255,255,255,.45)` (low-contrast olive-on-green).

---

## #2 — The overlap diagnosis (the core)

**Root cause: there is no layout container that reserves space.** Every group is
`position: fixed` at offsets that were tuned for *yesterday's* content; when an arc
added a control or a wider label, nothing recomputed, so footprints grew into each
other. Two concrete collisions:

**A. Bait tray ⟂ BAIT/HIDE buttons (the worst — a real tap-target collision).**
The tray (bottom-left, `flex-wrap`, up to `64vw`≈250px wide) and the action
cluster (bottom-right, `.action-bait`/`.action-hide` at `right:132` → **x 194→258,
y 64→202**) are **two separately-anchored groups sharing the bottom band**. With 3–4
chips + wide `"1 Seeds ×7"` labels, the wrapping tray reaches **x≈262, y up to ~90**
— directly into BAIT's footprint (x 194→258, y 64→128). Overlap region ≈ **x
194→258, y 64→90**. So *"Greens ×7" runs under BAIT* and a chip overlaps the hint —
exactly the screenshot. The `flex-wrap`+`max-width:64vw` (added for the 4th chip,
`style.css:1056`) **mitigated width but traded it for height**, pushing the 2nd row
*up into* the buttons.

**B. Centered title ⟂ top-right cluster.** `.hud-biome` is centered on **x=195**;
"RIVERBANK" (uppercase, `letter-spacing:.12em`) is ~130px wide → spans **x≈130→260**.
The 4-button cluster starts at **x=164**. Overlap **x 164→260** — the title's right
half runs **under the journal/missions buttons**. The 4th toggle (mute, A1) widened
the cluster from 3→4 (164px→214px), reaching past center-right into the title.

**C. Instruction strip buried.** `.touch-hint` is at `bottom:16` — the **same
baseline as the tray** (`bottom:16`) and centered, so chips sit on top of it; its
`.45` opacity makes it half-illegible regardless.

The pattern in all three: **accretion against fixed offsets with no reserving
container**, so each new control or wider label silently eats a neighbor's space.

---

## #3 — The layout proposal (the core deliverable)

**Principle:** replace corner-by-corner fixed offsets with **a few reserved bands**
that can't collide by construction, and put primary frequent actions in the
bottom-third thumb zone. Targets ≥48px, spacing ≥8px, nothing overlapping.

### Proposed wireframe (390×844 portrait, safe-area aware)

```
┌─────────────────────────────────────────────────────────┐
│ [☀ DAWN  ◜•◝]                              ( 📖 )( ⚑ )   │  TOP-LEFT: time pill+arc
│  RIVERBANK                                 ( ⚗ )( 🔊)    │  TOP-RIGHT: 2×2 toggle grid
│  Caught 3 · ◈ 128                                        │  (title+count+credits = one
│                                                          │   LEFT stack; center is FREE)
│                                                          │
│                     (game world)                         │
│                                                          │
│              "Drag to roam · tap CATCH"                  │  center-low, legible pill,
│                                                          │  AUTO-FADES after first play
│   ┌───────────────────────────────────┐                 │
│   │ ①🌰7   ②🌿7   ③🐛7   ④🐟3        │   SELECTOR BAND │  bait row — own band, no-wrap,
│   └───────────────────────────────────┘      ┌──────┐   │  compact chips, never near buttons
│                                    ┌────┐     │      │   │
│                                    │HIDE│     │CATCH │   │  ACTION BAND (thumb zone):
│                                    └────┘     │ 78%  │   │  CATCH primary (big, corner)
│                                    ┌────┐     │      │   │  BAIT/HIDE secondary (left of it)
│                                    │BAIT│     └──────┘   │
│                                    └────┘                │
└──────────────────────────── (home indicator safe area) ─┘
```

### TOP

- **Time** stays `top-left` (pill + arc) — unchanged.
- **Title + count + credits become ONE left-aligned stack** under the time pill
  (biome name, then `Caught N · ◈ credits`). **This removes collision B entirely** —
  there's no centered element to run under the right cluster, and the **center is
  freed** for the banners / result-flash that already live there
  (`.hud-banner`, `.hud-result`). Left-aligned reads as a tidy "field-card" header.
- **Toggle cluster → top-right as a 2×2 grid** (`📖 ⚑ / ⚗ 🔊`) instead of a
  1×4 row. 2×2 at 46px+8px = **100px wide × 100px tall** — it stays in the corner
  and **never reaches center**, with bigger inter-button spacing than today.
- **Consistent icons:** replace the mixed emoji with **one inline-SVG line-glyph
  set** (book, flag, flask, speaker), uniform 1.75px stroke, in the existing 46px
  circle. Emoji render with different weights/baselines per OS (the "flat icon vs
  emoji" Craig saw); inline SVG is **zero-asset, on-brand, and identical
  everywhere**. (Sizing is already unified post-A1b, `style.css:352`; this unifies
  the *glyph treatment* too.)

### BOTTOM (thumb zone) — the fix is **vertical separation into two bands**

- **Action band** (bottom-right, the easy thumb zone):
  - **CATCH** primary — 92px, bottom-right corner (`right:20 bottom:~96`).
  - **BAIT** + **HIDE** secondary — 64px, stacked just left of CATCH
    (`right:~120`), with ≥8px gaps. (Same three controls, same handlers — just
    spaced and reserved.)
- **Selector band** (the bait tray) — a **single full-width row ABOVE the action
  band** (`bottom:~190`, `left:16`, **`flex-wrap` removed → `no-wrap`**), so it is
  **vertically separated from the buttons and can use the full width** without ever
  competing for the bottom-right corner. **This kills collision A by construction**
  — chip count/label width can grow and it still can't reach the buttons (they're on
  a different vertical band). See #4 for the compact-chip density solution.
- **Instruction strip:** move to the now-free **center-low** area, give it a legible
  treatment (raise opacity + a subtle dark pill behind it, like `.time-pill`), and
  **auto-fade it after first play** — it's onboarding, not a permanent control (see
  note). No longer shares the tray's baseline, so collision C is gone.

> Instruction-text behavior note (kept render-side): simplest is a **CSS auto-fade**
> after a delay, or — preferred and already available — gate it on the existing
> **onboarding** machinery (an empty journal = first run) so it shows for new players
> and is hidden for returning ones. Either is presentation state, not game logic.

---

## #4 — The 4-bait tray density (the trigger)

The density problem: 4 chips × ~100px (`icon + "1 Seeds" + ×N`) = ~400px — can't
fit a bottom-left corner without colliding the right cluster, which is why
`flex-wrap` was added (and which created collision A by growing upward).

**Solution — compact chips in a dedicated no-wrap row:**
- **Compact each chip to `icon + ×count`** with the **1–4 index as a small corner
  badge** (or implied by left-to-right order, mirroring the `1/2/3` keys). That
  drops a chip from ~100px to **~52px**; 4 chips + gaps ≈ **236px** — fits **one
  no-wrap row** comfortably, even at 390px, *especially* now that the row owns its
  own full-width band (#3).
- **Remove `flex-wrap`** (`style.css:1056`) and the `max-width:64vw` cap — no longer
  needed once the row is vertically separated and the chips are compact.
- The selected chip keeps its bright highlight (`.bait-chip.selected`); the
  research-gated **fish (4th) chip still appears only when unlocked**
  (`Controls.ts:166-177`, `setBaitTray` `display` toggle) — so it's 3 chips
  (~180px) most of the game, 4 when earned. The label text can live in a tooltip /
  the onboarding strip rather than on every chip.
- *(Alternative, if Craig prefers minimalism: reveal the selector row only while
  BAIT is the active intent — fewer persistent elements, at the cost of one extra
  tap. Recommend the always-visible compact row as primary; it keeps bait legible.)*

---

## #5 — The #32 + roam-guard invariants (must be preserved)

- **#32 HUD-hide-when-panel-open** (`style.css:63-69`) is a **class-based** OR-list:
  `.action-btn, .bait-tray, .bait-hint, .hud-hidden, .touch-stick-base,
  .touch-stick-thumb { display:none }` under `body.modal-open`. **Preserved by
  keeping these class names.** The redesign regroups elements into reserved bands,
  but as long as the action buttons keep `.action-btn`, the bait row keeps
  `.bait-tray`, and the hint keeps its class, every interactive control still hides
  when a panel opens (no tap-through to CATCH). **Action item for the build:** if any
  control moves into a *new* wrapper, the wrapper/control must carry a class the
  hide-list matches (or add it to the list) — verified by the existing
  `modal-class` tests + a manual check.
- **Roam-drag canvas-only guard** (`Controls.ts:42` `isRoamTouchTarget` = "target
  `instanceof HTMLCanvasElement`"). The HUD is HTML `div`/`button`s — non-canvas — so
  a touch on any HUD element **never starts a roam**, and chips/buttons already
  `stopPropagation` on `touchstart` (`Controls.ts:155,196`). **Preserved** as long
  as the redesign keeps controls as non-canvas DOM with the same handlers (it does —
  pure restyle/reposition). No element becomes the canvas.

---

## #6 — Scope + the L2 visual-baseline plan

- **Scope = render/CSS only.** Repositions/restyles HUD controls + swaps emoji for
  inline-SVG glyphs. **Same handlers** (`makeActionButton`, `buildBaitTray`, the
  `intent` flags), **same `HUD.update` labels**, same panels/state. No `src/game/`
  change, no constants *tuning* (SVG markup + CSS only). `src/game/` purity intact
  (HUD is render-side).
- **L2 plan** (the harness exists — `e2e/smoke.spec.ts` + `e2e/visual.spec.ts`,
  Playwright, container-pinned):
  - **Smoke** (every-PR, `ci.yml` `e2e-smoke`) boots the built app and catches boot
    JS errors — guards that the regrouped DOM still mounts. Carries over free.
  - **Visual baseline** (`e2e-visual.yml`, container-only/nightly) locks the look —
    **but ⚠️ the current spec screenshots `#app canvas` only** (`visual.spec.ts:35`),
    i.e. the WebGL world, **not the HTML HUD overlay**. To lock the redesigned HUD,
    the build slice must add an **overlay-inclusive scene** (screenshot the viewport
    / `#app`, not just the canvas) — e.g. a frozen `?seed=7&freeze=1` scene with
    CATCH armed and the 4th bait chip unlocked so all controls + their spacing are in
    frame. Seed the Linux baseline **after Craig approves the look** (per
    `e2e/README.md`), so the baseline locks the *approved* layout.
- **Tests:** `463 passed (69 files)` on this branch (recon only, no code changed).
  As always, **vitest/tsc can't see layout** — Craig's iPhone is the gate; the L2
  visual baseline is what locks the look once approved.

---

## Decisions needed before the build slice

1. **Title placement:** left-aligned header stack (recommended — frees center, kills
   collision B) vs. keep it centered with a narrower/relocated cluster?
2. **Toggles:** inline-SVG line-glyph set (recommended) vs. keep emoji (unified
   size only)? And 2×2 grid vs. a single row that stops short of center?
3. **Bait selector:** always-visible compact no-wrap row (recommended) vs.
   reveal-on-BAIT?
4. **Instruction strip:** auto-fade via onboarding state (recommended) vs. a timed
   CSS fade vs. always-on (just made legible + relocated)?

Once the layout is approved, the **build slice** implements the CSS/layout + the SVG
icons, Craig playtests on the iPhone, then the L2 overlay baseline locks it.
