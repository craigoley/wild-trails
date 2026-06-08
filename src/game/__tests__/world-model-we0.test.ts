import { describe, expect, it } from 'vitest';
import {
  BIOMES,
  BIOME_ORDER,
  BIOME_SET_UNLOCK,
  BIOME_GATE_CHALLENGES,
  type BiomeId,
} from '../../utils/constants';

/**
 * World Expansion WE0 — the behavior-NEUTRAL metadata refactor. tier + prereq are ADDITIVE
 * structure on BiomeDef; nothing reads them for unlocking yet (the existing logic still runs
 * off BIOME_SET_UNLOCK), so the current 4 biomes behave EXACTLY as before. These pins are the
 * keystone (mirroring B0's "starter reach unchanged"): the 4 bounds are byte-identical, the
 * starting state is unchanged, and the new metadata DESCRIBES the real chain (never changes it).
 * The unlock BEHAVIOR itself is proven unchanged by the untouched L1 progression-to-win guards.
 */
describe('World model WE0 — ⚠️ the current 4 are byte-identical (behavior-neutral keystone)', () => {
  it('the 4 biomes + their bounds are unchanged (no shifted bound; still exactly the 2x2 cells)', () => {
    expect(BIOME_ORDER).toEqual(['meadow', 'woodland', 'wetland', 'highlands']); // still the 4
    // The exact cell rects (halfSize 20, pitch 40) — a shifted bound fails here.
    expect(BIOMES.meadow.bounds).toEqual({ minX: -20, minY: -20, maxX: 20, maxY: 20 });
    expect(BIOMES.woodland.bounds).toEqual({ minX: -20, minY: 20, maxX: 20, maxY: 60 });
    expect(BIOMES.wetland.bounds).toEqual({ minX: 20, minY: -20, maxX: 60, maxY: 20 });
    expect(BIOMES.highlands.bounds).toEqual({ minX: 20, minY: 20, maxX: 60, maxY: 60 });
  });

  it('the starting unlock state is unchanged (only the Meadow open)', () => {
    expect(BIOMES.meadow.unlocked).toBe(true);
    for (const id of ['woodland', 'wetland', 'highlands'] as BiomeId[]) {
      expect(BIOMES[id].unlocked).toBe(false);
    }
  });
});

describe('World model WE0 — the tier + prereq metadata', () => {
  it('the tier ladder: meadow 0 -> woodland 1 -> wetland 2 -> highlands 3', () => {
    expect(BIOMES.meadow.tier).toBe(0); // the hub
    expect(BIOMES.woodland.tier).toBe(1);
    expect(BIOMES.wetland.tier).toBe(2);
    expect(BIOMES.highlands.tier).toBe(3);
  });

  it('⚠️ prereq RE-EXPRESSES the current chain unchanged (it is BIOME_SET_UNLOCK’s inverse)', () => {
    expect(BIOMES.meadow.prereq).toBeUndefined(); // the hub has no prereq
    expect(BIOMES.woodland.prereq).toBe('meadow');
    expect(BIOMES.wetland.prereq).toBe('woodland');
    expect(BIOMES.highlands.prereq).toBe('wetland');
    // Each non-hub biome's prereq is the SOURCE of its BIOME_SET_UNLOCK entry, and the tier
    // climbs by exactly one along the chain — the metadata describes the REAL chain, never alters it.
    for (const id of BIOME_ORDER) {
      const prereq = BIOMES[id].prereq;
      if (prereq === undefined) continue;
      expect(BIOME_SET_UNLOCK[prereq]).toBe(id);
      expect(BIOMES[id].tier).toBe(BIOMES[prereq].tier + 1);
    }
  });

  it('the Highlands research-WRAP is intact (R2 unchanged — escalated, not flattened by WE0)', () => {
    // The Highlands prereq names the set (wetland); the escalation — research-mouse-night — is
    // STILL on BIOME_GATE_CHALLENGES. WE0 added descriptive metadata; it did not touch the wrap.
    expect(BIOME_GATE_CHALLENGES.wetland).toContain('research-mouse-night');
  });
});
