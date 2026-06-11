# CJ1 walk-cycle vibration — diagnostic (the player "violently vibrates up and down")

*Diagnose the actual cause before patching. No patch in this doc.*

CJ1 (#94) shipped the player walk cycle (bob + squash-stretch + lean, derived from velocity). On
Craig's iPhone the character **violently vibrates up and down** when walking — a failure, not a
tuning nuance. It passed tests and merged: a **feel-bug green tests can't see** (the #63 lesson —
feel-PRs need the device, and this one didn't get it before merge).

> ## ⚠️ TL;DR — the cause is CONFIRMED from the code (hypothesis **(a): phase rate too high**)
> The bob's vertical frequency is **`speed · strideRate / π` Hz**. At the player's **real** top
> speed (`maxSpeed = 6`) with the shipped **`strideRate = 9.0`**, that is
> **6 · 9 / π ≈ 17.2 bob cycles per second** — a ~17 Hz vertical buzz. That **is** the "violent
> vibration." It is **not** amplitude (the bob is a tiny 0.045u), **not** a noisy velocity source
> (the player's velocity is smooth), and **not** framerate-coupling (the phase advance is
> dt-correct). **The single number to fix is `strideRate`** (constants.ts) — ~**6× too high**.

---

## #1 — The walk-cycle DRIVE + the velocity source (smooth, not noisy)

**The phase advance** (`src/rendering/walkCycle.ts`, `stepGait`):

```ts
state.walkPhase = (state.walkPhase + speed * dt * profile.strideRate * strideMult) % TAU;
```

- **Distance-driven**: phase advances by `speed · dt` (= distance walked this frame) × `strideRate`
  (radians per world-unit). `strideMult = 1` for the player (never flees).
- **The walk bob** (the `'walk'` / `'bird'` branch):
  ```ts
  moveBob = profile.bobAmplitude * bobMult * 0.5 * (1 - Math.cos(2 * phi));
  out.scaleY = 1 - sQ * Math.cos(2 * phi);
  ```
  ⚠️ Note the **`cos(2·phi)`** — the bob oscillates at **twice** the phase rate (two footfall dips
  per phase cycle). This doubling is part of the frequency (below).

**The player's speed source** (`src/rendering/EntityRenderer.ts`, `sync`):

```ts
const a = stepWalkCycle(this.walk, Math.hypot(p.vx, p.vy), dt, frozen, this.walkOut);
```

The player feeds **`hypot(p.vx, p.vy)`** — the **logical** velocity, **not** a frame-to-frame
position delta. And that velocity is **smooth** (`src/game/Player.ts`, `approachVelocity`): it ramps
toward `mdir · maxSpeed` at `accel = 120/s` and **holds steady at `maxSpeed = 6`** while the stick is
held; friction decays it cleanly to 0 on release. Sustained walking → **constant** `vx/vy` → the
phase advances **smoothly**.

> **So hypothesis (b) — noisy/lerped velocity — is RULED OUT for the player.** (The *animals* derive
> speed from `prev→current` position in `EntityRenderer`, but the bug is the **player**, whose
> source is the clean logical velocity.) The source is smooth; the problem is purely the **rate**.

---

## #2 — ⚠️ The FREQUENCY (the confirmed cause, with the numbers)

Per second the phase advances `ω = speed · strideRate` rad/s. The bob's `cos(2·phi)` doubles that, so
the **bob's temporal frequency** is:

```
f_bob  =  2 · ω / (2π)  =  speed · strideRate / π     (cycles per second, Hz)
       =  strideRate / π   cycles per WORLD-UNIT walked
```

With the shipped **`strideRate = 9.0`** → **`9 / π ≈ 2.86 bob cycles per world-unit`**. Across the
player's real speeds:

| Player speed (u/s) | What it is | Bob frequency |
|---|---|---|
| **6.0** (`maxSpeed`) | a held-stick walk (the normal case) | **≈ 17.2 Hz** ⚠️ violent vibration |
| 2.2 (`walkSpeedRef`) | the "full gait" reference | ≈ 6.3 Hz — still a buzz |
| 1.1 | a gentle stroll | ≈ 3.1 Hz — already too fast |

A believable footfall cadence is **~1.5–3.5 Hz** (walk → jog). **17 Hz is ~6–8× too fast** — the
character isn't bouncing once per step, it's buzzing ~17 times a second. **This is the bug, and it's
hypothesis (a): the phase rate is far too high.**

**Corroborating smell:** `walkSpeedRef`'s comment says *"≈ the player's max speed"* and is set to
**2.2** — but the real `maxSpeed` is **6**. The cadence constants were authored against an assumed
top speed of ~2.2 that the player **never actually moves at** — strong evidence the walk was **never
validated against real movement** (the exact #63 device-gap). Even at that assumed 2.2 the bob is
6.3 Hz, so `strideRate` was too high regardless.

---

## #3 — dt / framerate (hypothesis (c) ruled out)

The phase advance multiplies by **`dt`**, and `dt` is **real elapsed seconds**, clamped
(`src/main.ts`: `dt = min((nowMs - lastMs)/1000, MAX_FRAME_DT)`), passed once into
`entities.sync(game, alpha, dt, …)` which calls `stepWalkCycle` **once per frame**. So:

- **Framerate-independent**: per-second phase advance is `speed · strideRate` regardless of 60 vs
  120 fps (more frames → smaller `dt` each → same sum). The vibration is **not** faster at high fps.
- **Not double-applied**: `sync` runs once per frame; `bobY` is written to `position.y` once
  (`this.player.position.set(lx, a.bobY, lz)`), `scaleY` once. No second integrator.

So **(c) is not the cause.** (It also means the fix is a pure constant change — the machinery is
correct, only the rate is wrong.)

---

## #4 — Why the tests missed it (the frequency gap → the new guard)

The walk-cycle tests pin the **math shape**, never the **frequency at real speed**:

- `walk-cycle.test.ts:42` — `expect(s.walkPhase).toBeCloseTo((speed * dt * CJ.strideRate) % TAU)`.
  This computes the *expected* value **from `CJ.strideRate` itself** — it is **tautological**: it
  passes for **any** `strideRate`, including 9 or 900. It checks the *mechanism*, not the result.
- `gait.test.ts` — asserts `stepWalkCycle === cj1Ref(...)`, where `cj1Ref` **re-derives the same
  formula using the same `CJ.strideRate`**. Again tautological w.r.t. the rate.
- The amplitude bounds (`|bobY| ≤ bobAmplitude + idleAmplitude`) **are** checked — but **amplitude
  was never the problem.** A 17 Hz bob of amplitude 0.045 satisfies every existing assertion.

**The gap:** nothing converts "phase advanced per unit time at a real walk speed" into a **frequency**
and asserts it's gentle. That's the guard the fix must add (#5).

---

## #5 — ⚠️ The fix (for the CONFIRMED cause) + the new frequency guard

**The fix — lower `strideRate`** (`src/utils/constants.ts`, `CHARACTER_JUICE.strideRate`). Target a
gentle footfall (~2.5–3.5 Hz) at the speed the player actually moves (`maxSpeed = 6`):

```
strideRate = π · f_target / maxSpeed
   f ≈ 3.0 Hz @ 6 u/s  →  strideRate ≈ 1.57
   f ≈ 3.5 Hz @ 6 u/s  →  strideRate ≈ 1.83
   f ≈ 2.3 Hz @ 6 u/s  →  strideRate ≈ 1.20
```

> **Proposed starting point: `strideRate ≈ 1.5`** (≈ **2.9 Hz** at top speed — a believable jog
> footfall; ≈ 1.5 Hz at a 1.1 u/s stroll). That is **~6× lower** than the shipped 9.0. ⚠️ This is a
> **feel** value — the recon proposes the band; **Craig dials the exact number on the device.**

- **Only `strideRate` changes.** `bobAmplitude` (0.045) and `squashAmplitude` (0.05) are small and
  fine — the bob is the right *size*, just the wrong *speed*. Don't touch them (changing amplitude
  would chase the wrong variable).
- **Optional, flag-don't-fix:** `walkSpeedRef = 2.2` vs the real `maxSpeed = 6`. This only affects the
  idle↔walk **blend** crossfade + the lean cap (not the vibration). Correcting it to ~6 would make the
  bob/lean ramp in over the full speed range (a slow shuffle reads partly-idle). That's a **separate
  feel call** — leave it out of the vibration fix; raise it for Craig as a follow-up.

**The new GUARD (a frequency pin — so this can't regress):** in the walk-cycle tests, drive the real
`stepWalkCycle` at `maxSpeed` for one second of `dt` slices and **count the bob cycles**, asserting a
gentle band:

```ts
// pseudo — the guard the fix adds
const speed = TUNING.maxSpeed; // the player's REAL sustained speed (6) — not walkSpeedRef
const dt = 1 / 60;
const s = createWalkState();
const bob: number[] = [];
for (let t = 0; t < 1.0; t += dt) bob.push(stepWalkCycle(s, speed, dt, false, T()).bobY);
const peaks = countLocalMaxima(bob);          // peaks over 1.0 s ≈ frequency in Hz
expect(peaks).toBeGreaterThanOrEqual(1);       // alive — the bob is moving
expect(peaks).toBeLessThanOrEqual(4);          // GENTLE — a footfall, not a >4 Hz buzz
```

With the shipped `strideRate = 9` this guard sees ~17 peaks → **FAILS** (catches the bug). With
`strideRate ≈ 1.5` it sees ~3 → passes. ⚠️ Crucially the guard derives the expected from a **real
speed**, never from `strideRate` — so it's not tautological the way the current tests are.

---

## #6 — Scope: render-side, cosmetic, pure

- **The fix is one constant** in `CHARACTER_JUICE` (`constants.ts`) read by the **render-side**
  `walkCycle.ts`. Cosmetic by construction — the sim never sees the bob (`finalCatchChance`,
  proximity, catch all read the *logical* position; the bob is a visual offset on the player Group).
- **No logic change, no `src/game/` change** (Player/GameState/Catch/Missions untouched). `src/game/`
  purity preserved. No schema bump.
- **L2:** the L2 capture is **frozen → neutral pose** (`stepGait` returns the rest pose when
  `frozen`), so the world-canvas baselines do **not** depend on the bob frequency — **no baseline
  diff** expected from changing `strideRate`.
- **Tests:** green on this recon branch — **551 passing** (no code changed; recon only).

---

## STOP — confirm the cause, then the fix is PLAYTESTED ON DEVICE

**Confirmed cause:** (a) **phase rate too high** — `strideRate = 9.0` yields a ~**17 Hz** vertical
bob at the player's real `maxSpeed = 6`. Not amplitude, not noisy velocity (the player's source is
smooth), not framerate (dt-correct).

**The fix slice:** lower `strideRate` to ~**1.5** (a feel band, ~2.9 Hz at top speed) + add the
**frequency guard** (count bob peaks at `maxSpeed`, assert ≤ 4 Hz). ⚠️ And **this time the fix is
felt on Craig's iPhone before merge** — a feel-fix must be felt; do **not** merge on green tests
(the whole point of this diagnostic).
