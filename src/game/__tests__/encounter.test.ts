import { describe, expect, it } from 'vitest';
import {
  advanceEncounter,
  shakesSurvived,
  startEncounter,
  type Encounter,
} from '../Encounter';
import { createGameState, update } from '../GameState';
import { createAnimalPool, spawnAnimal } from '../Animal';
import { createPlayer } from '../Player';
import { createBaitState, deployBait } from '../Bait';
import { createIntent } from '../Input';
import { createRng } from '../../utils/rng';
import { CATCH, SIM_DT } from '../../utils/constants';

/** Build a resolved-by-hand encounter for testing the playback machine. */
function fakeEncounter(over: Partial<Encounter>): Encounter {
  return {
    animalIndex: 0,
    species: 'fieldmouse',
    chance: 0.5,
    shakes: [{ passed: true }, { passed: true }, { passed: true }],
    caught: true,
    critical: false,
    shakeIndex: 0,
    beatTimer: CATCH.shakeBeatSec,
    phase: 'shaking',
    ...over,
  };
}

/** Step an encounter to completion; return the outcome + the number of steps. */
function playToEnd(enc: Encounter): { outcome: 'caught' | 'escaped'; steps: number } {
  for (let i = 1; i <= 10000; i++) {
    const out = advanceEncounter(enc, SIM_DT);
    if (out) return { outcome: out, steps: i };
  }
  throw new Error('encounter never resolved');
}

describe('Encounter — start gating', () => {
  it('returns null when no animal is within reach', () => {
    const pool = createAnimalPool();
    spawnAnimal(pool, 'fieldmouse', 100, 0); // far away
    const enc = startEncounter({
      animals: pool,
      player: createPlayer(0, 0),
      biome: 'meadow',
      tool: 'net',
      bait: createBaitState(),
      rng: createRng(1),
    });
    expect(enc).toBeNull();
  });

  it('starts an encounter on the nearest in-range animal with a valid chance', () => {
    const pool = createAnimalPool();
    const a = spawnAnimal(pool, 'fieldmouse', 1, 0)!; // within attemptRadius
    const enc = startEncounter({
      animals: pool,
      player: createPlayer(0, 0),
      biome: 'meadow',
      tool: 'net',
      bait: createBaitState(),
      rng: createRng(1),
    });
    expect(enc).not.toBeNull();
    expect(enc!.animalIndex).toBe(pool.indexOf(a));
    expect(enc!.chance).toBeGreaterThanOrEqual(0);
    expect(enc!.chance).toBeLessThanOrEqual(1);
    expect(enc!.shakes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Encounter — playback machine', () => {
  it('walks every shake beat then a resolve beat, then reports the outcome', () => {
    const enc = fakeEncounter({ caught: true });
    const { outcome, steps } = playToEnd(enc);
    expect(outcome).toBe('caught');
    expect(enc.phase).toBe('done');
    // 3 shake beats + 1 resolve beat worth of time.
    const expectedSec = 3 * CATCH.shakeBeatSec + CATCH.resolveBeatSec;
    expect(steps * SIM_DT).toBeGreaterThanOrEqual(expectedSec - SIM_DT);
    expect(steps * SIM_DT).toBeLessThanOrEqual(expectedSec + SIM_DT);
  });

  it('an escape resolves to escaped', () => {
    const enc = fakeEncounter({
      shakes: [{ passed: true }, { passed: false }],
      caught: false,
    });
    expect(playToEnd(enc).outcome).toBe('escaped');
    expect(shakesSurvived(enc)).toBe(1);
  });
});

describe('Encounter — GameState wiring', () => {
  /** A game with spawning paused and a single test animal near the player. */
  function gameWithAnimalAt(x: number, y: number): ReturnType<typeof createGameState> {
    const g = createGameState(123);
    for (const a of g.animals) a.active = false; // clear any boot spawn
    g.spawnTimer = 1e9; // pause spawning for the test
    spawnAnimal(g.animals, 'fieldmouse', x, y);
    return g;
  }

  it('a guaranteed catch despawns the animal and increments the session count', () => {
    const g = gameWithAnimalAt(0.5, 0);
    // Force chance to clamp to 1: tranq + correct bait + point-blank.
    g.tool = 'tranq';
    g.bait.selected = 'seeds'; // fieldmouse diet
    deployBait(g.bait, 0, 0);

    const intent = { ...createIntent(), catchPressed: true };
    update(g, intent, SIM_DT); // starts the encounter
    expect(g.encounter).not.toBeNull();
    expect(g.telemetry.catchAttempts).toBe(1);
    expect(g.telemetry.lastChance).toBe(1);

    // Play it out.
    for (let i = 0; i < 400 && g.encounter; i++) update(g, createIntent(), SIM_DT);
    expect(g.encounter).toBeNull();
    expect(g.sessionCatches).toBe(1);
    expect(g.telemetry.caught).toBe(1);
    expect(g.animals.some((a) => a.active)).toBe(false); // the caught animal is gone
  });

  it('an escape leaves the animal active and sends it fleeing', () => {
    const g = gameWithAnimalAt(0.5, 0);
    const idx = g.animals.findIndex((a) => a.active);
    // Inject an escape encounter directly (deterministic, no rng dependence).
    g.encounter = {
      animalIndex: idx,
      species: 'fieldmouse',
      chance: 0.1,
      shakes: [{ passed: false }],
      caught: false,
      critical: false,
      shakeIndex: 0,
      beatTimer: CATCH.shakeBeatSec,
      phase: 'shaking',
    };
    for (let i = 0; i < 400 && g.encounter; i++) update(g, createIntent(), SIM_DT);
    expect(g.encounter).toBeNull();
    expect(g.sessionCatches).toBe(0);
    expect(g.telemetry.escaped).toBe(1);
    expect(g.animals[idx].active).toBe(true); // still in the world
    expect(g.animals[idx].aiState).toBe('flee'); // and bolting
  });
});
