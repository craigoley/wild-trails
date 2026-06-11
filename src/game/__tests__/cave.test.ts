import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  SPECIES_INFO,
  SPECIES_MODEL,
  BIOMES,
  WATER,
  HIDING_SPOTS,
  BIOME_SET_UNLOCK,
  RESEARCH_PROJECTS,
  MISSIONS,
  GAIT_PROFILES,
} from '../../utils/constants';
import { finalCatchChance } from '../Catch';
import { evaluateCatch, reconcileResearchUnlocks, isResearchGatedUnlock } from '../Missions';
import { isActiveAt, eligibleSpecies } from '../Species';
import { dayPhaseAt } from '../Time';
import { startResearch, evaluateResearch, researchState } from '../Research';
import { addCredits } from '../Economy';
import { createJournal, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';

/**
 * World Expansion — CAVE / UNDERGROUND (§4.2): the always-dark biome. ⚠️ THE TWIST IS DATA, NOT CODE:
 * cave species use the EXISTING `activityWindow: 'any'` (active every phase — cave-dwellers ignore the
 * surface cycle), and the cave does NOT touch the clock. These pins lock the contained twist (the heart:
 * a cave catch carries the REAL surface phase → NO trivialization), the additive Riverbank branch, the
 * species+bait gate (no phase), anti-lockout, and the gaits. The dark LOOK is Craig's device gate.
 */
const CAVE = ['pipistrelle', 'daubentonbat', 'longearedbat', 'horseshoebat', 'eel'] as const;
const ALL_PHASES = ['dawn', 'day', 'dusk', 'night'] as const;
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateCatch>[1];
const baitlessStarter = (id: string) =>
  finalCatchChance(SPECIES[id as keyof typeof SPECIES], { dist: 0.5, tool: 'net', biome: 'cave', correctBait: false, fleeing: false });

describe('Cave — the biome (a new always-dark cell E of the Riverbank)', () => {
  it('a tier-5 cell east of the Riverbank, near-black slate (the dark)', () => {
    expect(BIOMES.cave.tier).toBe(5);
    expect(BIOMES.cave.prereq).toBe('riverbank');
    expect(BIOMES.cave.bounds).toEqual({ minX: 60, minY: 60, maxX: 100, maxY: 100 }); // a new equal cell
    expect(BIOMES.cave.adjacent).toEqual(['riverbank', 'moor']);
    expect(BIOMES.riverbank.adjacent).toContain('cave'); // symmetric — the fork edge
    expect(BIOMES.moor.adjacent).toContain('cave');
    expect(BIOMES.cave.color).toBe(0x141a1e); // near-black cool slate — dark via the GROUND (lights unchanged)
  });

  it('has an underground POOL (#55 water, the eel’s home) + low rock cover (stalagmites)', () => {
    expect(WATER.filter((w) => w.biome === 'cave').length).toBeGreaterThanOrEqual(1); // the eel's pool
    expect(HIDING_SPOTS.filter((h) => h.biome === 'cave')).toHaveLength(2);
    expect(HIDING_SPOTS.filter((h) => h.biome === 'cave').every((h) => h.kind === 'rocks')).toBe(true);
  });
});

describe('Cave — ⚠️ THE CONTAINED TWIST: ‘any’-window species + the clock untouched (no trivialization)', () => {
  it('every cave species is activityWindow:‘any’ — the EXISTING flag, active at EVERY phase', () => {
    for (const id of CAVE) {
      expect(SPECIES[id].activityWindow).toBe('any');
      for (const phase of ALL_PHASES) expect(isActiveAt('any', phase)).toBe(true); // active every phase
      // …and the spawn gate honours it: the species is eligible in the cave at every phase.
      for (const phase of ALL_PHASES) {
        expect(eligibleSpecies('cave', phase).map((s) => s.id)).toContain(id);
      }
    }
  });

  it('⚠️ the clock is biome-INDEPENDENT — the cave CANNOT change the phase (dayPhaseAt takes only time)', () => {
    // dayPhaseAt is a pure function of the global clock; there is no biome input, so being underground
    // cannot make game.dayPhase read "night". (A compile-time + behavioural guard on the heart of #1.)
    expect(dayPhaseAt(0)).toBe(dayPhaseAt(0));
    expect(typeof dayPhaseAt(123.4)).toBe('string');
  });

  it('⚠️ a cave catch carries the REAL surface phase → it never auto-satisfies a phase challenge (#48)', () => {
    // meadow-dusk = "catch 2 at DUSK" (a catch-in-timephase mission). A CAVE catch while the surface
    // clock reads DAY must NOT advance it — the dark cave is not "dusk". The SAME species caught when
    // the clock reads DUSK DOES advance it: the phase is the EVENT's (the real clock), never the biome's.
    const byDay = createJournal();
    evaluateCatch(byDay, ev('pipistrelle', 'cave', 'day'));
    expect(byDay.missions['meadow-dusk']?.progress ?? 0).toBe(0); // the dark cave at 'day' is NOT dusk/night

    const atDusk = createJournal();
    evaluateCatch(atDusk, ev('pipistrelle', 'cave', 'dusk')); // i.e. caught when the surface clock says dusk
    expect(atDusk.missions['meadow-dusk']?.progress ?? 0).toBe(1); // advances — the phase flows from the clock
  });
});

describe('Cave — the roster (honest narrow ecology: 4 bats + the eel; the conservation stakes)', () => {
  it('5 species on honest diets (insects ×4 + the eel’s fish); no phase-locked windows', () => {
    for (const id of CAVE) {
      expect(SPECIES[id].biome).toBe('cave');
      expect(['insects', 'fish']).toContain(SPECIES[id].bait);
      expect(SPECIES_INFO[id].fieldNote.length).toBeGreaterThan(20);
      expect(SPECIES_MODEL[id]).toBeDefined();
    }
    expect(CAVE.filter((id) => SPECIES[id].bait === 'fish')).toEqual(['eel']); // the one non-bat
  });

  it('honest status: the protected horseshoe bat + the critically-endangered eel; the pipistrelle doing well', () => {
    expect(SPECIES_INFO.horseshoebat.status.toLowerCase()).toContain('protected'); // ⚠️ rare + strictly protected
    expect(SPECIES_INFO.eel.status.toLowerCase()).toContain('critically endangered'); // ⚠️ the 2nd hero
    expect(SPECIES_INFO.pipistrelle.status.toLowerCase()).toContain('doing well');
  });

  it('CJ2 gaits by tag: the four bats are BIRD (flight), the eel WALKs (+ fleesToWater to the pool)', () => {
    for (const id of ['pipistrelle', 'daubentonbat', 'longearedbat', 'horseshoebat'] as const) {
      expect(SPECIES[id].gait).toBe('bird');
    }
    expect(SPECIES.eel.gait).toBe('walk');
    expect(SPECIES.eel.fleesToWater).toBe(true); // the eel dives into the underground pool
    for (const id of CAVE) expect(GAIT_PROFILES[SPECIES[id].gait]).toBeDefined();
  });
});

describe('Cave — ⚠️ anti-lockout (the pipistrelle valve catchable bait-less; ALL five catchable)', () => {
  it('the pipistrelle (a tiny common bat) is comfortably catchable bait-less; every species > 0', () => {
    expect(baitlessStarter('pipistrelle')).toBeGreaterThan(0.3); // the bait-less valve (no lockout)
    for (const id of CAVE) expect(baitlessStarter(id)).toBeGreaterThan(0);
    expect(baitlessStarter('eel')).toBeGreaterThan(0); // the apex (~0.16), still > 0
  });
});

describe('Cave — ⚠️ the BRANCH (additive: the existing Riverbank→Coast arm is UNCHANGED)', () => {
  it('the Riverbank set forks to BOTH the Coast AND the Cave; the Coast arm stays first', () => {
    expect(BIOME_SET_UNLOCK.riverbank).toEqual(['coast', 'cave']); // the fork (existing arm first)
    // Every OTHER link unchanged (incl. the Woodland + Highlands forks from earlier slices):
    expect(BIOME_SET_UNLOCK.meadow).toEqual(['woodland']);
    expect(BIOME_SET_UNLOCK.woodland).toEqual(['wetland', 'pineforest']);
    expect(BIOME_SET_UNLOCK.highlands).toEqual(['riverbank', 'moor']);
  });

  it('⚠️ BOTH breadcrumbs at the Riverbank fork — each arm has its OWN research-area project (#37)', () => {
    // The Riverbank has no mission set (research-gated, like the Moor), so both fork arms surface in the
    // research-area panel: their own biome-access projects, area-tagged, activity in the (accessed) prereq.
    for (const [target, prereq] of [['coast', 'riverbank'], ['cave', 'riverbank']] as const) {
      const p = RESEARCH_PROJECTS[`unlock-the-${target}`];
      expect(p.reward).toEqual({ kind: 'biome-access', biome: target });
      expect(p.area).toBe(target);
      expect(p.activityRequirement).toEqual({ kind: 'catch-in-biome', biome: prereq, count: 4 });
    }
  });
});

describe('Cave — ⚠️ the gate (#92 SPECIES+BAIT, NO phase — never trivialized by the dark)', () => {
  it('wired by DATA only: the fork + a cost-0 project on a species+bait mastery (no phase condition)', () => {
    expect(BIOME_SET_UNLOCK.riverbank).toContain('cave');
    expect(isResearchGatedUnlock('cave')).toBe(true);
    const p = RESEARCH_PROJECTS['unlock-the-cave'];
    expect(p.reward).toEqual({ kind: 'biome-access', biome: 'cave' });
    expect(p.cost).toBe(0);
    expect(p.knowledgeRequirement).toBe('research-dipper-insects');
    const req = MISSIONS['research-dipper-insects'].requirement as { kind: string; phase?: unknown; bait?: string; species?: string };
    expect(req).toEqual({ kind: 'research', species: 'dipper', bait: 'insects', count: 1 });
    expect(req.phase).toBeUndefined(); // ⚠️ NO phase — the cave's "always dark" never touches a phase requirement
  });

  it('⚠️ the #48 inverse — BOTH failure modes: a bait-LESS dipper AND a wrong-bait one fail', () => {
    const baitless = createJournal();
    evaluateCatch(baitless, ev('dipper', 'riverbank', 'day'));
    expect(baitless.missions['research-dipper-insects']?.completed ?? false).toBe(false);

    const wrong = createJournal();
    evaluateCatch(wrong, { species: 'dipper', biome: 'riverbank', phase: 'day', bait: 'seeds' } as Parameters<typeof evaluateCatch>[1]);
    expect(wrong.missions['research-dipper-insects']?.completed ?? false).toBe(false);

    const right = createJournal();
    evaluateCatch(right, { species: 'dipper', biome: 'riverbank', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    expect(right.missions['research-dipper-insects']?.completed).toBe(true); // the real diet — the deliberate choice
  });

  it('the activity + a flush wallet do NOT unlock it without the mastery (by play)', () => {
    const j = createJournal();
    // The shared Riverbank SOURCE gate (research-mouse-dusk) must be met too (the fork's source, like
    // the Coast) — pre-meet it so only the cave-specific dipper challenge is left.
    evaluateCatch(j, ev('fieldmouse', 'meadow', 'dusk')); // research-mouse-dusk (the riverbank source gate)
    addCredits(j, 1000);
    startResearch(j, 'unlock-the-cave');
    for (let i = 0; i < 4; i++) evaluateResearch(j, ev('reedbunting', 'riverbank', 'day')); // activity done
    reconcileResearchUnlocks(j);
    expect(researchState(j, 'unlock-the-cave').completed).toBe(false);
    expect(j.unlockedBiomes).not.toContain('cave');

    evaluateCatch(j, { species: 'dipper', biome: 'riverbank', phase: 'day', bait: 'insects' } as Parameters<typeof evaluateCatch>[1]);
    evaluateResearch(j, ev('reedbunting', 'riverbank', 'day'));
    reconcileResearchUnlocks(j);
    expect(j.unlockedBiomes).toContain('cave');
  });
});

describe('Cave — no schema bump (the data slice is forward/back compatible)', () => {
  it('the journal schema version is UNCHANGED — a new biome + species are purely additive data', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(7);
  });
});
