import { describe, expect, it } from 'vitest';
import {
  createBaitState,
  deployBait,
  isBaitSelectable,
  setSelectedBait,
} from '../Bait';
import { baitIndexForKey, BAIT_SELECT_KEYS } from '../Input';
import { createGameState, update, type GameState } from '../GameState';
import { spawnAnimal } from '../Animal';
import { createIntent } from '../Input';
import { BAIT_ORDER, SIM_DT } from '../../utils/constants';

describe('Bait tray — direct selection (the new setter)', () => {
  it('selects a bait that has stock', () => {
    const s = createBaitState();
    expect(s.selected).toBe(BAIT_ORDER[0]); // seeds by default
    expect(setSelectedBait(s, 'insects')).toBe(true);
    expect(s.selected).toBe('insects');
  });

  it('selecting an EMPTY bait is a no-op; the previous stays selected', () => {
    const s = createBaitState();
    setSelectedBait(s, 'greens'); // valid
    s.counts.insects = 0; // empty out insects
    expect(setSelectedBait(s, 'insects')).toBe(false); // blocked
    expect(s.selected).toBe('greens'); // unchanged
  });

  it('isBaitSelectable maps count>0 -> selectable, 0 -> not (the tray predicate)', () => {
    const s = createBaitState();
    expect(isBaitSelectable(s, 'seeds')).toBe(true);
    s.counts.seeds = 0;
    expect(isBaitSelectable(s, 'seeds')).toBe(false);
  });
});

describe('Bait tray — keyboard index mapping (off-by-one guard)', () => {
  it("chip key '1' -> first bait (index 0), '2' -> 1, '3' -> 2", () => {
    expect(baitIndexForKey('1')).toBe(0);
    expect(baitIndexForKey('2')).toBe(1);
    expect(baitIndexForKey('3')).toBe(2);
    // BAIT_ORDER[index] is the bait the chip selects.
    expect(BAIT_ORDER[baitIndexForKey('1')]).toBe('seeds');
  });

  it('a non-bait key maps to -1 (no selection)', () => {
    expect(baitIndexForKey('q')).toBe(-1);
    expect(baitIndexForKey('w')).toBe(-1);
    expect(BAIT_SELECT_KEYS.length).toBe(BAIT_ORDER.length); // one key per bait
  });
});

describe('Bait tray — selection flows through the intent into GameState', () => {
  it('intent.baitSelect selects the bait (and is consumed)', () => {
    const g = createGameState(1);
    const intent = { ...createIntent(), baitSelect: 2 }; // insects
    update(g, intent, SIM_DT);
    expect(g.bait.selected).toBe(BAIT_ORDER[2]);
    expect(intent.baitSelect).toBe(-1); // consumed
  });

  it('selecting an empty bait via the intent does NOT change selection', () => {
    const g = createGameState(1);
    g.bait.counts[BAIT_ORDER[1]] = 0; // empty the 2nd bait
    const before = g.bait.selected;
    update(g, { ...createIntent(), baitSelect: 1 }, SIM_DT);
    expect(g.bait.selected).toBe(before); // unchanged (no-op)
    expect(g.notice).not.toBeNull(); // surfaced the scarcity (now the generic notice channel)
  });
});

describe('Bait tray — regression: deploy is unchanged (display-only refactor)', () => {
  /** A game with spawning paused and one test animal at the player. */
  function gameWithAnimalAt(species: 'fieldmouse', x: number, y: number): GameState {
    const g = createGameState(3);
    for (const a of g.animals) a.active = false;
    g.spawnTimer = 1e9;
    spawnAnimal(g.animals, species, x, y);
    return g;
  }

  it('selecting then deploying the bait produces the SAME active lure + decrement', () => {
    // Direct unit check: select greens, deploy -> active greens, count -1.
    const s = createBaitState();
    setSelectedBait(s, 'greens');
    const before = s.counts.greens;
    expect(deployBait(s, 4, 5)).toBe(true);
    expect(s.activeType).toBe('greens');
    expect(s.counts.greens).toBe(before - 1);

    // Through the sim: select via intent, deploy via intent — same outcome.
    const g = gameWithAnimalAt('fieldmouse', 0.5, 0);
    const seedsBefore = g.bait.counts.seeds;
    update(g, { ...createIntent(), baitSelect: 0 }, SIM_DT); // select seeds
    update(g, { ...createIntent(), baitDeploy: true }, SIM_DT); // deploy
    expect(g.bait.activeType).toBe('seeds'); // selected bait was deployed
    expect(g.bait.counts.seeds).toBe(seedsBefore - 1); // and consumed (economy unchanged)
  });
});
