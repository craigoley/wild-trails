# HUD — catch-target portraits (recon)

*show what to catch: a rendered procedural-model THUMBNAIL (the shared primitive) → a minimal play-screen
TARGET CHIP + richer research-panel PORTRAITS*

Per Craig's ask + the research (contextual-minimalism): the research panel already says *"Catch the
hedgehog · 0/3"* — but it's (a) behind a panel, (b) all TEXT (no picture to match the animal in front of
you), (c) absent from the play screen (you roam with no objective reminder). The fix: one new primitive
(a rendered thumbnail of the actual procedural model — **zero new art**) feeding two surfaces — a compact
play-screen chip + richer panel portraits. ⚠️ **Contextual-minimalism: the play screen stays CLEAN.**
**Design only — no code.**

> ## ⚠️ The two headlines
> 1. **The thumbnail render is feasible + cheap — render-to-texture, CACHED, ONE render per species.**
>    The existing `WebGLRenderer` renders each procedural model once into a `WebGLRenderTarget` →
>    `readRenderTargetPixels` → a `<img>` dataURL, cached + reused everywhere. **No per-frame cost.** One
>    real wrinkle (solvable): the entity materials use `depthTest:false` (for world-compositing) which
>    breaks a thumbnail's self-occlusion — the thumb render flips it to `true`. A clean fallback exists.
> 2. **The play-screen chip is the design risk (contextual-minimalism) — keep it ONE quiet element.** A
>    single tracked-target chip (thumbnail + `name · 0/3`), tucked in a corner, present only when there's
>    an active tracked objective, reusing the #32 hide-when-panel-open — and (the delight) **pulsing when
>    the target species is on-screen near you** ("oh, there it is"). NOT a persistent multi-objective panel.

---

## #1 — ⚠️ The thumbnail render (crux A — the new capability, validated)

**How models render today:** `buildAnimalModel(def)` / `buildPlayerModel()` (`builders.ts`) assemble a
`THREE.Group` of procedural primitives; `EntityRenderer` pools them in the live 3D scene. Nothing renders
a model to a 2D HUD image — this is the new capability.

**The validated approach — render-to-texture, cached (the lean):**
1. A tiny offscreen setup, built ONCE: a small `Scene` (the species model + a light), a framing camera,
   and a small `WebGLRenderTarget` (e.g. 128×128).
2. Per species, **once** (lazily, on first display): place the model, `renderer.setRenderTarget(target)`
   → `renderer.render(thumbScene, thumbCamera)` → `renderer.readRenderTargetPixels(...)` into a
   `Uint8Array` → blit to a 2D `<canvas>` → `toDataURL()` → cache the string. `setRenderTarget(null)`
   restores the main canvas (the main scene is never touched).
3. The HUD/panels show a plain `<img src={cachedDataUrl}>` (DOM) — **no 3D in the HUD, no per-frame cost.**

- **Cost:** 49 tiny one-time renders (lazy → spread over first use, not a boot spike), then pure cache
  hits. Reuses the **one** GL context (a render target, not a second `WebGLRenderer` — avoids the mobile
  multi-context limit). Cheap + mobile-safe. Honours the no-per-frame-alloc rule (the cache is built once;
  the loop never renders thumbnails).
