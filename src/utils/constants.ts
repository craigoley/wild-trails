/**
 * ALL tuning values live here. No magic numbers anywhere else in the codebase.
 *
 * The pure game layer works on a flat world plane in world units: `x` runs
 * left/right, `y` runs near/far (depth). The rendering layer maps those onto
 * three.js axes (game x -> three x, game y -> three z) and views the plane
 * through an OrthographicCamera tilted to an isometric angle. Speeds are
 * world-units per second.
 *
 * Catch/species/AI/spawn tuning lands in later phased PRs — each adds its own
 * block here, never a magic number out at a call site.
 */

import type { Rect } from './math';

/** Wild palette as 0xRRGGBB numbers for the three.js / rendering layer. */
export const PALETTE = {
  background: 0x0d1f12,
  /** Ground plane — deep forest green. */
  ground: 0x1d3b24,
  /** Faint world grid lines over the ground. */
  groundLine: 0x2c5436,
  /** Player marker — warm trail-blaze orange (reads against the green). */
  player: 0xffb347,
  /** Fog veil over locked biomes — the deep-shadow background colour. */
  fog: 0x0a1810,
  /** Boundary wall at the edge of the unlocked region (warm "blocked" amber). */
  boundary: 0xffcf6b,
  /** Target ring when armed (bright cyan — "this is your catch target"). */
  targetArmed: 0x66f0ff,
  /** Target ring when the correct bait is on it (green — "baited, calm"). */
  targetBaited: 0x6dff9b,
  /** Active-bait ground marker (warm seed-amber). */
  baitMarker: 0xffd166,
} as const;

/** Same palette as CSS hex strings for the HTML HUD overlay. */
export const CSS_PALETTE = {
  background: '#0d1f12',
  ground: '#1d3b24',
  player: '#ffb347',
  /** Result flash: caught (green) / escaped (amber). */
  caught: '#6dff9b',
  escaped: '#ffcf6b',
} as const;

/**
 * Fixed simulation timestep, seconds. The sim ALWAYS advances in whole slices of
 * this size so it stays deterministic and frame-rate independent; the render
 * loop accumulates real frame time and steps the sim in fixed SIM_DT slices,
 * interpolating the remainder so motion is smooth at any refresh rate.
 */
export const SIM_DT = 1 / 60;

/**
 * Hard cap on a single real frame delta, seconds. A backgrounded tab can return
 * a multi-second delta; clamp it so the sim doesn't fast-forward (and the
 * accumulator doesn't spiral) when the page regains focus.
 */
export const MAX_FRAME_DT = 0.25;

/** Player body. */
export const PLAYER = {
  /** Collision half-extent AND visual half-size, world units. */
  radius: 0.4,
} as const;

/**
 * The roaming world. A finite isometric world made of BIOME cells. The starting
 * Meadow is the original square centred on the origin; the other biomes tile
 * outward from it. `halfSize` is the half-extent of ONE biome cell.
 */
export const WORLD = {
  /** Half-extent of a single biome cell from its centre, world units. The
   *  starting Meadow spans [-halfSize, +halfSize] on each axis (unchanged from
   *  the Phase 0 square), and adjacent biomes are cells of the same size tiled
   *  beside it. */
  halfSize: 20,
} as const;

/** The biomes in the world. `meadow` is the starting region. */
export type BiomeId = 'meadow' | 'woodland' | 'wetland' | 'highlands';

/** Static definition of one biome: its finite bounds, display name, adjacency
 *  in the world graph, initial unlocked state, and ground tint. */
export interface BiomeDef {
  id: BiomeId;
  displayName: string;
  /** Finite footprint in world units. */
  bounds: Rect;
  /** Whether the biome is enterable. Only the Meadow starts unlocked; the
   *  unlock MECHANISM (missions) arrives in a later PR — this is just the
   *  initial state so the locked-but-visible rendering has something to read. */
  unlocked: boolean;
  /** Adjacent biome ids (graph edges). */
  adjacent: BiomeId[];
  /** Ground tint, 0xRRGGBB. */
  color: number;
}

/** Half-size of one biome cell, and the centre-to-centre pitch of the grid (one
 *  full cell, so adjacent cells share an edge with no gap). */
const CELL = WORLD.halfSize;
const PITCH = CELL * 2;

/** A square biome cell of half-size CELL centred at (cx, cy). */
function cell(cx: number, cy: number): Rect {
  return { minX: cx - CELL, minY: cy - CELL, maxX: cx + CELL, maxY: cy + CELL };
}

/** Iteration order for the biome graph (deterministic; render + lookup order). */
export const BIOME_ORDER: readonly BiomeId[] = ['meadow', 'woodland', 'wetland', 'highlands'];

/**
 * The biome graph. A 2x2 grid of equal cells:
 *
 *     WOODLAND (0, +PITCH) | HIGHLANDS (+PITCH, +PITCH)
 *     MEADOW   (0, 0)      | WETLAND   (+PITCH, 0)
 *
 * The Meadow is unlocked and centred on the origin (so its bounds equal the
 * original world square); the other three exist in the graph but are locked.
 */
export const BIOMES: Record<BiomeId, BiomeDef> = {
  meadow: {
    id: 'meadow',
    displayName: 'Meadow',
    bounds: cell(0, 0),
    unlocked: true,
    adjacent: ['woodland', 'wetland'],
    color: 0x2f6b3a,
  },
  woodland: {
    id: 'woodland',
    displayName: 'Woodland',
    bounds: cell(0, PITCH),
    unlocked: false,
    adjacent: ['meadow', 'highlands'],
    color: 0x244f2c,
  },
  wetland: {
    id: 'wetland',
    displayName: 'Wetland',
    bounds: cell(PITCH, 0),
    unlocked: false,
    adjacent: ['meadow', 'highlands'],
    color: 0x2a5a55,
  },
  highlands: {
    id: 'highlands',
    displayName: 'Highlands',
    bounds: cell(PITCH, PITCH),
    unlocked: false,
    adjacent: ['woodland', 'wetland'],
    color: 0x4a4f57,
  },
};

/** How locked-but-adjacent biomes are rendered — visible (the metroidvania
 *  breadcrumb) but clearly out of reach. */
export const BIOME_RENDER = {
  /** Locked biome ground is darkened by this factor (0..1) so it reads as
   *  "there, but not yet yours". */
  lockedDim: 0.45,
  /** Opacity of the translucent fog veil drawn over locked biomes. */
  fogOpacity: 0.4,
  /** Small +y offset of the fog veil above the ground (avoids z-fighting). */
  fogY: 0.02,
  /** Boundary wall (at the edge between the unlocked region and a locked
   *  neighbour) — height + thickness in world units, and opacity (semi-
   *  transparent so the locked land is still visible past it). */
  wallHeight: 1.2,
  wallThickness: 0.3,
  wallOpacity: 0.55,
} as const;

// ===========================================================================
// Time of day
// ===========================================================================

/** The four phases of the day-night cycle. Time of day gates which species are
 *  out (the educational mechanic: crepuscular animals only at dawn/dusk, etc). */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** A species' activity window: one day phase, or ANY (out at all hours). */
export type ActivityWindow = DayPhase | 'any';

/** Human-readable activity label for the Field Journal card (confirms the
 *  time-of-day mechanic the player learned by encountering the species). */
export const ACTIVITY_LABEL: Record<ActivityWindow, string> = {
  any: 'Active all day',
  dawn: 'Active at dawn',
  day: 'Active by day',
  dusk: 'Active at dusk',
  night: 'Active at night',
};

/** Display for the HUD time-of-day indicator: a short label + a zero-asset
 *  unicode glyph per phase (so a kid instantly reads "it's dusk"). */
export const DAY_PHASE_DISPLAY: Record<DayPhase, { label: string; icon: string }> = {
  dawn: { label: 'Dawn', icon: '🌅' },
  day: { label: 'Day', icon: '☀️' },
  dusk: { label: 'Dusk', icon: '🌆' },
  night: { label: 'Night', icon: '🌙' },
};

/** Labels for the organised panels (Mission Active/Completed sections, Journal
 *  per-biome headers). No magic strings out in the renderers. */
