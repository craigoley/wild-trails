// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { JournalPanel } from '../JournalPanel';
import { MissionPanel } from '../MissionPanel';
import { createJournal, recordCatch } from '../../state/Journal';

const telemetry = { offered: 0, started: 0, progressed: 0, completed: 0, rewardsClaimed: 0 };

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Journal panel — grouped by biome', () => {
  it('renders all 5 biome headers, inside the scroll body, with the overall total kept', () => {
    const p = new JournalPanel(document.body);
    p.refresh(createJournal());
    expect(document.querySelectorAll('.journal-biome')).toHaveLength(15); // all 15 biomes (+ §desert Sonoran Desert) shown (+ §migration Estuary) (+ §hedgerow Hedgerow + Hazel Copse) (+ Alpine Summit, §4.2)
    // The grouping lives INSIDE the scroll body — the scroll architecture is untouched.
    expect(document.querySelector('.journal-scroll > .journal-grid > .journal-biome')).not.toBeNull();
    // Overall "X of N" total still in the panel header.
    expect(document.querySelector('.journal-title')!.textContent).toContain('0 of 69');
  });

  it('undiscovered species stay "???" (name NOT leaked) under their biome header', () => {
    const p = new JournalPanel(document.body);
    p.refresh(createJournal()); // nothing found
    const grid = document.querySelector('.journal-grid')!;
    // Biome NAME shows (the header); species names do NOT.
    expect(grid.textContent).toContain('Highlands');
    expect(grid.textContent).not.toContain('Rock Ptarmigan');
    expect(grid.textContent).not.toContain('Dotterel');
    expect(document.querySelectorAll('.journal-silhouette').length).toBeGreaterThan(0);
  });

  it('a found species shows its card; locked biomes are marked, the Meadow is not', () => {
    const j = createJournal();
    recordCatch(j, 'fieldmouse', 1); // a meadow species
    const p = new JournalPanel(document.body);
    p.refresh(j);
    expect(document.querySelector('.journal-grid')!.textContent).toContain('Field Mouse');
    // Fresh-ish journal: Wetland + Highlands are locked (not earned) -> marked.
    expect(document.querySelectorAll('.journal-biome.locked').length).toBeGreaterThan(0);
    // The Meadow header is NOT locked.
    const meadow = [...document.querySelectorAll('.journal-biome')].find((h) =>
      h.textContent!.startsWith('Meadow'),
    )!;
    expect(meadow.classList.contains('locked')).toBe(false);
  });
});

describe('Mission panel — Active / Completed sections', () => {
  it('shows an Active section; the empty Completed section has no header (early game)', () => {
    const p = new MissionPanel(document.body);
    p.refresh(createJournal(), telemetry, false); // nothing completed yet
    const sections = [...document.querySelectorAll('.mission-section')].map((e) => e.textContent);
    expect(sections).toContain('Active');
    expect(sections).not.toContain('Completed'); // empty -> hidden
    // Sections live inside the scroll body (scroll architecture untouched).
    expect(document.querySelector('.mission-scroll > .mission-list > .mission-section')).not.toBeNull();
  });

  it('a completed mission moves to a Completed section', () => {
    const j = createJournal();
    j.missions['meadow-survey'] = { progress: 5, completed: true };
    const p = new MissionPanel(document.body);
    p.refresh(j, telemetry, false);
    const sections = [...document.querySelectorAll('.mission-section')].map((e) => e.textContent);
    expect(sections).toContain('Active');
    expect(sections).toContain('Completed');
  });
});
