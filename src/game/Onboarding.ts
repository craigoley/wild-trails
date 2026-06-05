/**
 * First-session onboarding — a PURE, Node-testable step machine (zero three / DOM
 * / Math.random). It tracks which contextual prompt the first-time player should
 * see next, advancing on the player's SITUATION (moved, an animal nearby, in
 * catch range, made a catch) — teach-by-doing in the Meadow.
 *
 * It GUIDES, never GATES: it only reads the situation and returns a prompt to
 * show; the game loop runs independently, so ignoring a prompt never blocks play.
 * Active on a first run only (an empty journal); a returning player is never
 * onboarded. Session-only — a mid-onboarding reload just restarts harmlessly.
 *
 * Bait is taught by the existing demand-driven baitHint (not duplicated). Reward
 * (journal) is shown before direction (missions), a beat apart.
 */

import { ONBOARDING } from '../utils/constants';

export type OnboardStep = 'move' | 'approach' | 'catch' | 'journal' | 'missions' | 'done';
/** The steps that have a prompt to display (everything but 'done'). */
export type PromptStep = Exclude<OnboardStep, 'done'>;

export interface OnboardState {
  /** Still guiding? (first-run, not skipped, not finished.) */
  active: boolean;
  step: OnboardStep;
  /** Countdown for the timed beats (journal -> missions -> done). */
  beat: number;
}

/** What the player is doing right now — derived at the boundary from game state. */
export interface OnboardSituation {
  /** Has the player moved at all this session? */
  moved: boolean;
  /** Is there an animal around to approach? */
  animalNearby: boolean;
  /** Is an animal in catch range (CATCH armed)? */
  catchArmed: boolean;
  /** Has the player made at least one catch? */
  caughtAny: boolean;
}

/** Start onboarding for a first run (empty journal); inert for a returning player. */
export function createOnboarding(firstRun: boolean): OnboardState {
  return { active: firstRun, step: firstRun ? 'move' : 'done', beat: 0 };
}

/**
 * Advance the machine from the situation. Returns the prompt step to SHOW this
 * frame (only on a transition), or null. The opening 'move' prompt is emitted by
 * the caller when onboarding begins; this drives every step after it.
 */
export function tickOnboarding(s: OnboardState, sit: OnboardSituation, dt: number): PromptStep | null {
  if (!s.active) return null;
  const prev = s.step;
  switch (s.step) {
    case 'move':
      if (sit.moved && sit.animalNearby) s.step = 'approach';
      break;
    case 'approach':
      if (sit.catchArmed) s.step = 'catch';
      break;
    case 'catch':
      if (sit.caughtAny) {
        s.step = 'journal';
        s.beat = ONBOARDING.beatSec;
      }
      break;
    case 'journal':
      s.beat -= dt;
      if (s.beat <= 0) {
        s.step = 'missions'; // reward shown — now point to what's next, a beat later
        s.beat = ONBOARDING.beatSec;
      }
      break;
    case 'missions':
      s.beat -= dt;
      if (s.beat <= 0) {
        s.step = 'done';
        s.active = false;
      }
      break;
  }
  return s.step !== prev && s.step !== 'done' ? (s.step as PromptStep) : null;
}

/** Skip the rest of onboarding (the start-screen Skip / a returning player). */
export function skipOnboarding(s: OnboardState): void {
  s.active = false;
  s.step = 'done';
}
