/**
 * Procedural low-poly model builders — render-only, ZERO assets. Each function
 * assembles a THREE.Group of primitives (capsules / spheres / cones / cylinders)
 * for one entity kind. Built foot-origin (lowest point at y = 0) and facing +z,
 * so the renderer can plant the Group on the ground, rotate it toward travel, and
 * squash it toward the ground (feet stay planted) with no extra bookkeeping.
 *
 * Flat-shaded materials give the faceted Monument-Valley read. All dimensions and
 * colours come from constants — no magic numbers here. Each model is built ONCE
 * (the renderer pools the Groups); nothing here runs per frame.
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
} from 'three';
import {
  ANIMAL_MODEL_BASE,
  MODEL_SEGMENTS,
  PLAYER_MODEL,
  SPECIES_MODEL,
  type SpeciesDef,
} from '../../utils/constants';

const SEG = MODEL_SEGMENTS;

/** §4.2 PINE — the LEGIBILITY render order. Entities (player + animals) draw OVER the world props
 *  (renderOrder + depthTest:false), so a tall tree can NEVER hide what you're trying to catch — the
 *  closed Pine Forest stays playable, and every biome reads cleaner. Structural, not tuning. */
const ENTITY_RENDER_ORDER = 10;

/** A flat-shaded standard material (the low-poly facet look). `depthTest:false` makes entities
 *  composite over the world (paired with the high renderOrder below) — the occlusion fix. */
function flatMat(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, depthTest: false });
}

/** Add a mesh at (x, y, z) to `g`, returning it for further tweaks. Entity meshes get the high
 *  render order so they draw after (over) the world. */
function add(g: Group, geo: BufferGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.renderOrder = ENTITY_RENDER_ORDER;
  g.add(m);
  return m;
}

// ===========================================================================
// Player
// ===========================================================================

/** The player model + the limb pivots the renderer swings: the two leg hip-pivots (CJ3) and the two
 *  arm shoulder-pivots (CJ3b). The pivots are children of `group`, so they ride the body's bob/lean;
 *  the renderer just rotates them about x (legs in opposition, arms contralateral to the legs). */
export interface PlayerModel {
  group: Group;
  legL: Group;
  legR: Group;
  armL: Group;
  armR: Group;
}

