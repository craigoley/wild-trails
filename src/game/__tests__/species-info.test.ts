import { describe, expect, it } from 'vitest';
import { SPECIES_INFO, SPECIES_ORDER } from '../../utils/constants';

/**
 * §4.1a — the richer field-guide knowledge. Pins every species has a full entry and
 * that the field note reads as a SYNTHESIS (the naturalist gaze), not a flashcard.
 */
describe('SPECIES_INFO — every species has a full field-guide entry', () => {
  it('all 13 species have a non-empty fieldNote, behaviour, and status (no gaps)', () => {
    expect(Object.keys(SPECIES_INFO).sort()).toEqual([...SPECIES_ORDER].sort());
    for (const id of SPECIES_ORDER) {
      const info = SPECIES_INFO[id];
      expect(info, `${id} missing SPECIES_INFO`).toBeDefined();
      expect(info.fieldNote.length).toBeGreaterThan(40); // a sentence, not a label
      expect(info.behaviour.length).toBeGreaterThan(20);
      expect(info.status.length).toBeGreaterThan(20);
    }
  });

  it('the field note is a SYNTHESIS (names a time-of-day), not a flashcard fact-list', () => {
    for (const id of SPECIES_ORDER) {
      const note = SPECIES_INFO[id].fieldNote.toLowerCase();
      // The naturalist gaze ties WHEN to where/what — every note names a time cue...
      expect(/dawn|dusk|day|night|hour|light|dark/.test(note), `${id} note has no time cue`).toBe(true);
      // ...and is prose, NOT the "Diet: / Habitat: / Active:" flashcard labels.
      expect(/diet:|habitat:|active:/.test(note), `${id} note reads as a flashcard`).toBe(false);
    }
  });

  it('the status register is hopeful (mentions thriving / doing-well, not just decline)', () => {
    // Across the roster, the conservation lines lean POSITIVE — what helps them thrive.
    const positives = SPECIES_ORDER.filter((id) =>
      /thriv|doing well|common|at home|increasing|safe/.test(SPECIES_INFO[id].status.toLowerCase()),
    );
    expect(positives.length).toBeGreaterThanOrEqual(SPECIES_ORDER.length - 2); // most read hopeful
  });
});