export const PANEL_LABELS = {
  /** Mission section headers. */
  missionsActive: 'Active',
  missionsCompleted: 'Completed',
  /** Appended to a still-locked biome's Journal header ("Highlands — 0 of 3 · locked"). */
  lockedSuffix: ' · locked',
} as const;

/** Copy for the §17.1 "Reach new lands" unlock-legibility block — the naturalist
 *  voice (a field journal, not a system toast). The set→biome relationship made
 *  legible: complete a biome's missions → reach the next. */
export const UNLOCK_COPY = {
  blockHeader: 'Reach new lands',
  /** In progress: complete the set to reach the target biome. */
  toReach: (setName: string, targetName: string): string =>
    `Complete the ${setName} missions to reach the ${targetName}`,
  /** Already earned: a quiet ✓ of the path walked. */
  opened: (targetName: string): string => `✓ The ${targetName} lies open`,
} as const;

/**
 * Day-night cycle. The cycle length is one full loop through dawn -> day ->
 * dusk -> night; each phase's START is a fraction of the cycle [0, 1). Dawn and
 * dusk are deliberately SHORT (the crepuscular windows) and day/night long.
 */
export const TIME = {
  /** Full day-night cycle length, seconds. */
  cyclePeriodSec: 120,
  /** Phase start fractions of the cycle, ascending. dawn starts at 0. */
  dayStart: 0.15,
  duskStart: 0.5,
  nightStart: 0.65,
} as const;

// ===========================================================================
// Species
// ===========================================================================

/** Every catchable species id. Phase 4 seeds only the Meadow's tier-1 roster;
 *  locked biomes get their species as they unlock in later PRs. */
export type SpeciesId =
  | 'fieldmouse'
  | 'rabbit'
  | 'quail'
  | 'hedgehog'
  // Woodland (tier 2 — rarer / faster / warier than the Meadow roster).
  | 'redsquirrel'
  | 'robin'
  | 'badger'
  | 'roedeer'
  // Wetland (tier 3 — the hardest lowland roster).
  | 'mallard'
  | 'frog'
  // Highlands (tier 4 — alpine high-tops, the hardest roster of all).
  | 'ptarmigan'
  | 'mountainhare'
  | 'dotterel';

/** Rarity/difficulty tier: 1 = common, slow, forgiving … higher = rarer,
 *  faster, warier. The Meadow is all tier 1. */
export type Tier = 1 | 2 | 3 | 4 | 5;

/** Bait types = animal diets. The right bait for a species' diet calms it and
 *  lures it closer; the wrong bait does nothing (the diet-learning mechanic). */
export type BaitId = 'seeds' | 'greens' | 'insects';

/**
 * Static definition of one species. The two axes the design keeps INDEPENDENT:
 *  - `spawnWeight` is the RARITY axis (how often it appears), and
 *  - `baseCatchRate` is the catch-DIFFICULTY axis (how hard it is once found).
 * They are deliberately NOT collapsed into one number. `baseCatchRate` is
 * reserved for PR #5 (the catch loop) — it's typed here so the table shape is
 * stable, but nothing reads it yet.
 */
export interface SpeciesDef {
  id: SpeciesId;
  displayName: string;
  /** Home biome — the only biome this species spawns in. */
  biome: BiomeId;
  /** RARITY: relative weight in the spawn lottery (higher = more common). */
  spawnWeight: number;
  /** Flee speed when startled, world units/sec (kept below the player's top
   *  speed so tier-1 animals are catchable on foot once catching lands). */
  baseFleeSpeed: number;
  /** How close the player can get before the animal bolts, world units. */
  detectionRadius: number;
  /** Which day phase this species is active in (ANY = all hours). */
  activityWindow: ActivityWindow;
  tier: Tier;
  /** CATCH DIFFICULTY — the base [0,1] catch chance before tool / proximity /
   *  bait / biome modifiers (the catch loop, PR #5). INDEPENDENT of spawnWeight. */
  baseCatchRate: number;
  /** Diet — the bait type that calms + lures this species (wrong bait = no-op). */
  bait: BaitId;
  /** Render tint, 0xRRGGBB. */
  color: number;
  /** Visual size (cube side), world units — smaller animals read as smaller. */
  size: number;
  /** Short, accurate "did you know" line for the Field Journal card. Written as
   *  CONFIRMATION of what play taught (§5), not a front-loaded lecture. */
  profile: string;
}

/** Deterministic iteration order over the species table. */
export const SPECIES_ORDER: readonly SpeciesId[] = [
  'fieldmouse',
  'rabbit',
  'quail',
  'hedgehog',
  'redsquirrel',
  'robin',
  'badger',
  'roedeer',
  'mallard',
  'frog',
  'ptarmigan',
  'mountainhare',
  'dotterel',
];

/**
 * The species table — DATA. The Meadow's tier-1 roster: common, slow, docile
 * animals with varied activity windows so time-of-day gating is real
 * (fieldmouse + rabbit are out all day; quail forages at dawn; the hedgehog is
 * crepuscular at dusk).
 */
