// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchPanel } from '../ResearchPanel';
import {
  activityBiome,
  groupResearchByArea,
  isAreaAccessed,
  isProjectVisible,
} from '../researchGroups';
import { createJournal } from '../../state/Journal';
import { startResearch } from '../../game/Research';
import { addCredits } from '../../game/Economy';
import { RESEARCH_PROJECTS } from '../../utils/constants';

beforeEach(() => {
  document.body.innerHTML = '';
});

const text = () => document.body.textContent ?? '';
const rowNames = () =>
  [...document.querySelectorAll('.research-row .research-name')].map((n) => n.textContent);

// A player who has reached the wetland (meadow always + wetland earned) but no further.
const wetlandPlayer = () => {
  const j = createJournal();
  addCredits(j, 200);
  j.unlockedBiomes.push('wetland');
  return j;
};

describe('researchGroups (pure) — the project→area tag + the hide rule', () => {
  it('every project resolves an area tag (incl. the catch-in-phase one — no derive ambiguity)', () => {
    for (const id of Object.keys(RESEARCH_PROJECTS)) {
      expect(RESEARCH_PROJECTS[id].area, id).toBeTruthy();
    }
    // study-after-dark is catch-in-phase (no activity biome) but still tags an area.
    expect(RESEARCH_PROJECTS['study-after-dark'].area).toBe('meadow');
    expect(activityBiome(RESEARCH_PROJECTS['study-after-dark'])).toBeNull();
  });

  it('access predicate matches the journal source of truth (meadow always + unlockedBiomes)', () => {
    const j = createJournal();
    expect(isAreaAccessed(j, 'meadow')).toBe(true);
    expect(isAreaAccessed(j, 'wetland')).toBe(false);
    j.unlockedBiomes.push('wetland');
    expect(isAreaAccessed(j, 'wetland')).toBe(true);
  });

  it('hide rule: visible iff its activity area is accessed OR it is started', () => {
    const j = wetlandPlayer();
    // internal wetland study — activity in the accessed wetland → visible
    expect(isProjectVisible(j, RESEARCH_PROJECTS['study-the-wetland'])).toBe(true);
    // internal highlands study — activity in a NOT-accessed area → hidden
    expect(isProjectVisible(j, RESEARCH_PROJECTS['study-the-uplands'])).toBe(false);
    // ...UNLESS it's already started (old-save in-flight safety) → shown again
    startResearch(j, 'study-the-uplands');
    expect(isProjectVisible(j, RESEARCH_PROJECTS['study-the-uplands'])).toBe(true);
  });
});

describe('ResearchPanel — grouped by area + the one-area-ahead breadcrumb horizon', () => {
  it('⚠️ P1: the access card RELOCATES to its (accessed) activity area — still startable, never hidden', () => {
    const j = wetlandPlayer();
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    // Highlands Access (activity = catch in the accessed wetland) renders as a startable card —
    // under the WETLAND section now (its activity area), NOT the locked Highlands. The unlock
    // mechanism is intact (the Start card lives where you can act on it).
    expect(rowNames()).toContain('Highlands Access');
    // ...but the highlands INTERNAL study (activity in not-accessed highlands) is still hidden.
    expect(rowNames()).not.toContain('The Open Tops');
    // P1: the locked Highlands section shows ONLY the how-to-reach breadcrumb (no card, no Start).
    expect(text()).toContain('Reach by completing ‘Highlands Access’ in the Wetland');
    expect(text()).not.toContain('More to study here once you arrive');
  });

  it('⚠️ areas 2+ ahead show "more lands ahead" — no dead-end breadcrumb', () => {
    const j = wetlandPlayer(); // riverbank is two areas ahead of the wetland
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    // Riverbank Access's activity is in the (not-accessed) highlands → its breadcrumb is NOT shown.
    expect(rowNames()).not.toContain('Riverbank Access');
    expect(rowNames()).not.toContain('Aquatic Life');
    expect(text()).toContain('More lands ahead');
  });

  it('an ACCESSED area shows its projects fully (Wetland → The Water’s Edge card)', () => {
    const j = wetlandPlayer();
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    expect(rowNames()).toContain('The Water’s Edge'); // study-the-wetland, full card
    expect(text()).toContain('Wetland'); // a plain (non-locked) area header
  });

  it('a collapsed section renders NO Start control for the hidden internals (only the teaser)', () => {
    const j = wetlandPlayer();
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    // The Riverbank section is collapsed to a teaser — no card, hence no Start button there.
    // (Confirm the hidden internal 'Aquatic Life' contributed no startable row.)
    const names = rowNames();
    expect(names).not.toContain('Aquatic Life');
    expect(document.querySelector('.research-teaser')).not.toBeNull();
  });

  it('the in-flight safety: a STARTED project in a not-accessed area is never hidden', () => {
    const j = wetlandPlayer();
    startResearch(j, 'study-the-uplands'); // pre-started (e.g. an old save) while highlands locked
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    expect(rowNames()).toContain('The Open Tops'); // shown so it can still be completed
  });
});

describe('groupResearchByArea (pure) — section shape', () => {
  it('orders meadow → … in world order; woodland now hosts the relocated Pine Forest Access', () => {
    const groups = groupResearchByArea(wetlandPlayer());
    const areas = groups.map((g) => g.area);
    // P1: woodland has no NATIVE project, but Pine Forest Access (activity = woodland) relocates
    // here — so the woodland section now exists (its access card lives where the work is done).
    expect(areas).toContain('woodland');
    expect(areas[0]).toBe('meadow');
    // meadow + wetland accessed; highlands/riverbank/coast not.
    expect(groups.find((g) => g.area === 'wetland')!.accessed).toBe(true);
    expect(groups.find((g) => g.area === 'highlands')!.accessed).toBe(false);
    // P1: the one-area-ahead locked section carries a reach breadcrumb; 2+ ahead does not.
    expect(groups.find((g) => g.area === 'highlands')!.reach).not.toBeNull();
    expect(groups.find((g) => g.area === 'riverbank')!.reach).toBeNull(); // 2+ ahead
  });
});

describe('groupResearchByArea (pure) — P1: gating cards relocate to their activity area', () => {
  it('the access project displays under its accessed PREREQ area, not its locked target', () => {
    const groups = groupResearchByArea(wetlandPlayer());
    const wetland = groups.find((g) => g.area === 'wetland')!;
    const highlands = groups.find((g) => g.area === 'highlands')!;
    // Highlands Access (reward biome = highlands, activity = wetland) relocates to the WETLAND group...
    expect(wetland.visibleIds).toContain('unlock-the-highlands');
    // ...and is NOT in the locked Highlands group (whose own study cards stay there, hidden).
    expect(highlands.visibleIds).not.toContain('unlock-the-highlands');
  });

  it('the locked one-ahead section names its access project + accessed prereq in `reach`', () => {
    const highlands = groupResearchByArea(wetlandPlayer()).find((g) => g.area === 'highlands')!;
    expect(highlands.reach).toEqual({ projectName: 'Highlands Access', prereqName: 'Wetland' });
  });
});
