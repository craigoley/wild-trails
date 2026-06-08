# Challenge-hint cadence — recon/diagnostic (diagnose the spam, then design the cadence)

A real playtest gripe: with a research challenge active (e.g. `research-mouse-dusk`, the Coast
gate — "catch a meadow forager at dusk"), a correction banner ("Not the one — seek a meadow
forager at DUSK…") pops on what feels like EVERY catch — notification spam that fights the calm
(P4/P6). This pass finds the ACTUAL trigger from the code first, then designs the right cadence.

**This doc is diagnostic only — no patch.** Findings cite `file:line` against current main (#82).

> ## ⚠️ #1 — The actual trigger (ground truth, quoted): biome-level, not near-miss
> `Missions.ts:179`, inside `evaluateCatch`'s per-mission loop, on a catch that did NOT satisfy
> the challenge (`!meets(...)`):
> ```ts
> if (def.requirement.kind === 'research' && def.hint && ev.biome === SPECIES[def.requirement.species].biome) {
>   result.hints.push(def.hint);
> }
> ```
> The hint fires whenever an **active research challenge's SPECIES lives in the same BIOME as the
> catch** — **regardless of whether you caught that species, or at what phase.** So with the
> dusk-mouse challenge active (fieldmouse, meadow), the hint fires on **every meadow catch that
> isn't fieldmouse@dusk** — a rabbit, a quail, a hedgehog, a day-mouse all trigger the same
> dusk-mouse nag. **That is the spam.** → **Hypothesis (a) confirmed** (it fires on every
> non-satisfying catch *in the challenge's biome*), **NOT** a recent regression (c).

---

## #2 — What changed (git): longstanding (#46), newly SALIENT

`git log -L` on the trigger: the block was introduced in **#46 — "research challenges (§4.1b)"**
(the *original* research-challenge PR), not by the Coast/dusk work, not #78. The biome-level
condition has been there since day one — **it's longstanding, not a regression.**

So why noticed NOW? Two compounding reasons, both from recent work making it *salient*:
- **Coast (#80) added `research-mouse-dusk`** — a 4th *meadow* challenge, on **dusk**, a phase a
  player rarely hits by accident → the challenge stays **open for a long time** → many meadow
  catches happen while it nags.
- The **meadow is the most-played biome** (the start), so a meadow-biome challenge maximises the
  in-biome catch count → maximum spam.

The fix is therefore **"narrow the over-broad condition,"** not "restore a prior cadence" (there
was no quieter prior — it was always biome-level).

## #3 — The banner system + how often each kind SHOULD fire

`missionBanners.ts` turns an `evaluateCatch` result into banners; `BannerKind = 'mission' |
'unlock' | 'hint' | 'research'`. The hint path (`missionBanners.ts:39`):
```ts
for (const hint of [...new Set(result.hints)]) out.push({ text: hint, kind: 'hint' });
```
The only throttle is a **per-event de-dup of identical strings** — so a *single* catch can still
emit **one hint per active in-biome challenge** (e.g. mouse-night + mouse-dusk both fire on one
day-mouse catch). Intended cadence by kind: **mission** (on completion — rare) · **unlock** (on
biome unlock — rare) · **research** (progress/completion — occasional) · **hint** (a *contextual
teaching nudge* — should be **rare**, but today fires on ~every meadow catch). The hint kind is the
outlier abusing the per-catch banner path.

## #4 — ⚠️ The right cadence (helpful, not spammy — silence on unrelated)

The trigger's flaw: it treats **any in-biome miss** as a "warm miss," when a warm miss should be
**the right CREATURE under the wrong CONDITION**. The near-miss insight:
- Catching the **challenge's species at the wrong phase** (a fieldmouse at *day* while the dusk
  challenge is open) → **genuinely helpful**: "you found the forager — but it's not dusk yet."
- Catching **anything else** (a rabbit, a quail) → **irrelevant**: nagging about the dusk-mouse is
  pure noise.

**Proposed cadence — scope the hint to the SAME SPECIES (the near-miss):**
```ts
// fire ONLY when you caught the challenge's species but missed its condition (wrong phase):
if (def.requirement.kind === 'research' && def.hint && ev.species === def.requirement.species) {
  result.hints.push(def.hint);
}
```
(Since the block only runs on `!meets`, a same-species catch that lands here necessarily failed on
**phase** — exactly the helpful near-miss.) Effect: **silent on every unrelated catch**; the hint
appears only when you've found the right creature at the wrong time — which is *rare* and *useful*.
This collapses the frequency from "every meadow catch" to "the occasional wrong-phase fieldmouse."

**Optional extra throttle (decision):** if even repeated same-species-wrong-phase nudges feel
chatty, add a **once-per-challenge** guard (emit the hint at most once while a given challenge is
open). Lean: the species-scoping alone should suffice (it's the root fix); a once-guard is a small
optional add if the playtest still wants it quieter. (The current `ev.biome` check is replaced, not
augmented — species-match is strictly narrower.)

## #5 — ⚠️ The #48 / knowledge-by-play challenge logic is UNCHANGED

The fix touches **only the hint-emit condition** (line 179) — a cosmetic banner cue. It does **not**
touch `meets()` (the challenge evaluation), the progress/completion, or the gating. The challenge
still: completes only on the right species **at the right phase**; stays **non-forced** (the #48
inverse — normal play doesn't auto-satisfy it); and gates Coast exactly as before. The catch core,
the research spine, and the L1 `#46-auto-satisfaction` / knowledge-by-play guards are untouched —
this is purely *when the teaching banner shows*, not *what completes the challenge*.

## #6 — Scope + L1/L2 + purity

**Contained:** a one-line condition change in `evaluateCatch` (`Missions.ts`, `src/game/` — pure;
the hint is just data on the result, consumed render-side by `missionBanners`). `src/game/` stays
pure (no render in the eval). **A test pinning the new cadence:** with `research-mouse-dusk` active,
an **unrelated** catch (rabbit@meadow / quail@meadow) emits **NO hint**; the **near-miss**
(fieldmouse@day) **DOES** emit the hint; and the right catch (fieldmouse@dusk) completes with no
hint. Plus a regression pin that the challenge still completes/gates (the #46 + knowledge-by-play
guards pass unchanged). **494 green** on this branch.

---

## Decisions needed before patching

1. **The cadence** — fire the hint **only on the same-species near-miss** (`ev.species ===
   req.species`, i.e. right creature / wrong phase), **silent on all unrelated catches** — confirm?
2. **The optional once-guard** — species-scoping alone (recommended), or also throttle to **once per
   challenge** while it's open? (Lean: species-scoping alone; add the once-guard only if the playtest
   still finds it chatty.)
3. **Scope** — hint-emit condition only; `meets()`/the challenge eval/gating/#48 untouched — confirm?
