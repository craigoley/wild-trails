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
  // Complete the Woodland set.
  for (let i = 0; i < 4; i++) evaluateCatch(j, { species: 'redsquirrel', biome: 'woodland', phase: 'day' });
  evaluateCatch(j, { species: 'badger', biome: 'woodland', phase: 'night' });
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
    j.missions['woodland-night'].completed = false; // unfinish a set mission
    expect(isGameComplete(j)).toBe(false);
  });

  it('does NOT require the standalone tracking mission', () => {
    const j = fullyCompletedJournal();
    // Force the standalone badger track INCOMPLETE — the game is still complete,
    // because standalone side-quests don't count toward the biome sets.
    if (j.missions['track-badger']) j.missions['track-badger'].completed = false;
    expect(isGameComplete(j)).toBe(true);
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
    const missionPts = MISSION_ORDER.reduce((s, id) => s + MISSIONS[id].rewardPoints, 0);
    const speciesPts = SPECIES_ORDER.length * RANK.perSpeciesFound;
    const top = RANKS[RANKS.length - 1].minPoints;
    expect(missionPts + speciesPts).toBeGreaterThanOrEqual(top); // 195 >= 120
    // Even WITHOUT the optional tracking mission, the sets + species clear it.
    const required = missionPts - MISSIONS['track-badger'].rewardPoints + speciesPts;
    expect(required).toBeGreaterThanOrEqual(top); // 180 >= 120 — no grind needed
  });

  it('every species in the roster actually exists (the win can be filled)', () => {
    for (const id of SPECIES_ORDER) expect(SPECIES[id]).toBeDefined();
  });
});
