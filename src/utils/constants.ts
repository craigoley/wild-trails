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
  /** Deployed hide footprint (muted khaki-green — blends with cover, reads as gear). */
  hideMarker: 0x8a9a5b,
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
export type BiomeId = 'meadow' | 'woodland' | 'wetland' | 'highlands' | 'riverbank' | 'coast';

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
  /** Adjacent biome ids (graph edges). RENDER-ONLY (the locked-but-visible dim/fog/
   *  wall) — NOT the unlock logic (that's the tier/prereq chain below). */
  adjacent: BiomeId[];
  /** World Expansion (§4.2) — the difficulty / unlock-RING order: 0 = the starting hub
   *  (Meadow), rising outward as biomes unlock. Distinct from a species' catch-`tier`
   *  (this is the biome's place in the access ladder); the roster's difficulty climbs with
   *  it. */
  tier: number;
  /** World Expansion (§4.2) — the access GATE: the biome whose mission-SET must complete to
   *  unlock this one (the linear chain, made explicit metadata) — `undefined` for the hub.
   *  RE-EXPRESSES `BIOME_SET_UNLOCK`'s inverse (BIOME_SET_UNLOCK[prereq] === this id); an
   *  escalated gate (the Highlands) additionally carries its research-wrap via
   *  `BIOME_GATE_CHALLENGES` + the R2 project — UNCHANGED. WE0 adds this as DESCRIPTIVE
   *  metadata; the existing unlock logic still runs off BIOME_SET_UNLOCK (behavior-neutral).
   *  WE-each reads it when adding biomes. */
  prereq?: BiomeId;
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
export const BIOME_ORDER: readonly BiomeId[] = ['meadow', 'woodland', 'wetland', 'highlands', 'riverbank', 'coast'];

/**
 * The THROUGH-LINE (§4.3 TL1) — the soul layer's first slice. A biome's "thriving" derives from
 * how thoroughly you've STUDIED it (species catalogued + a GUARDED research bonus). It is purely
 * COSMETIC: a warmth GRADE on the biome ground + a soft qualitative WORD in the journal. Nothing
 * gameplay reads it. Activity-paced (rises by PLAY — catching/studying — never wall-clock).
 */
export const THRIVING = {
  /** Blend weights when a biome HAS research projects; with none, species-catalogued is used
   *  ALONE (guarded — no division by zero). Species-catalogued is the universal primary signal. */
  speciesWeight: 0.85,
  researchWeight: 0.15,
  /** The warmth GRADE (render): the unlocked-biome ground colour lerps from a SUBTLE muted
   *  baseline (thriving 0) to full/rich (thriving 1). ⚠️ NOT the locked-dim (0.45, for LOCKED
   *  biomes) — calm and quiet, never drab; the world looks GOOD at zero thriving, just stiller. */
  grade: {
    minSaturation: 0.82, // thriving 0 -> 82% of the biome's saturation (subtly muted)
    minLightness: 0.95, // thriving 0 -> 95% lightness (a gentle calm; err toward SUBTLE, not drab)
  },
  /** The qualitative journal WORD bands (ascending `min`) — no number, no meter. */
  bands: [
    { min: 0, word: 'quiet' },
    { min: 0.25, word: 'waking' },
    { min: 0.6, word: 'alive' },
    { min: 0.9, word: 'flourishing' },
  ],
} as const;

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
    tier: 0, // the starting hub
    color: 0x2f6b3a,
  },
  woodland: {
    id: 'woodland',
    displayName: 'Woodland',
    bounds: cell(0, PITCH),
    unlocked: false,
    adjacent: ['meadow', 'highlands'],
    tier: 1,
    prereq: 'meadow', // the Meadow set unlocks the Woodland (gentle gate)
    color: 0x244f2c,
  },
  wetland: {
    id: 'wetland',
    displayName: 'Wetland',
    bounds: cell(PITCH, 0),
    unlocked: false,
    adjacent: ['meadow', 'highlands'],
    tier: 2,
    prereq: 'woodland', // the Woodland set unlocks the Wetland (gentle gate)
    color: 0x2a5a55,
  },
  highlands: {
    id: 'highlands',
    displayName: 'Highlands',
    bounds: cell(PITCH, PITCH),
    unlocked: false,
    adjacent: ['woodland', 'wetland', 'riverbank'],
    tier: 3,
    // The Wetland set unlocks the Highlands — but ESCALATED: also research-mouse-night
    // (BIOME_GATE_CHALLENGES) + the R2 research wrap. The prereq names the set; the wrap is
    // unchanged.
    prereq: 'wetland',
    color: 0x4a4f57,
  },
  // World Expansion (§4.2) — RIVERBANK, the first NEW biome: a flowing-water reach north of
  // the Highlands (a new equal cell, edge-adjacent — the rectangular clamp extends to it
  // unchanged). Tier 4, reached by RESEARCH past the Highlands. The river reuses the #55
  // water discs (rendered as a band); the water vole flees into it (the dip-net call-back).
  riverbank: {
    id: 'riverbank',
    displayName: 'Riverbank',
    bounds: cell(PITCH, PITCH * 2), // north of the Highlands — [20,60] x [60,100]
    unlocked: false,
    adjacent: ['highlands', 'coast'],
    tier: 4,
    prereq: 'highlands', // the Highlands set + the R2 wrap precede it; its own gate is research-rabbit-dawn
    color: 0x35756b,
  },
  // World Expansion (§4.2) — COAST, the 2nd new biome: a SEA-dominant shore north of the
  // Riverbank (the river meets the sea). A new equal cell — the clamp extends unchanged. The
  // SEA is a large #55 water region on the cell's OUTER (north / world-boundary) edge — NOT
  // covering the shared y=100 seam, so the beach edge stays walkable to the Riverbank. An OPEN
  // biome (2 cover spots) — BOTH biome nets shine (throwing on the beach, dip across the sea).
  coast: {
    id: 'coast',
    displayName: 'Coast',
    bounds: cell(PITCH, PITCH * 3), // north of the Riverbank — [20,60] x [100,140]
    unlocked: false,
    adjacent: ['riverbank'],
    tier: 5,
    prereq: 'riverbank', // gated by research-mouse-dusk + the unlock-the-coast project
    color: 0xc9b489, // sand / shingle
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
  /** §4.1c: an ADDITIONAL research-challenge requirement on an escalated gate — shown
   *  so a knowledge-gate is never silent. ✓ when done, + when still required. */
  andResearch: (title: string, done: boolean): string => `${done ? '✓' : '+'} the “${title}” research`,
  /** §4.1.4 R2 — the research PROJECT an escalated gate is WRAPPED in, with its state, so
   *  the research step is never a silent wall: ✓ when complete, "start it" when not begun,
   *  else its live progress. */
  andResearchProject: (name: string, started: boolean, progress: number, count: number, completed: boolean): string =>
    completed
      ? `✓ the “${name}” research`
      : !started
        ? `+ start the “${name}” research`
        : `+ the “${name}” research (${progress}/${count})`,
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
  | 'dotterel'
  // Riverbank (§4.2, tier 4-5 — flowing water; the dip-net's biome via the water vole).
  | 'reedbunting'
  | 'watervole'
  | 'greywagtail'
  | 'dipper'
  // Riverbank fish-eaters (§4.1.5 — the FISH diet; the apex catches).
  | 'kingfisher'
  | 'otter'
  // Coast (§4.2, tier 4-5 — the sea; the fish-diet synergy + the apex grey seal).
  | 'linnet'
  | 'brentgoose'
  | 'turnstone'
  | 'herringgull'
  | 'greyseal';

/** Rarity/difficulty tier: 1 = common, slow, forgiving … higher = rarer,
 *  faster, warier. The Meadow is all tier 1. */
export type Tier = 1 | 2 | 3 | 4 | 5;

/** Bait types = animal diets. The right bait for a species' diet calms it and
 *  lures it closer; the wrong bait does nothing (the diet-learning mechanic).
 *  `fish` (§4.1.5) is the 4th diet — RESEARCH-GATED (the kingfisher + otter eat it). */
export type BaitId = 'seeds' | 'greens' | 'insects' | 'fish';

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
  /** Nets & Gear slice W — this species FLEES TOWARD WATER (a leap into the pond),
   *  not straight away (frog only). Real behaviour (P5); it puts the animal out of the
   *  hand net's reach over water — the lateral condition the dip-net (B1) answers.
   *  Omitted/false = flees straight away from the player (unchanged). */
  fleesToWater?: boolean;
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
  'reedbunting',
  'watervole',
  'greywagtail',
  'dipper',
  'kingfisher',
  'otter',
  'linnet',
  'brentgoose',
  'turnstone',
  'herringgull',
  'greyseal',
];

