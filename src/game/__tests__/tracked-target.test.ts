import { describe, expect, it } from 'vitest';
import { defaultTrackedMission, resolveTracked, isTargetNear } from '../trackedTarget';
import { speciesForChallenge } from '../catchTarget';
import { createJournal } from '../../state/Journal';
import { MISSIONS, MISSION_ORDER, SPECIES } from '../../utils/constants';
import type { Animal } from '../Animal';

/**
 * §HUD catch-target (ii) — the play-screen chip's tracked-target selection + the near-player scan. PURE,
 * session-only (no schema bump). These pin: the auto default (the current biome's goal), the tap-to-track
 * override, and the near-pulse predicate (over the bounded animal pool, no alloc). Display-only — the
 * resolvers read mission state + game.animals; they never change catching. The FEEL is Craig's gate.
 */

const animal = (over: Partial<Animal>): Animal => ({ active: true, species: 'hedgehog', x: 0, y: 0, ...over }) as Animal;

describe('defaultTrackedMission — the auto pick (the current biome’s goal)', () => {
  it('picks an active, incomplete mission whose target is in the CURRENT biome', () => {
    const id = defaultTrackedMission(createJournal(), 'meadow');
    expect(id).not.toBeNull();
    expect(MISSIONS[id!].standalone ?? false).toBe(false); // a progression goal, not a standalone challenge
    expect(SPECIES[speciesForChallenge(MISSIONS[id!].requirement)].biome).toBe('meadow'); // the biome preference held
  });

  it('falls back to a sensible default when the biome has none', () => {
    const id = defaultTrackedMission(createJournal(), 'cave'); // no active cave goal early on
    expect(id).not.toBeNull(); // still a sensible default (an active progression mission)
  });

  it('⚠️ P4: the fallback is the NEAREST-to-complete goal, not the first in order', () => {
    const j = createJournal();
    // The trackable (incomplete, progression) missions, in order — none of which target 'cave'.
    const trackable = MISSION_ORDER.filter(
      (id) => !MISSIONS[id].standalone && SPECIES[speciesForChallenge(MISSIONS[id].requirement)].biome !== 'cave',
    );
    expect(trackable.length).toBeGreaterThan(1);
    // Push a LATER mission to the most progress (ratio 1.0, still incomplete); the first stays at 0.
    const target = trackable[trackable.length - 1];
    j.missions[target] = { progress: MISSIONS[target].requirement.count, completed: false };
    // The chip should point at the one you're closest to finishing — not trackable[0].
    expect(defaultTrackedMission(j, 'cave')).toBe(target);
    expect(target).not.toBe(trackable[0]); // and it genuinely beat the first-in-order pick
  });

  it('⚠️ P4: a current-biome goal still wins over a near-complete elsewhere (biome preference first)', () => {
    const j = createJournal();
    // Make some non-meadow goal nearly complete...
    const elsewhere = MISSION_ORDER.find(
      (id) => !MISSIONS[id].standalone && SPECIES[speciesForChallenge(MISSIONS[id].requirement)].biome !== 'meadow',
    )!;
    j.missions[elsewhere] = { progress: MISSIONS[elsewhere].requirement.count - 1, completed: false };
    // ...the meadow default still wins (the biome preference precedes the nearest-complete fallback).
    const id = defaultTrackedMission(j, 'meadow')!;
    expect(SPECIES[speciesForChallenge(MISSIONS[id].requirement)].biome).toBe('meadow');
  });

  it('returns null when nothing is left (all goals complete)', () => {
    const j = createJournal();
    for (const id of Object.keys(MISSIONS)) j.missions[id] = { progress: 0, completed: true };
    expect(defaultTrackedMission(j, 'meadow')).toBeNull();
  });
});

describe('resolveTracked — the session override, else the default', () => {
  it('honours a valid, still-active override', () => {
    const j = createJournal();
    const override = defaultTrackedMission(j, 'woodland'); // any real active mission
    expect(resolveTracked(override, j, 'meadow')).toBe(override); // the override wins over the meadow default
  });

  it('ignores a completed / unknown override → the default', () => {
    const j = createJournal();
    const def = defaultTrackedMission(j, 'meadow');
    expect(resolveTracked('not-a-mission', j, 'meadow')).toBe(def);
    const done = def!;
    j.missions[done] = { progress: 0, completed: true };
    expect(resolveTracked(done, j, 'meadow')).not.toBe(done); // a completed override is dropped
  });
});

describe('isTargetNear — ⚠️ the near-pulse predicate (bounded scan, no alloc, no mutate)', () => {
  it('true when an ACTIVE instance of the species is within radius; false otherwise', () => {
    const animals = [
      animal({ species: 'hedgehog', x: 2, y: 1 }), // active hedgehog, near
      animal({ species: 'rabbit', x: 0, y: 0 }), // wrong species
      animal({ active: false, species: 'hedgehog', x: 0, y: 0 }), // inactive — ignored
    ];
    expect(isTargetNear(animals, 'hedgehog', 0, 0, 5)).toBe(true);
    expect(isTargetNear(animals, 'hedgehog', 100, 100, 5)).toBe(false); // too far
    expect(isTargetNear(animals, 'badger', 0, 0, 5)).toBe(false); // none present
    expect(isTargetNear([], 'hedgehog', 0, 0, 5)).toBe(false); // empty pool
  });

  it('uses the radius boundary (squared distance) correctly', () => {
    const animals = [animal({ x: 3, y: 4 })]; // distance 5 from origin
    expect(isTargetNear(animals, 'hedgehog', 0, 0, 5)).toBe(true); // exactly at the radius
    expect(isTargetNear(animals, 'hedgehog', 0, 0, 4.9)).toBe(false); // just outside
  });

  it('does not mutate the pool (a pure read)', () => {
    const animals = [animal({ x: 1, y: 1 })];
    const snapshot = JSON.stringify(animals);
    isTargetNear(animals, 'hedgehog', 0, 0, 5);
    expect(JSON.stringify(animals)).toBe(snapshot);
  });
});
