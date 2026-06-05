import { describe, expect, it } from 'vitest';
import {
  createOnboarding,
  skipOnboarding,
  tickOnboarding,
  type OnboardSituation,
} from '../Onboarding';
import { createJournal, recordCatch, foundCount } from '../../state/Journal';
import { ONBOARDING } from '../../utils/constants';

const sit = (over: Partial<OnboardSituation> = {}): OnboardSituation => ({
  moved: false,
  animalNearby: false,
  catchArmed: false,
  caughtAny: false,
  ...over,
});
const PAST_BEAT = ONBOARDING.beatSec + 0.1;

describe('Onboarding — first-run detection (the returning-player skip)', () => {
  it('a fresh (empty) journal is a first run; a journal with a catch is NOT', () => {
    const fresh = createJournal();
    expect(foundCount(fresh) === 0).toBe(true); // the signal main uses

    const returning = createJournal();
    recordCatch(returning, 'fieldmouse', 1);
    expect(foundCount(returning) === 0).toBe(false); // returning -> not onboarded
  });

  it('onboarding is active for a first run, inert for a returning player', () => {
    expect(createOnboarding(true).active).toBe(true);
    expect(createOnboarding(true).step).toBe('move');
    const returning = createOnboarding(false);
    expect(returning.active).toBe(false);
    expect(returning.step).toBe('done');
    expect(tickOnboarding(returning, sit({ moved: true, animalNearby: true }), 1)).toBeNull();
  });
});

describe('Onboarding — the step machine advances in order, by situation', () => {
  it('move -> approach -> catch -> journal -> missions -> done', () => {
    const s = createOnboarding(true);
    // 'move' holds until BOTH moved + an animal nearby.
    expect(tickOnboarding(s, sit({ moved: true }), 1)).toBeNull(); // no animal yet
    expect(s.step).toBe('move');
    expect(tickOnboarding(s, sit({ moved: true, animalNearby: true }), 1)).toBe('approach');

    expect(tickOnboarding(s, sit({ animalNearby: true }), 1)).toBeNull(); // not in range yet
    expect(tickOnboarding(s, sit({ catchArmed: true }), 1)).toBe('catch');

    expect(tickOnboarding(s, sit({ catchArmed: true }), 1)).toBeNull(); // no catch yet
    expect(tickOnboarding(s, sit({ caughtAny: true }), 1)).toBe('journal');

    // REWARD first (journal), THEN direction (missions) — a beat apart, not together.
    expect(tickOnboarding(s, sit(), 1)).toBeNull(); // journal still showing (beat not elapsed)
    expect(tickOnboarding(s, sit(), PAST_BEAT)).toBe('missions');

    expect(tickOnboarding(s, sit(), PAST_BEAT)).toBeNull(); // missions shown -> done
    expect(s.step).toBe('done');
    expect(s.active).toBe(false);
  });
});

describe('Onboarding — GUIDES, never gates progress', () => {
  it('advances on the situation alone — no "acknowledge the prompt" is ever required', () => {
    // A player who ignores every prompt and just plays still reaches the catch step:
    // the machine advances from caughtAny, not from any acknowledgement input.
    const s = createOnboarding(true);
    tickOnboarding(s, sit({ moved: true, animalNearby: true }), 1); // -> approach
    tickOnboarding(s, sit({ catchArmed: true }), 1); // -> catch
    const r = tickOnboarding(s, sit({ caughtAny: true }), 1); // -> journal, purely from the catch
    expect(r).toBe('journal');
  });

  it('an inactive machine is a no-op (the game loop runs independently)', () => {
    const s = createOnboarding(false);
    expect(tickOnboarding(s, sit({ caughtAny: true, catchArmed: true }), 1)).toBeNull();
  });
});

describe('Onboarding — skip suppresses the remaining prompts', () => {
  it('after skip, no further prompts fire', () => {
    const s = createOnboarding(true);
    tickOnboarding(s, sit({ moved: true, animalNearby: true }), 1); // mid-sequence
    skipOnboarding(s);
    expect(s.active).toBe(false);
    expect(tickOnboarding(s, sit({ catchArmed: true }), 1)).toBeNull();
    expect(tickOnboarding(s, sit({ caughtAny: true }), 1)).toBeNull();
  });
});