/**
 * Richer field-guide knowledge per species (§4.1a) — a PARALLEL reference table,
 * kept SEPARATE from SpeciesDef (gameplay tuning). Pure data; the journal card pulls
 * it open. The `fieldNote` is the hero: the naturalist-gaze SYNTHESIS that connects
 * WHEN + WHAT-IT-EATS + WHERE + BEHAVIOUR into "so look there, then" — teaching the
 * SYSTEM, not listing facts (P2). `status` is real but HOPEFUL — what helps the
 * animal thrive, never preachy or grim. (habitat/diet/activity are derived from
 * SpeciesDef; `profile` stays the fun-fact.)
 */
export interface SpeciesInfo {
  fieldNote: string;
  behaviour: string;
  status: string;
  /** A DEEPER field note revealed once the species' research project is complete (the
   *  §4.1.4 journal-layer reward — "research an animal, learn more about it"). Optional;
   *  shown on the dex card ONLY when unlocked (purely additive, no balance touch). */
  researchNote?: string;
}

export const SPECIES_INFO: Record<SpeciesId, SpeciesInfo> = {
  fieldmouse: {
    fieldNote:
      'A round-the-clock seed-eater of the meadow — the field mouse forages day and night among the grass stems for seeds and grain. There is no wrong hour to find one in the long grass.',
    behaviour:
      'Darts in quick bursts between cover with its cheeks stuffed with seeds, climbing grass stalks and tunnelling runways through the thatch.',
    status: 'Common and thriving — meadows and field margins full of seeding grasses keep mice everywhere.',
    researchNote:
      'Field study: active in short bursts around the clock rather than by day or night, the field mouse caches seeds in scattered larders and can find its way home across surprising distances. A female may raise several litters between spring and autumn — the engine the meadow runs on.',
  },
  rabbit: {
    fieldNote:
      'A grazer of the open meadow — the rabbit crops grass and clover at all hours, never far from a burrow. Scan the short turf near hedges and banks.',
    behaviour:
      'Feeds in the open but bolts for the burrow at the first alarm, thumping a hind foot to warn the others; busiest at dawn and dusk.',
    status: 'Very common — rabbits breed quickly, and a meadow with banks to dig in suits them well.',
  },
  quail: {
    fieldNote:
      'A dawn seed-eater hidden in the meadow grass — the quail creeps through tall cover at first light, picking up seeds and small insects. Look low at dawn.',
    behaviour:
      'Stays on the ground, running through the grass rather than flying; its three-note call carries far before sunrise.',
    status: 'A summer visitor — quail do best where meadows are left tall and uncut for them to hide and feed.',
  },
  hedgehog: {
    fieldNote:
      'A dusk insectivore of the meadow edge — the hedgehog snuffles out beetles, worms and slugs as evening falls. Watch the long grass at dusk.',
    behaviour:
      'Roams at night by smell; when startled it curls into a spiny ball, trusting its roughly 5,000 spines over running.',
    status: 'Once common, now declining — it needs messy hedges and gaps between gardens to roam and feed.',
    researchNote:
      'Field study: a hedgehog ranges over a mile a night and hibernates from November, its heartbeat dropping from ~190 to ~20 beats a minute. The spines are modified hairs — about 7,000 on an adult, each lasting a year before it drops and regrows.',
  },
  redsquirrel: {
    fieldNote:
      'A daytime seed-eater of the treetops — the red squirrel works the woodland canopy by day for seeds, nuts and pine cones. Look up among the branches in daylight.',
    behaviour:
      'Leaps between branches using its bushy tail for balance, and buries caches of seeds to dig up through the winter.',
    status: 'Rare and protected — red squirrels hold on where conifer woods give them seeds and space of their own.',
  },
  robin: {
    fieldNote:
      'A dawn insect-hunter of the woodland floor — the robin watches from low perches at first light, dropping to snatch grubs and worms. First light, low among the trees.',
    behaviour:
      'Bold and curious, it follows digging animals to grab disturbed insects, and sings to defend its patch all year round.',
    status: 'Common and thriving — robins do well in woods, hedges and gardens alike.',
  },
  badger: {
    fieldNote:
      'A night-digging insectivore of the deep woodland — the badger emerges after dark to root out earthworms and grubs. A creature of the night, near its sett among the trees.',
    behaviour:
      'Lives in family groups in a sett of tunnels, following the same well-worn paths each night with its nose to the ground.',
    status: 'Common but shy — badgers thrive where old woods give them undisturbed ground to dig their setts.',
  },
  roedeer: {
    fieldNote:
      'A dusk browser of the woodland clearings — the roe deer steps out as the light fades to feed on leaves, shoots and brambles. Watch the clearing edges at dusk.',
    behaviour:
      'Browses delicately at the wood’s edge, freezing at any sound before bounding away with a sharp bark of alarm.',
    status: 'Common and increasing — roe deer thrive where woodland meets open ground.',
  },
  mallard: {
    fieldNote:
      'A daytime dabbler of the open water — the mallard up-ends in the shallows by day for water plants and seeds. Out on the wetland, in daylight.',
    behaviour:
      'Tips tail-up to feed underwater without diving; the green-headed drake and the streaky brown duck pair up on the water.',
    status: 'Very common — mallards are at home on almost any pond, lake or wetland.',
  },
  frog: {
    fieldNote:
      'A dawn insectivore of the water’s edge — the common frog waits in the shallows at first light, hunting insects, slugs and worms. Look low along the wetland margins as the sun comes up.',
    behaviour:
      'Sits motionless, then ambushes with a flick of its long sticky tongue; one powerful leap carries it back to the safety of the water.',
    status: 'Common but sensitive — frogs breathe through their skin, so clean ponds and wetlands keep them thriving.',
  },
  ptarmigan: {
    fieldNote:
      'A daytime plant-eater of the high tops — the rock ptarmigan picks at shoots, buds and berries by day, higher up the mountain than almost any other bird. Look on the open ground, in daylight.',
    behaviour:
      'Relies on camouflage over flight, sitting tight until almost stepped on; it turns from speckled brown to pure white for the winter.',
    status: 'Doing well on the high tops — ptarmigan thrive where the mountains stay cold and wild.',
  },
  mountainhare: {
    fieldNote:
      'A dusk grazer of the high moor — the mountain hare crops heather and grasses as the light fades on the open tops. Watch the slopes at dusk.',
    behaviour:
      'Rests in a shallow scrape by day and feeds at dusk and dawn; it can bound away faster than almost anything on the hill, and turns blue-grey then white in winter.',
    status: 'At home on the high moor — mountain hares thrive where heather is managed and cold winters favour their pale coat.',
  },
  dotterel: {
    fieldNote:
      'A daytime insect-hunter of the highest tops — the dotterel picks insects and spiders from the bare stony ground by day, on the very roof of the hills. Look on the open summits, in daylight.',
    behaviour:
      'Unusually tame, it lets you come close; and unusually, the brighter female leaves the duller male to sit on the eggs and raise the chicks.',
    status: 'A rare summer visitor — dotterel nest only on the highest, wildest ground, which keeps them safe and undisturbed.',
  },
  reedbunting: {
    fieldNote:
      'A seed-eater of the reedy riverbank — the reed bunting works the wet margins for seeds (and insects in summer). Look low among the reeds by day.',
    behaviour:
      'The male wears a black head and a white collar, and sings a simple scratchy song from a swaying reed stem.',
    status: 'Doing well where riverbanks and wet farmland keep their reeds and rough, seeding margins.',
  },
  watervole: {
    fieldNote:
      'A bankside grazer of slow, clear rivers — the water vole crops waterside grasses, reeds and sedges along the bank. Watch the green margins by day.',
    behaviour:
      '“Ratty” of The Wind in the Willows — at the first alarm it dives off the bank into the water with a loud “plop” and swims for cover.',
    status: 'Britain’s fastest-declining mammal — but where clean banks are kept safe from American mink, the water vole bounces back.',
  },
  greywagtail: {
    fieldNote:
      'An insect-hunter of fast water — the grey wagtail snaps up insects along stony river edges by day.',
    behaviour:
      'It bobs its long tail constantly on the midstream rocks; despite the name, it flashes vivid lemon-yellow underneath.',
    status: 'At home on clean, fast rivers — it spreads wherever the water runs clear and insect-rich.',
  },
  dipper: {
    fieldNote:
      'A streambed hunter of fast rivers — the dipper prises caddis and mayfly larvae from the riverbed by day.',
    behaviour:
      'The only British songbird that swims — it walks UNDERWATER against the current, then bobs on a midstream rock, white bib flashing.',
    status: 'A sign of clean water — dippers thrive only where fast rivers stay unpolluted and full of insect life.',
  },
  kingfisher: {
    fieldNote:
      'A fish-hunter of the open river — the kingfisher watches from a low branch by day, then plunges to spear a small fish.',
    behaviour:
      'An electric-blue arrow: it sits dead still, then dives head-first into the water and is back on its perch in a flash — flying off fast when disturbed.',
    status: 'A jewel of clean rivers — kingfishers thrive wherever the water runs clear and full of small fish.',
  },
  otter: {
    fieldNote:
      'A fish-hunter of the whole river — the otter works the water at dusk for fish. Watch the banks as the light fades.',
    behaviour:
      'A sleek, playful swimmer — at the first alarm it slips into the river and is gone, hunting underwater with whiskers that feel the current.',
    status: 'Back from the brink — otters now thrive again on clean, well-stocked rivers right across the country.',
  },
  // Coast (§4.2) — written soul-AWARE: HONEST conservation status, the real spectrum.
  linnet: {
    fieldNote:
      'A small finch of the coastal scrub and dunes — the linnet picks seeds from low plants by day. Watch the rough ground above the beach.',
    behaviour:
      'Flocks twist and turn together over the dunes; the breeding male flushes rose-pink on the breast and forehead.',
    status: 'Red-listed and in decline — the loss of seeding plants on farmland and coast has hit the linnet hard.',
  },
  brentgoose: {
    fieldNote:
      'A small, dark goose of the winter shore — the brent goose grazes eelgrass and saltmarsh by day along the tideline.',
    behaviour:
      'Travels in loose, chattering flocks low over the water; it crops the eelgrass beds that only the shallow coast grows.',
    status: 'Doing well where its eelgrass beds and saltmarshes are protected — a winter visitor in good numbers.',
  },
  turnstone: {
    fieldNote:
      'A stout little wader of the tideline — the turnstone flips over seaweed and stones for sandhoppers and small invertebrates by day.',
    behaviour:
      'Works the strandline in busy, restless parties, levering over weed and shells with its short strong bill to grab what hides beneath.',
    status: 'Common on rocky and sandy shores in winter — a hardy, adaptable little traveller.',
  },
  herringgull: {
    fieldNote:
      'A big, bold gull of the coast — the herring gull takes fish and scavenges the shore by day.',
    behaviour:
      'Loud and clever, it patrols the tideline and harbours; the pink-legged adult drops shellfish onto rocks to crack them.',
    status: 'Surprisingly red-listed and in decline — the bold “town gull” masks a real fall in our wild seabird colonies.',
  },
  greyseal: {
    fieldNote:
      'A fish-hunter of the open sea — the grey seal hauls out on the rocks by day and hunts fish offshore.',
    behaviour:
      'Curious and powerful; at the first alarm it slides off the rocks into the sea and is gone, hunting underwater on a single long breath.',
    status: 'A conservation success — Britain now safeguards nearly half the world’s grey seals, back from the brink.',
  },
};

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
    // Slice W: the frog leaps to the water when startled (P5) — out of the hand net's
    // reach; the dip-net (B1) is the answer. (The mallard bursts into flight instead.)
    fleesToWater: true,
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
  // --- Riverbank (§4.2) — flowing water; tier 4-5, the dip-net's biome. ---
  reedbunting: {
    id: 'reedbunting',
    displayName: 'Reed Bunting',
    biome: 'riverbank',
    // The Riverbank VALVE (0.52): a small, calm seed-eater of the reeds — comfortably
    // catchable bait-less with the starter (the anti-lockout valve, like each biome's easiest).
    spawnWeight: 6,
    baseFleeSpeed: 2.6,
    detectionRadius: 2.4,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.52,
    bait: 'seeds',
    color: 0x7a6a4a,
    size: 0.32,
    profile:
      'Reed buntings work the reedy margins of rivers and wet farmland for seeds. The black-headed male sings a simple scratchy song from a swaying reed.',
  },
  watervole: {
    id: 'watervole',
    displayName: 'Water Vole',
    biome: 'riverbank',
    spawnWeight: 5,
    baseFleeSpeed: 3.4,
    detectionRadius: 2.8,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.38,
    bait: 'greens',
    color: 0x6b5a45,
    size: 0.4,
    profile:
      'The water vole — “Ratty” of The Wind in the Willows — grazes bankside grasses, then dives off the bank with a plop when startled. Britain’s fastest-declining mammal.',
    // §55 reuse: the vole leaps INTO the river when startled (like the frog) — out of the
    // hand net's reach; the dip-net (B1) is the answer again (the Riverbank synergy).
    fleesToWater: true,
  },
  greywagtail: {
    id: 'greywagtail',
    displayName: 'Grey Wagtail',
    biome: 'riverbank',
    spawnWeight: 4,
    baseFleeSpeed: 4.2,
    detectionRadius: 3.6,
    activityWindow: 'day',
    tier: 5,
    baseCatchRate: 0.28,
    bait: 'insects',
    color: 0xc9bf55,
    size: 0.28,
    profile:
      'A wagtail of fast, stony rivers, snapping up insects at the water’s edge — bobbing its long tail and flashing vivid lemon-yellow underneath, despite the “grey” name.',
  },
  dipper: {
    id: 'dipper',
    displayName: 'Dipper',
    biome: 'riverbank',
    // The Riverbank's HARDEST (0.20): a rare, fast river specialist.
    spawnWeight: 3,
    baseFleeSpeed: 4.4,
    detectionRadius: 3.8,
    activityWindow: 'day',
    tier: 5,
    baseCatchRate: 0.2,
    bait: 'insects',
    color: 0x4a3f38,
    size: 0.3,
    profile:
      'The only British songbird that swims: the dipper walks underwater along the riverbed hunting larvae, then bobs on a midstream rock, white bib flashing. A sign of clean, fast water.',
  },
  // --- Riverbank fish-eaters (§4.1.5) — the FISH diet. Catchable BAIT-LESS (hard); fish bait
  //     (research-gated) makes them easier, never required (anti-lockout). ---
  kingfisher: {
    id: 'kingfisher',
    displayName: 'Kingfisher',
    biome: 'riverbank',
    spawnWeight: 3,
    baseFleeSpeed: 4.6,
    detectionRadius: 4.0,
    activityWindow: 'day',
    tier: 5,
    baseCatchRate: 0.2,
    bait: 'fish', // §4.1.5 — eats fish (dives for small fish)
    color: 0x1a8fb5, // electric blue
    size: 0.28,
    profile:
      'An electric-blue arrow over the river: the kingfisher sits still on a low branch, then plunges head-first to spear a small fish, and is back in a flash. Flies off fast when disturbed.',
    // No fleesToWater: it dives FOR fish but escapes by FLIGHT, not by hiding in the water.
  },
  otter: {
    id: 'otter',
    displayName: 'Otter',
    biome: 'riverbank',
    // The APEX catch (0.15, the hardest in the game): a large, elusive, crepuscular river hunter.
    spawnWeight: 2,
    baseFleeSpeed: 4.6,
    detectionRadius: 4.2,
    activityWindow: 'dusk',
    tier: 5,
    baseCatchRate: 0.15,
    bait: 'fish', // §4.1.5 — a fish hunter of the whole river
    color: 0x5a4632,
    size: 0.46,
    profile:
      'A sleek river hunter: the otter works the water at dusk for fish, hunting underwater with whiskers that feel the current. At the first alarm it slips into the river and is gone.',
    // §55 reuse: the otter slips INTO the river to escape — the dip-net's biome deepens (the
    // third fleesToWater species, the apex of the water-edge catch).
    fleesToWater: true,
  },
  // --- Coast (§4.2) — the sea; tier 4-5, the fish-diet synergy + the apex grey seal. ---
  linnet: {
    id: 'linnet',
    displayName: 'Linnet',
    biome: 'coast',
    // The Coast VALVE (0.50): a small, calm seed-eater of the dunes — catchable bait-less.
    spawnWeight: 6,
    baseFleeSpeed: 2.8,
    detectionRadius: 2.6,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.5,
    bait: 'seeds',
    color: 0x9a5a4a,
    size: 0.3,
    profile:
      'A small finch of coastal scrub and dunes, eating seeds from low plants. The breeding male flushes rose-pink — but it is red-listed, hit hard by the loss of seeding ground.',
  },
  brentgoose: {
    id: 'brentgoose',
    displayName: 'Brent Goose',
    biome: 'coast',
    spawnWeight: 4,
    baseFleeSpeed: 3.6,
    detectionRadius: 3.4,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.38,
    bait: 'greens',
    color: 0x33312e,
    size: 0.42,
    profile:
      'A small, dark winter goose that grazes the eelgrass and saltmarsh of the shallow coast, travelling in loose chattering flocks low over the water.',
  },
  turnstone: {
    id: 'turnstone',
    displayName: 'Turnstone',
    biome: 'coast',
    spawnWeight: 5,
    baseFleeSpeed: 4.0,
    detectionRadius: 3.4,
    activityWindow: 'day',
    tier: 5,
    baseCatchRate: 0.34,
    bait: 'insects',
    color: 0xb5733f,
    size: 0.28,
    profile:
      'A stout tideline wader that flips over seaweed and stones with its short strong bill to grab the sandhoppers and small invertebrates hiding beneath.',
  },
  herringgull: {
    id: 'herringgull',
    displayName: 'Herring Gull',
    biome: 'coast',
    spawnWeight: 4,
    baseFleeSpeed: 3.8,
    detectionRadius: 3.6,
    activityWindow: 'day',
    tier: 4,
    baseCatchRate: 0.32,
    bait: 'fish', // §4.1.5 — fish + scavenge
    color: 0xe6e8ec,
    size: 0.4,
    profile:
      'A big, bold gull that takes fish and scavenges the shore — and, surprisingly, a red-listed bird in decline: the town gull masks a real fall in our wild seabird colonies.',
  },
  greyseal: {
    id: 'greyseal',
    displayName: 'Grey Seal',
    biome: 'coast',
    // The new APEX catch (0.12, the hardest of all): a large, wary, offshore hunter.
    spawnWeight: 2,
    baseFleeSpeed: 4.8,
    detectionRadius: 4.5,
    activityWindow: 'day',
    tier: 5,
    baseCatchRate: 0.12,
    bait: 'fish', // §4.1.5 — a fish hunter of the open sea
    color: 0xb0a89a,
    size: 0.56,
    profile:
      'A powerful sea hunter that hauls out on the rocks and hunts fish offshore on a single long breath. A conservation success — Britain safeguards nearly half the world’s grey seals.',
    // §55 reuse: the seal slides INTO the sea to escape — the apex water-diver; the dip-net's
    // biggest moment (across the open sea).
    fleesToWater: true,
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

/** FIXED hiding spots — the FREE cover baseline per biome (Nets & Gear slice C). The
 *  uniform 5/biome was REDUCED to make cover sparser + stealth more deliberate, and to
 *  open up the HIGHLANDS (fewest spots) — the "open ground" condition the throwing net
 *  (B1) keys off. A FREE baseline stays in EVERY biome (never zero) so the anti-lockout
 *  valve holds: the easiest species stays bait-less catchable by sneaking from this
 *  baseline (pinned by the L1 approach guard). Beyond the baseline, cover is
 *  PROVISIONED — deploy a portable HIDE where you need it (see HIDE). Meadow grass,
 *  Woodland ferns, Wetland reeds, Highlands boulders. */
export const HIDING_SPOTS: readonly HidingSpotDef[] = [
  // Meadow — tall grass ([-20,20]²): a spread of 3 (SW / NE / centre).
  { biome: 'meadow', x: -8, y: -6, radius: 2.2, kind: 'grass' },
  { biome: 'meadow', x: 10, y: 8, radius: 2.4, kind: 'grass' },
  { biome: 'meadow', x: 1, y: 3, radius: 1.8, kind: 'grass' },
  // Woodland — bracken ferns (x∈[-20,20], y∈[20,60]); clear of the badger sett.
  { biome: 'woodland', x: -12, y: 28, radius: 2.2, kind: 'ferns' },
  { biome: 'woodland', x: 12, y: 50, radius: 2.4, kind: 'ferns' },
  { biome: 'woodland', x: 3, y: 44, radius: 1.8, kind: 'ferns' },
  // Wetland — water's-edge reeds (x∈[20,60], y∈[-20,20]).
  { biome: 'wetland', x: 28, y: -6, radius: 2.2, kind: 'reeds' },
  { biome: 'wetland', x: 52, y: -10, radius: 2.4, kind: 'reeds' },
  { biome: 'wetland', x: 44, y: -2, radius: 1.8, kind: 'reeds' },
  // Highlands — boulders / scree (x∈[20,60], y∈[20,60]): the OPENEST biome, just 2
  // spots (open + precious, NOT barren — stealth stays a tool, the throwing net stays
  // valuable not mandatory).
  { biome: 'highlands', x: 30, y: 32, radius: 2.2, kind: 'rocks' },
  { biome: 'highlands', x: 50, y: 46, radius: 2.0, kind: 'rocks' },
  // Riverbank — bankside reeds (x∈[20,60], y∈[60,100]), clear of the river band (y≈74-86):
  // 3 spots (cover-rich, like the wetland — NOT open, so the dip-net not the throwing net is
  // the biome's tool). Reuses the wetland reed render.
  { biome: 'riverbank', x: 28, y: 68, radius: 2.2, kind: 'reeds' },
  { biome: 'riverbank', x: 50, y: 70, radius: 2.0, kind: 'reeds' },
  { biome: 'riverbank', x: 35, y: 92, radius: 2.4, kind: 'reeds' },
  // Coast — marram grass on the dunes/beach (x∈[20,60], y∈[100,123], clear of the sea): just 2
  // spots (an OPEN biome, like the Highlands — so the throwing net's open-ground reach applies on
  // the beach, while the sea makes the dip-net matter: Coast is where BOTH biome nets shine).
  // Reuses the meadow grass render.
  { biome: 'coast', x: 30, y: 108, radius: 2.2, kind: 'grass' },
  { biome: 'coast', x: 50, y: 114, radius: 2.0, kind: 'grass' },
];

/** The portable HIDE (Nets & Gear slice C) — naturalist gear you DEPLOY at your
 *  position to make cover where there is none (esp. the open Highlands). LATERAL: it
 *  gives the SAME cover stealth as a fixed spot (STEALTH.coverFactor ×0.45) — cover
 *  where you CHOOSE it, never a catch-rate boost. Owned as baseline gear; the
 *  deployment is TRANSIENT (re-placed each session, like a deployed lure — no schema). */
export const HIDE = {
  /** Cover radius of a deployed hide, world units (matches the baseline spot radii). */
  radius: 2.2,
  displayName: 'Portable Hide',
  flavor: 'A folding canvas hide — set it down and wait unseen, even on open ground.',
} as const;

/** A water region (a pond), world units. */
export interface WaterDef {
  biome: BiomeId;
  x: number;
  y: number;
  radius: number;
}

/** WATER terrain (Nets & Gear slice W). The wetland's pond — the FIRST modelled water:
 *  the PLAYER can't enter it (a movement barrier), but animals can, and the FROG flees
 *  INTO it (fleesToWater) out of the hand net's reach. The dip-net (B1) — a longer-reach
 *  net — is what reaches across. Sited in the wetland's open north-centre (cell
 *  x∈[20,60], y∈[-20,20]), clear of spawn, the supply post (55,-14), the reeds, and the
 *  x=20 entry; radius 6 leaves a real gap (a centre-fled frog sits ~6 > the hand net's
 *  reach 2.6 from any shore). Zero-asset (a flat teal disc). */
export const WATER: readonly WaterDef[] = [
  { biome: 'wetland', x: 40, y: 8, radius: 6 },
  // Riverbank (§4.2) — a flowing RIVER reach: three overlapping #55 discs forming a
  // continuous E-W band across the cell (reuses the disc barrier/slide/flee VERBATIM; the
  // render draws it as a connected band). The water vole flees into it (the dip-net answers).
  { biome: 'riverbank', x: 30, y: 80, radius: 6 },
  { biome: 'riverbank', x: 40, y: 80, radius: 6 },
  { biome: 'riverbank', x: 50, y: 80, radius: 6 },
  // Coast (§4.2) — the SEA: a LARGE #55 region of overlapping discs along the cell's OUTER
  // (north / world-boundary) edge, covering the seaward half (y≈123-140). It sits well clear of
  // the y=100 seam to the Riverbank — the beach (y≈100-123) stays walkable. The disc barrier /
  // slide / flee are reused VERBATIM (the sea is the disc mechanic scaled up — visual, not new);
  // the grey seal slips into it (the apex water-diver — the dip-net's biggest moment).
  { biome: 'coast', x: 28, y: 132, radius: 9 },
  { biome: 'coast', x: 40, y: 132, radius: 9 },
  { biome: 'coast', x: 52, y: 132, radius: 9 },
];

/** Frog flee-to-water steering (slice W): how strongly a fleeing frog's heading is
 *  blended TOWARD the nearest water centre vs straight away from the player (0 = away,
 *  1 = at the water). Enough to make for the pond, not so much it ignores the player. */
export const WATER_FLEE_BIAS = 0.6;

/** Render of the water disc — a flat translucent teal plane (zero-asset). */
export const WATER_RENDER = {
  color: 0x2f6f78,
  /** Ground offset so it sits just above the grid, below the props. */
  y: 0.02,
  opacity: 0.78,
} as const;

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
  { biome: 'riverbank', x: 52, y: 66, radius: 2.5 }, // clear of the river band + the reeds
  { biome: 'coast', x: 40, y: 106, radius: 2.5 }, // on the beach, clear of the sea + the marram
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
// Nets (durable catch gear — the "tool" in hand)
// ===========================================================================

/** Catch nets the player can OWN + equip (Nets & Gear arc). The Hand Net is the
 *  starter; the biome-specialized dip-net + throwing net (slice B1) are LATERAL — each
 *  answers its biome's catching CONDITION, NEVER a flat catch-rate multiplier (all stay
 *  catchMultiplier 1.0). The laterality KEYSTONE: every net's BASE `reach` is 2.6, so the
 *  proximity curve (the catch CHANCE at a given distance) is net-INDEPENDENT — no net has
 *  better odds. A biome net's edge is a CONDITION-extended GATE reach (`reachInWater` /
 *  `reachOpen`) that only widens WHICH animals are reachable in that situation, never the
 *  odds once reached. So the starter still catches everything everywhere (anti-lockout). */
export type ToolId = 'net' | 'dip-net' | 'throwing-net';

export interface ToolDef {
  id: ToolId;
  /** Player-facing net name (naturalist framing). */
  displayName: string;
  /** A short "what this net is for" line (P2/P5 — match your gear to the habitat). */
  flavor: string;
  /** Catch-chance factor — the NEUTRAL 1.0 identity for EVERY net (the advantage is
   *  LATERAL: reach/condition — never a flat >1 multiplier). */
  catchMultiplier: number;
  /** BASE reach, world units (slice B0) — the attempt gate AND the proximity-curve
   *  denominator. 2.6 for ALL nets (= CATCH.attemptRadius), so the catch CHANCE at a
   *  given distance is net-independent. */
  reach: number;
  /** Slice B1 — the GATE reach when the target is IN WATER (the dip-net's edge: reach
   *  across the pond to a fled frog). Omitted = no water advantage (falls back to `reach`).
   *  Affects ONLY the attempt gate, never the proximity/odds. */
  reachInWater?: number;
  /** Slice B1 — the GATE reach in an OPEN biome (the throwing net's edge: range on open
   *  ground where cover is sparse). Omitted = no open advantage (falls back to `reach`).
   *  Affects ONLY the attempt gate, never the proximity/odds. */
  reachOpen?: number;
}

export const TOOL_ORDER: readonly ToolId[] = ['net', 'dip-net', 'throwing-net'];

export const TOOLS: Record<ToolId, ToolDef> = {
  net: {
    id: 'net',
    displayName: 'Hand Net',
    flavor: 'A light sweep net — ideal up close, where grass and ferns let you sneak in.',
    catchMultiplier: 1.0,
    // EXACTLY the current attemptRadius — the keystone (pinned: net.reach === CATCH.attemptRadius).
    reach: 2.6,
  },
  'dip-net': {
    id: 'dip-net',
    displayName: 'Dip-net',
    flavor: 'A long-handled dip-net — reaches across pond margins to creatures that have fled to the water.',
    catchMultiplier: 1.0,
    reach: 2.6, // same odds as the hand net everywhere...
    reachInWater: 8, // ...but it can reach a frog fled to the pond's centre (~6.5 from shore).
  },
  'throwing-net': {
    id: 'throwing-net',
    displayName: 'Throwing Net',
    flavor: 'A weighted casting net — flings out across open ground where there is no cover to sneak behind.',
    catchMultiplier: 1.0,
    reach: 2.6, // same odds as the hand net everywhere...
    reachOpen: 7, // ...but it ranges out on the open tops, where you can't close on the birds.
  },
};

/** A biome is "open" — the throwing net's condition — when its FIXED cover (HIDING_SPOTS)
 *  is at/below this. The Highlands (2 spots, #53) is open; the others (3) are not. */
export const OPEN_BIOME_COVER_MAX = 2;

/** The net the player starts with (owned + equipped from the start). */
export const STARTER_TOOL: ToolId = 'net';

// ===========================================================================
// Bait
// ===========================================================================

/** Bait deltas — the diet-learning lure. Correct bait (matches a species' diet)
 *  calms it toward the catch ceiling AND lures it to APPROACH; wrong bait does
 *  nothing. Bait is a consumable with an in-memory count. */
export const BAIT_ORDER: readonly BaitId[] = ['seeds', 'greens', 'insects', 'fish'];

/** Baits that are RESEARCH-GATED (§4.1.5): they start at 0 (locked) and become buyable only
 *  once their unlocking research completes. The 3 original diets are always stocked. */
export const RESEARCH_GATED_BAITS: readonly BaitId[] = ['fish'];

/** Starting count for a bait: the 3 original diets start stocked; a research-gated bait
 *  (fish) starts at 0 — you don't begin with bait you can't use until you've studied it. */
export function startingBaitCount(id: BaitId): number {
  return RESEARCH_GATED_BAITS.includes(id) ? 0 : BAIT.startingCount;
}

/** The procedural diet-icon glyph a bait chip draws (CSS shapes, zero assets). */
export type BaitIconKind = 'seeds' | 'leaf' | 'insect' | 'fish';

/** Tray DISPLAY metadata per bait — a short label + which procedural icon to
 *  draw. Diet legibility (§5): the icon teaches "what this bait IS". */
export const BAIT_DISPLAY: Record<BaitId, { label: string; icon: BaitIconKind }> = {
  seeds: { label: 'Seeds', icon: 'seeds' },
  greens: { label: 'Greens', icon: 'leaf' },
  insects: { label: 'Insects', icon: 'insect' },
  fish: { label: 'Fish', icon: 'fish' },
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

  // --- Atmosphere: the audio MASTER bus + mute (§4.3) --------------------------------
  // A1b stripped the synthesized ambient (it sounded like static) — the wind/voice synthesis
  // params went with it. What stays is the master bus + mute (used by AudioEngine for SFX +
  // the future recorded-loop ambient). A future sample-based slice adds its own loop params.
  /** Master-bus level when un-muted (0..1). All sound routes through it; mute -> 0. */
  masterGain: 0.9,
  /** Mute/unmute ramp, seconds — short so it feels instant but never clicks. */
  muteRampSec: 0.06,
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
  // Riverbank (§4.2) — three river birds (reuse the BIRD build) + the vole (the MOUSE build).
  reedbunting: {
    kind: 'bird',
    accent: 0x2a2a2a, // black head
    beakLengthR: 0.4,
    crestHeightR: 0.3,
  },
  watervole: {
    kind: 'mouse',
    accent: 0x4a3b2a,
    earHeightR: 0.22,
    earRadiusR: 0.2,
    tailLengthR: 0.9,
    tailRadiusR: 0.09,
  },
  greywagtail: {
    kind: 'bird',
    accent: 0xf2e04a, // lemon-yellow underparts
    beakLengthR: 0.45,
    crestHeightR: 0.2,
  },
  dipper: {
    kind: 'bird',
    accent: 0xffffff, // white bib
    beakLengthR: 0.4,
    crestHeightR: 0.25,
  },
  // Riverbank fish-eaters (§4.1.5) — the kingfisher (bird, long dagger beak) + the otter (a
  // low quadruped, the mouse build with a long thick tail).
  kingfisher: {
    kind: 'bird',
    accent: 0xe88a4a, // orange breast
    beakLengthR: 0.9, // the long dagger bill
    crestHeightR: 0.2,
  },
  otter: {
    kind: 'mouse',
    accent: 0xcdbfa6, // pale throat
    earHeightR: 0.14,
    earRadiusR: 0.14,
    tailLengthR: 1.3,
    tailRadiusR: 0.22,
  },
  // Coast (§4.2) — four shore birds (the BIRD build) + the grey seal (the MAMMAL build, large,
  // round, tiny ears + a short tail for the flippers/read).
  linnet: {
    kind: 'bird',
    accent: 0xc0533a, // rose-pink breast
    beakLengthR: 0.4,
    crestHeightR: 0.25,
  },
  brentgoose: {
    kind: 'bird',
    accent: 0xf0f0f0, // white stern
    beakLengthR: 0.5,
    crestHeightR: 0.15,
  },
  turnstone: {
    kind: 'bird',
    accent: 0xd98b4a, // tortoiseshell back
    beakLengthR: 0.45,
    crestHeightR: 0.2,
  },
  herringgull: {
    kind: 'bird',
    accent: 0xf2c84a, // yellow bill
    beakLengthR: 0.6,
    crestHeightR: 0.15,
  },
  greyseal: {
    kind: 'mouse',
    accent: 0xdcd6cb,
    earHeightR: 0.1,
    earRadiusR: 0.1,
    tailLengthR: 0.3,
    tailRadiusR: 0.2,
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
  | { kind: 'track-and-catch'; species: SpeciesId; count: number }
  // §4.1b RESEARCH challenge: catch a species UNDER its biological condition (its
  // activity phase). BOTH dimensions are required, so completing it PROVES applied
  // knowledge — you can't catch the dusk-only roe deer except in the woodland at
  // dusk. The clue describes TRAITS, never the name, so the player identifies it
  // from the field-guide cards (#45). Anti-accident by construction.
  | { kind: 'research'; species: SpeciesId; phase: DayPhase; count: number };

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
  /** STANDALONE missions (Plan #8b tracking, §4.1b research challenges) are optional
   *  side-quests — they do NOT count toward their biome's set-completion (so they
   *  don't gate an unlock). Omitted/false = a normal set mission. */
  standalone?: boolean;
  /** §4.1b — a one-time credit bonus on completion (research challenges). Count-1, so
   *  it can't be farmed. Kept below the biome-complete reward so discovery stays the
   *  bigger payoff. */
  creditReward?: number;
  /** §4.1b — the teaching HINT shown on a "warm miss" (a catch in this challenge's
   *  biome that doesn't satisfy it). Re-frames the trait clue; never punishes. */
  hint?: string;
}

/** §4.1b research-challenge rewards. The credit bonus is MEANINGFUL but ONE-TIME
 *  (challenges are count-1, so it can't be farmed) and BOUNDED below the
 *  biome-journal-complete reward (CREDITS.perBiomeComplete = 25) — discovery stays
 *  the bigger payoff. Rank points are modest. Tune on playtest. */
export const RESEARCH = {
  rewardPoints: 12,
  creditReward: 18,
} as const;

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
  // §4.1b research challenges (standalone — don't gate unlocks / the win). NON-FORCED
  // conditions (§4.1b-fix): the meadow round-the-clock foragers at NIGHT.
  'research-mouse-night',
  'research-rabbit-night',
  'research-rabbit-dawn',
  'research-mouse-dusk',
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
  // §4.1b RESEARCH challenges — standalone applied-knowledge side-quests. The clue
  // describes TRAITS (the player identifies the species from the #45 cards); the
  // condition (species + activity phase) is anti-accident; a warm miss teaches.
  //
  // §4.1b-fix: these target NON-FORCED conditions. The original three (robin@dawn,
  // badger@night, roedeer@dusk) were AUTO-SATISFIED — the woodland catch-set forces
  // exactly those window-locked species in exactly those windows, so they completed
  // invisibly and there was no "figure it out" moment. The ONLY genuinely non-forced
  // space (without the deferred bait dimension) is the 'any'-window MEADOW foragers
  // (fieldmouse, rabbit) at NIGHT — no set or the dex forces a night meadow catch, so
  // the player must CHOOSE to go look after dark. (Bait would open more — flagged as
  // the §4.1b expansion: "catch species X using its diet bait" for any species.)
  'research-mouse-night': {
    id: 'research-mouse-night',
    biome: 'meadow',
    title: 'Research: The Night Shift',
    description:
      'A round-the-clock forager of the meadow grass — out among the stems by day AND by night. Most field-watchers only meet it in daylight. Identify it from your field guide, then seek it after dark.',
    requirement: { kind: 'research', species: 'fieldmouse', phase: 'night', count: 1 },
    rewardPoints: RESEARCH.rewardPoints,
    creditReward: RESEARCH.creditReward,
    standalone: true,
    hint: 'Not the one — you are after a round-the-clock forager of the meadow grass. Come back to the meadow after dark.',
  },
  'research-rabbit-night': {
    id: 'research-rabbit-night',
    biome: 'meadow',
    title: 'Research: Under the Moon',
    description:
      'A grazer that never strays far from its burrow — busiest at dawn and dusk, yet it still crops the meadow turf under the moon. Identify it from your field guide, then find it grazing at night.',
    requirement: { kind: 'research', species: 'rabbit', phase: 'night', count: 1 },
    rewardPoints: RESEARCH.rewardPoints,
    creditReward: RESEARCH.creditReward,
    standalone: true,
    hint: 'Not the one — you are after a burrow-grazer that crops the turf under the moon. Look in the meadow at night.',
  },
  // §4.2 — the Riverbank's by-PLAY mastery gate (research-gated unlock, R2). NON-FORCED: the
  // rabbit is active at ANY hour, so requiring it AT DAWN is a deliberate field-craft choice
  // (normal progression never forces a dawn rabbit — the #48 inverse holds). Doable in the
  // always-open Meadow with the starter (anti-wall); a count-1 standalone challenge.
  'research-rabbit-dawn': {
    id: 'research-rabbit-dawn',
    biome: 'meadow',
    title: 'Research: The Dawn Watch',
    description:
      'A grazer busiest at dawn and dusk, yet found at any hour — most field-watchers meet it by day. Prove your early-rising field-craft: find a rabbit cropping the meadow at first light.',
    requirement: { kind: 'research', species: 'rabbit', phase: 'dawn', count: 1 },
    rewardPoints: RESEARCH.rewardPoints,
    creditReward: RESEARCH.creditReward,
    standalone: true,
    hint: 'Not the one — be out at DAWN for a meadow grazer at first light.',
  },
  // §4.2 — the Coast's by-PLAY mastery gate. NON-FORCED: the fieldmouse forages at ANY hour, so
  // requiring it AT DUSK is a deliberate field-craft choice (normal play never forces a dusk
  // mouse — the #48 inverse holds). Doable in the always-open Meadow with the starter.
  'research-mouse-dusk': {
    id: 'research-mouse-dusk',
    biome: 'meadow',
    title: 'Research: The Evening Watch',
    description:
      'A round-the-clock forager of the meadow grass, out at every hour — most field-watchers meet it by day. Catch a field mouse at DUSK, as the light fades.',
    requirement: { kind: 'research', species: 'fieldmouse', phase: 'dusk', count: 1 },
    rewardPoints: RESEARCH.rewardPoints,
    creditReward: RESEARCH.creditReward,
    standalone: true,
    hint: 'Not the one — seek a meadow forager at DUSK, as the light fades.',
  },
};

/** Completing ALL of a biome's missions unlocks the mapped biome (lateral reward
 *  — a new region + its species, not flat power, §5.5). */
export const BIOME_SET_UNLOCK: Partial<Record<BiomeId, BiomeId>> = {
  meadow: 'woodland',
  woodland: 'wetland',
  wetland: 'highlands',
  highlands: 'riverbank', // §4.2 — the Highlands set + its R2 wrap precede the Riverbank gate
  riverbank: 'coast', // §4.2 — the Riverbank precedes the Coast gate (the river meets the sea)
};

/** §4.1c ESCALATING knowledge gates: in ADDITION to the catch-set, a biome's unlock
 *  may require completing research challenge(s) — demonstrated MASTERY, not just
 *  catch-counts. The ramp is gradual: earlier gates have NO entry (gentle, unchanged);
 *  only the LAST gate (Wetland→Highlands) adds a required challenge. ANTI-WALL: the
 *  required challenge is research-mouse-night (fieldmouse@night) — the EASIEST species,
 *  in the always-open starting Meadow, learnable from the very start, and the world is
 *  open so the player can always return there at night. Passable by UNDERSTANDING, never
 *  a wall (#37 shows the requirement). A biome with no entry gates on its catch-set alone. */
export const BIOME_GATE_CHALLENGES: Partial<Record<BiomeId, readonly string[]>> = {
  wetland: ['research-mouse-night'],
  // §4.2 — reaching the Riverbank is ESCALATED like the Highlands: the Highlands set AND a
  // by-PLAY mastery challenge (research-rabbit-dawn, a NON-FORCED dawn catch). The
  // unlock-the-riverbank research project wraps it (R2 generalized).
  highlands: ['research-rabbit-dawn'],
  // §4.2 — reaching the Coast: a by-PLAY mastery challenge (research-mouse-dusk, a NON-FORCED
  // dusk catch). ⚠️ This uses the LAST free non-forced slot — the any-window species
  // (fieldmouse/rabbit) × the free phases (night/dawn/dusk) are now ALL used; the NEXT biome
  // needs a mission-system enhancement for more non-forced-challenge variety (logged).
  riverbank: ['research-mouse-dusk'],
};

// ===========================================================================
// Research spine (§4.1.4 — R0a: the data model)
// ===========================================================================

/**
 * What in-game ACTIVITY advances a research project. ACTIONS ONLY — a catch of a
 * species / in a biome / at a phase — the teaching axes the player already plays. ⚠️
 * NEVER time-elapsed (not wall-clock, not even in-game day-cycles): research is a
 * reward for PLAYING, never a passive timer (P8). The count is SMALL (anti-grind), and
 * the activity is reachable with the starter gear in an unlocked biome (anti-wall).
 */
export type ResearchActivity =
  | { kind: 'catch-species'; species: SpeciesId; count: number }
  | { kind: 'catch-in-biome'; biome: BiomeId; count: number }
  | { kind: 'catch-in-phase'; phase: DayPhase; count: number };

/**
 * What completing a project unlocks. R0a defines the TYPE; the consumers wire the
 * EFFECT later: `journal-layer` = a deeper dex entry the JournalPanel reads (R0b);
 * `grant-tool` = own a net via grantTool (R1); `shop-access` / `biome-access` (R1/R2).
 */
export type ResearchReward =
  | { kind: 'journal-layer'; layer: string }
  | { kind: 'grant-tool'; toolId: ToolId }
  | { kind: 'shop-access'; key: string }
  | { kind: 'biome-access'; biome: BiomeId }
  // §4.1.5 — unlock a research-gated BAIT for purchase in the shop (the 4th reward kind,
  // mirroring grant-tool / biome-access). "Is it unlocked" derives from the completed project.
  | { kind: 'bait-access'; bait: BaitId };

export interface ResearchProject {
  id: string;
  /** The AREA this project CONCERNS — its panel grouping (the research panel groups by
   *  area). A `biome-access` project belongs to the area it OPENS (its breadcrumb lives
   *  in that area's section); an internal project belongs to where its activity happens.
   *  A pure DATA tag — the engine never reads it; only the panel groups by it. */
  area: BiomeId;
  name: string;
  /** Naturalist framing — what it studies (P2/P5). */
  blurb: string;
  /** Credits to START the project (a sink — play is what ADVANCES it, not credits). */
  cost: number;
  /** The in-game ACTION that advances it. */
  activityRequirement: ResearchActivity;
  /** Optional credits to COMPLETE once the activity is done (a sink, not a lock). */
  creditTopUp?: number;
  /** ⚠️ A §4.1c mastery-challenge id (R2). Satisfied ONLY by `journal.missions[id]`
   *  completion — i.e. by PLAY (#48). Credits/activity CANNOT satisfy it (structural —
   *  research wraps a knowledge gate it cannot bypass; P1/P2/P3). */
  knowledgeRequirement?: string;
  /** Project ids that must be complete first. */
  prereq?: readonly string[];
  reward: ResearchReward;
}

/**
 * The research registry (read by the engine, like MISSIONS). R0a ships a small set of
 * low-stakes "research an animal / a habitat, learn more about it" projects whose reward
 * is a journal-knowledge layer — new + OPTIONAL, entangled with no critical path. R0b
 * adds the UI + applies the journal-layer effect; R1/R2 add the migrating projects.
 */
export const RESEARCH_PROJECTS: Record<string, ResearchProject> = {
  'study-hedgehog': {
    id: 'study-hedgehog',
    area: 'meadow',
    name: 'The Hedgehog at Dusk',
    blurb: 'Spend evenings with the meadow hedgehog to fill out its field-guide page.',
    cost: 8,
    activityRequirement: { kind: 'catch-species', species: 'hedgehog', count: 3 },
    reward: { kind: 'journal-layer', layer: 'hedgehog' },
  },
  'study-after-dark': {
    id: 'study-after-dark',
    area: 'meadow',
    name: 'Nocturnal Field Study',
    blurb: 'Work the meadow after dark — but first prove you can find a round-the-clock forager at night.',
    cost: 10,
    activityRequirement: { kind: 'catch-in-phase', phase: 'night', count: 3 },
    creditTopUp: 10, // a top-up to write up the study (a sink)
    knowledgeRequirement: 'research-mouse-night', // by PLAY only (#48) — never bought
    // R0b: the layer is a SPECIES id — completing this reveals the field mouse's research
    // note (the round-the-clock nocturnal forager the night challenge is about).
    reward: { kind: 'journal-layer', layer: 'fieldmouse' },
  },
  // R1 — the biome NETS are earned through research (study the habitat -> earn its gear,
  // P5). Research is the SINGLE acquisition path (the shop-buy retired); the activity is
  // done with the STARTER net (anti-lockout — you never need a net to earn a net).
  'study-the-wetland': {
    id: 'study-the-wetland',
    area: 'wetland',
    name: 'The Water’s Edge',
    blurb: 'Learn how the wetland’s creatures use the open water — and how to reach across it. Earns the dip-net.',
    cost: 20,
    activityRequirement: { kind: 'catch-in-biome', biome: 'wetland', count: 4 },
    reward: { kind: 'grant-tool', toolId: 'dip-net' },
  },
  'study-the-uplands': {
    id: 'study-the-uplands',
    area: 'highlands',
    name: 'The Open Tops',
    blurb: 'Learn the open highland ground, where there is no cover to close the gap. Earns the throwing net.',
    cost: 20,
    activityRequirement: { kind: 'catch-in-biome', biome: 'highlands', count: 4 },
    reward: { kind: 'grant-tool', toolId: 'throwing-net' },
  },
  // R2 (the finale) — the §4.1c Wetland->Highlands gate, WRAPPED in research. The Highlands
  // unlock now flows through this project's biome-access reward instead of auto-firing on
  // isBiomeGateMet. ⚠️ DOUBLE-enforced knowledge-by-play: the mastery challenge
  // (research-mouse-night) is required BOTH as this project's knowledgeRequirement (R0a
  // structural — un-bypassable by credits/activity) AND by the dispatch's isBiomeGateMet
  // re-check (the wetland set + the challenge). cost 0 — ZERO wall risk on core progression;
  // the gate's meaning is "demonstrate you understand this place" (mastery + the activity),
  // never a paywall (the credit sink lives in the OPTIONAL R0b/R1 projects).
  'unlock-the-highlands': {
    id: 'unlock-the-highlands',
    area: 'highlands',
    name: 'Highlands Access',
    blurb: 'Study the wetland thoroughly, then prove your tracking mastery — and the route up to the highlands opens.',
    cost: 0,
    activityRequirement: { kind: 'catch-in-biome', biome: 'wetland', count: 4 },
    knowledgeRequirement: 'research-mouse-night', // the §4.1c mastery challenge — by PLAY only
    reward: { kind: 'biome-access', biome: 'highlands' },
  },
  // §4.2 — RIVERBANK access (R2's pattern, generalized to the first NEW biome). cost 0 (the
  // Riverbank's species are win-required -> zero wall risk on core progression, like the
  // Highlands). knowledgeRequirement = research-rabbit-dawn (a NON-FORCED mastery challenge,
  // by PLAY) — double-enforced with the isUnlockGateMet re-check (the highlands set + the same
  // challenge). The activity is highlands study (you're there by now).
  'unlock-the-riverbank': {
    id: 'unlock-the-riverbank',
    area: 'riverbank',
    name: 'Riverbank Access',
    blurb: 'Master the high tops, prove your dawn field-craft, and the route down to the riverbank opens.',
    cost: 0,
    activityRequirement: { kind: 'catch-in-biome', biome: 'highlands', count: 4 },
    knowledgeRequirement: 'research-rabbit-dawn', // by PLAY only — the non-forced dawn catch
    reward: { kind: 'biome-access', biome: 'riverbank' },
  },
  // §4.1.5 — the FISH diet, research-gated (the 4th reward kind: bait-access). OPTIONAL
  // convenience (fish bait is a ×3.5 multiplier, never required — the kingfisher/otter are
  // catchable bait-less), so it carries a credit COST (a sink) and NO knowledgeRequirement
  // (not core-progression). Completing it unlocks fish bait for purchase in the Field Supply.
  'study-aquatic-life': {
    id: 'study-aquatic-life',
    area: 'riverbank',
    name: 'Aquatic Life',
    blurb: 'Study the river’s fish-eaters until you can match their diet — then the Field Supply stocks fish bait.',
    cost: 15,
    activityRequirement: { kind: 'catch-in-biome', biome: 'riverbank', count: 4 },
    reward: { kind: 'bait-access', bait: 'fish' },
  },
  // §4.2 — COAST access (R2's pattern again). cost 0 (Coast's species are win-required -> anti-
  // wall). knowledgeRequirement = research-mouse-dusk (a NON-FORCED dusk catch, by play —
  // double-enforced with the isUnlockGateMet re-check). The activity is riverbank study.
  'unlock-the-coast': {
    id: 'unlock-the-coast',
    area: 'coast',
    name: 'Coast Access',
    blurb: 'Follow the river to where it meets the sea, and learn the dusk meadow — then the shore opens.',
    cost: 0,
    activityRequirement: { kind: 'catch-in-biome', biome: 'riverbank', count: 4 },
    knowledgeRequirement: 'research-mouse-dusk', // by PLAY only — the non-forced dusk catch
    reward: { kind: 'biome-access', biome: 'coast' },
  },
};

/** Deterministic project order (offer + display). */
export const RESEARCH_ORDER: readonly string[] = [
  'study-hedgehog',
  'study-after-dark',
  'study-the-wetland',
  'study-the-uplands',
  'unlock-the-highlands',
  'unlock-the-riverbank',
  'study-aquatic-life',
  'unlock-the-coast',
];

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
  /** Nets & Gear slice A — the durable-net section. */
  netsHeader: 'Your Nets',
  /** Badge on the currently-equipped net. */
  equippedLabel: 'Equipped',
  /** Button on an owned-but-not-active net. */
  equipLabel: 'Equip',
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
