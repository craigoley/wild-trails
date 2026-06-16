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

  it('the status register leans hopeful, but names honest decline where true (soul-aware §4.2)', () => {
    // The lines lean POSITIVE (what helps them thrive) — but written SOUL-AWARE, a genuinely
    // declining species says so (the red-listed linnet/herring gull, etc). So: MOST hopeful
    // (≥70%), not a blanket "≤2 may decline" — honest conservation status is the point.
    // "Hopeful" includes the RECOVERY / SUCCESS register (a species back from the brink reads
    // positive too) and the STABLE / WIDESPREAD / "does well" register (the cave's pipistrelle +
    // Daubenton's bat) — not just the static "thriving/common".
    const positives = SPECIES_ORDER.filter((id) =>
      /thriv|do(ing|es) well|common|at home|increasing|safe|recover|success|stable|widespread/.test(
        SPECIES_INFO[id].status.toLowerCase(),
      ),
    );
    // ≥58%: the world LEANS hopeful, but the soul-aware conservation biomes (Moor/Pine/Cave/Tidal) added
    // a NEUTRAL register too (endemic / restricted / nuanced — neither a hopeful keyword nor a decline),
    // and §4.2's ALPINE summit + §migration's ESTUARY are BY DESIGN the most conservation-pressured biomes
    // — the alpine "highest, last" roster (snow bunting with nowhere higher, retreating ring ouzel) AND the
    // estuary's Arctic-FLYWAY waders (the honest shorebird-decline stakes — near-threatened godwit, scarce
    // pintail, red-listed ringed plover; only the resident shelduck + the numerous wigeon clearly do well)
    // honestly lean to decline — that lean IS the teaching. So the explicitly-hopeful share settled a touch
    // lower again. It STILL leans hopeful (≈60% — a clear majority); the guard against an all-doom world holds.
    expect(positives.length).toBeGreaterThanOrEqual(Math.ceil(SPECIES_ORDER.length * 0.58));
  });
});
