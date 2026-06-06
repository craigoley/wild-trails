# Nets & Gear — recon + slice plan (DESIGN, no build)

A recon/design pass for the **Nets & Gear** arc: durable biome-specialized nets
(buy once, equip/switch) + a cover rework (start with fewer hiding spots, buy
more) folded into one "gear up for each biome" provisioning loop.

**This document is design only — no code ships in this PR.** Findings are cited
to `file:line` so the slice decisions rest on the real catch model, not theory.

Locked design constraint (the hard line): a biome net is "best in biome" because
it **answers that biome's catching CONDITION**, never via a flat catch-rate
multiplier. The starter net still catches everything (cozy rule: never locked
out). Advantage = the condition answered ⇒ lateral by construction.

---

## #1 — The catch model: what is expressible? (the gating question)

**Source: `src/game/Catch.ts`, `src/game/Encounter.ts`.**

`finalCatchChance(species, ctx)` (`Catch.ts:60`) composes independent multipliers:

```
baseCatchRate × toolMultiplier(tool) × proximityMultiplier(dist)
              × calmMultiplier(correctBait, fleeing) × biomeMatch(species, biome)
```

The `CatchContext` (`Catch.ts:26`) carries: **`dist`** (player→animal distance),
**`tool`** (`ToolId`), **`biome`**, `correctBait`, `fleeing`.

What this means for nets:

- ✅ **Distance / reach / proximity IS a real, expressible lever.**
  - `proximityMultiplier(dist)` (`Catch.ts:41`) lerps `proximityMax 1.3`
    (point-blank) → `proximityMin 0.7` at `CATCH.attemptRadius` (`constants.ts:967`,
    value **2.6**). Closer = better odds.
  - `startEncounter` (`Encounter.ts:60`) gates the attempt on
    `nearestActiveAnimal(..., CATCH.attemptRadius)` — i.e. **`attemptRadius` is the
    REACH**: beyond it, no encounter starts at all.
  - So "reach over water" / "range on open ground" *can* attach to something real
    (per-net `attemptRadius` + the proximity curve) — **this is NOT a flat
    multiplier.** This is the key positive finding: the design is buildable as
    lateral, because reach is first-class in the model.

- ⚠️ **There is already a `tool` slot, but it's the WRONG shape to copy.**
  `TOOLS` (`constants.ts:907`) is a flat `catchMultiplier` (net 1.0, trap 1.4,
  tranq 1.9). Biome nets must **not** add a `catchMultiplier` — that's exactly the
  pay-to-catch pattern the design forbids. (See guardrail note on trap/tranq below.)

- ⛔ **The BIOME CONDITIONS that gate each net's reach to its biome are NOT
  modeled today.** This is the honest blocker:
  - **Wetland "reach over water":** there is **no water terrain, no
    flee-toward-water, no reachability gap.** `fleeing` is just
    `aiState === 'flee'` (`Encounter.ts:72`); a fleeing animal simply gets
    *farther* — and that happens in every biome. Water is **flavor text only**
    (`constants.ts:405,412,623`), not a mechanic. So a longer-reach net would help
    against *any* fleeing animal *anywhere* → **not lateral** without a new input.
  - **Highlands "open ground":** cover (`HIDING_SPOTS`, `constants.ts`) is
    **uniform across all four biomes — 5 spots each, same radii** (meadow grass,
    woodland ferns, wetland reeds, highlands rocks). Highlands is **not** more open
    than meadow today. So "birds won't let you close on open ground" has nothing to
    key off — *until the cover rework makes highlands barer* (see #3/#4 synergy).

**Verdict for #1:** "best in biome, lateral" is **mechanically expressible in
principle** (reach is real), but **needs a new catch INPUT before the biome nets
can behave as designed**:
  1. a per-net **`reach`** (net-derived `attemptRadius`) — cheap, and it does
     **not** change the catch FORMULA, only its parameter; and
  2. a **biome condition** that makes that reach matter only in-biome:
     - highlands ← **supplied by the cover rework** (less cover ⇒ animals flee
       sooner/from farther ⇒ a range net answers it). Nice synergy: C enables B.
     - wetland ← needs genuinely **new modeling** (a water-gap / flee-to-water
       distance trait). This is the biggest new piece and should be isolated.

So the lean slice plan's "B = biome-net behaviors" must be split: **add the
lateral catch INPUT first, then let nets parameterize it** (exactly the flagged
"add the catch input before the nets can be lateral" outcome).

---

## #2 — Inventory / equip: the new durable-gear system

The game has **no durable owned-equipment** concept. It has:
- **Bait** = consumable counts (`Bait.ts:15` `BaitState.counts`), persisted.
- **A single active `tool` slot already in GameState** (`GameState.ts:122,200`:
  `tool: STARTER_TOOL`) — fed into the encounter (`GameState.ts:321,338`). But it's
  fixed to the starter; nothing owns/switches it, and it isn't persisted.

A durable net inventory needs:
- **Owned set** — which nets the player has bought (starter owned from the start).
- **Active selection** — the equipped net (reuses the existing `game.tool` slot,
  generalized to a net id).
- **Persistence (v5 → v6):** add `ownedNets: NetId[]` + `activeNet: NetId`.
  Migration `up_5to6` (mirrors `up_4to5`, `Journal.ts:232`): spread + default to
  `ownedNets: [starter]`, `activeNet: starter` so a returning v5 player loses
  nothing and starts with exactly today's net. Sanitize on load (drop unknown ids;
  force-include the starter; clamp `activeNet` to an owned id).
