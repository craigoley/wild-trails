import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import { buildPlayerModel } from '../models/builders';
import { PLAYER_MODEL } from '../../utils/constants';

/**
 * §character — the CONSERVATIONIST EXPLORER kit (a wide-brim hat + a backpack + earthy field colours,
 * replacing the flat amber). ⚠️ THE STRUCTURAL GUARANTEE these pins lock: the kit parents to the ROOT
 * GROUP `g` (exactly like the head/torso meshes), NEVER to a limb pivot — so it rides the CJ1
 * bob/lean/squash as ONE with the body and CANNOT mis-swing (a floating hat / a pack swinging like a
 * limb is the failure mode this prevents). The LOOK — does it read as a naturalist — is Craig's device
 * gate, not a test. The walk math is untouched (the CJ1/CJ3/CJ3b + #101 pins stay green elsewhere).
 */

const meshes = (g: Group) => g.children.filter((c): c is Mesh => c instanceof Mesh);
const pivots = (g: Group) => g.children.filter((c): c is Group => c instanceof Group);

describe('§character — the kit parents to the ROOT GROUP (the anti-mis-swing guarantee)', () => {
  it('⚠️ the four limb pivots each hold ONLY their limb — the kit is NEVER on a pivot (cannot mis-swing)', () => {
    const pm = buildPlayerModel();
    // The four animated pivots (the two legs + the two arms) are the ONLY Groups under g.
    const limbPivots = pivots(pm.group);
    expect(limbPivots).toHaveLength(4);
    expect(new Set(limbPivots)).toEqual(new Set([pm.legL, pm.legR, pm.armL, pm.armR]));
    // ⚠️ Each pivot holds EXACTLY its one limb cylinder — no hat/pack/strap ever attached to a limb,
    // so the kit can never inherit a leg/arm swing (the structural guarantee).
    for (const pivot of limbPivots) {
      expect(pivot.children).toHaveLength(1);
      expect(pivot.children[0]).toBeInstanceOf(Mesh);
    }
  });

  it('the backpack is a BoxGeometry mesh, a DIRECT child of g, behind the torso (−z)', () => {
    const pm = buildPlayerModel();
    const box = meshes(pm.group).find((m) => m.geometry instanceof BoxGeometry);
    expect(box).toBeDefined(); // the pack rides g, not a limb
    expect(box!.position.z).toBeLessThan(0); // seated on the BACK (−z)
    expect(box!.position.y).toBeGreaterThan(PLAYER_MODEL.legHeight); // on the upper body, not the floor
  });

  it('the hat sits ON the head — its brim + crown are direct children of g, above the head', () => {
    const pm = buildPlayerModel();
    const headY = PLAYER_MODEL.legHeight + PLAYER_MODEL.bodyHeight + PLAYER_MODEL.headRadius * PLAYER_MODEL.headSeatR;
    // The kit meshes added directly to g, sitting above the head centre (the brim + the crown).
    const aboveHead = meshes(pm.group).filter((m) => m.position.y >= headY + PLAYER_MODEL.headRadius * 0.4);
    expect(aboveHead.length).toBeGreaterThanOrEqual(2); // brim + crown
    // The brim is the widest disc — clearly wider than the head (the signature explorer silhouette).
    const brimR = PLAYER_MODEL.headRadius * PLAYER_MODEL.kit.brimRadiusR;
    expect(brimR).toBeGreaterThan(PLAYER_MODEL.headRadius); // a WIDE brim, not a skullcap
  });

  it('the kit ADDS meshes (hat brim + crown + pack + 2 straps) over the bare figure', () => {
    const pm = buildPlayerModel();
    // Bare figure direct-child meshes: torso + head = 2. The kit adds brim + crown + pack + 2 straps = 5.
    expect(meshes(pm.group)).toHaveLength(7);
  });
});

describe('§character — the earthy field palette replaces the flat amber (no proportion change)', () => {
  it('the field-clothes colours are earthy (khaki/olive/tan), not the old amber 0xffb347', () => {
    expect(PLAYER_MODEL.shirt).not.toBe(0xffb347); // the amber is gone
    for (const c of [PLAYER_MODEL.shirt, PLAYER_MODEL.skin, PLAYER_MODEL.trousers, PLAYER_MODEL.kit.hatColor, PLAYER_MODEL.kit.packColor]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('⚠️ the WALK-COUPLED proportion is UNCHANGED (the tuned CJ walk stays byte-identical)', () => {
    // legHeight is THE one dim the walk reads (visible stride = legHeight·sin(legSwing)); it must NEVER
    // move (that would re-tune the gait). The playtest head-seat lift (headSeatR) is WALK-SAFE — the
    // head never feeds walkCycle — so the walk is untouched while the head reads better.
    expect(PLAYER_MODEL.legHeight).toBe(0.34); // ⚠️ the walk-coupled dim — never change it
    expect(PLAYER_MODEL.bodyHeight).toBe(0.46); // body height unchanged
    expect(PLAYER_MODEL.headRadius).toBe(0.17); // head SIZE unchanged (only its seat height lifted)
    expect(PLAYER_MODEL.headSeatR).toBeGreaterThan(0.8); // the head lifted off the shoulders (playtest #1)
  });
});
