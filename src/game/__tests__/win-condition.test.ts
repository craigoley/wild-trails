import { describe, expect, it } from 'vitest';
import {
  currentRank,
  evaluateCatch,
  isGameComplete,
  missionSetBiomes,
  shouldCelebrateWin,
} from '../Missions';
import { createJournal, recordCatch } from '../../state/Journal';
import { MISSIONS, MISSION_ORDER, RANK, RANKS, SPECIES, SPECIES_ORDER } from '../../utils/constants';

/** Play the game to FULL completion through the real engine (no hand-set points):
 *  catch every species + complete every biome mission SET. Faithful = the rank
 *  points are whatever the engine actually awards. */
function fullyCompletedJournal() {
  const j = createJournal();
  for (const id of SPECIES_ORDER) recordCatch(j, id, 1); // every species catalogued
  // Complete the Meadow set.
  for (let i = 0; i < 5; i++) evaluateCatch(j, { species: 'fieldmouse', biome: 'meadow', phase: 'day' });
  for (let i = 0; i < 2; i++) evaluateCatch(j, { species: 'quail', biome: 'meadow', phase: 'dawn' });
  for (let i = 0; i < 2; i++) evaluateCatch(j, { species: 'hedgehog', biome: 'meadow', phase: 'dusk' });
  // Complete the Woodland four-window set: survey + dawn robin + dusk roe deer +
  // tracked night badger (Woodland gate tune).
  for (let i = 0; i < 4; i++) evaluateCatch(j, { species: 'redsquirrel', biome: 'woodland', phase: 'day' });
  evaluateCatch(j, { species: 'robin', biome: 'woodland', phase: 'dawn' });
  evaluateCatch(j, { species: 'roedeer', biome: 'woodland', phase: 'dusk' });
  evaluateCatch(j, { species: 'badger', biome: 'woodland', phase: 'night' });
  // Complete the Wetland set (Highlands content): survey ×3 (+ day mallard) + dawn frog.
  for (let i = 0; i < 3; i++) evaluateCatch(j, { species: 'mallard', biome: 'wetland', phase: 'day' });
  evaluateCatch(j, { species: 'frog', biome: 'wetland', phase: 'dawn' });
  return j;
}

describe('isGameComplete — the win condition (per requirement)', () => {
  it('is TRUE when all species + all biome sets + top rank are met', () => {
    expect(isGameComplete(fullyCompletedJournal())).toBe(true);
  });

  it('is FALSE if even one species is missing', () => {
    const j = fullyCompletedJournal();
    delete j.species.frog; // one short of the roster
    expect(isGameComplete(j)).toBe(false);
  });

  it('is FALSE if a biome SET mission is incomplete', () => {
    const j = fullyCompletedJournal();
    j.missions['woodland-dawn'].completed = false; // unfinish a set mission
    expect(isGameComplete(j)).toBe(false);
  });

  it('REQUIRES the badger tracking mission (it now GATES — no longer standalone)', () => {
    const j = fullyCompletedJournal();
    // Woodland gate tune: track-badger is now a set mission, so unfinishing it
    // breaks woodland-set completion — the game is no longer complete.
    j.missions['track-badger'].completed = false;
    expect(isGameComplete(j)).toBe(false);
    expect(missionSetBiomes()).not.toContain('highlands'); // no set there to require
  });
});

describe('shouldCelebrateWin — fires ONCE (the persisted-flag guard)', () => {
  it('fires when complete + not yet won; then never again once won is set', () => {
    const j = fullyCompletedJournal();
    expect(j.won).toBe(false);
    expect(shouldCelebrateWin(j)).toBe(true); // first time
    j.won = true; // the boundary marks it celebrated
    expect(shouldCelebrateWin(j)).toBe(false); // already won -> no re-celebration
  });

  it('does not fire while the game is incomplete', () => {
    expect(shouldCelebrateWin(createJournal())).toBe(false);
  });
});

describe('free-roam after win — a won save reloads as won, not reset', () => {
  it('a complete + won journal does not re-celebrate and is unchanged', () => {
    const j = fullyCompletedJournal();
    j.won = true; // as it would be after the celebration + save
    const speciesBefore = Object.keys(j.species).length;
    expect(shouldCelebrateWin(j)).toBe(false); // free-roam, no re-fire
    expect(isGameComplete(j)).toBe(true); // still complete (nothing reset)
    expect(Object.keys(j.species).length).toBe(speciesBefore); // progress intact
  });
});

describe('achievability — the win is REACHABLE with shipped content (no grind)', () => {
  it('full completion reaches the TOP rank', () => {
    expect(currentRank(fullyCompletedJournal()).name).toBe(RANKS[RANKS.length - 1].name);
  });

  it('the max achievable rank points clear the top threshold by a margin', () => {
    // Every mission reward + every species bonus — the ceiling with shipped content.
    // §4.1b added standalone research challenges (+12 each). §4.1b-fix reworked them
    // from 3 auto-satisfied ghosts to 2 genuinely NON-FORCED ones: +24 (not +36) to
    // the ceiling, so mission points 195 -> 219. They're OPTIONAL (standalone) — the
    // win never requires them; they only RAISE the achievable ceiling.
    // §4.4 added 3 MULTI-CONDITION research challenges (+12 each, OPTIONAL/standalone): 243 -> 279.
    const missionPts = MISSION_ORDER.reduce((s, id) => s + MISSIONS[id].rewardPoints, 0);
    const speciesPts = SPECIES_ORDER.length * RANK.perSpeciesFound;
    const top = RANKS[RANKS.length - 1].minPoints;
    expect(missionPts).toBe(279); // +3 standalone multi-condition challenges (only RAISE the ceiling)
    expect(SPECIES_ORDER.length).toBe(24); // bigger roster, bigger win bar
    expect(missionPts + speciesPts).toBeGreaterThanOrEqual(top); // clears with margin
  });

  it('every species in the roster actually exists (the win can be filled)', () => {
    for (const id of SPECIES_ORDER) expect(SPECIES[id]).toBeDefined();
  });
});