- **Equip UI** — UX precedent is the **bait tray** (`Controls.ts:125`
  `buildBaitTray` → `.bait-chip` row, `setBaitTray` `Controls.ts:153`): an
  always-visible row of tappable chips, selected = highlighted, empty/unowned =
  greyed, keys `1/2/3` direct-select (`baitSelect` intent). A **net tray** (or a
  shop "equip" toggle) follows the same pattern. Buying lives in the existing
  **Field Supply shop** (`ShopPanel.ts`, the credits sink) — nets are a new shop
  row category alongside bait.

No catch behavior here — see slice A.

---

## #3 — Cover rework + the anti-lockout interaction (the riskiest piece)

**Source: `src/game/World.ts:143` `isInCover`, `src/game/Detection.ts`,
`STEALTH` (`constants.ts`), `HIDING_SPOTS`.**

Today: `isInCover` (point within any `HIDING_SPOTS` radius) →
`computeStealthFactor` (`Detection.ts:32`, `coverFactor 0.45`) → shrinks the
animal's `effectiveDetectionRadius` (`Detection.ts:45`). **Cover lets you approach
closer before the animal flees** — and closeness is the bait-less catch lever
(`proximityMultiplier`).

"Fewer to start, buy more" makes cover **player-provisioned state** (some
`HIDING_SPOTS` start inactive; a purchase activates them; persisted in v6).

