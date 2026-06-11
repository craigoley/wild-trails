# Character Juice — CJ3: limb articulation (recon)

*the player walks with legs; simple FK leg-swing on the existing walkPhase, NOT IK/raycast*

PLAN.md §4.5 (CJ3) + Craig's ask: *"I wish my character's legs moved."* CJ1 (#94/#102) animates the
whole player as a UNIT (bob/squash/lean — a weeble). CJ3 makes the **legs swing** in the walk cycle.
**Design only — no code.**

> ## ⚠️ The headline (it changes the scope): the player ALREADY HAS LEGS
> `buildPlayerModel()` does **not** build a single capsule — it already assembles a **figure**:
> **2 leg cylinders + a tapered torso + a head sphere + 2 arms** (`src/rendering/models/builders.ts:50`).
> The legs are real, separate meshes — they're just **static**: added at fixed positions, and the
> whole Group bobs as one. **So CJ3 is not "add legs to a capsule" (new geometry, the scar category)
> — it's "animate the legs that are already there."** That collapses both of the brief's risk flags:
> - **(a) the mesh change** shrinks to **re-parenting** the existing leg meshes onto hip pivots (no new
>   shapes), and
> - **(4) the L2 baselines** likely **DON'T diff** — at the frozen/neutral pose the legs are straight,
>   in the exact same world positions as today (details in #4).
>
> What's left is the genuinely valuable part: the **FK swing math** + the **bob sync** (#2) — and
> that's still device-gated for feel.

---

## #1 — The player mesh now, and the (small) construction change

**Now** (`builders.ts:50–73`) — a `Group` of primitives, foot-origin, facing +z:

```
legs:  2 × CylinderGeometry(legRadius .075, legHeight .34)  at (±legSpread .12, legHeight/2, 0)   [accent=boots]
torso: CylinderGeometry(top .12, bottom .17, bodyHeight .46) at (0, legHeight+bodyHeight/2, 0)
head:  SphereGeometry(headRadius .17)                        at (0, ~.80, 0)
arms:  2 × CylinderGeometry(armRadius .05, armLength .4)     hanging at the sides
```

Each **leg cylinder spans y = 0 (foot) → 0.34 (hip)**, centred at y = 0.17. To swing a leg you must
rotate it **about the hip** (its top), not its centre. The standard zero-asset FK setup — **wrap each
leg in a hip-pivot Group**:

```ts
// per side sx ∈ {-1, +1}
const hip = new Group();
hip.position.set(sx * P.legSpread, P.legHeight, 0);        // pivot AT the hip (y = 0.34)
add(hip, legCylinder, accent, 0, -P.legHeight / 2, 0);     // mesh hangs DOWN: foot back at y=0, top at the pivot
g.add(hip);
// keep the reference so the renderer can swing it:
legPivots.push(hip);
```

- At `hip.rotation.x = 0` the leg renders in the **exact same world position as today** (pivot .34 +
  mesh −.17 = centre .17) → **visually identical when not walking** (this is what keeps the L2
  baselines stable, #4).
- **Expose the pivots to the renderer.** Cleanest: `buildPlayerModel()` returns
  `{ group, legL, legR }` (a tiny typed struct) instead of a bare `Group`; `EntityRenderer` stores
  the two pivots. No per-frame `getObjectByName` lookups, no new allocation in the loop.
- **Keep it abstract.** No new geometry, no detail — the swing alone reads as "walking." The figure
  stays the clean low-poly silhouette it already is.

**This is the whole mesh change**: re-parent 2 existing meshes + return 2 references. (Optionally the
same wrap for the 2 arms if Craig picks "+arms", #6 — they exist too.)

---

## #2 — ⚠️ The leg-swing: FK on the EXISTING walkPhase (conservative, synced to the bob)

**Reuse `walkPhase`** (the CJ1 dividend — the distance-driven phase, frequency-fixed in #102). No
second phase → the legs are **automatically in sync** with the bob because they read the same phase.

**The swing** — each hip rotates fore/aft about the lateral (x) axis, the two legs in **opposition**:

```
legSwing      = blend · A · cos(walkPhase)      // the pure helper returns this one value
legL.rotation.x =  legSwing
legR.rotation.x = −legSwing                      // opposition (R = leg + π)
```

**Why `cos(walkPhase)`, and the bob sync (the #1 jank-avoider).** The bob is
`0.5·(1 − cos(2·phase))` — it dips to its **low** at `phase = 0, π` (the footfalls) and peaks
**high** at `π/2, 3π/2` (mid-stance). With `cos(phase)` the legs are at their **fore/aft extreme
exactly at the bob's low** and **vertical at the bob's high**:

| phase | legL | legR | bob | reads as |
|---|---|---|---|---|
| 0 | +A (fwd) | −A (back) | low | a foot just planted, body low (double-support) ✓ |
| π/2 | 0 | 0 | high | legs passing vertical, body high (mid-stance) ✓ |
| π | −A (back) | +A (fwd) | low | the OTHER foot plants, body low ✓ |
| 3π/2 | 0 | 0 | high | passing, body high ✓ |

That is the natural relationship (the body's centre of mass is **lowest when the legs are spread**,
highest at mid-stance) — one leg-stride (fore→aft→fore) per phase cycle = **two footfalls per stride**,
matching the bob's two dips. ⚠️ The exact phase offset (`cos` vs `sin`, and the rotation **sign** so a
forward swing reads forward) is a **trivial one-line device-dial** — the build flips it on feel; the
*structural* guarantee is "same phase → synced" + "opposition."

**Conservative amplitude A.** The foot's fore/aft travel is `legHeight·sin(A)`. A gentle, tasteful
stride — **propose `A ≈ 0.3 rad (~17°)`**, band **0.2–0.4**. A high-kick (A ≳ 0.6) is the jank to
avoid. Device-dialed; ships at ~0.3.

**Where the math lives:** in the **pure** `walkCycle.ts` (`stepGait`), which already has `phase` and
`blend`. Add `legSwing` to `WalkTransform` and a `legSwingAmplitude` to the `GaitProfile`
(`= A` for the player, `0` for the animal profiles since CJ3 is player-only). The renderer just
applies `t.legSwing` to the two pivots — **swing math stays pure + Node-testable** (a CJ3 frequency/
amplitude guard, like the #102 one).

---

## #3 — Idle + composition with the bob/lean (no fighting)

- **Idle crossfade is automatic.** `legSwing = blend · A · cos(phase)`, and `blend =
  smoothstep(speed/walkSpeedRef)` → 0 at rest (and the distance-driven `phase` stops advancing). So a
  standing character has **still, straight legs** — no twitching — crossfading in exactly like the bob.
- **Composition is clean (no fight).** The bob/squash/lean transform the **whole player Group**
  (the hip pivots are children, so they ride the bob/lean). The leg-swing is an **additional local
  rotation** on each hip *under* that. They stack naturally: the body bobs and leans; the legs swing
  beneath it.
- **Honest limitation (no IK):** because there's no foot-planting IK, the feet **bob up/down with the
  body** (as they already do in CJ1) rather than staying pinned to the ground. On flat ground, with an
  abstract figure and a conservative swing, this reads fine as "walking" — and avoiding IK is the
  whole point (#5). Worth saying out loud so the device-playtest judges the right thing.

---

## #4 — ⚠️ Cosmetic + freeze→neutral + the L2 baselines (they likely DON'T diff)

- **Cosmetic by construction.** The legs are visual only — the **logical** position / movement / catch
  are untouched (`src/game/` cannot read the renderer). Pin: the sim layer is byte-unchanged.
- **Freeze → neutral.** `stepGait(frozen)` returns the rest pose; add **`legSwing = 0`** to that
  branch (and to `neutral()`), so a frozen player has **straight legs**. Update the existing
  freeze→neutral pin (`walk-cycle.test.ts:12`) to include `legSwing: 0`.
- **⚠️ Correction to the brief's assumption — the L2 baselines should NOT need a regen.** The brief
  expected a mesh change → a baseline diff. But the legs **already exist**, and the hip-pivot re-parent
  renders them at the **identical world position when `rotation.x = 0`** (pivot .34 + mesh −.17 =
  centre .17, exactly as today). The L2 scenes are all `?freeze=1` → neutral → straight legs →
  **identical pixels**. So the 6 visual baselines (`meadow-day-start` etc., which do show the player)
  should be **unchanged**.
  - **The build must VERIFY this** (run the visual project; expect 0 diff) — it's the proof the
    re-parent is faithful.
  - **The one exception:** if Craig wants a **proportion tweak** for a better walk read (e.g. slightly
    longer/separated legs so the swing is more legible), *that* changes the neutral silhouette → the
    baselines **would** diff → regen under the #85 active-gate workflow (approve the look, then reseed).
    So: **animate-as-is → no regen; refine-proportions → regen.** Recommend shipping animate-as-is
    first and only regenerating if the look needs it.

---

## #5 — Perf + scope (player-only)

- **Perf: negligible.** Two extra `Group` nodes (the hip pivots) and **two `rotation.x` writes per
  frame**. No new per-frame allocation; the legs were already 2 meshes. Cheaper than the bob's trig.
- **Scope: PLAYER-ONLY (recommended).** The animals (CJ2) already have static legs too (4 on the
  quadruped, 2 stubs on the bird), but animating them is a **much bigger, per-archetype, N-species mesh
  project** (quadruped diagonal-gait phasing, bird hops, leg references per build). **Defer.** Craig's
  ask is the main character; CJ3 lands the player walk. (Animal legs = a future CJ4.)
- **Purity / schema.** The swing math is in the pure `walkCycle.ts`; `src/game/` + state stay pure;
  **no schema bump** (no persisted state — `legSwing` is derived per-frame like the bob).

---

## #6 — ⚠️ The open question for Craig: how much FORM?

Because the figure **already has arms and a head**, the form options are about **what also moves**, and
they're cheaper than the brief assumed (the meshes exist — it's the same pivot-wrap pattern):

| Option | What swings | Marginal cost | Jank-risk |
|---|---|---|---|
| **(a) legs only** ✅ *recommend* | the 2 legs | the core build | lowest |
| (b) legs + arms | + the 2 arms (counter-swing: arm opposite the same-side leg) | small (arms exist; same pivot wrap, sign flipped) | low–medium (a 2nd sync to feel) |
| (c) legs + arms + head | + a tiny head bob/turn | small | medium (heads reading "wrong" is uncanny) |

> **Recommend (a) legs-only first** — the literal ask, lowest jank-risk, the clean win. Arms are a
> **cheap, obvious follow-up** (the same FK pattern on the existing arm meshes, swinging
> `−legSwing`-ish for the natural contralateral arm/leg) if the legs land well. Head (c) buys the least
> for the most uncanny-risk — skip unless asked.

---

## Scope summary + what STOP is waiting on

**The build (once Craig picks the form + confirms the swing):**
1. `builders.ts` — wrap each existing leg (and arms if +arms) in a hip-pivot Group; return
   `{ group, legL, legR }`.
2. `walkCycle.ts` — add `legSwing` to `WalkTransform` (`= blend·A·cos(phase)`; `0` when frozen) +
   `legSwingAmplitude` to `GaitProfile` (player `A≈0.3`, animals `0`).
3. `constants.ts` — `CHARACTER_JUICE.legSwingAmplitude ≈ 0.3` (the one new tuning knob).
4. `EntityRenderer.ts` — store the 2 pivots; each frame set `legL.rotation.x = t.legSwing`,
   `legR.rotation.x = −t.legSwing`.
5. Tests — a CJ3 guard (swing is in opposition, conservative amplitude, **0 at idle/freeze**, synced
   to the same phase as the bob); the freeze→neutral pin gains `legSwing: 0`; verify the L2 visual
   baselines are **unchanged** (no regen) — or regen if proportions are tweaked.

**Green now: 556 tests** (recon adds no code). `src/game/` pure; no schema bump.

**STOP for Craig's decisions:**
1. **Form (#6)** — legs-only *(rec)* / legs + arms / + head?
2. **Swing amplitude (#2)** — ship `A ≈ 0.3 rad` and dial on device? (band 0.2–0.4)
3. **Proportions (#4)** — animate the legs **as-is** (no baseline regen) *(rec)*, or refine leg
   proportions for a more legible swing (→ baseline regen after you approve the look)?

After the words/form are confirmed, the build implements it — then Craig playtests the **feel** (do the
legs *walk*: synced to the step, subtle not janky) and, only if proportions changed, approves the new
look so the L2 player baselines regenerate.
