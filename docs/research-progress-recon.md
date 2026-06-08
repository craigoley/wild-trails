# Research progress indicator — recon (confirm the completion model, then design)

A real playtest gap: the Research panel shows a started project as **"In progress" + "Catch the
hedgehog — 0/3"**, but nothing reads AS progress — the player can't see *how* it advances, *what*
completion depends on, or *how far along* they are. This recon **confirms the completion model
from the engine first**, then designs an indicator that matches it.

**This doc is design only — no code.** Findings cite `file:line` against current main (#75).

> ## ⚠️ #1 — The completion model (CONFIRMED ground truth — activity-driven, NOT timed)
> The hypothesis holds, verified against the engine:
> - **`progress` is a CATCH-ACTIVITY counter.** `evaluateResearch` (`Research.ts`) does
>   `s.progress += 1` **only when a catch event matches** `activityRequirement` (a species /
>   biome / phase catch). It advances by **PLAY (catches)** — never by time.
> - **There is NO timer / elapsed / wall-clock field** in `ResearchState` (`{ started, progress,
>   completed }`) or anywhere in the research model (the only "timer" in the codebase is the
>   unrelated bait deploy timer). **R0a's cardinal guard is intact** — no principle problem,
>   purely a UI-legibility gap.
> - **Completion** = `isResearchReady` = `progress >= activityRequirement.count` **AND**
>   `knowledgeMet` (the R2 mastery challenge, by play) **AND** `prereqMet`. No-top-up projects
>   **auto-complete** at the catch boundary; a `creditTopUp` project waits for the panel's
>   "Complete ✦N" button.
>
> → So **"0/3" means "0 of 3 required catches"** and **"how long" has no time answer — it's "N
> more catches of the named activity."** The indicator must show **activity-remaining**, never
> invent a time/duration estimate (that would imply wall-clock and violate R0a).

---

## #2 — The card render now

Per project row (`ResearchPanel.row` / `.control`):
- **Info:** `.research-name` (title) + `.research-blurb` (naturalist description) +
  `.research-activity` = `${describeActivity(req)} — ${progress}/${count}` — e.g.
  **"Catch the hedgehog — 0/3"** (`describeActivity` names the activity: catch-species /
  catch-in-biome / catch-at-phase).
- **Control (right):** `Start ✦{cost}` (not started) · **`In progress`** (started, activity
  short) · `Needs: {challenge title}` (started, the R2 knowledge gate unmet) · `Complete` /
  `Complete ✦{topUp}` (ready) · `Complete ✓` (done).
- **The Start step:** `Start ✦{cost}` pays a credit SINK to begin (cost 8/10/15/20; the
  win-required gates are ✦0 = free). Play then advances `progress`; credits don't.

## #3 — ⚠️ The gap (precise)

The information *exists* (`progress` / `count`) but **doesn't READ as progress**:
1. **"0/3" is plain text on the activity line — no visual bar / fill.** A player can't viscerally
   see "this is 2/3 done, filling as I catch."
2. **"In progress" (the control) is a dead label** — it says "started, not done" but conveys
   **nothing about how far**. And it's *disconnected* from the `0/3` on the info line (the
   how-far lives in one element, the status word in another).
3. **The "catching advances this" link is implicit.** "Catch the hedgehog" and "0/3" sit on one
   line, but it isn't framed as *"do this → the bar fills."*
4. For knowledge-gated rows, `Needs: {challenge}` is shown (good, the #37 pattern) — but the
   **activity bar (e.g. 4/4) and the knowledge requirement aren't unified**, so "activity done,
   but the mastery challenge is still pending" doesn't read clearly.

**Pin:** add a visual PROGRESS BAR so "In progress" *means* how-far, keep the activity name as
the "what advances this," and show activity-remaining (not time). The data is all already in the
panel — this is *showing existing progress, better*.

## #4 — The indicator design (matches the activity model — a bar, not fake time)

A **progress bar** in every started, incomplete row — a fill = `progress / count` (0..1):

```
The Hedgehog at Dusk
Spend evenings with the meadow hedgehog…
Catch the hedgehog                       2 / 3
[██████████████░░░░░░]   ← fill = progress/count
                                         [ Complete ✓ / action ]
```

- **The bar makes "In progress" visual** (replaces the dead label): an empty bar = just started
  (0%), a filling bar = how far. The `X / N` count sits on/beside it (kept — it's the precise
  read). The activity name ("Catch the hedgehog") stays as the **label of what advances it**.
- **Started-but-0:** an empty bar + the named activity → clear it's begun and what to do.
- **Knowledge-gated (Highlands / Riverbank access):** show the activity bar (e.g. full, 4/4)
  **AND** the knowledge requirement line (`Needs: {challenge}` with a ✓/pending) — so "the
  activity's done, the mastery challenge is what's left" reads at a glance (the #37 pattern,
  unified with the bar).
- **Activity-remaining, never time.** A "remaining" read is *"1 more catch"* (`count − progress`),
  not seconds. **No duration/ETA estimate** — there is no timer to base one on (and one would
  violate R0a). The bar communicates *how far by activity*, full stop.
- The **action button** (`Start` / `Complete ✦N`) stays as the *action*; the bar is the *status*
  (today "In progress" tried to be both and was neither).

Copy/treatment lives in `ResearchPanel` (+ a small CSS bar). Optional: a subtle "✓ when full"
or a colour shift as it nears completion — kept gentle (P4).

## #5 — Scope: render/CSS-only (no engine change)

The bar **reads existing state** — `s.progress`, `p.activityRequirement.count`,
`knowledgeMet(journal, p)`, `s.started` / `s.completed` — all already available in
`ResearchPanel`. The fill % = `progress / count` is **derived** (no new value, no persisted
field, **no schema bump**). **No engine change, no new completion logic** — the R0a guards
(activity-not-timer, knowledge-by-play) and the whole `Research.ts` engine are **untouched**.
This is purely `ResearchPanel.ts` render + a CSS bar (+ maybe a copy string in constants).
`src/game/` stays pure (the panel is render-side).

## #6 — L2 + purity

`src/game/` untouched (render-only). **L2 visual baseline:** a research-panel scene showing the
bars mid-progress locks the look (a started project at, say, 2/3). It needs the panel **open with
a project started** for the capture — likely a small `testHooks` affordance (e.g. `?research=…`
to open the panel + seed a started project's progress, mirroring the existing `?unlock` / `?at`
hooks), added in the build. The smoke/visual scenes otherwise unaffected. `src/game/` purity
intact. **471 green** on this branch.

---

## Decisions needed before building

1. **Confirm the model** — research is **activity-driven** (a catch counter), **no timer**;
   "duration" = activity-remaining, so the indicator is a **progress bar, not a time estimate**
   (confirm we don't invent an ETA).
2. **The indicator** — a per-row **progress bar** (fill = `progress/count`) + the kept `X / N`
   + the activity name as "what advances this"; knowledge-gated rows also show the challenge
   state (the #37 pattern). Confirm the shape?
3. **Render-only scope** — `ResearchPanel` + CSS, no engine change, no schema bump, R0a guards
   untouched — confirm? (Plus: should completed rows keep the full bar + ✓, or just the ✓ badge?)