⚠️ **The interaction to protect (this is the load-bearing risk):**
Cover is the **bait-scarcity anti-lockout valve**. Bait is shop-only and can run
out (§12 / PR #44); the cozy "never locked out" guarantee leans on **sneaking
from cover to get close enough to catch easy species bait-less**. **Fewer cover ⇒
harder approach ⇒ harder bait-less catch ⇒ re-opens the §4.0 lockout risk we
closed.**

**Protection (design recommendation — confirm):**
- **Keep a FREE cover baseline in every biome** — cover purchases *add* spots
  (provisioning beyond the floor), never the only way to have any. A net-less,
  bait-less player can always catch that biome's easy species from the free
  baseline (`proximityMin 0.7` + easy `baseCatchRate` keep them catchable at the
  reachable distance). Pin this as an invariant test in slice C.
- **Only the late/open biome (highlands) starts genuinely barer** — which is *also*
  the throwing-net's "open ground" condition (#1 synergy). Highlands sits behind
  the §4.1c demonstrated-mastery gate, so the player arrives equipped; the bait-less
  valve for *easy* species still holds via the free baseline, while the *harder*
  open-ground species are the throwing net's intended (buyable, lateral) answer.
- **Net-less is never a lockout, even in highlands:** ensure each biome's easiest
  species clears a bait-less, starter-net catch from the free baseline cover.

---

## #4 — The slice plan (the key output)

One catch-touching change at a time. Refined from the lean (A / B / C):

| Slice | What | Touches catch? | Notes |
|---|---|---|---|
| **A** | Durable-net **inventory + equip/switch + persistence v6 + UI**. Starter net behaves **exactly** as today. | **No** | Proves the system with zero catch-core change. Generalizes `game.tool` → owned/active net; v5→v6 migration; net tray (bait-tray pattern); buy row in the shop. |
| **B0** | **Add the lateral catch INPUT**: per-net **`reach`** (net-derived `attemptRadius`) + the **biome condition(s)** the nets key off (wetland water-gap; highlands openness via C). Starter net `reach` = current **2.6** ⇒ **behavior identical** (the invariant, like `stealthFactor === 1`). | **Yes (input only, not the formula)** | The careful catch PR. NO net gets a `catchMultiplier`. Wetland water-gap is the real new modeling — consider isolating it as its own sub-PR. |
| **B1** | **Biome-net behaviors**: dip-net (long reach + answers wetland water-gap), throwing net (range on open ground). Lateral by construction — they only set `reach`/condition params from B0. | **Yes (params only)** | Only after B0. Each net is "normal elsewhere" because the condition only exists in its biome. |
| **C** | **Cover rework** (fewer start, buy more) + the **#3 anti-lockout protection** (free baseline; only highlands barer). | Stealth/approach + balance (**not the catch formula**) | Also supplies B1's highlands "open ground" condition. |

**Ordering — recommended: A → C → B0 → B1.**
- A is non-catch → safe first.
- C touches stealth/approach (not the catch formula) **and creates the open-ground
  condition** B1 needs → do it before B1. Carries its own anti-lockout invariant.
- B0 then B1 are the catch-input changes, isolated and last, with C's condition
  already in place. (Wetland water-gap can be a B0 sub-slice if it grows.)
- **Never** combine B and C in one PR (two catch-adjacent changes at once).

Alternative if cover is contentious: A → B0 (reach input, highlands net deferred)
→ B1-wetland → C → B1-highlands. Slower but each step is smaller. **Decision
needed from Craig** (see below).

---

## #5 — Naturalist framing (P2/P5)

Real tools that teach "match your gear to the habitat":
- **Hand / sweep net** (starter) — close work in grass & ferns; ideal in
  meadow/woodland where you can sneak close.
- **Dip-net** (long-handled) — reaches over pond margins & reedbeds; the wetland
  tool, because wetland *has* water to reach across.
- **Throwing / casting net** — cast over open ground at flushing birds; the
  highlands tool, because the tops are *open* with no cover to close the gap.

Knowing *which net suits which biome* IS the naturalist knowledge the system
teaches. Names + flavor go in `constants.ts` (zero-asset; net geometry procedural,
matching the supply-hut precedent).

---

## #6 — Guardrail / pay-to-catch check

- **Starter net always catches everything** — A doesn't touch catch; B0 keeps
  starter `reach` = 2.6 (invariant); C keeps a free cover baseline. ✅ at every
  slice.
- **B must not touch the catch FORMULA** (`finalCatchChance` composition) — only
  the `attemptRadius`/`reach` **input** and new **condition** inputs. The
  multi-shake resolution and the multiplier structure stay byte-for-byte. ✅
- **Biome nets are LATERAL, not multipliers** — explicitly do **NOT** give any net
  a `catchMultiplier > 1`. Advantage = reach/condition only. ✅
- **⚠️ Pre-existing pattern to decide on:** `TOOLS.trap` (1.4) / `TOOLS.tranq`
  (1.9) are flat-multiplier, `unlocked:false`, mission-gated tools from an
  unshipped PR #8. They ARE the pay-to-catch shape. **Decision needed:** do biome
  nets **replace** trap/tranq (retire the flat multipliers), or coexist? The arc
  should not extend the flat-multiplier pattern.
- **Tests:** `358 passed (53 files)` on this branch, no code changed (recon only).
  Layout/feel and on-device behavior remain Craig's device gate as usual.

---

## Decisions needed before building slice A

1. **Ordering:** `A → C → B0 → B1` (recommended) vs the slower `A → B0 → …`?
2. **Wetland water-gap:** is adding a real water/flee-to-water condition in scope
   for this arc (it's the one genuinely new piece of catch modeling), or should the
   wetland net's laterality be achieved another way?
3. **trap/tranq:** retire the flat-multiplier tools in favor of lateral nets, or
   keep both systems?
4. **Cover floor:** confirm the "free baseline everywhere, only highlands barer"
   protection for the anti-lockout valve.