export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  fieldmouse: {
    id: 'fieldmouse',
    displayName: 'Field Mouse',
    biome: 'meadow',
    spawnWeight: 6,
    baseFleeSpeed: 2.6,
    detectionRadius: 2.5,
    activityWindow: 'any',
    tier: 1,
    // EASY: slow flee (2.6) + common. High base so a starter mouse is reliable.
    // Plan #12 spread (~0.82): 0.75 -> 0.62 so skill (bait/proximity) matters more.
    baseCatchRate: 0.62,
    bait: 'seeds',
    color: 0x8a7b6b,
    size: 0.45,
    profile:
      'Field mice turn up almost anywhere and eat mostly seeds and grains. They breed several times a year, which is why they are the commonest catch in the meadow.',
  },
  rabbit: {
    id: 'rabbit',
    displayName: 'Rabbit',
    biome: 'meadow',
    spawnWeight: 3,
    // PR #5.1 feel: eased 4.2 -> 3.8 so a player (maxSpeed 6) closes the gap
    // without an endless chase, but it's still the brisk one of the roster.
    baseFleeSpeed: 3.8,
    detectionRadius: 3.5,
    activityWindow: 'any',
    tier: 1,
    // MEDIUM: brisk flee (3.8) — catchable bare, but the right bait clearly helps.
    // Plan #12 spread (~0.82): 0.50 -> 0.41.
    baseCatchRate: 0.41,
    bait: 'greens',
    color: 0xb8a584,
    size: 0.55,
    profile:
      'Rabbits graze on grasses and clover and bolt for cover in a zig-zag when startled. Their big ears help them hear danger coming.',
  },
  quail: {
    id: 'quail',
    displayName: 'Quail',
    biome: 'meadow',
    spawnWeight: 2,
    // PR #5.1 feel: eased 4.6 -> 4.0 (still the fastest/wariest tier-1, but
    // catchable on foot rather than a marathon).
    baseFleeSpeed: 4.0,
    detectionRadius: 4.0,
    activityWindow: 'dawn',
    tier: 1,
    // HARD: fastest + wariest (flee 4.0, detection 4.0). Low base so seeds (its
    // diet) are effectively REQUIRED — the moment bait stops feeling optional.
    // Plan #12 spread (~0.82): 0.32 -> 0.26.
    baseCatchRate: 0.26,
    bait: 'seeds',
    color: 0x9c7b4a,
    size: 0.5,
    profile:
      'Quail forage at first light for seeds and shoots, and would rather run than fly. Coveys roost together in a circle, tails pointing in.',
  },
  hedgehog: {
    id: 'hedgehog',
    displayName: 'Hedgehog',
    biome: 'meadow',
    spawnWeight: 2,
    baseFleeSpeed: 1.8,
    detectionRadius: 2.0,
    activityWindow: 'dusk',
    tier: 1,
    // EASIEST: slowest + most docile (flee 1.8). The confidence-building catch.
    // Plan #12 spread (~0.82): 0.85 -> 0.70 (still the most catchable; point-blank
    // ~0.91 bare, so even the easy one isn't a guaranteed tap without help).
    baseCatchRate: 0.7,
    bait: 'insects',
    color: 0x5c4a3a,
    size: 0.5,
    profile:
      'Hedgehogs come out at dusk to hunt insects and worms. When threatened they curl into a spiky ball — they\'re calm and easy to approach.',
  },
  // --- Woodland, tier 2 — harder than every Meadow animal (lower baseCatchRate
  //     than the Meadow average, faster flee than the Meadow's fastest). ---
  redsquirrel: {
    id: 'redsquirrel',
    displayName: 'Red Squirrel',
    biome: 'woodland',
    spawnWeight: 4,
    // TIER 2: quick + wary, darts for the trees. flee 4.4 > Meadow's fastest (4.0).
    baseFleeSpeed: 4.4,
    detectionRadius: 4.2,
    activityWindow: 'day',
    tier: 2,
    // Plan #12 spread (~0.82): 0.42 -> 0.34.
    baseCatchRate: 0.34,
    bait: 'seeds',
    color: 0xb5632a,
    size: 0.5,
    profile:
      'Red squirrels forage by day for seeds, nuts and cones, burying caches to dig up later. They are quick and wary, and bolt up the nearest trunk when alarmed.',
  },
  robin: {
    id: 'robin',
    displayName: 'Robin',
    biome: 'woodland',
    spawnWeight: 3,
    // TIER 2: the hardest yet — baseCatchRate (below the Meadow min), flee 4.6
    // (above the Meadow max 4.0). A flighty dawn songbird.
    baseFleeSpeed: 4.6,
    detectionRadius: 4.5,
    activityWindow: 'dawn',
    tier: 2,
    // Plan #12 spread (~0.82): 0.30 -> 0.25 (still the hardest; > 0, catchable).
    baseCatchRate: 0.25,
    bait: 'insects',
    color: 0x9c5042,
    size: 0.42,
    profile:
      'Robins sing from first light and hunt insects, worms and grubs — often following a digging gardener for an easy meal. They are bold but flighty, quick to flit off.',
  },
  // --- Woodland, tier 2 (Plan #9) — deepen the biome ---
  badger: {
    id: 'badger',
    displayName: 'Badger',
    biome: 'woodland',
    spawnWeight: 3,
    // SLOW but WARY: low flee (3.6) yet a low catch rate — it's caution, not speed
    // (wide detection). The night-only animal: be out after dark to find it.
    baseFleeSpeed: 3.6,
    detectionRadius: 4.0,
    activityWindow: 'night',
    tier: 2,
    baseCatchRate: 0.32,
    bait: 'insects',
    color: 0x44444a,
    size: 0.6,
    profile:
      'Badgers live underground in setts and come out at night to snuffle for earthworms, their favourite food. Their bold black-and-white striped face is a warning to leave them be.',
  },
  roedeer: {
    id: 'roedeer',
    displayName: 'Roe Deer',
    biome: 'woodland',
    spawnWeight: 2,
    // FAST + skittish: flee 4.6 (tied with the robin), a low rate. A dusk browser.
    baseFleeSpeed: 4.6,
    detectionRadius: 4.4,
    activityWindow: 'dusk',
    tier: 2,
    baseCatchRate: 0.28,
    bait: 'greens',
    color: 0xa9784e,
    size: 0.7,
    profile:
      'Roe deer browse on leaves, shoots and brambles at dawn and dusk, slipping between the trees. They freeze at the faintest sound, then bound away with a sharp bark.',
  },
  // --- Wetland, tier 3 (Plan #9) — the hardest roster: rate below the Woodland band ---
  mallard: {
    id: 'mallard',
    displayName: 'Mallard',
    biome: 'wetland',
    spawnWeight: 4,
    baseFleeSpeed: 4.4,
    detectionRadius: 4.2,
    activityWindow: 'day',
    tier: 3,
    baseCatchRate: 0.24,
    bait: 'greens',
    color: 0x2f5d3a,
    size: 0.5,
    profile:
      'Mallards dabble at the water\'s surface, tipping upside-down to reach pondweed and seeds. The male\'s glossy green head shines in the sun; both burst into noisy flight when startled.',
  },
  frog: {
    id: 'frog',
    displayName: 'Common Frog',
    biome: 'wetland',
    spawnWeight: 5,
    // HARDEST yet (0.20): tiny, skittish, the fastest flee (4.8) — a single leap to
    // the water. Catchable, but only with the right approach + bait.
    baseFleeSpeed: 4.8,
    detectionRadius: 4.5,
    activityWindow: 'dawn',
    tier: 3,
    baseCatchRate: 0.2,
    bait: 'insects',
    color: 0x5f8f3f,
    size: 0.32,
    profile:
      'Common frogs catch insects, slugs and worms with a flick of their sticky tongue. They breathe through damp skin and escape danger with one powerful leap back into the water.',
  },
  // --- Highlands (tier 4 — alpine high-tops, below the Wetland floor 0.20) ------
  ptarmigan: {
    id: 'ptarmigan',
    displayName: 'Rock Ptarmigan',
    biome: 'highlands',
    spawnWeight: 5,
    // A ground grouse — relies on camouflage, then flushes; moderate flee, but a
    // tier-4 catch rate (0.18, below the frog's 0.20).
    baseFleeSpeed: 4.2,
    detectionRadius: 4.0,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.18,
    bait: 'greens',
    color: 0xb8b4a4,
    size: 0.36,
    profile:
      'Rock ptarmigan live higher up the mountain than almost any other bird. They swap their speckled brown summer feathers for pure white in winter, vanishing against the snow.',
  },
  mountainhare: {
    id: 'mountainhare',
    displayName: 'Mountain Hare',
    biome: 'highlands',
    // The FASTEST flee in the game (5.2, still below the player's maxSpeed 6 — so
    // catchable on foot, but only just): alpine hares are explosively quick.
    spawnWeight: 4,
    baseFleeSpeed: 5.2,
    detectionRadius: 5.0,
    activityWindow: 'dusk',
    tier: 4,
    baseCatchRate: 0.15,
    bait: 'greens',
    color: 0x9aa3ad,
    size: 0.46,
    profile:
      "Britain's only native hare of the high tops, the mountain hare turns blue-grey then white in winter for camouflage. It can bound away faster than almost anything on the hill.",
  },
  dotterel: {
    id: 'dotterel',
    displayName: 'Dotterel',
    biome: 'highlands',
    // The HARDEST catch (0.12): a small, rare wader of the highest tops.
    spawnWeight: 3,
    baseFleeSpeed: 3.8,
    detectionRadius: 4.2,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.12,
    bait: 'insects',
    color: 0xa9763f,
    size: 0.3,
    profile:
      'Dotterel nest on the highest, stoniest ground of all. Unusually, it is the female who is brighter coloured — the male sits on the eggs and raises the chicks alone.',
  },
};

// ===========================================================================
// Spawning + animal AI
// ===========================================================================

/** Biome + time-of-day weighted spawning, with a BOUNDED population. */
export const SPAWN = {
  /** Hard population cap = the fixed animal-pool size. Spawning never grows it. */
  maxAnimals: 12,
  /** Seconds between spawn attempts. */
  intervalSec: 2.5,
  /** Animals spawn on a ring around the player, in [min, max] world units —
   *  never on top of the player (min > the largest detectionRadius so a fresh
   *  spawn doesn't instantly flee), and within roughly a screen's reach. */
  spawnRadiusMin: 6,
  spawnRadiusMax: 14,
  /** Despawn an animal once it's farther than this from the player (off-screen
   *  cleanup that recycles its pool slot). */
  despawnRadius: 22,
} as const;

/** Roaming AI feel. */
export const ANIMAL = {
  /** Collision/visual half-extent used for biome containment, world units. */
  radius: 0.3,
  /** WANDER random-walk speed, world units/sec (a slow amble). */
  wanderSpeed: 1.2,
  /** How often WANDER picks a fresh heading, seconds. */
  wanderRetargetSec: 2.0,
  /** Hysteresis: once fleeing, keep fleeing until the player is detectionRadius +
   *  this buffer away — so an animal at the threshold doesn't flicker state. */
  fleeReleaseBuffer: 1.5,
} as const;

// ===========================================================================
// Stealth + detection (PR #6 — an ISOLABLE layer ON TOP of the #4 values)
// ===========================================================================

/**
 * Stealth tunes the species detectionRadius DOWN; it never edits the #4 base
 * values. The effective radius = baseDetectionRadius * stealthFactor, where
 * stealthFactor ∈ [0,1] and === 1 reproduces PR #4 behaviour exactly (the
 * load-bearing invariant). The factor is the product of the active multipliers
 * below (all < 1), clamped to [0,1].
 */
