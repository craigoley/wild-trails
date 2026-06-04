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

/** A flat-shaded standard material (the low-poly facet look). */
function flatMat(color: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
}

/** Add a mesh at (x, y, z) to `g`, returning it for further tweaks. */
function add(g: Group, geo: BufferGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// ===========================================================================
// Player
// ===========================================================================

export function buildPlayerModel(): Group {
  const P = PLAYER_MODEL;
  const g = new Group();
  const body = flatMat(P.color);
  const accent = flatMat(P.accent);

  // Legs (accent = boots), from the ground up.
  for (const sx of [-1, 1]) {
    add(g, new CylinderGeometry(P.legRadius, P.legRadius, P.legHeight, SEG), accent,
      sx * P.legSpread, P.legHeight / 2, 0);
  }
  // Tapered torso.
  add(g, new CylinderGeometry(P.bodyRadiusTop, P.bodyRadiusBottom, P.bodyHeight, SEG), body,
    0, P.legHeight + P.bodyHeight / 2, 0);
  // Head.
  add(g, new SphereGeometry(P.headRadius, SEG, SEG), body,
    0, P.legHeight + P.bodyHeight + P.headRadius * 0.8, 0);
  // Arms hanging at the sides.
  for (const sx of [-1, 1]) {
    add(g, new CylinderGeometry(P.armRadius, P.armRadius, P.armLength, SEG), body,
      sx * (P.bodyRadiusTop + P.armRadius * 1.4), P.legHeight + P.bodyHeight - P.armLength / 2, 0);
  }
  return g;
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