- ⚠️ **The wrinkle (solvable):** `flatMat` sets **`depthTest:false`** (entities composite OVER the world,
  the Pine #109 fix). In an isolated thumb scene that makes the model's own back faces draw over its front
  → a muddy thumbnail. **Fix:** for the thumb render, clone the model (or its materials) with
  `depthTest:true` (+ a dedicated thumb light, since the models are `MeshStandardMaterial`). A small,
  contained step — flagged because it's the kind of detail that bites if unspotted.
- ⚠️ **Determinism (L2):** a WebGL thumbnail is platform/GPU-locked, like the main render — so the
  thumbnails are pinned to the **container** baseline (same as today's L2). The smoke test (no baselines)
  is unaffected. Render thumbs **lazily** so boot/`__renderReady` isn't delayed.

**The fallback (if RTT proves fiddly on a real device):** a **stylized silhouette swatch** — the species'
`color` + a simple gait-shaped CSS form (bird/quadruped/hedgehog/frog), the existing `JournalPanel`
`.card-swatch` pattern. Still procedural, zero new art, instant. Lower fidelity, but it ships the chip.
**Recommend: RTT primary, the swatch as the guaranteed fallback** (the chip works either way).

---

## #2 — The mission/research target + count data (what the chip/panel read)

The `MissionRequirement` union (`constants.ts`) — **3 of 5 kinds target a specific species** (direct
thumbnail), **2 don't** (need a representative):

| Requirement kind | Targets | Thumbnail |
|---|---|---|
| `catch-species` | `.species` | ✅ that species |
| `track-and-catch` | `.species` | ✅ that species |
| `research` | `.species` (+ phase/bait) | ✅ that species |
| `catch-in-biome` | `.biome` (any species) | ⚠️ a REPRESENTATIVE |
| `catch-in-timephase` | `.phase` (any species) | ⚠️ a REPRESENTATIVE |

- **Progress** = `journal.missions[id]?.progress ?? 0` vs `MISSIONS[id].requirement.count`. Active set =
  `groupMissions(journal).active` (the incomplete missions, in `MISSION_ORDER`). Research projects mirror
  this (`activityRequirement` + `describeActivity` already produces *"Catch the hedgehog · 0/3"*).
- **The representative (for biome/phase targets):** the biome's **signature species** = the first of that
  biome in `SPECIES_ORDER` (the pedagogical primary — meadow → `fieldmouse`); for a phase, the first
  phase-active species. So every challenge maps to a displayable species.
- **The HUD read** (a small pure helper): `targetFor(challenge) → { species, progress, count, label }` —
  the one shape the chip + the panel rows both consume.

---

## #3 — ⚠️ The tracked-target selection (which one the chip shows)

**LEAN: a tracked objective, default-then-overridable.** With multiple active goals, the chip shows ONE:
- **Default (auto):** a sensible pick — the **current biome's** first active challenge (you see the goal
  for where you are), falling back to the nearest-to-complete / first in `MISSION_ORDER`.
- **Override (tap-to-track):** tapping a row in the research/mission panel sets it as the tracked target →
  the chip (the quest-tracker pattern). A small "track" affordance on each row.

⚠️ **Persistence decision (a real fork):**
- **Session-only (recommended, NO schema bump):** the tracked id lives in memory at the boundary (or
  `GameState`, like `activeTrackTarget` already does — `GameState.ts:194`); default re-computes each load;
  tap-to-track sets it for the session. Zero schema risk, the simpler build.
- **Persisted (an additive field):** `journal.pinnedMissionId?: string` — survives reloads, but a **v8
  migration** (additive, safe, but a schema bump). Defer unless Craig wants the pin to stick across
  sessions.

**Recommend: session-only** (default auto-pick + in-session tap-to-track) — the value is "a reminder
while I play," which doesn't need to persist; keeps it display-only with no schema bump.

---

## #4 — ⚠️ The minimal play-screen chip (crux B — designed)

**ONE compact element**, contextual + quiet:
- **Content:** a small thumbnail + a tight label — `🦔 Hedgehog · 0/3` (the thumbnail is the primitive;
  the count is the progress). Reuse the research/mission count format.
- **Placement:** a corner chip. Two honest options — **(a) top-left, below `.hud-credits`** (the passive-
  label zone — stays visible, never blocks play), or **(b) bottom-area, with the action cluster** (hides
  with the modal). ⚠️ **Recommend (a) top-left passive stack** — it reads as an objective label (like the
  biome/credits labels), thumb-safe, out of the play area. Small + low-contrast so shot-3's sparseness
  survives.
- **Contextual presence:** shown **only** when there's an active tracked objective (and hidden when all
  done / in the title/onboarding). Reuse the **#32 `body.modal-open`** toggle so it vanishes when any
  panel opens (CSS `display:none`, like `.action-btn`).
- ⚠️ **The near-player highlight (the delight):** the chip **pulses / glows** when the target species is
  currently spawned **near** the player — the HUD reads `game.animals` for an active instance of the
  target species within a radius (a cheap per-frame check over the bounded pool, no alloc) and toggles a
  CSS `is-near` class. "Oh — there it is." This is the feature's spark; keep the pulse gentle.

**Result:** one quiet chip — a thumbnail + count in the corner, present when relevant, that lights up when
your quarry is in view. Minimal, contextual, on-brand.

---

## #5 — The research-panel portraits (the richer surface)

