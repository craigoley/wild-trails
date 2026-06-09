# Through-line TL2: recon — ambient visual life (swaying grass + drifting motes), tied to thriving

A recon/design pass for **TL2**: making a biome's *thriving* (TL1, #82) VISIBLE as
**motion** — a cared-for biome sways more and has more drifting motes; an unstudied
one is still and sparse. **Two effects, independently tunable**: swaying **grass**
(low risk — a transform on existing geometry) + drifting **motes** (higher feel-risk
— new particles). **Design only — no code in this PR.** Cosmetic, like TL1: zero
gameplay change. Cited to `file:line`. Tests green at **507** on this branch.

The decisive constraint threaded throughout: the **active L2 visual gate** captures
the world canvas under `?freeze=1`, so the motion must be **freezable** (a stable,
deterministic rest frame) or it flakes the baselines.

---

## #1 — The grass (the safe effect): a base-pivot sway on existing geometry

**Source: `WorldRenderer.addGrassCluster` (`WorldRenderer.ts:334`) + the cover
builders (`addFernCluster:283`, `addReedCluster:298`).** Cover is built **once** as
**individual `Mesh`es** added to `this.group` — e.g. each grass blade is a
`ConeGeometry` blade, positioned with its **centre** at `y = bladeHeight/2`
(`WorldRenderer.ts:343`-ish). No new assets, no shader — flat-shaded procedural
geometry. There is **no per-frame world update today** (props are static; the loop
only re-grades colour on `setThriving`).

**The hook (simplest, lowest-risk, no refactor):** a **per-frame rotation wobble**
on the existing cover blades — `mesh.rotation.z = amp · sin(t·freq + phase)`. Two
small build-time tweaks make it natural + cheap:

1. **Base-pivot, not centre-pivot.** Today a blade's origin is its centre, so a
   rotation pivots the *middle*. Translate the **shared** blade geometry up once
   (`geo.translate(0, bladeHeight/2, 0)`) and set the mesh `position.y = 0` → the
   origin sits at the **base**, so the rotation sways from the ground (the tip
   arcs, the base stays planted) — and the at-rest look is **pixel-identical** to
   today (base at 0, tip at `bladeHeight`).
2. **Per-blade phase** from the blade's `(x+z)` so they don't sway in lockstep
   (a field ripples, not a metronome).

**Collect the swayable meshes** into a tracked list (or a dedicated `ambient` group)
at build time — grass / ferns / reeds sway; **rocks do not** (`addRockCluster:318`
is excluded). Then a new `updateAmbient(dt)` walks the list and sets each
`rotation.z`. Confirmed: **a transform on existing geometry, no new assets, no
shader.**

---

## #2 — The motes (the riskier effect): zero-asset Three.js `Points`

**Approach:** one `THREE.Points` cloud **per unlocked biome** — a `BufferGeometry`
of N positions + a `PointsMaterial` (`size`, `color`, `transparent`, `opacity`,
`depthWrite:false`). **Zero external asset.** For "soft, not cheap," generate a tiny
**radial-gradient dot** on an offscreen `<canvas>` once at boot and use it as the
point texture (procedural, no file) — a faint round mote rather than the default
hard square. (Fallback if we want truly texture-free: a small square at low opacity;
recommend the generated soft dot — the "looks cheap if off" risk is real.)

**Drift + recycle (no per-frame allocation):** the N positions live in **one reused
`Float32Array`**; per frame each mote drifts slowly (a gentle upward bias + a little
lateral) and **recycles** to the bottom of a band when it leaves it. One draw call
per biome; updating N floats + `attributes.position.needsUpdate = true` is trivial.

**⚠️ CONSERVATIVE defaults (the feel-risk — err subtle, the audio/TL1 lesson):**

| Knob | Proposed default | Why |
|---|---|---|
| max count (thriving=1) | **~12–14** per biome | a few, not a snowstorm |
| size | **~0.06–0.08** world units | small |
| drift speed | **~0.15–0.2** u/s | slow, barely-there |
| opacity | **~0.20–0.25** | faint |
| colour | a warm off-white (or a faint biome tint) | "pollen/spores in light", not snow |
| recycle band | y ≈ 0.1 → 2.4 | low, near the grass |

**Determinism (load-bearing for L2):** initial mote positions are placed
**deterministically** (golden-angle / index-seeded, like the cover spiral
`WorldRenderer.spiral:274`) — **never `Math.random` per frame** — so a frozen frame
is byte-stable (see #6).

---

## #3 — Tied to thriving (REUSE TL1, don't re-derive)

TL1's `thrivingByBiome(journal)` (`Thriving.ts:51`, returns `Record<biome, 0..1>`,
pure + display-only, **never imported by the sim**) is **already** fed to the
renderer via `worldRenderer.setThriving(...)` (`main.ts:143`, again on a catch at
`:350`). The renderer **already stores `this.thriving[id]`** (`WorldRenderer.ts:91`)
and re-grades colour from it. **TL2 reads the exact same `this.thriving[id]`** — no
new derivation, no second source.

**The mapping (0..1 → motion):**
- **sway amplitude** = `sway.maxAmplitudeRad · thriving[biome]`
- **mote count** = `round(motes.maxCount · thriving[biome])`

