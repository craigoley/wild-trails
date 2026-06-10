import { describe, expect, it } from 'vitest';
import { createJournal } from '../../state/Journal';
import { evaluateCatch, type CatchEvent } from '../Missions';
import { createGameState, update } from '../GameState';
import { spawnAnimal } from '../Animal';
import { deployBait } from '../Bait';
import { createIntent } from '../Input';
import { SIM_DT, type BaitId } from '../../utils/constants';

/** A catch event; bait optional (a bait-less catch passes null). */
const ev = (species: string, biome: string, phase: string, bait?: BaitId | null): CatchEvent =>
  ({ species, biome, phase, bait } as CatchEvent);

const done = (id: string, e: CatchEvent): boolean => {
  const j = createJournal();
  evaluateCatch(j, e);
  return j.missions[id]?.completed === true;
};

describe('multi-condition challenges — meets() ANDs PRESENT conditions, SKIPS absent (no regression)', () => {
  it('a single-condition (phase-only) research challenge is byte-identical — completes with NO bait field', () => {
    // research-mouse-night = species+phase only; omitting bait entirely still completes it.
    expect(done('research-mouse-night', ev('fieldmouse', 'meadow', 'night'))).toBe(true);
    // ...and a bait value is simply ignored by a bait-less def (the condition is absent).
    expect(done('research-mouse-night', ev('fieldmouse', 'meadow', 'night', 'insects'))).toBe(true);
    // wrong phase still fails (the phase condition is still enforced).
    expect(done('research-mouse-night', ev('fieldmouse', 'meadow', 'day'))).toBe(false);
  });

  it('species + bait is satisfied ONLY by the right species caught with the right bait (the AND)', () => {
    expect(done('research-hedgehog-insects', ev('hedgehog', 'meadow', 'dusk', 'insects'))).toBe(true);
    expect(done('research-hedgehog-insects', ev('rabbit', 'meadow', 'dusk', 'insects'))).toBe(false); // wrong species
    expect(done('research-hedgehog-insects', ev('hedgehog', 'meadow', 'dusk', 'greens'))).toBe(false); // wrong bait
  });
});

describe('⚠️ #48 NON-FORCED — a bare/normal catch never auto-satisfies a multi-condition challenge', () => {
  // research-hedgehog-insects (2-cond: species + bait) — bait is the non-forced lever.
  it('hedgehog+insects: bait-less / wrong-bait does NOT complete; insect bait does (the inverse + completable)', () => {
    expect(done('research-hedgehog-insects', ev('hedgehog', 'meadow', 'dusk', null))).toBe(false); // bait-less
    expect(done('research-hedgehog-insects', ev('hedgehog', 'meadow', 'dusk', 'seeds'))).toBe(false); // wrong bait
    expect(done('research-hedgehog-insects', ev('hedgehog', 'meadow', 'dusk', 'insects'))).toBe(true); // the choice
  });

  // research-mouse-night-seeds (3-cond: species + phase + bait) — maximally non-forced.
  it('mouse+night+seeds: wrong phase OR no bait OR wrong bait fails; night+seeds completes', () => {
    expect(done('research-mouse-night-seeds', ev('fieldmouse', 'meadow', 'day', 'seeds'))).toBe(false); // wrong phase
    expect(done('research-mouse-night-seeds', ev('fieldmouse', 'meadow', 'night', null))).toBe(false); // no bait
    expect(done('research-mouse-night-seeds', ev('fieldmouse', 'meadow', 'night', 'insects'))).toBe(false); // wrong bait
    expect(done('research-mouse-night-seeds', ev('fieldmouse', 'meadow', 'night', 'seeds'))).toBe(true); // both facts applied
  });

  // research-otter-fish (2-cond) — the fish-bait dependency; standalone (gates nothing).
  it('otter+fish: bait-less / wrong-bait does NOT complete; fish bait does (completable once fish bait is accessible)', () => {
    expect(done('research-otter-fish', ev('otter', 'riverbank', 'dusk', null))).toBe(false); // bait-less
    expect(done('research-otter-fish', ev('otter', 'riverbank', 'dusk', 'greens'))).toBe(false); // wrong bait
    expect(done('research-otter-fish', ev('otter', 'riverbank', 'dusk', 'fish'))).toBe(true); // the choice
  });
});

describe('multi-condition challenges — the warm-miss hint generalizes (species-scoped, #84)', () => {
  it('a same-species catch that MISSES the bait condition pushes the teaching hint (and completes nothing)', () => {
    const j = createJournal();
    const r = evaluateCatch(j, ev('hedgehog', 'meadow', 'dusk', null)); // right species, no bait
    expect(j.missions['research-hedgehog-insects']?.completed ?? false).toBe(false);
    expect(r.hints.some((h) => h.toLowerCase().includes('insect'))).toBe(true);
  });
});

describe('⚠️ THE PLUMBING — lastCaughtBait captures the active bait BEFORE clearActiveBait', () => {
  function gameWithFieldmouse() {
    const g = createGameState(123);
    for (const a of g.animals) a.active = false; // clear any boot spawn
    g.spawnTimer = 1e9; // pause spawning
    spawnAnimal(g.animals, 'fieldmouse', 0.5, 0); // point-blank with the player at origin
    return g;
  }

  it('a guaranteed catch with seed bait active yields lastCaughtBait=seeds, and the lure is cleared AFTER', () => {
    const g = gameWithFieldmouse();
    g.bait.selected = 'seeds'; // the fieldmouse diet -> correct bait -> chance clamps to 1 (guaranteed)
    deployBait(g.bait, 0, 0);
    g.bait.timer = 1e9; // keep the lure active through the whole multi-shake encounter
    expect(g.bait.activeType).toBe('seeds');

    update(g, { ...createIntent(), catchPressed: true }, SIM_DT); // start the (guaranteed) encounter
    expect(g.encounter).not.toBeNull();
    for (let i = 0; i < 400 && g.encounter; i++) update(g, createIntent(), SIM_DT); // play it out

    expect(g.sessionCatches).toBe(1);
    expect(g.lastCaughtBait).toBe('seeds'); // captured AT catch time...
    expect(g.bait.activeType).toBeNull(); // ...and the lure was cleared AFTER (so the capture was BEFORE)
  });

  it('a bait-less catch yields lastCaughtBait=null (so a bait challenge is never satisfied by accident)', () => {
    const g = gameWithFieldmouse();
    // No bait deployed. The fieldmouse is point-blank with the starter — base×proximity catches it.
    update(g, { ...createIntent(), catchPressed: true }, SIM_DT);
    for (let i = 0; i < 400 && g.encounter; i++) update(g, createIntent(), SIM_DT);
    if (g.sessionCatches === 1) expect(g.lastCaughtBait).toBeNull(); // bait-less -> null (only assert if it caught)
  });
});
