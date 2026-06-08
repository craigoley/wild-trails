// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaitPanel } from '../BaitPanel';
import { createBaitState } from '../../game/Bait';
import { BAIT_ORDER, type BaitId } from '../../utils/constants';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const all = (): BaitId[] => [...BAIT_ORDER];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('BaitPanel — scroll architecture + close (matches the other panels)', () => {
  it('has the bounded scroll body with the list inside, and a ✕ in the fixed header', () => {
    const p = new BaitPanel(document.body, vi.fn());
    p.refresh(createBaitState(), () => true);
    expect(document.querySelector('.bait-scroll > .bait-select-list')).not.toBeNull();
    expect(document.querySelector('.bait-header > .overlay-close')).not.toBeNull();
    expect(document.querySelector('.bait-scroll .overlay-close')).toBeNull(); // ✕ never in the scroll
  });

  it('closes via the ✕ (overlayDismiss)', () => {
    const p = new BaitPanel(document.body, vi.fn());
    p.refresh(createBaitState(), () => true);
    p.setOpen(true);
    expect(p.isOpen()).toBe(true);
    fireDown(document.querySelector('.bait-header .overlay-close')!);
    expect(p.isOpen()).toBe(false);
  });
});

describe('BaitPanel — rows, selection, and the research gate', () => {
  it('renders one row per UNLOCKED bait (a gated bait is hidden until unlocked)', () => {
    const p = new BaitPanel(document.body, vi.fn());
    // Only the first three diets unlocked (fish gated) -> 3 rows.
    const unlocked = (id: BaitId) => id !== 'fish';
    p.refresh(createBaitState(), unlocked);
    expect(document.querySelectorAll('.bait-select-row').length).toBe(all().filter(unlocked).length);

    // Once fish unlocks, the 4th row appears.
    p.refresh(createBaitState(), () => true);
    expect(document.querySelectorAll('.bait-select-row').length).toBe(all().length);
  });

  it('highlights the selected bait and greys an empty one', () => {
    const bait = createBaitState();
    bait.selected = 'greens';
    bait.counts.seeds = 0; // empty -> non-selectable
    const p = new BaitPanel(document.body, vi.fn());
    p.refresh(bait, () => true);
    const rows = document.querySelectorAll('.bait-select-row');
    const seedsRow = rows[BAIT_ORDER.indexOf('seeds')];
    const greensRow = rows[BAIT_ORDER.indexOf('greens')];
    expect(greensRow.classList.contains('selected')).toBe(true);
    expect(seedsRow.classList.contains('empty')).toBe(true);
  });

  it('tapping a row SELECTS it (by index) and closes the panel — pick → deploy', () => {
    const onSelect = vi.fn();
    const p = new BaitPanel(document.body, onSelect);
    p.refresh(createBaitState(), () => true);
    p.setOpen(true);
    const insectsIdx = BAIT_ORDER.indexOf('insects');
    fireDown(document.querySelectorAll('.bait-select-row')[insectsIdx]);
    expect(onSelect).toHaveBeenCalledWith(insectsIdx);
    expect(p.isOpen()).toBe(false); // auto-closes so the next tap deploys
  });
});