export function buildPlayerModel(): PlayerModel {
  const P = PLAYER_MODEL;
  const g = new Group();
  // §character — the field-clothes palette (replacing the flat amber): a khaki-olive shirt (torso +
  // sleeves), a tan-stone trouser, a neutral-tan head. The earthy brown stays the strap/boot accent.
  const shirt = flatMat(P.shirt);
  const skin = flatMat(P.skin);
  const trousers = flatMat(P.trousers);

  // Legs (trousers). CJ3: each leg hangs from a HIP PIVOT at y = legHeight, the cylinder
  // offset DOWN by legHeight/2 so its foot is at y = 0 and its top at the pivot. At rotation.x = 0
  // this is byte-identical to the old fixed leg (centre y = legHeight/2) — so a STILL player's POSE
  // is exactly as before (only the colour changed); the renderer swings the pivot to walk.
  const legPivots: Group[] = [];
  for (const sx of [-1, 1]) {
    const hip = new Group();
    hip.position.set(sx * P.legSpread, P.legHeight, 0);
    add(hip, new CylinderGeometry(P.legRadius, P.legRadius, P.legHeight, SEG), trousers, 0, -P.legHeight / 2, 0);
    g.add(hip);
    legPivots.push(hip);
  }
  const [legL, legR] = legPivots; // index 0 = left (sx −1), index 1 = right (sx +1)
  // Tapered torso (shirt).
  add(g, new CylinderGeometry(P.bodyRadiusTop, P.bodyRadiusBottom, P.bodyHeight, SEG), shirt,
    0, P.legHeight + P.bodyHeight / 2, 0);
  // Head (skin). headY is reused below to seat the hat. headSeatR lifts the head so it sits cleanly ON
  // the shoulders (a head wearing a hat), not sunk into the torso.
  const headY = P.legHeight + P.bodyHeight + P.headRadius * P.headSeatR;
  add(g, new SphereGeometry(P.headRadius, SEG, SEG), skin, 0, headY, 0);
  // Arms hanging at the sides (shirt sleeves). CJ3b: each arm hangs from a SHOULDER PIVOT at the body
  // top (y = legHeight + bodyHeight), the cylinder offset DOWN by armLength/2 so the hand is at the
  // bottom and the top at the pivot. At rotation.x = 0 this is byte-identical to the old fixed arm —
  // a STILL player's POSE is unchanged; the renderer swings it.
  const shoulderY = P.legHeight + P.bodyHeight;
  const armPivots: Group[] = [];
  for (const sx of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(sx * (P.bodyRadiusTop + P.armRadius * 1.4), shoulderY, 0);
    add(shoulder, new CylinderGeometry(P.armRadius, P.armRadius, P.armLength, SEG), shirt, 0, -P.armLength / 2, 0);
    g.add(shoulder);
    armPivots.push(shoulder);
  }
  const [armL, armR] = armPivots; // index 0 = left (sx −1), index 1 = right (sx +1)

  // ⚠️ §character — THE FIELD KIT. Every piece parents to `g` (the ROOT group), exactly like the
  // head/torso meshes above — NOT to a leg/arm pivot. So the kit rides the CJ1 bob/lean/squash as ONE
  // with the body and CANNOT mis-swing (a limb's swing never reaches it). Built once; no per-frame work.
  const K = P.kit;
  const hatMat = flatMat(K.hatColor);
  const packMat = flatMat(K.packColor);
  const strapMat = flatMat(K.strapColor);
  // The wide-brim hat: a thin brim disc high on the head + a rounded DOME crown on it (the bush-hat read).
  const brimY = headY + P.headRadius * K.brimRaiseR;
  add(g, new CylinderGeometry(P.headRadius * K.brimRadiusR, P.headRadius * K.brimRadiusR, K.brimThickness, SEG),
    hatMat, 0, brimY, 0);
  // A low dome (a flattened sphere) seated AT the brim — its lower half tucks behind the head/brim, its
  // visible upper half is the crown. Rounder + more hat-like than the old flat-topped cylinder.
  const crown = add(g, new SphereGeometry(P.headRadius * K.crownRadiusR, SEG, SEG), hatMat, 0, brimY, 0);
  crown.scale.set(1, K.crownDomeFlatten, 1);
  // The backpack: a rounded box on the UPPER BACK (−z, behind the torso), seated on the upper body.
  add(g, new BoxGeometry(K.packWidth, K.packHeight, K.packDepth), packMat,
    0, P.legHeight + P.bodyHeight * K.packRaiseR, -(P.bodyRadiusTop + K.packDepth / 2));
  // Two shoulder straps over the front (+z) — thin vertical cylinders that tie the pack on.
  for (const sx of [-1, 1]) {
    add(g, new CylinderGeometry(K.strapRadius, K.strapRadius, K.strapLength, SEG), strapMat,
      sx * K.strapSpread, shoulderY - K.strapLength / 2, P.bodyRadiusTop + K.strapRadius);
  }
  return { group: g, legL, legR, armL, armR };
}

// ===========================================================================
// Animals
// ===========================================================================

/** Build the model for a species (dispatch by its configured kind). */
export function buildAnimalModel(def: SpeciesDef): Group {
  const kind = SPECIES_MODEL[def.id].kind;
  switch (kind) {
    case 'bird':
      return buildBird(def);
    case 'hedgehog':
      return buildHedgehog(def);
    case 'frog':
      return buildFrog(def);
    default:
      return buildQuadruped(def); // mouse + rabbit + squirrel share the quadruped base
  }
}

/** A squat frog: a low wide body, two big eye-bumps near the front, and folded
 *  back haunches (the jumper's legs). Its own minimal build — zero assets. */
