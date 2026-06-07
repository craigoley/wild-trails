import { describe, expect, it } from 'vitest';
import { finalCatchChance } from '../Catch';
import { gateReach, nearestCatchable, createAnimalPool, spawnAnimal, type Animal } from '../Animal';
import { equipTool, ownsTool, grantTool } from '../Tools';
import { createJournal } from '../../state/Journal';
import { TOOLS, SPECIES, CATCH, type SpeciesId, type ToolId } from '../../utils/constants';

/**
 * Nets & Gear slice B1 — the lateral biome nets. The keystone: every net's odds are
 * identical (base reach 2.6 -> proximity net-independent); a biome net only widens the
 * GATE in its condition. No net is better; each makes ITS situation workable.
 */
const ctx = (tool: ToolId, dist: number, biome: string) =>
  ({ dist, tool, biome, correctBait: false, fleeing: false }) as Parameters<typeof finalCatchChance>[1];
const animal = (species: SpeciesId, inWater: boolean) => ({ species, inWater }) as Animal;

describe('B1 #1 — the 2 lateral nets exist (no rate boost; condition gate-reach)', () => {
  it('dip-net + throwing-net: catchMultiplier 1.0, base reach 2.6, condition extensions 8 / 7', () => {
    for (const id of ['dip-net', 'throwing-net'] as const) {
      expect(TOOLS[id].catchMultiplier).toBe(1.0); // LATERAL — no flat catch-rate boost
      expect(TOOLS[id].reach).toBe(2.6); // same base as the hand net -> net-independent odds
    }
    expect(TOOLS['dip-net'].reachInWater).toBe(8); // clears the W pond gap (~6.5 from shore)
    expect(TOOLS['throwing-net'].reachOpen).toBe(7); // range on C's open ground
    expect(TOOLS.net.reachInWater).toBeUndefined(); // the hand net has NO condition edge
    expect(TOOLS.net.reachOpen).toBeUndefined();
  });
});

describe('B1 #2 — ⚠️ LATERAL: identical ODDS, condition-extended GATE (the crux)', () => {
  it('the catch CHANCE at a given distance is IDENTICAL for all 3 nets (Catch.ts not net-boosted)', () => {
    const frog = SPECIES.frog;
    for (const d of [0.5, 1.5, 2.5]) {
      const base = finalCatchChance(frog, ctx('net', d, 'wetland'));
      expect(finalCatchChance(frog, ctx('dip-net', d, 'wetland'))).toBe(base);
      expect(finalCatchChance(frog, ctx('throwing-net', d, 'wetland'))).toBe(base);
    }
  });

  it('the dip-net GATE reaches an IN-WATER target (8); the hand net cannot; on LAND both are 2.6', () => {
    expect(gateReach('dip-net', animal('frog', true))).toBe(8); // reaches the fled frog across water
    expect(gateReach('net', animal('frog', true))).toBe(2.6); // hand net cannot reach it
    expect(gateReach('dip-net', animal('frog', false))).toBe(2.6); // on land — NO advantage
    expect(gateReach('net', animal('frog', false))).toBe(2.6);
  });

  it('the throwing-net GATE ranges in an OPEN biome (7); not in cover-rich biomes (2.6)', () => {
    expect(gateReach('throwing-net', animal('ptarmigan', false))).toBe(7); // highlands = open
    expect(gateReach('throwing-net', animal('fieldmouse', false))).toBe(2.6); // meadow = cover-rich
    expect(gateReach('net', animal('ptarmigan', false))).toBe(2.6); // hand net is always 2.6
  });

  it('nearestCatchable: the dip-net reaches a far in-water frog the hand net cannot; on land neither can', () => {
    const pool = createAnimalPool();
    const frog = spawnAnimal(pool, 'frog', 5, 0)!; // 5 units away — beyond 2.6, within 8
    frog.inWater = true;
    expect(nearestCatchable(pool, 0, 0, 'dip-net')).toBeGreaterThanOrEqual(0);
    expect(nearestCatchable(pool, 0, 0, 'net')).toBe(-1); // hand net: 5 > 2.6
    frog.inWater = false; // on land the dip-net is also just 2.6
    expect(nearestCatchable(pool, 0, 0, 'dip-net')).toBe(-1);
  });
});

describe('B1 #4 — acquisition via the grantTool seam (research-driven as of R1)', () => {
  it('grantTool owns a net (idempotent) -> equip; the swappable seam research uses', () => {
    const j = createJournal();
    expect(grantTool(j, 'dip-net')).toBe(true);
    expect(ownsTool(j, 'dip-net')).toBe(true);
    expect(grantTool(j, 'dip-net')).toBe(false); // already owned -> idempotent no-op
    equipTool(j, 'dip-net');
    expect(j.activeTool).toBe('dip-net');

    // Both biome nets ride the SAME seam — research-completion grants them (R1); a
    // pre-R1 save where one was already owned just stays owned (a re-grant is a no-op).
    expect(grantTool(j, 'throwing-net')).toBe(true);
    expect(ownsTool(j, 'throwing-net')).toBe(true);
  });
});

describe('B1 #5 — ⚠️ anti-lockout: the STARTER hand net still catches everything', () => {
  it("every biome's easiest species is catchable with the starter hand net (nets never required)", () => {
    const easiest: SpeciesId[] = ['hedgehog', 'redsquirrel', 'mallard', 'ptarmigan'];
    for (const id of easiest) {
      const sp = SPECIES[id];
      const chance = finalCatchChance(sp, ctx('net', 0.5, sp.biome));
      expect(chance).toBeGreaterThan(0); // catchable bait-less with the starter
      expect(gateReach('net', animal(id, false))).toBe(2.6); // reachable when close
    }
    // The wetland easiest (mallard) does NOT flee to water -> not gated behind the dip-net.
    expect(SPECIES.mallard.fleesToWater).toBeUndefined();
  });

  it('the catch-core invariant holds: the starter reach is still 2.6 (= attemptRadius)', () => {
    expect(TOOLS.net.reach).toBe(CATCH.attemptRadius);
  });
});
