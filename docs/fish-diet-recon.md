# Diet Expansion — the FISH diet recon (the 4th diet, research-gated, enriching Riverbank)

The §4.1.5 companion to Riverbank (#69): a 4th diet/bait (**fish**), **research-gated** ("study
aquatic life → unlock fish bait"), bringing the deliberately-held-back **kingfisher + otter** into
Riverbank as fish-eaters. Catch-touching (a new diet feeds the catch input) + a re-pin audit (HIGH
bar) + a new research reward type.

**This doc is design only — no code.** Findings cite `file:line` against current main (#69).

> ## ⚠️ Headline findings (de-risk the arc)
> 1. **The catch math is UNTOUCHED — and so is the match logic.** `calmMultiplier(correctBait:
>    boolean, fleeing)` (`Catch.ts:49`) takes a **boolean**; `isCorrectBaitFor` (`Bait.ts`) is
>    generic (`species.bait === state.activeType`). So fish is a **pure enum addition** — a new
>    `BaitId` + the new species' `bait: 'fish'`. **No formula, no match-logic change.**
> 2. **Zero existing re-pins** (audit #3): every shipped diet is biologically correct — the mallard
>    *dabbles* (greens), the dipper eats aquatic *insect larvae* (insects). Fish is added ONLY to the
>    new kingfisher + otter. **No balance change to any shipped species → the L1 band is untouched.**

---

## #1 — The diet/bait system now (+ the 4th, where it lands)

`BaitId = 'seeds' | 'greens' | 'insects'` (`constants.ts:329`); `BAIT_ORDER` + `BAIT_DISPLAY`
(label + a procedural `BaitIconKind`) drive the tray. The diet→catch path: `isCorrectBaitFor(species,
state)` = `species.bait === state.activeType` (a deployed, un-timed-out bait of the species' diet) →
the catch passes a **boolean** `correctBait` → `calmMultiplier = correctBait ? BAIT.correctCalm (3.5)
: 1.0`. **A 4th diet touches NONE of this logic** — it's: `BaitId += 'fish'`, `BAIT_ORDER += 'fish'`,
`BAIT_DISPLAY.fish`, a `'fish'` `BaitIconKind` (a procedural fish glyph), and `bait: 'fish'` on the
new species. The formula + the match are settled.

## #2 — Kingfisher + Otter (the held-back fish-eaters — pure addition to Riverbank)

| Species | Diet | Active | Water | Difficulty | Teaches |
|---|---|---|---|---|---|
| **Kingfisher** | **fish** | day | perches over / **dives into** water | hard (~0.20) | An electric-blue arrow — sits still over the river, then plunges to spear a fish. Flies off fast when flushed (so **no `fleesToWater`** — it *leaves*). A clean-water jewel. |
| **Otter** | **fish** | dusk (crepuscular) | **in** the river | hardest (~0.15, the game's apex catch) | A sleek river hunter — slips into the water and is gone (⚠️ **`fleesToWater`** — like the vole/frog; the **dip-net** matters again). Back from near-extinction where rivers run clean. |

Both `biome: 'riverbank'`, tier 4-5, `bait: 'fish'`, with `SPECIES_INFO` cards + `SPECIES_MODEL`
entries (a bird build for the kingfisher; the mouse/mammal build for the otter). They re-use the #55
water: the **otter flees into the river** (the third `fleesToWater` species — the dip-net's biome
deepens); the kingfisher dives but flees by flight.

## #3 — ⚠️ The re-pin audit (HIGH bar — honest result: NONE)

Every shipped species, against the bar *"is the current diet WRONG, such that fish is the correct
fix?"* (not "is fish also plausible"):

| | Diet | Verdict |
|---|---|---|
| fieldmouse/quail/redsquirrel/reedbunting | seeds | ✓ correct (seed-eaters) — **keep** |
| rabbit/roedeer/ptarmigan/mountainhare/watervole | greens | ✓ correct (grazers/browsers) — **keep** |
| hedgehog/robin/badger/dotterel/greywagtail | insects | ✓ correct (insectivores; badger = earthworms ≈ inverts) — **keep** |
| **mallard** | greens | ✓ **keep** — mallards **dabble** for plants/seeds; they are NOT fish-divers (herons/kingfishers are). Fish would be *wrong*. |
| **frog** | insects | ✓ **keep** — frogs eat insects/slugs/worms, not fish. |
| **dipper** | insects | ✓ **keep** — the dipper eats aquatic INSECT **larvae** (caddis/mayfly); "insects" is precisely right. Fish would be *wrong*. |

→ **No existing species is currently-wrong. Zero re-pins.** Fish is added only to the new
kingfisher + otter (pure addition, low bar). The careful original pinning holds; **no balance change,
no player-relearning cost, the L1 catch-balance band is unaffected.**

## #4 — ⚠️ The research gate + the bait reward type

A **`study-aquatic-life`** research project (the R1/R0b pattern): `activity` = catch-in-riverbank ×4
(study the river); a modest **credit `cost`** (fish bait is OPTIONAL convenience — see #5 — so a
credit sink is appropriate, unlike the cost-0 win-required biome gates); **no `knowledgeRequirement`**
(not core-progression, so no mastery gate needed — like R0b's layers / R1's nets). Completing it
**unlocks fish bait for purchase in the shop**.

**The reward type:** `ResearchReward` (`constants.ts:1937`) already has a **typed-but-UNWIRED
`shop-access` kind** (`{ kind:'shop-access'; key:string }`) — only `grant-tool` is dispatched today.
Two clean options:
- **(a) Add a `bait-access` kind** `{ kind:'bait-access'; bait:BaitId }` — explicit + type-safe,
  mirroring `biome-access`/`grant-tool`. ← **recommended.**
- (b) Wire the existing `shop-access` with `key:'fish-bait'` (reuses the kind, looser typing).

Either way, **"is fish bait unlocked" derives from the completed project** (like R1's net ownership /
R0b's layers — `researchProjectForBait('fish')?.completed`); the shop OFFERS fish bait once unlocked
(buyable like the other baits, the credit sink). No new gating code — the spine generalizes.

## #5 — ⚠️ Anti-lockout: fish bait is CONVENIENCE, never required

Bait is a **×3.5 force-multiplier, never a gate** (wrong/no bait = ×1.0, still catchable). So the
kingfisher + otter — like every species — must be **catchable BAIT-LESS with the starter net**
(harder, leaning on stealth/approach; fish bait makes them *easier*, never *possible*). Their base
rates are tuned so the bait-less final is `> 0` (catchable, hard): fish bait ×3.5 is the reward for
researching, not the key to the cage. **Reaching Riverbank's full dex — and the win — never requires
researching fish bait** (else it's a soft-lock on the win path). Pinned by a new L1 guard
(kingfisher/otter catchable bait-less). Fish bait is exactly as optional as seeds/greens/insects.

## #6 — The bait tray (density) + a downstream note

`.bait-tray` is a bottom-left flex row (gap 8px); each `.bait-chip` is ~80px (icon + label + count).
3 chips ≈ 250px; a 4th ≈ 330px — on a 390px iPhone that's tight and risks crowding the joystick /
bottom controls. Mitigations: **the fish chip only appears once researched** (so it's 3 chips for
most of the game — the density hit is late + earned), plus a possible shrink / wrap-to-two-rows. **A
4th chip needs an on-device density check in the build** (flagged, not blocking).

**Downstream (log, don't build):** a 4th diet opens **new non-forced research-challenge space** — the
§4.1b challenges are bounded by the catch dimensions (species/biome/phase/diet); a "catch a fish-eater"
or diet-themed challenge is fresh ground for future slices.

## #7 — Persistence + L1/L2

⚠️ **The one wrinkle — fish bait COUNT must start at 0** (not `startingCount` 5): it's research-gated.
`defaultBait`/`sanitizeBait` (`Journal.ts`) currently give **every** `BAIT_ORDER` entry
`startingCount` — so a per-bait starting count is needed (`fish: 0`, others 5). A v7 save (no fish
key) loads with `fish: 0` via the new default — so **no schema bump** (the `Record<BaitId, number>`
shape is unchanged; the new key defaults transparently; the unlock derives from `journal.research`).
`SpeciesId` widens (+kingfisher, +otter — compile-time). `src/game/` + state stay pure.

**New L1 guards:** the kingfisher/otter are catchable **bait-less** (anti-lockout #5); the catch
band holds (no re-pin → unchanged); fish bait is **research-gated** (locked at 0 until the project
completes); the **win path** includes the 2 new species (progression-to-win extends). **L2:** the
new species are entities in the existing Riverbank scene; a tray-with-4-chips scene could verify the
density. **455 green** on this branch.

---

## Decisions needed before building

1. **The re-pin audit: confirm ZERO existing re-pins** (only the new kingfisher + otter get fish) —
   the honest result.
2. **The reward type: a new `bait-access` kind** (recommended) or reuse the unwired `shop-access`?
3. **Anti-lockout: fish bait is convenience, not required** — the kingfisher/otter catchable
   bait-less, the win reachable without researching fish — confirm?
4. **Fish bait starts at 0, research-gates the shop offer** (the persistence wrinkle) — confirm the
   no-bump approach? And the 2 species' base rates (kingfisher ~0.20, otter ~0.15 — the apex catch)?
