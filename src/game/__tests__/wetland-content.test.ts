import { describe, expect, it } from 'vitest';
import { evaluateCatch, isBiomeSetComplete, type CatchEvent } from '../Missions';
import { clampActive, createWorld, isUnlocked, unlockBiome } from '../World';
import { eligibleSpecies } from '../Species';
import { finalCatchChance } from '../Catch';
import { createBaitState, deployBait, isCorrectBaitFor } from '../Bait';
import { createJournal } from '../../state/Journal';
import { PLAYER, SPECIES, SPECIES_ORDER, type BaitId, type SpeciesId } from '../../utils/constants';

const M = PLAYER.radius;
const NEW = ['badger', 'roedeer', 'mallard', 'frog'] as const;

const ev = (over: Partial<CatchEvent>): CatchEvent => ({
  species: 'fieldmouse',
  biome: 'meadow',
  phase: 'day',
  ...over,
});

describe('Plan #9 — Wetland unlock via the Woodland mission set', () => {
  // The four-window gate (Woodland gate tune): survey + dawn robin + dusk roe deer
  // + the tracked night badger.
  function completeWoodlandSet(j: ReturnType<typeof createJournal>) {
    for (let i = 0; i < 4; i++) evaluateCatch(j, ev({ biome: 'woodland', phase: 'day' })); // survey ×4
    evaluateCatch(j, ev({ species: 'robin', biome: 'woodland', phase: 'dawn' })); // woodland-dawn
    evaluateCatch(j, ev({ species: 'roedeer', biome: 'woodland', phase: 'dusk' })); // woodland-dusk
    return evaluateCatch(j, ev({ species: 'badger', biome: 'woodland', phase: 'night' })); // track-badger -> set complete
  }

  it('completing the Woodland set unlocks the Wetland (data-driven, once)', () => {
    const j = createJournal();
    const last = completeWoodlandSet(j);
    expect(isBiomeSetComplete(j, 'woodland')).toBe(true);
    expect(j.unlockedBiomes).toContain('wetland');
    expect(last.unlocked).toContain('wetland');
    // Idempotent — a further woodland catch doesn't re-unlock.
    expect(evaluateCatch(j, ev({ biome: 'woodland', phase: 'day' })).unlocked).toEqual([]);
  });

  it('the OLD too-easy condition alone (survey ×4 + a night catch) NO LONGER unlocks', () => {
    // The pre-tune gate: 4 woodland catches + 1 night catch. Without the dawn robin
    // AND dusk roe deer, the four-window set is incomplete -> no Wetland.
    const j = createJournal();
    for (let i = 0; i < 4; i++) evaluateCatch(j, ev({ species: 'redsquirrel', biome: 'woodland', phase: 'day' }));
    const r = evaluateCatch(j, ev({ species: 'badger', biome: 'woodland', phase: 'night' }));
    expect(isBiomeSetComplete(j, 'woodland')).toBe(false);
    expect(r.unlocked).not.toContain('wetland');
  });

  it('the new catch-species kind matches the right species only (dawn robin / dusk roe deer)', () => {
    const j = createJournal();
    // A wrong species in the dawn window does NOT complete woodland-dawn.
    evaluateCatch(j, ev({ species: 'redsquirrel', biome: 'woodland', phase: 'dawn' }));
    expect(j.missions['woodland-dawn'].completed).toBe(false);
    // The robin does.
    evaluateCatch(j, ev({ species: 'robin', biome: 'woodland', phase: 'dawn' }));
    expect(j.missions['woodland-dawn'].completed).toBe(true);
    // The roe deer completes woodland-dusk; a wrong species doesn't.
    evaluateCatch(j, ev({ species: 'redsquirrel', biome: 'woodland', phase: 'dusk' }));
    expect(j.missions['woodland-dusk'].completed).toBe(false);
    evaluateCatch(j, ev({ species: 'roedeer', biome: 'woodland', phase: 'dusk' }));
    expect(j.missions['woodland-dusk'].completed).toBe(true);
  });

  it('the EXISTING Meadow->Woodland unlock still fires (the chain did not break)', () => {
    const j = createJournal();
    for (let i = 0; i < 5; i++) evaluateCatch(j, ev({ biome: 'meadow', phase: 'day' })); // survey
    for (let i = 0; i < 2; i++) evaluateCatch(j, ev({ biome: 'meadow', phase: 'dawn' })); // dawn
    evaluateCatch(j, ev({ biome: 'meadow', phase: 'dusk' })); // dusk 1/2
    const last = evaluateCatch(j, ev({ biome: 'meadow', phase: 'dusk' })); // dusk 2/2 -> completes
    expect(last.unlocked).toContain('woodland');
  });

  it('with #9-pre, unlocking Wetland permits it but STILL denies the locked Highlands', () => {
    const w = createWorld();
    unlockBiome(w, 'woodland');
    unlockBiome(w, 'wetland'); // the L-shape (Meadow + Woodland + Wetland)
    expect(isUnlocked(w, 'wetland')).toBe(true);
    expect(clampActive(w, 40, 0, M)).toBe(false); // Wetland centre — reachable
    expect(clampActive(w, 40, 40, M)).toBe(true); // Highlands corner — still denied
  });
});