export const STEALTH = {
  /** Detection-radius multiplier while the player is inside a hiding spot. */
  coverFactor: 0.45,
  /** Detection-radius multiplier while the player is SNEAKING (moving slowly). */
  movementFactor: 0.6,
  /**
   * "Sneaking" is derived from the player's CURRENT speed (no separate movement
   * mode exists — see PR #6 recon): at/below this fraction of maxSpeed the player
   * counts as sneaking. Standing still or a light joystick deflection sneaks;
   * full-tilt movement does not.
   */
  sneakSpeedFrac: 0.45,
} as const;

/** Ecology-appropriate cover shape per biome — the renderer dispatches on this so
 *  cover looks like the place (no grass in a marsh). Stealth treats every kind the
 *  same (isInCover is geometry-only). */
export type CoverKind = 'grass' | 'ferns' | 'reeds' | 'rocks';

/** A hiding-spot (cover) prop — DATA. A player within `radius` of (x, y) is "in
 *  cover" (any kind). Same discipline as the species table. */
export interface HidingSpotDef {
  biome: BiomeId;
  x: number;
  y: number;
  radius: number;
  kind: CoverKind;
}

/** Hiding spots, per biome — a handful spread across each cell so stealth has
 *  somewhere to happen everywhere, in the biome's own cover: Meadow tall grass,
 *  Woodland bracken ferns, Wetland water's-edge reeds, Highlands boulders/scree.
 *  Comparable density + radii (1.8–2.4) so the cover stealth lever (×0.45) is
 *  equally viable in every biome. */
export const HIDING_SPOTS: readonly HidingSpotDef[] = [
  // Meadow — tall grass ([-20,20]²). Visual UNCHANGED; just tagged 'grass'.
  { biome: 'meadow', x: -8, y: -6, radius: 2.2, kind: 'grass' },
  { biome: 'meadow', x: 7, y: -10, radius: 2.0, kind: 'grass' },
  { biome: 'meadow', x: 10, y: 8, radius: 2.4, kind: 'grass' },
  { biome: 'meadow', x: -6, y: 11, radius: 2.0, kind: 'grass' },
  { biome: 'meadow', x: 1, y: 3, radius: 1.8, kind: 'grass' },
  // Woodland — bracken ferns (x∈[-20,20], y∈[20,60]); spread clear of the badger sett.
  { biome: 'woodland', x: -12, y: 28, radius: 2.2, kind: 'ferns' },
  { biome: 'woodland', x: 9, y: 34, radius: 2.0, kind: 'ferns' },
  { biome: 'woodland', x: 12, y: 50, radius: 2.4, kind: 'ferns' },
  { biome: 'woodland', x: -11, y: 55, radius: 2.0, kind: 'ferns' },
  { biome: 'woodland', x: 3, y: 44, radius: 1.8, kind: 'ferns' },
  // Wetland — water's-edge reeds (x∈[20,60], y∈[-20,20]).
  { biome: 'wetland', x: 28, y: -6, radius: 2.2, kind: 'reeds' },
  { biome: 'wetland', x: 48, y: 8, radius: 2.0, kind: 'reeds' },
  { biome: 'wetland', x: 52, y: -10, radius: 2.4, kind: 'reeds' },
  { biome: 'wetland', x: 34, y: 12, radius: 2.0, kind: 'reeds' },
  { biome: 'wetland', x: 44, y: -2, radius: 1.8, kind: 'reeds' },
  // Highlands — boulders / scree (x∈[20,60], y∈[20,60]).
  { biome: 'highlands', x: 30, y: 32, radius: 2.2, kind: 'rocks' },
  { biome: 'highlands', x: 50, y: 46, radius: 2.0, kind: 'rocks' },
  { biome: 'highlands', x: 52, y: 30, radius: 2.4, kind: 'rocks' },
  { biome: 'highlands', x: 34, y: 53, radius: 2.0, kind: 'rocks' },
  { biome: 'highlands', x: 42, y: 40, radius: 1.8, kind: 'rocks' },
];

/** Procedural tall-grass cluster look (render-only, zero assets). */
export const HIDING_RENDER = {
  /** Blades per cluster. */
  bladeCount: 10,
  /** Blade height + base radius, world units. */
  bladeHeight: 1.2,
  bladeRadius: 0.07,
  /** Fraction of the spot radius the blades fill. */
  spread: 0.82,
  /** Tall-grass green. */
  color: 0x4e7d3a,
} as const;

/** Woodland bracken — low arching fronds (shorter than grass, tilted outward so it
 *  reads as understory, not upright blades). Built like the grass cluster. */
export const FERN_RENDER = {
  frondCount: 9,
  frondHeight: 0.7,
  frondRadius: 0.05,
  spread: 0.85,
  /** Outward tilt (radians) so fronds arch low rather than stand up. */
  tiltRad: 0.55,
  color: 0x3e6b2f,
} as const;

/** Wetland reeds — tall, thin VERTICAL blades, a few topped with a brown cattail. */
export const REED_RENDER = {
  bladeCount: 9,
  bladeHeight: 1.6,
  bladeRadius: 0.045,
  spread: 0.78,
  color: 0x6b7d4a,
  /** A cattail head caps every Nth reed. */
  cattailEvery: 3,
  cattailHeight: 0.22,
  cattailRadius: 0.085,
  cattailColor: 0x6b4a2a,
} as const;

/** Highlands boulders / scree — a ground-hugging cluster of low grey rocks whose
 *  sizes vary deterministically with index (no RNG). */
export const ROCK_RENDER = {
  rockCount: 7,
  spread: 0.8,
  minSize: 0.22,
  maxSize: 0.52,
  /** Height-to-width ratio — rocks are squashed, not cubes. */
  heightRatio: 0.7,
  color: 0x8a8f97,
} as const;

/** A Field Supply post — a walk-in building (§12 1b-revise). One per biome; it only
 *  exists (renders + opens) once the biome is unlocked. Walking into `radius`
 *  (a proximity zone, NOT a wall — no collision) opens the Field Supply panel. */
export interface SupplyPostDef {
  biome: BiomeId;
  x: number;
  y: number;
  radius: number;
}

/** One post per biome, placed clear of spawn (0,0), cover, and the badger sett. */
export const SUPPLY_POSTS: readonly SupplyPostDef[] = [
  { biome: 'meadow', x: 14, y: -14, radius: 2.5 },
  { biome: 'woodland', x: 15, y: 25, radius: 2.5 },
  { biome: 'wetland', x: 55, y: -14, radius: 2.5 },
  { biome: 'highlands', x: 55, y: 55, radius: 2.5 },
];

/** Closing the Field Supply steps the player OUT the door (−y), this far PAST the
 *  zone edge — so they land clear of the zone (no reopen-trap by position) and not
 *  flush against the hut. (§12 1b interaction.) */
export const SUPPLY_EXIT_MARGIN = 0.8;

/** Procedural zero-asset hut: a square of timber walls with a doorway gap in the
 *  front, under a pyramid roof. Built once per unlocked biome in rebuildDynamic. */
export const SUPPLY_RENDER = {
  /** Footprint (square side) + wall height/thickness, world units. */
  size: 1.7,
  wallHeight: 1.1,
  wallThickness: 0.16,
  /** Doorway gap width in the front (-y facing) wall. */
  doorWidth: 0.7,
  /** Pyramid roof height above the walls + its overhang past the walls. */
  roofHeight: 0.7,
  /** Cone base-radius = size × this factor (≈ half-diagonal of the square). */
  roofRadiusFactor: 0.78,
  roofOverhang: 0.2,
  wallColor: 0x8a6b44,
  roofColor: 0x5a3d22,
} as const;

// ===========================================================================
// Tools
// ===========================================================================

/** Catch tools, in unlock order. NET is the tier-1 baseline. */
export type ToolId = 'net' | 'trap' | 'tranq';

export interface ToolDef {
  id: ToolId;
  displayName: string;
  /** Flat multiplier applied to the catch chance. */
  catchMultiplier: number;
  /** Whether the tool is available from the start. TRAP/TRANQ unlock with
   *  missions (PR #8); selectable in tests via the table regardless. */
  unlocked: boolean;
}

