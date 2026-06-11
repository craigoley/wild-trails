# World Expansion — CAVE / UNDERGROUND (recon)

*the always-dark biome; the CONTAINED phase-independent twist; the dark-biome legibility*

PLAN.md §4.2 + Craig's pick: the **Cave** — the one remaining biome with a new-mechanic idea. The
twist (locked): cave species are **phase-independent** — active regardless of surface day/night
(honest: cave-dwellers ignore the surface cycle; a place *outside* the cycle). This is flagged as the
**1st biome to touch a core system (phase)** — so the recon's job is to confirm the twist is genuinely
**contained** (not a ripple) and solve the **dark-biome legibility**. **Design only — no code.**

> ## ⚠️ The headline: the "core-system touch" DISSOLVES — the twist is the EXISTING `'any'` flag
> "Phase-independent" already exists, fully supported and proven: **`activityWindow: 'any'`**
> (`isActiveAt(window, phase) = window === 'any' || window === phase`). The **fieldmouse and rabbit use
> it today** — always active, every phase. So a cave species is just an **`'any'`-window species**. And
> the cave **cannot change the clock**: `dayPhaseAt(timeSec)` is a pure function of the *global* clock,
> with **no biome input** — `game.dayPhase` runs the normal surface cycle everywhere, including
> underground. So the recommended design is **NOT a risky core change** and **NOT merely the fallback** —
> it's the correct, honest, zero-core-touch slice: **visual-dark cave + `'any'`-window species + the
> clock runs normally.** Every ripple the brief feared is structurally impossible. Details below.

---

## #1 — ⚠️ The phase trace: is the rule CONTAINED? (every reader checked)

**How phase works** (`Time.ts`): `dayPhaseAt(timeSec)` maps the global clock → `dawn/day/dusk/night`.
**Biome-independent** — it takes only `timeSec`. `GameState.update` sets `game.dayPhase =
dayPhaseAt(game.timeSec)` once per tick, everywhere. **The cave cannot override it without a rewire**
(and we will not rewire it).

Every reader of phase, and how the cave's `'any'` species + normal clock slot in **with zero change**:

| Reader | How it reads phase | Cave (`'any'` species, normal clock) |
|---|---|---|
| **SPAWNS** (`Spawn.trySpawn` → `eligibleSpecies(biome, phase)` → `isActiveAt`) | `'any'` ⇒ eligible at **every** phase | ✅ Cave species always spawn — the existing `'any'` path. No rewire. |
| **#92 CHALLENGES** (`Missions.meets`: `ev.phase === req.phase`) | checks the catch event's phase | ✅ `ev.phase = game.dayPhase` = the **real surface clock** at catch time. A cave catch carries the **true** phase (see #2). |
| **ANTI-LOCKOUT** | `'any'` ⇒ `isActiveAt` returns **true** | ✅ Always available — the opposite of the "ignores phase ⇒ never qualifies" edge (the flag returns *true*, never false). |
| **the HUD time indicator / `lastCaughtPhase`** | display the real `game.dayPhase` | ✅ Shows the **surface** time while you're underground — honest ("it's day above; you're in the dark"). No dissonance to fix. |

> **Verdict: maximally contained — it requires NO core-system change.** The cave is, mechanically, a
> normal additive biome (like the others) whose species use the existing `'any'` window, plus a dark
> palette. **`Catch.ts`, `Time.ts`, `Missions.meets`, `Spawn` — all untouched.**
> **The REJECTED design** (what *would* ripple): making the cave **override `game.dayPhase`** to a
> special "underground/always-night" state. That touches spawns + challenges + the HUD + `lastCaughtPhase`
> at once — a global rewrite. **Do not do this.** The `'any'`-window design delivers the identical honest
> payload (cave-dwellers outside the cycle) with none of the blast radius.

---

## #2 — ⚠️ No #48 / challenge trivialization (the sharp risk, resolved)

**The fear:** a cave catch counts as "night" for free → every cave catch satisfies "catch X at night",
eroding the #48 non-forced property.

**Why it can't happen here:** the cave is visually dark **but does not touch `game.dayPhase`** (#1). So
`ev.phase` on a cave catch is the **real surface phase** at that moment. *"Catch X at night"* still
requires the **actual clock** to read night — the dark cave never auto-satisfies it. The visual dark and
the phase logic are fully decoupled. ✅

