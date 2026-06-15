// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DetailSheet } from '../DetailSheet';
import { TargetChip } from '../TargetChip';
import { createJournal } from '../../state/Journal';
import { MISSION_ORDER, MISSIONS } from '../../utils/constants';
import { speciesForChallenge } from '../../game/catchTarget';
import { SPECIES } from '../../utils/constants';

/**
 * §chip-detail — the bottom sheet (DOM) + the chip tap target. Pins: the sheet renders the lead + the
 * three sections, opens/closes via the dismissal paths (handle / scrim / Escape), and the chip fires its
 * tap callback on pointerdown (additive — the roam handler is untouched). The LOOK is Craig's device gate.
 */

beforeEach(() => {
  document.body.innerHTML = '';
});

const trackedId = MISSION_ORDER[0];
const overlay = () => document.querySelector('.detail-overlay') as HTMLElement;
const sheetText = () => document.querySelector('.detail-sheet')?.textContent ?? '';

describe('DetailSheet — the bottom-sheet detail card', () => {
  it('opens for the tracked mission, rendering the LEAD + WHERE / HOW / WHY sections', () => {
    const s = new DetailSheet(document.body);
    s.openFor(trackedId, createJournal());
    expect(s.isOpen()).toBe(true);
    expect(overlay().style.display).toBe('flex'); // a partial overlay (the world shows above the scrim)
    expect(document.querySelector('.detail-lead')).not.toBeNull();
    expect(document.querySelectorAll('.detail-section').length).toBe(3); // WHERE / HOW / WHY
    const text = sheetText();
    expect(text).toContain('Where');
    expect(text).toContain('How');
    expect(text).toContain('Why');
    expect(text).toContain(SPECIES[speciesForChallenge(MISSIONS[trackedId].requirement)].displayName);
    expect(text).toContain(MISSIONS[trackedId].title); // the tracked goal
  });

  it('has obvious dismissal — a drag-handle, a scrim tap, and Escape (never a trap)', () => {
    const s = new DetailSheet(document.body);

    // drag-handle tap
    s.openFor(trackedId, createJournal());
    (document.querySelector('.detail-handle') as HTMLElement).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(s.isOpen()).toBe(false);

    // scrim (the overlay root) tap
    s.openFor(trackedId, createJournal());
    const root = overlay();
    const ev = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: root }); // a press on the scrim itself, not the sheet
    root.dispatchEvent(ev);
    expect(s.isOpen()).toBe(false);

    // Escape
    s.openFor(trackedId, createJournal());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(s.isOpen()).toBe(false);
  });

  it('is hidden until opened (display:none), so it never blocks play passively', () => {
    new DetailSheet(document.body);
    expect(overlay().style.display).toBe('none');
  });
});

describe('TargetChip — the tap target (additive; no roam change)', () => {
  it('fires its onTap on pointerdown (the chip becomes the hit target)', () => {
    const chip = new TargetChip(document.body);
    const onTap = vi.fn();
    chip.setOnTap(onTap);
    const el = document.querySelector('.hud-target') as HTMLElement;
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('exposes a button role for the tap affordance', () => {
    new TargetChip(document.body);
    const el = document.querySelector('.hud-target') as HTMLElement;
    expect(el.getAttribute('role')).toBe('button');
  });
});