export const TOOL_ORDER: readonly ToolId[] = ['net', 'trap', 'tranq'];

export const TOOLS: Record<ToolId, ToolDef> = {
  net: { id: 'net', displayName: 'Net', catchMultiplier: 1.0, unlocked: true },
  trap: { id: 'trap', displayName: 'Trap', catchMultiplier: 1.4, unlocked: false },
  tranq: { id: 'tranq', displayName: 'Tranq', catchMultiplier: 1.9, unlocked: false },
};

/** The tool the player starts with. */
export const STARTER_TOOL: ToolId = 'net';

// ===========================================================================
// Bait
// ===========================================================================

/** Bait deltas — the diet-learning lure. Correct bait (matches a species' diet)
 *  calms it toward the catch ceiling AND lures it to APPROACH; wrong bait does
 *  nothing. Bait is a consumable with an in-memory count. */
export const BAIT_ORDER: readonly BaitId[] = ['seeds', 'greens', 'insects'];

/** The procedural diet-icon glyph a bait chip draws (CSS shapes, zero assets). */
export type BaitIconKind = 'seeds' | 'leaf' | 'insect';

/** Tray DISPLAY metadata per bait — a short label + which procedural icon to
 *  draw. Diet legibility (§5): the icon teaches "what this bait IS". */
export const BAIT_DISPLAY: Record<BaitId, { label: string; icon: BaitIconKind }> = {
  seeds: { label: 'Seeds', icon: 'seeds' },
  greens: { label: 'Greens', icon: 'leaf' },
  insects: { label: 'Insects', icon: 'insect' },
};

export const BAIT = {
  /** Starting count per bait type (in-memory; no persistence until PR #7). */
  startingCount: 5,
  /** Calm multiplier when the CORRECT bait is active on the target (toward the
   *  ~4x ceiling the design calls for). Wrong/none = 1.0 (no effect). */
  correctCalm: 3.5,
  /** Seconds a deployed bait stays active. */
  activeWindowSec: 6,
  /** Matching-diet animals within this radius of the bait APPROACH it (instead
   *  of fleeing), world units. */
  lureRadius: 8,
  /** Approach speed while lured, world units/sec. */
  approachSpeed: 2.0,
  /** Bait is a CONSUMED, SCARCE resource (§12): 1 is spent on every deploy, and the
   *  ONLY source is the Field Supply shop — catching no longer refills it. It can
   *  run out; easy animals stay catchable bait-less (the anti-lockout valve). */
  maxCount: 9,
  /** Seconds the on-screen bait notice ("Out of …" / "Wrong bait") lingers. */
  noticeSec: 1.4,
} as const;

// ===========================================================================
// Catch
// ===========================================================================

/** The catch system — the core verb. Multi-shake resolution computed as DATA;
 *  the renderer plays it back, so feel is driven by the math, never faked. */
export const CATCH = {
  /** Max distance from an animal to attempt a catch, world units. PR #5.1 feel:
   *  eased 2.2 -> 2.6 so getting "in range" is comfortable (the proximity
   *  penalty at the new edge still rewards closing the distance). */
  attemptRadius: 2.6,
  /** Proximity multiplier: point-blank (dist 0) -> proximityMax; at attemptRadius
   *  -> proximityMin. Closer = better odds. Linear between. */
  proximityMax: 1.3,
  proximityMin: 0.7,
  /** Penalty applied to a FLEEING (spooked) animal — harder to catch. */
  fleePenalty: 0.5,
  /** Biome match: full odds in the species' home biome, a penalty out of it.
   *  (Animals only roam their home biome today, but the factor is in place for
   *  when they don't.) */
  biomeMatchBonus: 1.0,
  biomeMismatchPenalty: 0.6,
  /** Number of shakes by tier (index = tier - 1). Rarer = more shakes = more
   *  tension. The per-shake check is chance^(1/shakes), so the overall odds
   *  equal the computed chance regardless of shake count. */
  shakesByTier: [3, 3, 4, 4, 5],
  /** Seconds each shake beat plays (the hit-stop window where feedback lands). */
  shakeBeatSec: 0.45,
  /** Settle (caught) / break-out (escape) beat after the last shake, seconds. */
  resolveBeatSec: 0.6,
  /** RARE critical catch: a small chance to collapse the whole attempt to a
   *  SINGLE check at the much better chance^(1/critRoot) odds — an instant,
   *  satisfying catch. */
  critChance: 0.05,
  /** Root used for the critical single check (4 = fourth-root odds). */
  critRoot: 4,
  /** Per-shake squash intensity for the render playback (0..1). PR #5.1: 0.4 ->
   *  0.55 so each shake reads clearly at arm's length on a phone. */
  squashIntensity: 0.55,
  /** Width expansion ratio relative to the height squash (volume-preserving feel). */
  squashWidthRatio: 0.5,
} as const;

/**
 * Catch FEEDBACK rendering (PR #5.1 — discoverability + legibility). These are
 * render-only; they NEVER touch the resolved odds. The animation still reads the
 * ShakeOutcome[] data — these just make it visible.
 */
export const CATCH_FX = {
  /** Target ring under the catchable animal — inner/outer radius (world units)
   *  and a small +y lift so it sits on the ground without z-fighting. */
  ringInner: 0.5,
  ringOuter: 0.72,
  ringY: 0.03,
  /** Gentle ring pulse so "this is your target" reads as alive. */
  ringPulseAmp: 0.12,
  ringPulseHz: 2.5,
  /** ESCAPE break-out: the target pops to this scale on the resolve beat so a
   *  failed catch reads as "it lunged free", not "nothing happened". */
  escapePop: 1.45,
  /** On-screen result flash ("Got it!" / "It got away!") duration, seconds. */
  resultFlashSec: 1.2,
  /** Active-bait ground marker — radius (world units) + a small +y lift. */
  baitMarkerRadius: 0.55,
  baitMarkerY: 0.04,
} as const;

/** Synth voice frequencies/feel for the catch beats (Web Audio, no files). */
export const AUDIO = {
  /** Base pitch of a shake blip, Hz; each shake index steps it up by stepHz. */
  shakeBaseHz: 440,
  shakeStepHz: 70,
  /** Pitch ratio applied to a FAILED shake blip (duller than a pass). */
  shakeFailPitchRatio: 0.8,
  /** Shake blip duration, seconds. */
  blipDuration: 0.09,
  /** Shake blip gain (volume). */
  blipGain: 0.12,
  /** Catch flourish root pitch, Hz. */
  catchHz: 660,
  /** Catch flourish first-note duration, seconds. */
  catchDuration: 0.12,
  /** Catch flourish first-note gain. */
  catchGain: 0.16,
  /** Second note harmonic ratio (relative to catchHz). */
  catchHarmonicRatio: 1.5,
  /** Second note duration, seconds. */
  catchHarmonicDuration: 0.18,
  /** Second note gain. */
  catchHarmonicGain: 0.14,
  /** Second note delay after the first, seconds. */
  catchHarmonicDelay: 0.1,
  /** Escape tone start pitch, Hz (it glides down from here). */
  escapeHz: 300,
  /** Escape glide end pitch ratio (relative to escapeHz). */
  escapeGlideRatio: 0.6,
  /** Escape glide duration, seconds. */
  escapeDuration: 0.22,
  /** Escape glide gain. */
  escapeGain: 0.14,
  /** Bait-deploy confirmation blip — a soft mid tone. */
  baitHz: 520,
  baitDuration: 0.1,
  baitGain: 0.1,
  /** "Denied" blip — a low buzz when a deploy fails (out of bait). */
  denyHz: 150,
  denyDuration: 0.14,
  denyGain: 0.1,
  /** Mission-complete chime (two rising notes). */
  missionHz: 587,
  missionDuration: 0.13,
  missionGain: 0.13,
  /** Second note pitch ratio — a perfect fifth above missionHz. */
  missionHarmonicRatio: 1.5,
  /** Biome-unlock fanfare (three rising notes — the spine's payoff). */
  unlockHz: 523,
  unlockGain: 0.16,
  /** Second note pitch ratio (major third above unlockHz). */
  unlockNote2Ratio: 1.25,
  /** Third note pitch ratio (perfect fifth above unlockHz). */
  unlockNote3Ratio: 1.5,
  /** Third note sustains longer by this factor (the payoff lingers). */
  unlockNote3DurScale: 1.6,
} as const;