function buildFrog(def: SpeciesDef): Group {
  const B = ANIMAL_MODEL_BASE;
  const cfg = SPECIES_MODEL[def.id];
  const s = def.size;
  const g = new Group();
  const body = flatMat(def.color);
  const accent = flatMat(cfg.accent);

  const bodyR = s * B.bodyRadiusR * 1.3; // wide for its height
  const bodyY = bodyR * 0.55; // sits low to the ground
  const bodyMesh = add(g, new SphereGeometry(bodyR, SEG, SEG), body, 0, bodyY, 0);
  bodyMesh.scale.set(1.15, 0.7, 1.3); // flattened + stretched forward

  // Two big eye-bumps on top, near the front.
  const eyeR = s * (cfg.eyeRadiusR ?? 0.25);
  const eyeY = bodyY + bodyR * 0.45;
  const eyeZ = bodyR * 0.55;
  for (const sx of [-1, 1]) {
    add(g, new SphereGeometry(eyeR, SEG, SEG), accent, sx * bodyR * 0.4, eyeY, eyeZ);
  }

  // Folded back haunches — two angled bumps at the rear.
  const hauR = bodyR * 0.55;
  for (const sx of [-1, 1]) {
    const hau = add(g, new SphereGeometry(hauR, SEG, SEG), body, sx * bodyR * 0.7, bodyY, -bodyR * 0.6);
    hau.scale.set(0.7, 0.7, 1.1);
  }
  return g;
}

/** Shared quadruped: capsule body along z, four legs, head + snout at +z. */
function buildQuadruped(def: SpeciesDef): Group {
  const B = ANIMAL_MODEL_BASE;
  const cfg = SPECIES_MODEL[def.id];
  const s = def.size;
  const g = new Group();
  const body = flatMat(def.color);
  const accent = flatMat(cfg.accent);

  const bodyR = s * B.bodyRadiusR;
  const bodyLen = s * B.bodyLengthR;
  const legH = s * B.legHeightR;
  const headR = s * B.headRadiusR;
  const bodyY = legH + bodyR;

  // Body capsule, laid along z (rotate the default y-axis capsule by 90°).
  const cyl = Math.max(0.001, bodyLen - bodyR * 2);
  const bodyMesh = add(g, new CapsuleGeometry(bodyR, cyl, 3, SEG), body, 0, bodyY, 0);
  bodyMesh.rotation.x = Math.PI / 2;

  // Four legs at the body corners.
  const legZ = (bodyLen / 2) * B.legInsetR;
  const legX = bodyR * 0.8;
  const legR = s * B.legRadiusR;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(g, new CylinderGeometry(legR, legR, legH, SEG), body, sx * legX, legH / 2, sz * legZ);
    }
  }

  // Head + snout at the front (+z).
  const headZ = (bodyLen / 2) * B.headForwardR;
  add(g, new SphereGeometry(headR, SEG, SEG), body, 0, bodyY + bodyR * 0.3, headZ);
  const snout = add(g, new ConeGeometry(s * B.snoutRadiusR, s * B.snoutLengthR, SEG), accent,
    0, bodyY + bodyR * 0.2, headZ + headR);
  snout.rotation.x = Math.PI / 2; // point +z

  // Ears on the head.
  const earH = s * (cfg.earHeightR ?? 0.3);
  const earR = s * (cfg.earRadiusR ?? 0.2);
  for (const sx of [-1, 1]) {
    const ear = add(g, new ConeGeometry(earR, earH, SEG), body,
      sx * headR * 0.5, bodyY + bodyR * 0.3 + headR * 0.8, headZ);
    ear.rotation.x = -0.2; // tilt slightly back
  }

  // Tail at the back (-z): rabbit = round bobtail; squirrel = big bushy upright
  // tail (the signature read); mouse + others = long thin cylinder.
  if (cfg.kind === 'rabbit') {
    add(g, new SphereGeometry(s * (cfg.tailRadiusR ?? 0.2), SEG, SEG), accent, 0, bodyY, -bodyLen / 2);
  } else if (cfg.kind === 'squirrel') {
    const tailR = s * (cfg.tailRadiusR ?? 0.4);
    const tailLen = s * (cfg.tailLengthR ?? 1.4);
    const tail = add(g, new CapsuleGeometry(tailR, tailLen, 3, SEG), accent,
      0, bodyY + tailLen * 0.4, -bodyLen / 2 - tailR * 0.4);
    tail.rotation.x = 0.5; // arc up-and-back behind the body
  } else {
    const tailLen = s * (cfg.tailLengthR ?? 1.2);
    const tail = add(g, new CylinderGeometry(s * (cfg.tailRadiusR ?? 0.05), s * (cfg.tailRadiusR ?? 0.05), tailLen, SEG),
      accent, 0, bodyY, -bodyLen / 2 - tailLen / 2);
    tail.rotation.x = Math.PI / 2;
  }
  return g;
}

