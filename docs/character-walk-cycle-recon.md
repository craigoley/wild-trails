# Character Juice CJ1: recon — the procedural player walk cycle (bob + squash-stretch + lean, derived from velocity)

A recon/design pass for **CJ1**: a procedural **walk cycle** that turns the
sliding player capsule into a character that *walks* — a gentle **bob**, **squash &
stretch**, a **lean** into movement, and an **idle breathing** at rest — all derived
from velocity, **zero-asset** (transforms on the existing mesh). **Design only — no
code.** Cosmetic, like TL1/TL2: it must change **no** movement/collision/catch logic.
"Feel it, don't see it" — subtle reads as life, overdone reads as rubbery. Cited to
`file:line`. Tests **515 green**.

---

## #1 — The player render now (and the velocity it can read)

**Source: `EntityRenderer.sync(state, alpha)` (`EntityRenderer.ts:95`).** Each frame:

```ts
this.player.position.set(lerp(p.prevX, p.x, alpha), 0, lerp(p.prevY, p.y, alpha)); // y=0 (ground)
EntityRenderer.faceTravel(this.player, p.facingX, p.facingY);                       // rotation.y = atan2(fx,fy)
```

- `this.player` is a **`Group`** built by `buildPlayerModel()` (`builders.ts`) — legs
  → torso → head → arms, all built **from `y = 0` UP** (feet at the origin). So the
  Group's origin is **at the ground** — *ideal* for squash-stretch (it scales from the
  planted feet, no foot-floating).
- The render **reads** `state.player` one-way (`p.x/p.y/prevX/prevY`, `facingX/facingY`)
  and **velocity is right there: `p.vx, p.vy`** (`Player.ts:41-42`, units/sec). So
  `speed = hypot(vx, vy)` and the move direction come straight from state — no
  prev-vs-current derivation needed.
- `faceTravel` sets **only `rotation.y`** (the yaw) — so a **lean on `rotation.x`
  composes cleanly** (the yaw faces travel; the pitch leans forward).
- **Movement LOGIC is fully separate from the render:** the sim mutates
  `state.player.{x,y,vx,vy}`; the renderer only *reads* it. CJ1 touches **only** the
  visual `Group` transform — never the logical position.

(Character height ≈ `legHeight 0.34 + bodyHeight 0.46 + ~head 0.3 ≈ 1.1` world units —
the scale the conservative amplitudes are tuned against.)

---

## #2 — The walk-cycle derivation (from velocity) + CONSERVATIVE defaults

Two phase accumulators held in `EntityRenderer` (private scalars, no alloc):

