import { describe, expect, it } from 'vitest';
import { clampActive, createWorld, isUnlocked, unlockBiome } from '../World';
import { evaluateCatch, isBiomeSetComplete, reconcileResearchUnlocks } from '../Missions';
import { startResearch, evaluateResearch } from '../Research';
import { finalCatchChance } from '../Catch';
import { createBaitState, deployBait, isCorrectBaitFor } from '../Bait';
import { createJournal } from '../../state/Journal';
import { BIOMES, PLAYER, SPECIES, SPECIES_ORDER, TUNING, type BaitId } from '../../utils/constants';

const M = PLAYER.radius;
const ALPINE = ['ptarmigan', 'mountainhare', 'dotterel'] as const;

// R2: the Highlands unlock is research-WRAPPED — after the §4.1c gate is met, the
// unlock-the-highlands project (its wetland activity + the same mastery challenge) must
// also complete; the reconcile then fires the unlock. Drives that final step.
const doHighlandsResearch = (j: ReturnType<typeof createJournal>): void => {
  startResearch(j, 'unlock-the-highlands');
  for (let i = 0; i < 4; i++) evaluateResearch(j, { species: 'frog', biome: 'wetland', phase: 'day' } as Parameters<typeof evaluateResearch>[1]);
  reconcileResearchUnlocks(j);
};

describe('Highlands content — the diagonal 4th cell is now reachable (geometry)', () => {
  // Derived from the data (no magic numbers): the Highlands rect + its seams.
  const hb = BIOMES.highlands.bounds;
  const cx = (hb.minX + hb.maxX) / 2;
  const cy = (hb.minY + hb.maxY) / 2;

  it('the clamp DENIES the Highlands corner while it is still locked (the #9-pre guard)', () => {
    const w = createWorld();
    unlockBiome(w, 'woodland');
    unlockBiome(w, 'wetland'); // the L-shape — Highlands not yet earned
    expect(clampActive(w, cx, cy, M)).toBe(true); // corner denied (moved-back)
  });

  it('unlocking Highlands PERMITS its corner + both seams are seamless', () => {
    const w = createWorld();
    unlockBiome(w, 'woodland');
    unlockBiome(w, 'wetland');
    unlockBiome(w, 'highlands');
    expect(isUnlocked(w, 'highlands')).toBe(true);
    // The exact cell the per-rect clamp was built to deny is now reachable.
    expect(clampActive(w, cx, cy, M)).toBe(false);
    // West seam (shared edge with Woodland, x = hb.minX): on it -> permitted (no
    // wall between two unlocked neighbours). The clamp logic is UNCHANGED — the
    // seam opens only because both neighbours are unlocked.
    expect(clampActive(w, hb.minX, cy, M)).toBe(false);
    // South seam (shared edge with Wetland, y = hb.minY): on it -> permitted.
    expect(clampActive(w, cx, hb.minY, M)).toBe(false);
  });
});

