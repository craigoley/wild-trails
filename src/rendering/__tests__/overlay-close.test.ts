// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { JournalPanel } from '../JournalPanel';
import { MissionPanel } from '../MissionPanel';

/**
 * The soft-trap fix: both overlays must be dismissable by ✕, a backdrop tap, and
 * Escape (touch + keyboard parity), and the open/close toggle must round-trip.
 * Run under jsdom so the DOM close handlers are EXERCISED, not faked.
 */

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const fireKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Journal overlay — dismissable', () => {
  it('the ✕ button closes it', () => {
    const p = new JournalPanel(document.body);
    p.setOpen(true);
    expect(p.isOpen()).toBe(true);
    fireDown(document.querySelector('.journal-overlay .overlay-close')!);
    expect(p.isOpen()).toBe(false);
  });

  it('a backdrop tap (press on the overlay, outside the panel) closes it', () => {
    const p = new JournalPanel(document.body);
    p.setOpen(true);
    fireDown(document.querySelector('.journal-overlay')!); // target === overlay root
    expect(p.isOpen()).toBe(false);
  });

  it('a press INSIDE the panel does NOT close it (only the backdrop does)', () => {
    const p = new JournalPanel(document.body);
    p.setOpen(true);
    fireDown(document.querySelector('.journal-panel')!); // inside the panel
    expect(p.isOpen()).toBe(true);
  });

  it('Escape closes it; other keys do not', () => {
    const p = new JournalPanel(document.body);
    p.setOpen(true);
    fireKey('a');
    expect(p.isOpen()).toBe(true);
    fireKey('Escape');
    expect(p.isOpen()).toBe(false);
  });

  it('the toggle round-trips: open then toggle returns to closed (hyp-a regression guard)', () => {
    const p = new JournalPanel(document.body);
    p.setOpen(true);
    expect(p.isOpen()).toBe(true);
    p.setOpen(!p.isOpen()); // the J / 📓 toggle (as main does)
    expect(p.isOpen()).toBe(false);
  });
});

describe('Mission overlay — dismissable (the identical sibling bug)', () => {
  it('✕, backdrop tap, and Escape each close it', () => {
    const p = new MissionPanel(document.body);

    p.setOpen(true);
    fireDown(document.querySelector('.mission-overlay .overlay-close')!);
    expect(p.isOpen()).toBe(false);

    p.setOpen(true);
    fireDown(document.querySelector('.mission-overlay')!);
    expect(p.isOpen()).toBe(false);

    p.setOpen(true);
    fireKey('Escape');
    expect(p.isOpen()).toBe(false);
  });
});