- **`walkPhase`** — advanced by **distance walked**: `walkPhase += speed · dt · STRIDE_RATE`.
  Speed-driven, so the bob rhythm tracks pace and **stops dead when speed → 0** (and
  when frozen; see #5). A footfall twice per stride.
- **`idleClock`** — advanced by `dt` (gated on `!frozen`), for the at-rest breathing.

A `blend = smoothstep(speed / WALK_SPEED_REF)` crossfades **idle → walk** so there's no
pop when starting/stopping.

**The four effects** (a pure helper computes them; #3 applies them):

| Effect | Formula (subtle) | Conservative default |
|---|---|---|
| **BOB** | `bobY = blend · BOB_AMP · (0.5 - 0.5·cos(2·walkPhase))` (up on each footfall) `+ (1-blend)·IDLE_AMP·sin(idleClock·IDLE_FREQ)` | `BOB_AMP ≈ 0.045` u (~4% height) |
| **SQUASH-STRETCH** (volume-preserving) | `scaleY = 1 + amp·cos(2·walkPhase)` (stretch at the rise, squash at footfall); `scaleXZ = 1/√scaleY` (so `scaleY·scaleXZ² ≈ 1`) | `amp ≈ 0.06` (6%) |
| **LEAN** | target `leanX = clamp(speed/WALK_SPEED_REF,0,1)·LEAN_MAX`; **spring** toward it: `lean += (target - lean)·min(1, LEAN_K·dt)` (springs back to upright when stopped) | `LEAN_MAX ≈ 0.12` rad (~7°) |
| **IDLE** | the `(1-blend)` terms above — a slow breathing bob + a whisper of squash | `IDLE_AMP ≈ 0.02` u, `IDLE_FREQ ≈ 0.4 Hz` (a breath ~every 2.5 s) |

**Err subtle** (the audio/TL1/TL2 scar): these magnitudes are the *first-playtest*
starting point — small bob, ~6% squash, ~7° lean. Risk on "too subtle," never
"rubbery." All independently tunable constants (one `CHARACTER_JUICE` block), so a
playtest "the lean's too much but the bob's nice" tunes only the lean.

---

## #3 — The render hook (no refactor; logical position UNCHANGED)

In `sync` (extended to `sync(state, alpha, dt, frozen)`), **after** positioning
`this.player` at the logical lerp, apply the helper's output to the **visual Group**:

```ts
const a = walkCycle(speed, this.walkPhase, this.idleClock, this.lean, blend); // pure, numbers only
this.player.position.set(lx, a.bobY, lz);            // bob REPLACES the y=0 (was ground)
this.player.scale.set(a.scaleXZ, a.scaleY, a.scaleXZ); // squash-stretch from the feet origin
this.player.rotation.x = a.leanX;                    // lean — composes with faceTravel's rotation.y
```

- The **logical position is untouched** — `lx/lz` ARE the logical lerp; the bob/scale/
  lean live entirely on the visual `Group`. The character still *stands and moves where
  the logic says*; only its skin breathes around that point.
- **No refactor:** the player is already a single `Group` positioned each frame — CJ1
  adds three transform writes + two scalar integrations. The walk MATH lives in a new
  **pure** `src/rendering/walkCycle.ts` (no `three`, Node-testable); `EntityRenderer`
  holds the phase scalars and applies the result.

---

## #4 — Cosmetic (catch/proximity reads the LOGICAL position — pinned)

**Confirmed and structurally guaranteed:** the catch/proximity is computed in the
**game layer** from `state.player`, never from the rendered mesh:

```ts
// Encounter.ts:64,69 — startEncounter
nearestCatchable(input.animals, input.player.x, input.player.y, input.tool);
const dist = Math.hypot(animal.x - input.player.x, animal.y - input.player.y);
```

`input.player` is the sim's `PlayerState` (logical `x/y`). The renderer reads state
**one-way** and bobs `this.player` (the `Group`); it **never writes back** to
`state.player`. The **game layer doesn't import the renderer at all** — so the visual
bob *cannot* reach catch range. ⚠️ The bob would only jitter catch range if catch read
the *mesh* position; it reads the *logical* position → **no jitter, by construction.**
Pin: an L1 test that a catch attempt's in-range outcome is identical regardless of the
(render-only) walk phase — trivially true since the sim never sees it, but worth a
guard against a future "read the mesh" mistake.

---

## #5 — Freezable (the active L2 gate)

Gate the whole animation on **`!frozen`** (the same flag TL2/the sim use): when frozen,
advance no clocks and apply the **neutral pose** (`bobY=0, scale=1, leanX=0`). So a
frozen capture shows the plain capsule at its logical position.

**Strong coexistence finding (like TL2 at thriving=0):** the L2 scenes pause the sim at
the initial state with the player **not moving** (`vx=vy=0`), and the only time-driven
part (idle breathing) is gated off when frozen → the frozen player is **neutral =
identical to today's render**. So **the existing visual baselines do NOT change** — no
regeneration needed, no flaky bobbing-character diffs. (If we ever *wanted* to capture
the walk in a baseline, we'd add an additive moving scene at a pinned phase — not this
slice.)

---

## #6 — Perf + scope + the cosmetic L1 guard

- **Perf:** per frame — a handful of `sin/cos`, two scalar integrations, three transform
  writes on **one** `Group`. No per-frame allocation (scalars reused). Trivial on mobile
  (Three already recomputes the player's matrix every frame — it's a moving object).
- **Scope / purity:** `src/game/` + state stay **pure** — the animation reads
  `state.player.vx/vy` and lives in the render layer; the walk math is a pure helper
  (no `three`). **No schema bump** (the cycle is computed every frame from velocity —
  zero persisted state).
- **L1 cosmetic guard:** the pure `walkCycle` helper is unit-tested — volume
  preservation (`scaleY · scaleXZ² ≈ 1`), conservative bounds (amplitudes/lean within
  limits), `speed 0 → idle/neutral`, monotonic lean in speed — **and** the structural
  guarantee (the game layer never reads the render; catch uses logical pos), with the
  existing player/catch/L1 suites unchanged.
- **Tests:** 515 green (recon only).

---

## Decisions needed before building

1. **The conservative defaults** — confirm the #2 table (BOB ~0.045u, squash ~6%, lean
   ~7°, idle ~0.02u) as the first-playtest start (err subtle).
2. **Squash-stretch** — include it now (the life principle, volume-preserving) vs.
   bob+lean only first (squash is the highest "rubbery" risk if overdone)?
3. **Freeze → neutral pose** (recommended — keeps the L2 baselines unchanged) — confirm.
4. **The sync signature** — OK to extend `entities.sync(state, alpha)` →
   `sync(state, alpha, dt, frozen)` (the one integration touch)?