describe('Highlands content — the unlock chain (pure data)', () => {
  it('the Wetland set AND the §4.1c research gate unlock the Highlands (escalated)', () => {
    const j = createJournal();
    // wetland-survey ×3 (+ the day mallard) ...
    for (let i = 0; i < 3; i++) evaluateCatch(j, { species: 'mallard', biome: 'wetland', phase: 'day' });
    // ... + the dawn frog completes the SET — but §4.1c: the set ALONE no longer suffices.
    const setDone = evaluateCatch(j, { species: 'frog', biome: 'wetland', phase: 'dawn' });
    expect(isBiomeSetComplete(j, 'wetland')).toBe(true);
    expect(j.unlockedBiomes).not.toContain('highlands'); // the escalated gate also needs the research
    expect(setDone.unlocked).not.toContain('highlands');
    // research-mouse-night (fieldmouse@night) — the demonstrated-mastery gate — is met...
    evaluateCatch(j, { species: 'fieldmouse', biome: 'meadow', phase: 'night' });
    expect(j.unlockedBiomes).not.toContain('highlands'); // ...but the Highlands is research-wrapped (R2)
    doHighlandsResearch(j); // the research wrap completes -> the unlock fires
    expect(j.unlockedBiomes).toContain('highlands');
  });

  it('the OLD condition alone (wetland survey only) does NOT unlock the Highlands', () => {
    const j = createJournal();
    for (let i = 0; i < 3; i++) evaluateCatch(j, { species: 'mallard', biome: 'wetland', phase: 'day' });
    // survey done, but wetland-dawn (frog) is missing -> set incomplete -> no unlock.
    // (mallard also completed wetland-day; the dawn frog is still outstanding.)
    expect(isBiomeSetComplete(j, 'wetland')).toBe(false);
    expect(j.unlockedBiomes).not.toContain('highlands');
  });

  it('the full chain fires end to end: meadow -> woodland -> wetland -> highlands', () => {
    const j = createJournal();
    // Meadow set.
    for (let i = 0; i < 5; i++) evaluateCatch(j, { species: 'fieldmouse', biome: 'meadow', phase: 'day' });
    for (let i = 0; i < 2; i++) evaluateCatch(j, { species: 'quail', biome: 'meadow', phase: 'dawn' });
    for (let i = 0; i < 2; i++) evaluateCatch(j, { species: 'hedgehog', biome: 'meadow', phase: 'dusk' });
    expect(j.unlockedBiomes).toContain('woodland');
    // Woodland four-window set.
    for (let i = 0; i < 4; i++) evaluateCatch(j, { species: 'redsquirrel', biome: 'woodland', phase: 'day' });
    evaluateCatch(j, { species: 'robin', biome: 'woodland', phase: 'dawn' });
    evaluateCatch(j, { species: 'roedeer', biome: 'woodland', phase: 'dusk' });
    evaluateCatch(j, { species: 'badger', biome: 'woodland', phase: 'night' });
    expect(j.unlockedBiomes).toContain('wetland');
    // Wetland set + the §4.1c research gate (fieldmouse@night) -> Highlands.
    for (let i = 0; i < 3; i++) evaluateCatch(j, { species: 'mallard', biome: 'wetland', phase: 'day' });
    evaluateCatch(j, { species: 'frog', biome: 'wetland', phase: 'dawn' });
    evaluateCatch(j, { species: 'fieldmouse', biome: 'meadow', phase: 'night' }); // demonstrated mastery
    doHighlandsResearch(j); // R2: + the research wrap (study the wetland) opens the route up
    expect(j.unlockedBiomes).toContain('highlands');
  });
});

describe('Highlands content — tier-4 difficulty + the alpine roster', () => {
  it('the alpine species sit BELOW the wetland frog (0.20), strictly ordered, all > 0', () => {
    const tail = ['frog', 'ptarmigan', 'mountainhare', 'dotterel'] as const;
    for (let i = 0; i < tail.length - 1; i++) {
      expect(SPECIES[tail[i]].baseCatchRate).toBeGreaterThan(SPECIES[tail[i + 1]].baseCatchRate);
    }
    for (const id of ALPINE) {
      expect(SPECIES[id].baseCatchRate).toBeLessThan(SPECIES.frog.baseCatchRate);
      expect(SPECIES[id].baseCatchRate).toBeGreaterThan(0); // catchable, not clamped out
      expect(SPECIES[id].tier).toBe(4);
      expect(SPECIES[id].biome).toBe('highlands');
      expect(SPECIES[id].baseFleeSpeed).toBeLessThan(TUNING.maxSpeed); // catchable on foot
    }
    expect(SPECIES_ORDER.length).toBe(17);
  });
});

describe('Highlands content — diet gate holds for the new species', () => {
  for (const id of ALPINE) {
    it(`${id}: its diet bait helps; a wrong bait does nothing`, () => {
      const species = SPECIES[id];
      const ctx = (correctBait: boolean) => ({
        dist: 0.5,
        tool: 'net' as const,
        biome: species.biome,
        correctBait,
        fleeing: false,
      });
      const correct = createBaitState();
      correct.selected = species.bait;
      deployBait(correct, 0, 0);
      expect(isCorrectBaitFor(species, correct)).toBe(true);

      const wrongId = (['seeds', 'greens', 'insects'] as BaitId[]).find((b) => b !== species.bait)!;
      const wrong = createBaitState();
      wrong.selected = wrongId;
      deployBait(wrong, 0, 0);
      expect(isCorrectBaitFor(species, wrong)).toBe(false);

      const withCorrect = finalCatchChance(species, ctx(true));
      const withWrong = finalCatchChance(species, ctx(false));
      expect(withCorrect).toBeGreaterThan(withWrong); // correct bait helps
    });
  }
});
