import { describe, expect, it } from 'vitest';
import {
  signatureSpecies,
  phaseSpecies,
  speciesForChallenge,
  targetForMission,
  speciesForResearch,
  type CatchChallenge,
  type CatchTarget,
} from '../catchTarget';
import { createJournal } from '../../state/Journal';
import { MISSIONS, MISSION_ORDER, SPECIES, SPECIES_ORDER, RESEARCH_PROJECTS, type SpeciesId } from '../../utils/constants';

/**
 * §HUD catch-target (i) — the PURE target resolver: every challenge → a displayable species + progress,
 * so the HUD can show "a portrait of WHAT to catch · 0/3". ⚠️ Display-only — reads existing mission/
 * research state, never touches catching. These pin the 5-kind mapping (3 name a species; biome/phase →
 * a representative) + the progress read. The thumbnail RENDER is device-validated (no WebGL in Node).
 */

describe('catchTarget — speciesForChallenge (the 5 kinds → a displayable species)', () => {
  it('the species-naming kinds return their own species', () => {
    expect(speciesForChallenge({ kind: 'catch-species', species: 'hedgehog' })).toBe('hedgehog');
    expect(speciesForChallenge({ kind: 'track-and-catch', species: 'badger' })).toBe('badger');
    expect(speciesForChallenge({ kind: 'research', species: 'redsquirrel' })).toBe('redsquirrel');
  });

  it('catch-in-biome → the biome SIGNATURE species (its first in SPECIES_ORDER)', () => {
    expect(speciesForChallenge({ kind: 'catch-in-biome', biome: 'meadow' })).toBe('fieldmouse');
    // and it's genuinely that biome's species:
    expect(SPECIES[signatureSpecies('woodland')].biome).toBe('woodland');
  });

  it('catch-in-timephase / catch-in-phase → a phase SPECIALIST (a dusk animal for a dusk challenge)', () => {
    const dusk = speciesForChallenge({ kind: 'catch-in-timephase', phase: 'dusk' });
    expect(SPECIES[dusk].activityWindow).toBe('dusk'); // a real dusk species, not the any-window mouse
    expect(speciesForChallenge({ kind: 'catch-in-phase', phase: 'night' })).toBe(phaseSpecies('night'));
  });

  it('⚠️ EVERY active mission resolves to a real species (every challenge is displayable)', () => {
    for (const id of MISSION_ORDER) {
      const s = speciesForChallenge(MISSIONS[id].requirement as CatchChallenge);
      expect(SPECIES_ORDER).toContain(s);
    }
  });
});

describe('catchTarget — targetForMission (species + live progress)', () => {
  it('reads the requirement count + the journal progress', () => {
    const id = MISSION_ORDER[0];
    const journal = createJournal();
    const t0 = targetForMission(id, journal)!;
    expect(t0.count).toBe(MISSIONS[id].requirement.count);
    expect(t0.progress).toBe(0);
    expect(SPECIES_ORDER).toContain(t0.species);

    journal.missions[id] = { progress: 2, completed: false };
    expect(targetForMission(id, journal)!.progress).toBe(2); // tracks the live progress
  });

  it('returns null for an unknown mission id', () => {
    expect(targetForMission('not-a-mission', createJournal())).toBeNull();
  });

  it('⚠️ reuses the `out` scratch when given (the no-per-frame-alloc contract for the render loop)', () => {
    const id = MISSION_ORDER[0];
    const journal = createJournal();
    const scratch: CatchTarget = { species: 'fieldmouse', progress: 0, count: 0 };
    const a = targetForMission(id, journal, scratch);
    const b = targetForMission(id, journal, scratch);
    expect(a).toBe(scratch); // filled the SAME object, not a new one
    expect(b).toBe(a); // every call reuses it → zero per-frame allocation
  });
});

describe('catchTarget — speciesForResearch (the named challenge’s species, else the activity rep)', () => {
  it('every research project resolves to a real species', () => {
    for (const id of Object.keys(RESEARCH_PROJECTS)) {
      const s = speciesForResearch(id);
      expect(s).not.toBeNull();
      expect(SPECIES_ORDER).toContain(s as SpeciesId);
    }
  });

  it('a knowledge-gated project portrays its mastery-challenge species', () => {
    // find a project with a knowledgeRequirement → it should portray that mission's species.
    const id = Object.keys(RESEARCH_PROJECTS).find((k) => RESEARCH_PROJECTS[k].knowledgeRequirement);
    if (id) {
      const km = RESEARCH_PROJECTS[id].knowledgeRequirement!;
      expect(speciesForResearch(id)).toBe(speciesForChallenge(MISSIONS[km].requirement as CatchChallenge));
    }
    expect(speciesForResearch('not-a-project')).toBeNull();
  });
});
