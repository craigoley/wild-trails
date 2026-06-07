// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchPanel } from '../ResearchPanel';
import { JournalPanel } from '../JournalPanel';
import { researchBannerMessages } from '../missionBanners';
import { createJournal, recordCatch } from '../../state/Journal';
import { startResearch, evaluateResearch } from '../../game/Research';
import { addCredits } from '../../game/Economy';
import { RESEARCH_PROJECTS, SPECIES_INFO } from '../../utils/constants';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const ev = (species: string, biome: string, phase: string) =>
  ({ species, biome, phase }) as Parameters<typeof evaluateResearch>[1];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ResearchPanel — clones the panel/scroll architecture (the #28/#30/#31 reuse)', () => {
  it('has the bounded scroll body with the list inside, and a ✕ in the FIXED header (not the scroll)', () => {
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(createJournal());
    expect(document.querySelector('.research-scroll > .research-list')).not.toBeNull();
    expect(document.querySelector('.research-header > .overlay-close')).not.toBeNull();
    expect(document.querySelector('.research-scroll .overlay-close')).toBeNull(); // ✕ never scrolls away
  });

  it('closes via the ✕ (overlayDismiss)', () => {
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(createJournal());
    p.setOpen(true);
    expect(p.isOpen()).toBe(true);
    fireDown(document.querySelector('.research-header .overlay-close')!);
    expect(p.isOpen()).toBe(false);
  });
});

describe('ResearchPanel — projects, Start, and state', () => {
  it('lists every project; a project starts on Start (spends credits via the callback)', () => {
    const j = createJournal();
    addCredits(j, 20);
    const onStart = vi.fn((id: string) => startResearch(j, id));
    const p = new ResearchPanel(document.body, onStart, vi.fn());
    p.refresh(j);
    expect(document.querySelectorAll('.research-row').length).toBe(Object.keys(RESEARCH_PROJECTS).length);

    // Start the first project (study-hedgehog, cost 8).
    const startBtn = document.querySelector('.research-row .shop-buy') as HTMLButtonElement;
    expect(startBtn.textContent).toContain('Start');
    fireDown(startBtn);
    expect(onStart).toHaveBeenCalledWith('study-hedgehog');
    expect(j.research['study-hedgehog'].started).toBe(true);
    expect(j.credits).toBe(12);
  });

  it("the knowledge gate is shown legibly (not a silent wall) once a project's activity is short of its knowledge", () => {
    const j = createJournal();
    addCredits(j, 50);
    startResearch(j, 'study-after-dark'); // needs research-mouse-night (by play)
    for (let i = 0; i < 3; i++) evaluateResearch(j, ev('fieldmouse', 'meadow', 'night')); // activity done
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    // The knowledge requirement isn't met -> the row surfaces what's needed, not a buy.
    const text = [...document.querySelectorAll('.research-row')].map((r) => r.textContent).join(' ');
    expect(text).toContain('Needs:');
  });
});

describe('researchBannerMessages — the catch-time nudge (reuses the Banner)', () => {
  it('a progress event shows "name — n/m"; completion shows "Research complete"; a non-match shows nothing', () => {
    const j = createJournal();
    addCredits(j, 20);
    startResearch(j, 'study-hedgehog');

    const r1 = evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk')); // 1/3
    const m1 = researchBannerMessages(j, r1);
    expect(m1).toHaveLength(1);
    expect(m1[0].kind).toBe('research');
    expect(m1[0].text).toContain('1/3');

    evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk'));
    const r3 = evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk')); // 3/3 -> complete
    expect(researchBannerMessages(j, r3).some((m) => m.text.includes('Research complete'))).toBe(true);

    const r4 = evaluateResearch(j, ev('fieldmouse', 'meadow', 'day')); // non-qualifying
    expect(researchBannerMessages(j, r4)).toEqual([]);
  });
});

describe('R0b reward effect — completing a project reveals the deeper card layer (additive)', () => {
  it("the hedgehog's researchNote shows on its dex card ONLY after study-hedgehog completes", () => {
    const j = createJournal();
    recordCatch(j, 'hedgehog', 1); // found -> the card renders
    const note = SPECIES_INFO.hedgehog.researchNote!.slice(0, 30);

    const panel = new JournalPanel(document.body);
    panel.refresh(j);
    expect(document.querySelector('.card-research')).toBeNull(); // locked -> not shown
    expect(document.querySelector('.journal-grid')!.textContent).not.toContain(note);

    // Complete the project (by activity), then refresh the dex.
    addCredits(j, 20);
    startResearch(j, 'study-hedgehog');
    for (let i = 0; i < 3; i++) evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk'));
    panel.refresh(j);

    expect(document.querySelector('.card-research')).not.toBeNull(); // now revealed
    expect(document.querySelector('.journal-grid')!.textContent).toContain(note);
  });
});
