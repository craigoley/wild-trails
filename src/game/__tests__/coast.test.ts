import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_INFO,
  BIOMES,
  WATER,
  BIOME_SET_UNLOCK,
  RESEARCH_PROJECTS,
  PLAYER,
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock } from '../Missions';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { createJournal } from '../../state/Journal';
import { createWorld, isInWater } from '../World';

/**
 * World Expansion — COAST, the 2nd new biome (§4.2). Proves the data-slice pattern REPEATS:
 * a new tiled cell + 5 species (the fish-diet synergy) + an R2 gate. The SEA is the #55 disc
 * mechanic scaled up on the cell's OUTER edge — ⚠️ NOT covering the shared seam (the beach
 * stays walkable to the Riverbank). Honest diets + honest conservation status (soul-aware).
 */
const COAST = ['linnet', 'brentgoose', 'turnstone', 'herringgull', 'greyseal'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'coast', correctBait: false, fleeing: false });

describe('Coast — the biome + the sea (the large outer-edge water, seam clear)', () => {
  it('a tier-5 cell north of the Riverbank, sand/shingle', () => {
    expect(BIOMES.coast.tier).toBe(5);
    expect(BIOMES.coast.prereq).toBe('riverbank');
    expect(BIOMES.coast.bounds).toEqual({ minX: 20, minY: 100, maxX: 60, maxY: 140 }); // a new equal cell
  });

  it('⚠️ the SEA is a large #55 region on the OUTER edge; the beach by the seam stays WALKABLE', () => {
    const world = createWorld();
    const sea = WATER.filter((w) => w.biome === 'coast');
    expect(sea.length).toBeGreaterThanOrEqual(3); // a big sea (reused discs)
    // Every sea disc sits well clear of the y=100 seam to the Riverbank (its top edge stays north):
    for (const w of sea) expect(w.y - w.radius).toBeGreaterThan(110);
    // The sea is real (deep water to the north)...
    expect(isInWater(world, 40, 132, 0)).toBe(true);
    // ...but the beach at the seam (y≈100-115) is walkable — the player can cross from the Riverbank
    // and roam the shore (the barrier never walls off the biome connection).
    expect(isInWater(world, 40, 104, PLAYER.radius)).toBe(false);
    expect(isInWater(world, 30, 110, PLAYER.radius)).toBe(false);
  });
});

describe('Coast — the roster (honest diets + HONEST conservation status)', () => {
  it('5 species on the existing 4 diets — 2 fish-eaters (the synergy); honest, no fudge', () => {
    for (const id of COAST) {
      expect(SPECIES[id].biome).toBe('coast');
      expect(['seeds', 'greens', 'insects', 'fish']).toContain(SPECIES[id].bait);
      expect(SPECIES[id].tier).toBeGreaterThanOrEqual(4);
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20);
    }
    expect(new Set(COAST.map((id) => SPECIES[id].bait))).toEqual(new Set(['seeds', 'greens', 'insects', 'fish'])); // all 4 diets
    expect(COAST.filter((id) => SPECIES[id].bait === 'fish').sort()).toEqual(['greyseal', 'herringgull']); // the synergy
  });

  it('honest status: a declining species says so (linnet/gull red-listed); a recovering one says so (seal)', () => {
    expect(SPECIES_INFO.linnet.status.toLowerCase()).toContain('decline');
    expect(SPECIES_INFO.herringgull.status.toLowerCase()).toContain('decline'); // the soul-aware gut-punch
    expect(SPECIES_INFO.greyseal.status.toLowerCase()).toContain('success'); // a conservation success
  });

  it('the grey seal slips INTO the sea (fleesToWater — the apex water-diver, the dip-net moment)', () => {
    expect(SPECIES.greyseal.fleesToWater).toBe(true);
    for (const id of ['linnet', 'brentgoose', 'turnstone', 'herringgull'] as const) {
      expect(!!SPECIES[id].fleesToWater).toBe(false);
    }
  });
});

describe('Coast — ⚠️ anti-lockout (the easiest + the fish-eaters catchable bait-less)', () => {
  it('the linnet (valve) is comfortably catchable bait-less; ALL five catchable; the gull/seal too', () => {
    expect(baitlessStarter('linnet')).toBeGreaterThan(0.3); // the valve
    for (const id of COAST) expect(baitlessStarter(id)).toBeGreaterThan(0); // every species catchable bait-less
    // the fish-eaters are catchable WITHOUT fish bait (fish bait eases, never gates — #71 bound):
    expect(baitlessStarter('herringgull')).toBeGreaterThan(0);
    expect(baitlessStarter('greyseal')).toBeGreaterThan(0); // the apex (~0.12), still > 0
  });
});

describe('Coast — ⚠️ the research gate (R2 generalized; knowledge-by-play double-enforced)', () => {
  it('wired by DATA only: BIOME_SET_UNLOCK extended + a cost-0 biome-access project', () => {
    expect(BIOME_SET_UNLOCK.riverbank).toContain('coast'); // §4.2 — successor arrays (single-element here)
    expect(isResearchGatedUnlock('coast')).toBe(true);
    const p = RESEARCH_PROJECTS['unlock-the-coast'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'coast' });
    expect(p.cost).toBe(0); // win-required -> anti-wall
    expect(p.knowledgeRequirement).toBe('research-mouse-dusk');
  });

  it('the activity + a flush wallet do NOT unlock it without the mastery challenge (by play)', () => {
    const j = createJournal();
    addCredits(j, 1000);
    startResearch(j, 'unlock-the-coast');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('reedbunting', 'riverbank', 'day')); // activity done
    reconcileResearchUnlocks(j);
    expect(researchState(j, 'unlock-the-coast').completed).toBe(false); // the knowledge gate blocks it
    expect(j.unlockedBiomes).not.toContain('coast'); // STILL gated — knowledge by play

    evaluateCatch(j, ev('fieldmouse', 'meadow', 'dusk')); // research-mouse-dusk
    evaluateResearch(j, ev('reedbunting', 'riverbank', 'day')); // re-evaluate -> auto-complete
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('coast');
  });
});

describe('Coast — ⚠️ the NON-FORCED mastery challenge (the #48 inverse)', () => {
  it('normal play does NOT auto-satisfy research-mouse-dusk — the player must CHOOSE a DUSK mouse', () => {
    const j = createJournal();
    // The meadow set (any@dusk via the hedgehog; fieldmouse caught by DAY for the survey):
    for (let i = 0; i < 5; i++) evaluateCatch(j, ev('fieldmouse', 'meadow', 'day'));
    for (let i = 0; i < 2; i++) evaluateCatch(j, ev('hedgehog', 'meadow', 'dusk')); // meadow-dusk via hedgehog
    expect(j.missions['research-mouse-dusk']?.completed ?? false).toBe(false); // NOT auto-satisfied

    evaluateCatch(j, ev('fieldmouse', 'meadow', 'dusk')); // the deliberate choice
    expect(j.missions['research-mouse-dusk']?.completed).toBe(true);
  });
});
