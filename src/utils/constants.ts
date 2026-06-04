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
} as const;

/** Same palette as CSS hex strings for the HTML HUD overlay. */
export const CSS_PALETTE = {
  background: '#0d1f12',
  ground: '#1d3b24',
  player: '#ffb347',
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
export type SpeciesId = 'fieldmouse' | 'rabbit' | 'quail' | 'hedgehog';

/** Rarity/difficulty tier: 1 = common, slow, forgiving … higher = rarer,
 *  faster, warier. The Meadow is all tier 1. */
export type Tier = 1 | 2 | 3 | 4 | 5;

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
  /** CATCH DIFFICULTY (reserved for PR #5; unused this PR). */
  baseCatchRate: number;
  /** Render tint, 0xRRGGBB. */
  color: number;
  /** Visual size (cube side), world units — smaller animals read as smaller. */
  size: number;
}

/** Deterministic iteration order over the species table. */
export const SPECIES_ORDER: readonly SpeciesId[] = ['fieldmouse', 'rabbit', 'quail', 'hedgehog'];

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
    baseCatchRate: 0.72,
    color: 0x8a7b6b,
    size: 0.45,
  },
  rabbit: {
    id: 'rabbit',
    displayName: 'Rabbit',
    biome: 'meadow',
    spawnWeight: 3,
    baseFleeSpeed: 4.2,
    detectionRadius: 3.5,
    activityWindow: 'any',
    tier: 1,
    baseCatchRate: 0.6,
    color: 0xb8a584,
    size: 0.55,
  },
  quail: {
    id: 'quail',
    displayName: 'Quail',
    biome: 'meadow',
    spawnWeight: 2,
    baseFleeSpeed: 4.6,
    detectionRadius: 4.0,
    activityWindow: 'dawn',
    tier: 1,
    baseCatchRate: 0.55,
    color: 0x9c7b4a,
    size: 0.5,
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
    baseCatchRate: 0.68,
    color: 0x5c4a3a,
    size: 0.5,
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