describe('Plan #9 — new species spawn gating (biome + time of day)', () => {
  it('each new species is eligible only in its biome at its activity window', () => {
    expect(eligibleSpecies('woodland', 'night').map((s) => s.id)).toContain('badger');
    expect(eligibleSpecies('woodland', 'dusk').map((s) => s.id)).toContain('roedeer');
    expect(eligibleSpecies('wetland', 'day').map((s) => s.id)).toContain('mallard');
    expect(eligibleSpecies('wetland', 'dawn').map((s) => s.id)).toContain('frog');
  });

  it('the Badger is NIGHT-only (not out by day/dawn/dusk)', () => {
    for (const phase of ['dawn', 'day', 'dusk'] as const) {
      expect(eligibleSpecies('woodland', phase).map((s) => s.id)).not.toContain('badger');
    }
  });

  it('new species never spawn in the wrong biome', () => {
    for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
      const meadow = eligibleSpecies('meadow', phase).map((s) => s.id);
      for (const id of NEW) expect(meadow).not.toContain(id);
    }
  });
});

describe('Plan #9 — difficulty ordering across all 10 species', () => {
  it('strictly descends easy -> hard, Wetland below the Woodland band', () => {
    const order: SpeciesId[] = [
      'hedgehog', 'fieldmouse', 'rabbit', 'redsquirrel',
      'badger', 'roedeer', 'quail', 'robin', 'mallard', 'frog',
    ];
    for (let i = 0; i < order.length - 1; i++) {
      expect(SPECIES[order[i]].baseCatchRate).toBeGreaterThan(SPECIES[order[i + 1]].baseCatchRate);
    }
    // Wetland (mallard, frog) below the woodland hardest (robin 0.25).
    expect(SPECIES.mallard.baseCatchRate).toBeLessThan(SPECIES.robin.baseCatchRate);
    expect(SPECIES.frog.baseCatchRate).toBeLessThan(SPECIES.robin.baseCatchRate);
    expect(SPECIES.frog.baseCatchRate).toBeGreaterThan(0); // catchable, not clamped out
  });
});

describe('Plan #9 — diet gate holds for the new species (correct bait > wrong == none)', () => {
  for (const id of NEW) {
    it(`${id}: its diet bait helps; a wrong bait does nothing`, () => {
      const species = SPECIES[id];
      const ctx = (correctBait: boolean) => ({
        dist: 0.5,
        tool: 'net' as const,
        biome: species.biome,
        correctBait,
        fleeing: false,
      });
      // Correct diet bait deployed -> isCorrectBaitFor true -> higher chance.
      const correct = createBaitState();
      correct.selected = species.bait;
      deployBait(correct, 0, 0);
      expect(isCorrectBaitFor(species, correct)).toBe(true);

      // A wrong bait -> isCorrectBaitFor false -> same as no bait.
      const wrongId = (['seeds', 'greens', 'insects'] as BaitId[]).find((b) => b !== species.bait)!;
      const wrong = createBaitState();
      wrong.selected = wrongId;
      deployBait(wrong, 0, 0);
      expect(isCorrectBaitFor(species, wrong)).toBe(false);

      const withCorrect = finalCatchChance(species, ctx(isCorrectBaitFor(species, correct)));
      const withWrong = finalCatchChance(species, ctx(isCorrectBaitFor(species, wrong)));
      const withNone = finalCatchChance(species, ctx(false));
      expect(withCorrect).toBeGreaterThan(withWrong);
      expect(withWrong).toBe(withNone);
    });
  }
});

describe('Plan #9 — roster count is data-driven', () => {
  it('the roster is 17 and contains the 4 Plan #9 species', () => {
    expect(SPECIES_ORDER.length).toBe(24); // +Highlands +Riverbank
    for (const id of NEW) expect(SPECIES_ORDER).toContain(id);
  });
});