/** On-screen banner timing for boundary events (mission complete / biome unlock).
 *  Reuses the existing fade-notice pattern (cf. BAIT.noticeSec, CATCH_FX
 *  resultFlashSec); the banner is main-owned (these are boundary events). */
export const BANNER = {
  /** A routine "Mission complete" toast stays up this long, seconds. */
  missionSec: 2.6,
  /** The biome-unlock banner lingers longer — it MUST be felt. */
  unlockSec: 3.8,
  /** Tail fade-out window at the end of a banner, seconds. */
  fadeSec: 0.45,
} as const;

/** Player movement feel — a snappy velocity ramp (no instant snap, no float). */
export const TUNING = {
  /** Top movement speed, world units per second. */
  maxSpeed: 6,
  /** Acceleration toward target velocity, world units/sec^2. */
  accel: 120,
  /** Deceleration toward rest when input releases, world units/sec^2. Slightly
   *  below accel for a stop that feels solid, not jittery. */
  friction: 110,
  /** Camera follow rate, per second (exponential smoothing). Higher = tighter
   *  to the player; lower = floatier. */
  camLerp: 10,
  /** Camera dead-zone radius, world units. The player can drift this far from
   *  screen centre before the camera starts following — so the marker has its
   *  own on-screen motion ("I'm moving") instead of being pinned dead-centre
   *  with the world sliding under it. 0 = classic locked-centre follow. */
  deadZone: 2,
} as const;

/**
 * The ISOMETRIC camera. Ported from the rogue-descent setup (do not reinvent):
 * the camera views its focus from an offset with EQUAL horizontal components
 * (offsetX = offsetZ) plus a height component, so it looks down the body
 * diagonal — the floor renders as a 45° DIAMOND and boxes show three faces (top
 * + two sides). Pitch = atan2(offsetY, √(offsetX²+offsetZ²)) = atan2(20, 20√2)
 * ≈ 35.26° (classic iso). NEVER zero offsetX/offsetZ — that collapses the yaw to
 * a flat top-down view and loses the 3D height read.
 */
export const CAMERA = {
  /** Half-height of the orthographic frustum, world units. Smaller than the
   *  world so the follow actually scrolls — the world edges move past the player. */
  viewSize: 8,
  /** Horizontal offset along world x. Equal to offsetZ => 45° camera yaw. */
  offsetX: 20,
  /** Height above the ground plane (sets the pitch together with offsetX/offsetZ). */
  offsetY: 20,
  /** Horizontal offset along world z. Equal to offsetX => 45° camera yaw. */
  offsetZ: 20,
  near: 0.1,
  far: 200,
  /**
   * Vertical FRAMING bias, as a fraction of viewSize. Shifts the orthographic
   * frustum window up so the focus (player) sits below screen centre — leaving
   * headroom above and pushing the empty foreground ground down behind the
   * bottom touch controls. A pure 2D pan of the image: it does NOT change the
   * camera's view direction or the iso ANGLE. Tune by eye on a portrait phone.
   */
  frameBiasY: 0.18,
} as const;

/**
 * The camera YAW about the world-up axis, radians — atan2(offsetX, offsetZ).
 * With the iso camera (offsetX = offsetZ) this is exactly 45°. The PURE game
 * layer rotates raw screen input by -ISO_YAW so that pressing "up" moves the
 * player straight up the screen even though that is a world diagonal — keeping
 * keyboard and touch in lockstep (both feed the same intent through the same
 * rotation).
 */
export const ISO_YAW = Math.atan2(CAMERA.offsetX, CAMERA.offsetZ);

/** On-screen touch joystick. */
export const TOUCH = {
  /** Drag distance (px) for full stick deflection (= max move axis). */
  stickRange: 60,
} as const;

/** Key (directional) light position, derived from the camera offset so the
 *  marker's top/sides read against the ground. */
export const KEY_LIGHT_POS = {
  x: CAMERA.offsetZ * 0.4,
  y: CAMERA.offsetY * 1.5,
  z: CAMERA.offsetZ * 0.6,
} as const;

/**
 * Lighting for the low-poly look. A flat-shaded model needs a clear KEY light to
 * show its facets and a HEMISPHERE light (sky over ground) for soft fill — so a
 * fox reads as faceted 3D, not a flat blob. Ambient is kept modest (a high
 * ambient washes facets out).
 */
export const LIGHTING = {
  /** Flat base fill so shadowed sides aren't pure black. */
  ambient: 0.45,
  /** Directional key light intensity (position = KEY_LIGHT_POS). */
  keyIntensity: 0.9,
  /** Hemisphere fill — warm sky over the meadow-green ground. */
  hemiSky: 0xcfe4ff,
  hemiGround: 0x35502f,
  hemiIntensity: 0.5,
} as const;

// ===========================================================================
// Procedural models (render-only — primitives, zero assets)
// ===========================================================================

/** Which procedural shape a species is built from. */
export type ModelKind = 'mouse' | 'rabbit' | 'bird' | 'hedgehog' | 'squirrel' | 'frog';

/** Low-poly segment count for spheres/cones/cylinders (kept low for facets). */
export const MODEL_SEGMENTS = 8;

/**
 * The PLAYER figure — an upright human-ish silhouette (legs + torso + head +
 * arms), built foot-origin (lowest point at y = 0) and facing +z. Dimensions in
 * world units; clearly taller + bipedal so it never reads as an animal.
 */
export const PLAYER_MODEL = {
  color: PALETTE.player,
  /** Boots / pack accent. */
  accent: 0x6b4a24,
  legHeight: 0.34,
  legRadius: 0.075,
  legSpread: 0.12,
  bodyHeight: 0.46,
  bodyRadiusTop: 0.12,
  bodyRadiusBottom: 0.17,
  headRadius: 0.17,
  armLength: 0.4,
  armRadius: 0.05,
} as const;

/**
 * Shared quadruped proportions, as RATIOS of a species' `size`, so every animal
 * scales from one base and only its distinguishing features differ. The body is
 * a capsule lying along z (head at +z front, tail at -z back).
 */
export const ANIMAL_MODEL_BASE = {
  bodyLengthR: 1.6,
  bodyRadiusR: 0.55,
  legHeightR: 0.42,
  legRadiusR: 0.13,
  legInsetR: 0.45,
  headRadiusR: 0.5,
  headForwardR: 0.85,
  snoutLengthR: 0.5,
  snoutRadiusR: 0.22,
} as const;

/** Per-species model config: the shape KIND plus its distinguishing feature
 *  dimensions (ratios of `size`) and accent colours. The body colour is the
 *  species' own `color` from the SPECIES table. */
export const SPECIES_MODEL: Record<
  SpeciesId,
  {
    kind: ModelKind;
    accent: number;
    earHeightR?: number;
    earRadiusR?: number;
    tailLengthR?: number;
    tailRadiusR?: number;
    beakLengthR?: number;
    crestHeightR?: number;
    spikeCount?: number;
    spikeLengthR?: number;
    /** Frog: eye-bump radius as a fraction of body size. */
    eyeRadiusR?: number;
  }