**The rule for cave-related challenges (confirmed lean):** cave species' challenges (and the cave's own
access gate) use **SPECIES + BAIT** conditions, **never phase**. Two reasons: (a) it keeps the
"always-dark" mood from ever *appearing* to interact with a phase requirement (no player confusion), and
(b) an `'any'`-window species is a poor phase-challenge subject anyway (its phase is whatever the clock
says). So: **the cave gate is a species+bait #92 challenge in the prereq biome** (#5), and cave species
are not the subject of phase-conditioned challenges. Trivialization is impossible by construction *and*
by authoring rule.

---

## #3 — ⚠️ The dark-biome legibility (crux B, solved by NOT dimming the lights)

The lighting is **global and static** (`SceneManager`: one `AmbientLight` 0.45 + a directional key 0.9 +
a hemisphere fill, added once) — there is **no per-biome lighting** and **no phase→scene-brightness
coupling** (confirmed: nothing in rendering dims the scene by phase). So the cleanest, contained way to
make the cave read dark is the **GROUND PALETTE**, exactly like every biome's `color`:

- **The cave is dark via a near-black, cool ground colour** (e.g. `~0x141a1e` slate/charcoal), the
  through-line warmth grade (TL1) layering on top as usual — **not** via dimmed lighting.
- **Entities keep the unchanged global lights → they stay fully lit.** A normally-lit player/animal on a
  **dark** ground is **HIGH contrast** — *more* visible, not less. (Dark-on-dark only happens if you dim
  the *lights*; we don't.) **Pine's entities-on-top** (`depthTest:false` + renderOrder) reinforces it —
  entities draw over the dark ground + any dark props.
- **Mood without burying gameplay:** dark ground + cool tint + a few dark stalagmite/rock props (reuse
  the `rocks` cover kind, recoloured) reads "underground" while the lit entities pop. The "always dark"
  is a **palette mood**, fully legible.

> **Crux B is solved by restraint:** keep the lights, darken the ground. ⚠️ If Craig later wants a
> *genuinely dimmer* moody cave (dimmed lighting / a vignette), **that** is where entity contrast breaks
> — and it'd need entity emissive/rim-lighting (a real change). Flagged as an **optional v2**; v1 is the
> safe, legible dark-ground cave.

---

## #4 — The species + diets (honest — and the cave is HONESTLY a narrow roster)

⚠️ **Honest cave ecology is narrow:** British cave fauna is **bats** (insectivores) + invertebrates that
don't fit the catch model. So the roster **leans `insects`** — that's the honest constraint, not a
failure. The one honest non-insect: an **underground pool** (a small #55 water region) lets the
**European eel** in (a dark-water migrant), adding `fish` + a second conservation hero.

**Proposed 5 (honest diets, honest status, CJ2 gaits):**

| Species | Diet | Difficulty | Gait | Honest status |
|---|---|---|---|---|
| **Common Pipistrelle** | insects | easiest (the valve, bait-less) | bird (flight bob) | doing well — our commonest bat, in towns and caves alike |
| **Daubenton's Bat** | insects | easy–medium | bird | the "water bat" — trawls insects over the underground pool; stable |
| **Brown Long-eared Bat** | insects | medium | bird | the "whispering bat" — quiet, gleaning; sensitive to disturbance |
| **Greater Horseshoe Bat** | insects | hard — ⚠️ a hero | bird | rare + strictly protected; lost most of its range, hanging on in the SW |
| **European Eel** | fish | apex | swim/walk | ⚠️ the 2nd hero — **critically endangered**, a mysterious dark-water migrant (the underground pool; fleesToWater) |

Anti-lockout valve: the **pipistrelle** (calm, insects, bait-less catchable). Diets: insects ×4 + fish
×1 — honest (bats eat insects; the eel takes the pool). Two real stakes (the protected horseshoe bat, the
critically-endangered eel). **CJ2 gaits:** bats reuse `bird` (a flight bob; the build can add a winged
silhouette), the eel `swim`/`walk` like the otter. The card's `ACTIVITY_LABEL.any` ("Active all day")
could get a tiny cave reword ("Active in the dark, round the clock") — a small teaching beat for "outside
the cycle."
> **Simpler alternative if Craig prefers no water:** drop the eel → **4 bats** (all `insects`). Honest
> and clean, but flatter (one diet, one hero). I lean the **bats + eel** version (diet variety + two
> heroes + the atmospheric pool).

---

## #5 — The branch + the gate

**The fork:** caves form in limestone uplands and along rivers (karst springs / river caves). The
**Highlands node is full** (no free edge), so fork off the **RIVERBANK** — `Riverbank → { Coast, Cave }`
— *"the river vanishes underground into a cave system."* This ties the cave's **underground pool + eel**
to the riverbank's water, and gives a clean fork. Place the **Cave at cell(80,80)** (`[60,100]×[60,100]`,
E of the Riverbank, N of the Moor), **tier 5**, adjacent to `riverbank` + `moor`. `BIOME_SET_UNLOCK.riverbank
= ['coast', 'cave']` (**additive** — the Coast arm unchanged; pin no regression).
**Both breadcrumbs:** the Riverbank has **no mission set** (research-gated, like the Moor), so the fork's
two breadcrumbs surface in the **research-area panel** (both `unlock-the-coast` and `unlock-the-cave`
projects, area-tagged) — the **Moor pattern**, confirmed legible.

**The gate** — a **#92 multi-condition challenge, SPECIES + BAIT, no phase** (#2), activity in the prereq
**Riverbank**: e.g. **`research-dipper-insects`** (*"catch the dipper over insect bait"* — a riverbank
species, its real diet; non-forced via bait) + an `unlock-the-cave` project (cost-0 biome-access,
knowledge-by-play double-enforced — mirrors `unlock-the-moor`/`unlock-the-pineforest`).

---

## #6 — Scope + L1/L2 (the EXACT core touch: none)

- **The exact core-system touch:** **NONE.** The phase-independent rule is the **existing
  `activityWindow: 'any'`** (data, not code); the cave does not override `game.dayPhase`. **`Catch.ts`,
  `Time.ts`, `Missions.meets`, `Spawn`, `Species.isActiveAt` — all byte-unchanged.** The slice is the
  proven **additive data pattern** + the dark **ground palette** + (optionally) one **#55 water** region
  for the eel + a recoloured **rocks** prop.
- **No schema bump:** `BiomeId`/`SpeciesId` widen at compile-time; `unlockedBiomes` is an unbounded
  `string[]`. Additive.
- **`src/game/` purity:** the cave is pure data; the dark is a render constant; the `'any'` window is a
  pure flag the sim already honours.
- **L2:** a **new dark Cave scene** (a new additive frozen baseline, `?…&unlock=all&at=80,80`), seeded
  after Craig approves the dark look. The existing baselines are a new-cell-away (the Pine entities-on-top
  already shipped). The dark-ground + lit-entity contrast is the thing to eyeball.
- **Tests:** green on this branch — **590 passing** (the recon adds no code). The build will add the
  Heathland/Pine-style guards (the additive branch + both breadcrumbs; the #92 gate's #48 both-failure-
  modes; **anti-lockout** the pipistrelle bait-less; the win-path extends through the Cave; gait tags;
  **no schema bump**) **plus a new pin: a cave catch carries the REAL surface phase** (no
  trivialization — the heart of #2) and **the cave species are `'any'`-window** (the contained twist).

---

## STOP — the decision before building

The scary part isn't scary: the twist reduces to the existing `'any'` flag + a dark ground, with the
clock untouched. Craig confirms:

1. **The contained twist (#1/#2)** — ship **visual-dark + `'any'`-window species + the clock runs
   normally** (zero core change, no trivialization) *(strongly recommended)* — vs. the rejected
   dayPhase-override (don't)?
2. **The legibility (#3)** — dark via the **ground palette**, lights unchanged, entities pop
   *(recommended)*? Or a moodier dimmed-light cave (optional v2, needs entity rim-light)?
3. **The roster (#4)** — **4 bats + the eel** (diet variety + 2 heroes + the underground pool)
   *(recommended)*, or 4 bats only (simpler, all-insects)?
4. **The branch (#5)** — fork off the **Riverbank** at cell(80,80) (the underground river) *(recommended)*?

After Craig confirms the contained twist + the legibility + the branch, the build implements it — then
Craig playtests the dark cave (does it read underground; are the player + animals clearly visible) and
approves the look (then the new Cave L2 baseline seeds).
