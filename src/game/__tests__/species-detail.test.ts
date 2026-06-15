import { describe, expect, it } from 'vitest';
import { speciesDetailFor } from '../speciesDetail';
import { speciesForChallenge, speciesForResearch, targetForMission } from '../catchTarget';
import { createJournal } from '../../state/Journal';
import {
  ACTIVITY_LABEL,
  BAIT_DISPLAY,
  BIOMES,
  MISSIONS,
  MISSION_ORDER,
  RESEARCH_PROJECTS,
  RESEARCH_ORDER,
  SPECIES,
  SPECIES_DETAIL,
} from '../../utils/constants';

/**
 * §chip-detail — the PURE detail assembly (display-only). Pins: the LEAD/WHERE map a real species def,
 * the HOW tip is DERIVED from the bait + a wary/bold detectionRadius split at a data-pinned threshold,
 * and the WHY shows the tracked mission + lists OTHER active challenges ("Also serves"). The sheet
 * RENDER + the look are device-validated; this is the data contract.
 */

const missionSpecies = (id: string) => speciesForChallenge(MISSIONS[id].requirement);

describe('speciesDetailFor — LEAD + WHERE (a real read of the species def)', () => {
  it('details the SAME species the chip names (reuses targetForMission) + the live progress', () => {
    const j = createJournal();
    const id = MISSION_ORDER[0];
    const t = targetForMission(id, j)!;
    const d = speciesDetailFor(id, j)!;
    expect(d.species).toBe(t.species); // consistency: exactly what the chip shows
    expect(d.count).toBe(t.count);
    j.missions[id] = { progress: 1, completed: false };
    expect(speciesDetailFor(id, j)!.progress).toBe(1); // tracks the live catch progress
  });

  it('WHERE = habitat + the activity-window label ("any" → "Active all day")', () => {
    const id = MISSION_ORDER[0];
    const d = speciesDetailFor(id, createJournal())!;
    const def = SPECIES[d.species];
    expect(d.habitat).toBe(BIOMES[def.biome].displayName);
    // non-cave species use the generic ACTIVITY_LABEL (cave has its own override, tested elsewhere).
    if (def.biome !== 'cave') expect(d.activity).toBe(ACTIVITY_LABEL[def.activityWindow]);
  });

  it('returns null for an unknown id (the sheet stays closed)', () => {
    expect(speciesDetailFor('not-a-mission', createJournal())).toBeNull();
  });
});

describe('speciesDetailFor — HOW (derived from diet + a wary/bold detectionRadius split)', () => {
  it('the wary threshold is a real constant, and it actually SPLITS the roster (not degenerate)', () => {
    expect(typeof SPECIES_DETAIL.waryThreshold).toBe('number');
    const radii = Object.values(SPECIES).map((s) => s.detectionRadius);
    expect(radii.some((r) => r >= SPECIES_DETAIL.waryThreshold)).toBe(true); // some wary
    expect(radii.some((r) => r < SPECIES_DETAIL.waryThreshold)).toBe(true); // some bold
  });

  it('names the diet bait, and the tip flips on the detectionRadius split', () => {
    const wary = MISSION_ORDER.find((id) => SPECIES[missionSpecies(id)].detectionRadius >= SPECIES_DETAIL.waryThreshold)!;
    const bold = MISSION_ORDER.find((id) => SPECIES[missionSpecies(id)].detectionRadius < SPECIES_DETAIL.waryThreshold)!;

    const dWary = speciesDetailFor(wary, createJournal())!;
    expect(dWary.baitLabel).toBe(BAIT_DISPLAY[SPECIES[dWary.species].bait].label);
    expect(dWary.wary).toBe(true);
    expect(dWary.warinessTip).toBe(SPECIES_DETAIL.waryTip);

    const dBold = speciesDetailFor(bold, createJournal())!;
    expect(dBold.wary).toBe(false);
    expect(dBold.warinessTip).toBe(SPECIES_DETAIL.boldTip);
  });
});

describe('speciesDetailFor — WHY (the tracked goal + "Also serves")', () => {
  it('the tracked block IS the chip’s mission (title · progress · points)', () => {
    const id = MISSION_ORDER[0];
    const j = createJournal();
    j.missions[id] = { progress: 2, completed: false };
    const w = speciesDetailFor(id, j)!.why.tracked!;
    expect(w.title).toBe(MISSIONS[id].title);
    expect(w.progress).toBe(2);
    expect(w.count).toBe(MISSIONS[id].requirement.count);
    expect(w.points).toBe(MISSIONS[id].rewardPoints);
  });

  it('"Also serves" lists OTHER active challenges targeting the same species (an in-flight research)', () => {
    // Find a mission + a research project that target the SAME species.
    let pair: { m: string; r: string } | undefined;
    for (const m of MISSION_ORDER) {
      const s = missionSpecies(m);
      const r = RESEARCH_ORDER.find((rid) => speciesForResearch(rid) === s);
      if (r) {
        pair = { m, r };
        break;
      }
    }
    expect(pair).toBeTruthy();
    const j = createJournal();
    j.research[pair!.r] = { started: true, progress: 0, completed: false }; // make the research in-flight
    const d = speciesDetailFor(pair!.m, j)!;
    expect(d.why.alsoServes).toContain(RESEARCH_PROJECTS[pair!.r].name);
  });

  it('a single-serving species has an EMPTY "Also serves" (and never lists the tracked goal itself)', () => {
    // A tracked mission whose species no OTHER active (non-standalone) mission targets; fresh journal
    // → no research started → research contributes nothing.
    const active = MISSION_ORDER.filter((id) => !MISSIONS[id].standalone); // fresh journal: none completed
    const count: Record<string, number> = {};
    for (const id of active) count[missionSpecies(id)] = (count[missionSpecies(id)] ?? 0) + 1;
    const solo = active.find((id) => count[missionSpecies(id)] === 1)!;
    const d = speciesDetailFor(solo, createJournal())!;
    expect(d.why.alsoServes).toEqual([]);
    expect(d.why.alsoServes).not.toContain(MISSIONS[solo].title); // the tracked goal is never echoed here
  });
});