The panel is *opened* (not the play screen), so it can be richer. Add the **species thumbnail `<img>`**
to the left of each row's name — `ResearchPanel` rows (*"The Cone-Hoarder"* + *"Catch the hedgehog ·
0/3"*) and `MissionPanel` rows (*"Dusk Watch"* + *"0/2 · +15 pts"*). Same cached thumbnail primitive;
a `.research-thumb` / `.mission-thumb` slot before `.research-name` / `.mission-title` (the
`JournalPanel.card-swatch` pattern). Now the text *and* the picture — you can visually match the target.

---

## #6 — Scope + L1/L2

- **Display-only.** Render (the thumbnail RTT) + HUD (the chip) + panels (the portraits), all **reading
  existing mission/research state**. ⚠️ **NO gameplay/catch/spawn change** — it shows what to catch, it
  never changes catching. `finalCatchChance` / spawn / the mission engine untouched.
- **Schema:** **no bump** on the recommended **session-only** tracked target (computed default + in-memory
  override). (Persisted pin = the optional additive `pinnedMissionId`, v8 — deferred.)
- **`src/game/` purity:** the chip reads mission state (pure data — `journal` + `MISSIONS`); the near-
  highlight reads `game.animals` (already in `GameState`); the thumbnail is **render-only** (the RTT lives
  in `src/rendering`, no `three` in `src/game/`). A small pure `targetFor(challenge)` helper can live in
  `src/game/` (data → `{species, progress, count}`), testable.
- **⚠️ L2 — coordinate with the PENDING seasonal reseed.** The HUD changes (the new chip + the panel
  portraits) shift the **play-screen + panel baselines**. ⚠️ The seasons arc already left a **full reseed
  pending** (the summer ambient moved every baseline). **Fold this HUD's baseline shift into that SAME
  reseed** — don't reseed twice. (If the chip's near-highlight pulse is animated, the L2 scenes pin it to
  a deterministic state under `?freeze`, like CJ → neutral; the chip itself is static.)
- **L1 tests:** `targetFor(challenge)` maps each requirement kind to the right species/representative +
  progress/count (pure, L1). The thumbnail cache + the chip DOM are render/DOM tests (the existing panel-
  test pattern). The near-highlight predicate (target species present within radius) is a pure check —
  pinnable.
- **Tests:** green on this branch — **690 passing** (the recon adds no code).

---

## ⚠️ Optional slicing (a modest feature — one PR, or two)

- **One PR (fine):** the thumbnail primitive + the panel portraits + the play-screen chip + tap-to-track
  + the near-highlight. It's contained (display-only).
- **Or two slices (de-risk the play-screen design):** **(i)** the thumbnail primitive + the **research-
  panel portraits** (lower risk — the richer panel, behind a tap); **(ii)** the **play-screen chip** +
  tracked-target + the near-highlight (the contextual-minimalism design — the part that needs Craig's eye
  on the clean play screen). **Recommend (ii) as its own playtest** even if (i) ships first — the chip on
  the sparse play screen is the judgment call.

---

## STOP — the decision before building

The thumbnail render is validated (RTT cached, with a swatch fallback), the data maps cleanly, and the
chip is designed minimal + contextual. Craig confirms:

1. **The thumbnail (#1)** — **render-to-texture, cached** (one render per species, the `depthTest:true`
   thumb variant) *(recommended)*, with the **CSS silhouette swatch as the fallback** if RTT is fiddly on
   device?
2. **The tracked target (#3)** — **session-only** (auto default + in-session tap-to-track, **no schema
   bump**) *(recommended)* vs. a persisted `pinnedMissionId` (v8)?
3. **The play-screen chip (#4)** — ONE corner chip (top-left passive stack), contextual, with the
   **near-player pulse** *(recommended)*? Confirm the placement + that the pulse is wanted.
4. **The slicing (#6)** — one PR, or **(i) panel portraits then (ii) the play-screen chip** as its own
   playtest *(recommended for the clean-play-screen judgment)*?
5. **The L2 coordination (#6)** — fold the HUD baseline shift into the **pending seasonal full reseed**
   (one reseed, after both land) *(recommended)*?

After Craig confirms the thumbnail approach + the chip design, the build implements it (display-only) —
then Craig playtests the chip on the play screen (clean, not cluttered; the near-pulse delight) before
the folded reseed.