/** A plump bird: round upright body, two stub legs, head + beak + crest. */
function buildBird(def: SpeciesDef): Group {
  const B = ANIMAL_MODEL_BASE;
  const cfg = SPECIES_MODEL[def.id];
  const s = def.size;
  const g = new Group();
  const body = flatMat(def.color);
  const accent = flatMat(cfg.accent);

  const bodyR = s * B.bodyRadiusR * 1.15; // rounder than the quadruped
  const legH = s * B.legHeightR * 0.7; // short stubs
  const headR = s * B.headRadiusR * 0.85;
  const bodyY = legH + bodyR;

  // Egg-ish body (a slightly squashed sphere).
  const bodyMesh = add(g, new SphereGeometry(bodyR, SEG, SEG), body, 0, bodyY, 0);
  bodyMesh.scale.set(1, 1.1, 1.25);

  // Two stub legs.
  const legR = s * B.legRadiusR * 0.8;
  for (const sx of [-1, 1]) {
    add(g, new CylinderGeometry(legR, legR, legH, SEG), accent, sx * bodyR * 0.4, legH / 2, 0);
  }

  // Head high on the front, beak + crest.
  const headY = bodyY + bodyR * 0.7;
  const headZ = bodyR * 0.55;
  add(g, new SphereGeometry(headR, SEG, SEG), body, 0, headY, headZ);
  const beak = add(g, new ConeGeometry(s * B.snoutRadiusR * 0.7, s * (cfg.beakLengthR ?? 0.4), SEG), accent,
    0, headY, headZ + headR);
  beak.rotation.x = Math.PI / 2;
  const crest = add(g, new ConeGeometry(headR * 0.3, s * (cfg.crestHeightR ?? 0.6), SEG), accent,
    0, headY + headR, headZ);
  crest.rotation.x = -0.5; // jaunty forward-flick plume
  return g;
}

/** A low round body bristling with spikes, small snout, tiny legs. */
function buildHedgehog(def: SpeciesDef): Group {
  const B = ANIMAL_MODEL_BASE;
  const cfg = SPECIES_MODEL[def.id];
  const s = def.size;
  const g = new Group();
  const body = flatMat(def.color);
  const accent = flatMat(cfg.accent);

  const bodyR = s * B.bodyRadiusR * 1.2;
  const legH = s * B.legHeightR * 0.5;
  const bodyY = legH + bodyR * 0.85;

  // Squashed dome body.
  const dome = add(g, new SphereGeometry(bodyR, SEG, SEG), body, 0, bodyY, 0);
  dome.scale.set(1.1, 0.8, 1.25);

  // Snout at the front.
  const snout = add(g, new ConeGeometry(s * B.snoutRadiusR * 0.8, s * B.snoutLengthR, SEG), accent,
    0, bodyY - bodyR * 0.2, bodyR * 1.15);
  snout.rotation.x = Math.PI / 2;

  // Tiny legs.
  const legR = s * B.legRadiusR * 0.8;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(g, new CylinderGeometry(legR, legR, legH, SEG), accent, sx * bodyR * 0.5, legH / 2, sz * bodyR * 0.5);
    }
  }

  // Spikes radiating from the back hemisphere.
  const count = cfg.spikeCount ?? 14;
  const spikeLen = s * (cfg.spikeLengthR ?? 0.8);
  const spikeGeo = new ConeGeometry(s * B.legRadiusR * 0.9, spikeLen, 5);
  for (let i = 0; i < count; i++) {
    // Distribute over the upper dome in a small spiral.
    const t = (i + 0.5) / count;
    const theta = t * Math.PI * 2 * 3; // a few turns around
    const phi = t * Math.PI * 0.42; // from top toward the sides
    const dx = Math.sin(phi) * Math.cos(theta);
    const dz = Math.sin(phi) * Math.sin(theta);
    const dy = Math.cos(phi);
    const spike = add(g, spikeGeo, body, dx * bodyR, bodyY + dy * bodyR * 0.8, dz * bodyR);
    // Point the cone outward along (dx, dy, dz).
    spike.lookAt(spike.position.x + dx, spike.position.y + dy, spike.position.z + dz);
    spike.rotateX(Math.PI / 2); // cones point +y; align to lookAt's +z
  }
  return g;
}