> = {
  // Tiny, round, small ears, long thin tail, pointed snout.
  fieldmouse: {
    kind: 'mouse',
    accent: 0xf2c6b6,
    earHeightR: 0.3,
    earRadiusR: 0.26,
    tailLengthR: 1.8,
    tailRadiusR: 0.05,
  },
  // Round body, tall upright ears, little round tail.
  rabbit: {
    kind: 'rabbit',
    accent: 0xfff2e6,
    earHeightR: 1.5,
    earRadiusR: 0.14,
    tailRadiusR: 0.24,
  },
  // Plump little BIRD: round body, two stub legs, beak + head crest.
  quail: {
    kind: 'bird',
    accent: 0x53381f,
    beakLengthR: 0.5,
    crestHeightR: 0.7,
  },
  // Low round body bristling with spikes, small snout.
  hedgehog: {
    kind: 'hedgehog',
    accent: 0xd9c2a3,
    spikeCount: 16,
    spikeLengthR: 0.85,
  },
  // Quadruped with a big upright bushy tail + tufted ears (the squirrel read).
  redsquirrel: {
    kind: 'squirrel',
    accent: 0xe0d2b8,
    earHeightR: 0.45,
    earRadiusR: 0.18,
    tailLengthR: 1.5,
    tailRadiusR: 0.42,
  },
  // A small songbird — reuses the BIRD build (round body + beak + crest).
  robin: {
    kind: 'bird',
    accent: 0xd98b4a,
    beakLengthR: 0.45,
    crestHeightR: 0.4,
  },
  // Low broad quadruped, dark with a pale snout + small ears + a short tail.
  badger: {
    kind: 'mouse',
    accent: 0xe8e8ec,
    earHeightR: 0.22,
    earRadiusR: 0.16,
    tailLengthR: 0.5,
    tailRadiusR: 0.08,
  },
  // Tall slender quadruped with upright ears + a tiny rump tail (the deer read).
  roedeer: {
    kind: 'rabbit',
    accent: 0xf0e6d2,
    earHeightR: 0.65,
    earRadiusR: 0.16,
    tailRadiusR: 0.16,
  },
  // A duck — reuses the BIRD build; long bill, no crest.
  mallard: {
    kind: 'bird',
    accent: 0xd9a441,
    beakLengthR: 0.7,
    crestHeightR: 0.15,
  },
  // Squat amphibian with two big eye-bumps (its own minimal build).
  frog: {
    kind: 'frog',
    accent: 0xcfe8a8,
    eyeRadiusR: 0.28,
  },
  // A plump alpine grouse — reuses the BIRD build (round body + beak + low crest).
  ptarmigan: {
    kind: 'bird',
    accent: 0xf0f0ec, // white winter belly
    beakLengthR: 0.4,
    crestHeightR: 0.25,
  },
  // A big hare — the RABBIT build with longer ears + a pale winter coat accent.
  mountainhare: {
    kind: 'rabbit',
    accent: 0xeef0f2,
    earHeightR: 1.3,
    earRadiusR: 0.13,
    tailRadiusR: 0.2,
  },
  // A small highland wader — the BIRD build, slim beak + a pale eyestripe accent.
  dotterel: {
    kind: 'bird',
    accent: 0xf2e4c4,
    beakLengthR: 0.35,
    crestHeightR: 0.15,
  },
} as const;

// ===========================================================================
// Missions + rank + biome unlock (Plan #8 — the progression spine)
// ===========================================================================

/** A mission requirement. The two KINDS differ ONLY in which catch-context field
 *  they read — the engine has ONE code path over these (no per-type branch). */
export type MissionRequirement =
  | { kind: 'catch-in-timephase'; phase: DayPhase; count: number }
  | { kind: 'catch-in-biome'; biome: BiomeId; count: number }
  // Catch a specific species — no tracking implied. Because a species is locked to
  // its biome + activity window, "catch the dawn robin" IS "play the woodland at
  // dawn" (the knowledge applied), without overloading track-and-catch's tracking
  // connotation onto un-tracked species (Woodland gate tune).
  | { kind: 'catch-species'; species: SpeciesId; count: number }
  // Plan #8b — TRACKING: catch a specific target species. The target only appears
  // via the tracking flow (signs + a seeded sett spawn), so catching it IS the
  // proof you tracked it. Gates on applied journal knowledge, not recall (§5.5).
  | { kind: 'track-and-catch'; species: SpeciesId; count: number };

export interface MissionDef {
  id: string;
  /** Which biome's mission SET this belongs to (completing the set unlocks the
   *  mapped biome — see BIOME_SET_UNLOCK). */
  biome: BiomeId;
  /** Applied-behavior framing — gates on knowledge the player USES, never grind
   *  or recall trivia (§6.5). */
  title: string;
  description: string;
  requirement: MissionRequirement;
  /** Field-Researcher rank points awarded on completion. */
  rewardPoints: number;
  /** STANDALONE missions (Plan #8b tracking) are optional side-quests — they do
   *  NOT count toward their biome's set-completion (so they don't gate an unlock).
   *  Omitted/false = a normal set mission. */
  standalone?: boolean;
}

/** Deterministic mission order (offer + display). */
export const MISSION_ORDER: readonly string[] = [
  'meadow-survey',
  'meadow-dawn',
  'meadow-dusk',
  'woodland-survey',
  'woodland-dawn',
  'woodland-dusk',
  'track-badger',
  'wetland-survey',
  'wetland-dawn',
  'wetland-day',
];

/**
 * The mission table — DATA. The Meadow set teaches by APPLICATION: roam + catch
 * (survey), then use time-of-day knowledge (be out at dawn / at dusk). New
 * missions are data edits. Tracking-puzzle missions (type 2) land in Plan #8b.
 */
export const MISSIONS: Record<string, MissionDef> = {
  'meadow-survey': {
    id: 'meadow-survey',
    biome: 'meadow',
    title: 'Meadow Survey',
    description: 'Get to know the meadow — catch 5 animals here.',
    requirement: { kind: 'catch-in-biome', biome: 'meadow', count: 5 },
    rewardPoints: 20,
  },
  'meadow-dawn': {
    id: 'meadow-dawn',
    biome: 'meadow',
    title: 'Dawn Patrol',
    description: 'Some animals only forage at first light. Catch 2 at dawn.',
    requirement: { kind: 'catch-in-timephase', phase: 'dawn', count: 2 },
    rewardPoints: 15,
  },
  'meadow-dusk': {
    id: 'meadow-dusk',
    biome: 'meadow',
    title: 'Dusk Watch',
    description: 'The crepuscular crowd comes out at dusk. Catch 2 at dusk.',
    requirement: { kind: 'catch-in-timephase', phase: 'dusk', count: 2 },
    rewardPoints: 15,
  },
  // Woodland set (Plan #9, gate tune) — a FOUR-WINDOW gate: the unlock now means
  // "you learned to hunt the woodland at every time of day," not "catch 4 squirrels."
  // Each window-locked species forces its window — explore (survey/day), the dawn
  // robin, the dusk roe deer, and the nocturnal badger via the tracking hunt. All
  // count-1 of a window-locked species (knowledge, not grind). track-badger now
  // GATES (no longer a standalone side-quest) — the signature lesson is required.
  'woodland-survey': {
    id: 'woodland-survey',
    biome: 'woodland',
    title: 'Into the Trees',
    description: 'Get to know the woodland — catch 4 animals among the trees.',
    requirement: { kind: 'catch-in-biome', biome: 'woodland', count: 4 },
    rewardPoints: 25,
  },
  'woodland-dawn': {
    id: 'woodland-dawn',
    biome: 'woodland',
    title: 'First Light',
    description: 'Robins sing the woodland awake. Catch the robin at dawn.',
    requirement: { kind: 'catch-species', species: 'robin', count: 1 },
    rewardPoints: 20,
  },
  'woodland-dusk': {
    id: 'woodland-dusk',
    biome: 'woodland',
    title: 'The Evening Browse',
    description: 'Roe deer step out to browse as the light fades. Catch the roe deer at dusk.',
    requirement: { kind: 'catch-species', species: 'roedeer', count: 1 },
    rewardPoints: 20,
  },
  // Plan #8b — the first TRACKING puzzle. Now a GATING mission (the woodland's
  // signature lesson is required, not optional): the journal told you the badger is
  // a nocturnal woodland digger — use that, follow the diggings to the sett at night.
  'track-badger': {
    id: 'track-badger',
    biome: 'woodland',
    title: 'On the Trail',
    description: 'Fresh diggings in the woodland. Read the signs, find the sett, and catch the badger.',
    requirement: { kind: 'track-and-catch', species: 'badger', count: 1 },
    rewardPoints: 15,
  },
  // Wetland set (Highlands content) — the FIRST Wetland gate (Wetland was terminal).
  // Teaches both wetland windows + an explore baseline (the #33 "don't ask too
  // little" shape); completing it unlocks the Highlands (the final diagonal cell).
  'wetland-survey': {
    id: 'wetland-survey',
    biome: 'wetland',
    title: 'Into the Marsh',
    description: 'Get to know the wetland — catch 3 animals among the reeds.',
    requirement: { kind: 'catch-in-biome', biome: 'wetland', count: 3 },
    rewardPoints: 25,
  },
  'wetland-dawn': {
    id: 'wetland-dawn',
    biome: 'wetland',
    title: 'Dawn Chorus',
    description: 'Frogs call from the water at first light. Catch the frog at dawn.',
    requirement: { kind: 'catch-species', species: 'frog', count: 1 },
    rewardPoints: 20,
  },
  'wetland-day': {
    id: 'wetland-day',
    biome: 'wetland',
    title: 'On the Water',
    description: 'Mallards dabble on the open water by day. Catch the mallard.',
    requirement: { kind: 'catch-species', species: 'mallard', count: 1 },
    rewardPoints: 20,
  },
};