So **thriving = 0 → fully still: amplitude 0, zero motes** (the unstudied biome is a
quiet diorama); **thriving = 1 → full sway + ~12 motes.** When thriving changes on a
catch, `setThriving` already fires — TL2 just re-reads it there to update the sway
amplitude + (re)size the mote count per biome (no rebuild of the cover/ground).

> **Recommended:** floor at 0 (unstudied = still) — it matches the design AND keeps
> the L2 baselines unchanged (see #6). If Craig wants "alive but quiet" even
> unstudied, a tiny floor (1–2 motes, micro-sway) is a one-knob change — but it
> would shift the baselines. Lean **floor = 0**.

---

## #4 — Independently tunable (the safety)

**Two separate constant blocks** so a playtest "motes too heavy, grass is nice" tunes
**only** the motes:

```ts
export const AMBIENT_LIFE = {
  sway:  { maxAmplitudeRad, freqHz, /* per-blade phase from position */ },   // GRASS
  motes: { maxCount, size, driftSpeed, opacity, color, riseBias, band },     // MOTES
} as const;
```

The two effects are also **separate code paths** (the sway walks the cover-mesh list;
the motes update the `Points` clouds) and **separate enable checks** — so one can be
dialed to 0 (or skipped) without touching the other. ✓ Confirmed: **independent
knobs, independent subsystems.**

---

## #5 — Perf (the render loop, mobile)

- **Sway:** ~**250–300** swayable blades total (≈32 hiding spots; grass `bladeCount
  10` / ferns `9` / reeds `9`, minus highlands rocks). One `sin()` + one
  `rotation.z` set per blade per frame = a few hundred cheap trig ops + matrix
  marks. Negligible on mobile (Three already re-computes matrices for any moving
  object).
- **Motes:** one `Points` per biome (≤6 clouds, **≤~14 points each**) → ≤6 draw
  calls; per frame, write into a **reused** `Float32Array` + set `needsUpdate`. **No
  per-frame allocation** (the CLAUDE.md bounded-pool rule). Tiny.
- **Integration:** add a single `worldRenderer.updateAmbient(dt)` call in the rAF
  loop just before `scene.render()` (`main.ts:508`), driven by the loop's existing
  `dt`. An internal `ambientTime += dt` drives the phase; nothing else changes.

Bounded counts, cheap math, zero allocation → no rAF jank. (If a low-end device ever
struggles, the count knobs in #4 dial it down.)

---

## #6 — Cosmetic-only + scope + L1/L2 (the motion must be FREEZABLE)

- **Cosmetic-only:** the motion lives entirely in `WorldRenderer` (the render layer),
  **reads** `this.thriving`, and **writes only Three.js transforms / buffers** — it
  never touches `GameState` / `Catch` / spawns / progression. `src/game/` + state stay
  pure (TL2 isn't imported by the sim, exactly like `Thriving` which "is NEVER imported
  by the sim", `Thriving.ts:7`). Catch/movement/spawns are byte-identical.
- **L1 guard:** no L1 (pure-sim) test can *see* render motion (it's not in
  `GameState`) — the guarantee is **structural**: TL2 adds no `src/game/` import and
  no state field, so the entire L1 suite stays green unchanged. The build slice adds a
  small **render-side** test (jsdom/unit on the pure mapping: `thriving → amplitude /
  mote count`, e.g. `0 → still`, `1 → full`, monotonic) — the *math* is unit-testable
  even though the WebGL render isn't.
- **⚠️ L2 — the motion must be freezable (the crux):** the visual gate captures
  `#app canvas` under `?freeze=1` (`e2e/visual.spec.ts:19-25,37`). Today
  `?freeze` pauses the sim by **not advancing the accumulator** (`main.ts:306`) and
  **snapping the camera** (`updateFollow(..., l2Frozen)` `:507`). TL2 must ride the
  **same flag**: gate the ambient clock with **`if (!l2Frozen) worldRenderer.updateAmbient(dt)`**
  so a frozen scene **never advances the motion** → the cover sits at rest
  (`rotation.z = 0`) and the motes hold their **deterministic initial positions** →
  a **byte-stable** capture, no flaky particle diffs.
- **Do the baselines even change?** Importantly: **the existing L2 scenes are
  fresh-journal (`?seed=7`, nothing caught) → `thriving ≈ 0` everywhere → TL2 is
  DORMANT** (amplitude 0, zero motes) → the world renders **identically** to today.
  So with **floor = 0** (#3), the **current baselines do not change at all** — TL2 and
  the active gate coexist with zero regeneration. To actually *lock the TL2 look*
  under regression, the build slice can **add one new frozen scene with a thriving
  biome** (e.g. `?seed=7&freeze=1&unlock=all&thrive=wetland` via a small test hook) and
  seed *that* baseline after Craig approves — additive, never disturbing the existing
  five.
- **Tests:** 507 green (recon only).

---

## Decisions needed before building

1. **Motes look** — generated soft round dot (recommended, "not cheap") vs. plain
   low-opacity square points (truly texture-free)?
2. **Conservative defaults** — confirm the #2 table (few/small/slow/faint) as the
   first-playtest starting point (err subtle).
3. **Unstudied floor** — **floor = 0** (unstudied = still; keeps L2 baselines
   unchanged — recommended) vs. a tiny "alive but quiet" floor (shifts baselines)?
4. **TL2 L2 scene** — add one frozen *thriving* scene to lock the look (recommended,
   additive), or rely on Craig's device playtest alone this slice?