/** Completing ALL of a biome's missions unlocks the mapped biome (lateral reward
 *  — a new region + its species, not flat power, §5.5). */
export const BIOME_SET_UNLOCK: Partial<Record<BiomeId, BiomeId>> = {
  meadow: 'woodland',
  woodland: 'wetland',
  wetland: 'highlands',
};

// ===========================================================================
// Tracking puzzle (Plan #8b)
// ===========================================================================

/** A procedural ground sign (paw-prints / dug earth) marking a tracking region.
 *  Static DATA, placed like HIDING_SPOTS; signs MARK a region, not a step trail. */
export interface TrackSignDef {
  biome: BiomeId;
  x: number;
  y: number;
  /** Investigate radius — the player within this distance reads the sign. */
  radius: number;
}

/**
 * The badger tracking puzzle. The SETT is the region the target dens in (and where
 * its hidden spawn is biased to, at night); the SIGNS cluster around it so a player
 * who knows "badger = nocturnal woodland digger" can reason toward it. All in the
 * woodland; the journal facts (night + woodland) are the real clue.
 */
export const TRACKING = {
  /** Which species this first tracking puzzle targets. */
  target: 'badger' as SpeciesId,
  /** The sett region — a point + radius in the woodland (biology-consistent: deep
   *  in the trees, away from the meadow edge). The hidden spawn lands here. */
  sett: { biome: 'woodland' as BiomeId, x: -8, y: 46, radius: 4.0 },
  /** The target's hidden spawn reveals when the player is within this distance of
   *  the sett (at night) — it appears as you reach the signed region, not the
   *  moment you enter the woodland. */
  revealRadius: 12,
  /** Teaching hints (the wrong-guess-TEACHES rule, §6.5) — they use the species'
   *  real facts; they NEVER reset progress. */
  freshHint: 'Fresh diggings — a badger passed here recently.',
  coldHint: 'These tracks are cold — badgers only forage at night.',
} as const;

/** Procedural signs around the sett — they mark the region (a loose cluster
 *  pointing inward), NOT a node-to-node breadcrumb trail. */
export const TRACK_SIGNS: readonly TrackSignDef[] = [
  { biome: 'woodland', x: 2, y: 30, radius: 2.4 },
  { biome: 'woodland', x: -3, y: 37, radius: 2.4 },
  { biome: 'woodland', x: -6, y: 42, radius: 2.4 },
];

/** How a track sign renders — a little cluster of flat dark dug-earth marks on
 *  the ground (zero-asset). Built once, deterministic (golden-angle spread). */
export const SIGN_RENDER = {
  color: 0x3a2a1c,
  markCount: 5,
  markRadius: 0.22,
  markHeight: 0.04,
  spread: 0.7,
} as const;

/** Generic transient HUD notice timing (Plan #8b generalised the bait notice into
 *  a shared channel). Each notice carries its own ttl so the fade is correct for
 *  any source. */
export const NOTICE = {
  /** How long a tracking teaching-hint lingers, seconds (a touch longer than a
   *  bait blip — it's a sentence to read). */
  trackSec: 2.4,
} as const;

/** Field Researcher rank — a SOFT gate (missions are the hard gate, §5.5).
 *  Total rank points = mission rewards + a bonus per species found. */
export const RANK = {
  /** Rank points granted per species found (journal completion feeds rank). */
  perSpeciesFound: 8,
} as const;

/**
 * Economy currency (§12 slice 1a) — credits earned from skill + knowledge, SEPARATE
 * from rank. Knowledge/research milestones deliberately out-earn repeat catches (the
 * §14.3 anti-grind ratio): a discovery is worth more than re-catching what you know.
 * Starting values — real tuning lands in 1b against shop prices. NOT spendable on
 * anything until the shop (1b); credits buy lateral enrichment, never catch power.
 */
export const CREDITS = {
  /** Per catch — skill reward; modest so repeat-catching isn't a farm. */
  perCatch: 3,
  /** Per NEW species (first catch / first dex entry) — the discovery bonus. */
  perNewSpecies: 10,
  /** Per biome whose journal is COMPLETED by the catch — a research milestone. */
  perBiomeComplete: 25,
  /** HUD readout glyph (zero-asset). */
  glyph: '✦',
} as const;

/**
 * The Field Supply (§12 slice 1b) — spend credits on EXTRA baseline-bait quantity.
 * Pure top-up: buying routes through addBait (caps at BAIT.maxCount) — never a
 * catch-rate or lure-param change (that's 1c). Free baseline (the catch-replenish
 * loop) is untouched; the shop is enrichment. Price + the 1a earn-rates are the
 * lever pair tuned by feel. One flat price for every bait type (none is "premium").
 */
export const SHOP = {
  /** Credits per purchase. */
  baitPrice: 2,
  /** Bait added per purchase (capped at BAIT.maxCount by addBait). */
  buyQuantity: 1,
  title: 'Field Supply',
  /** Naturalist framing line. */
  blurb: 'Top up your bait between catches — stock the pack for the trail ahead.',
  glyph: '🎒',
  /** Button-state copy when a bait type is already at the cap. */
  fullLabel: 'Full',
} as const;

export interface RankDef {
  name: string;
  /** Minimum total rank points to hold this rank. */
  minPoints: number;
}

/** Rank ladder, ascending. The current rank is the highest whose minPoints the
 *  player's total meets. */
export const RANKS: readonly RankDef[] = [
  { name: 'Novice', minPoints: 0 },
  { name: 'Field Hand', minPoints: 30 },
  { name: 'Naturalist', minPoints: 70 },
  { name: 'Field Researcher', minPoints: 120 },
];

/** The "Field Guide Complete" win screen copy (Plan #10). The tone is a naturalist
 *  finishing their guide — warm, calm, no high-score energy (§14.2). */
export const WIN = {
  title: '🌿 Field Guide Complete',
  /** Warm summary line. */
  blurb: 'Every creature catalogued, every region explored, every study finished — your field guide is full.',
  /** The free-roam invitation: an OPTION, never a pressure; progress never resets. */
  freeRoam: 'The wild keeps turning. Roam on whenever you like — nothing here ever resets.',
} as const;

// ===========================================================================
// Onboarding + start screen (Plan #11)
// ===========================================================================

/** The warm title / start splash. Zero-asset, NOT a lore wall. */
export const START_SCREEN = {
  title: 'Wild Trails',
  tagline: 'Wander the wild, track its creatures, and fill your field guide.',
  start: 'Start',
  continue: 'Continue',
  skip: 'Skip tutorial',
} as const;

/**
 * First-session contextual onboarding (Plan #11). ONE mechanic at a time, each
 * prompt triggered by the player's situation, taught by DOING in the Meadow — the
 * prompts GUIDE, they never gate play. Prompt text names both the touch + keyboard
 * control so it reads on either. Bait is handled by the existing demand-driven
 * baitHint (not duplicated here). Reward (journal) fires before direction (missions).
 */
export const ONBOARDING = {
  /** Intent-magnitude threshold for "the player has moved" (dead-zone filter). */
  moveThreshold: 0.01,
  /** How long each prompt shows, seconds (a touch longer than a bait blip — it's
   *  teaching). Also the linger before the journal -> missions beat advances. */
  beatSec: 4,
  prompts: {
    move: 'Drag to roam — or use WASD / arrow keys.',
    approach: 'An animal is about! Move closer to it.',
    catch: 'In range — press CATCH (or Space) to try a catch.',
    journal: 'Caught one! Open your Field Journal (J / 📓) to see your find.',
    missions: 'Missions show you what to do next (M / 🎯).',
  },
} as const;
