// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { syncModalOpenClass } from '../modalClass';
import { JournalPanel } from '../JournalPanel';

/**
 * Mobile layering fix (BUG 1): while any overlay panel is open, body.modal-open hides
 * the gameplay HUD (so it can't bleed through the translucent backdrop or catch a
 * stray touch). The flag is POLLED from main's loop, so it must clear on EVERY close
 * path. These tests pin the toggle + that the poll clears it on ✕ / backdrop / Escape.
 *
 * ⚠️ jsdom can't render the actual layering / safe-area — that's Craig's on-device
 * check. This pins only the class-toggle logic + the close-path → isOpen()=false chain.
 */
const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('syncModalOpenClass — the HUD-hide flag', () => {
  it('open => body.modal-open set; closed => cleared', () => {
    syncModalOpenClass(true);
    expect(document.body.classList.contains('modal-open')).toBe(true);
    syncModalOpenClass(false);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});

describe('the poll clears modal-open on EVERY close path (no stuck-hidden HUD)', () => {
  // Mirrors main's per-frame poll over the open panels.
  const poll = (panel: JournalPanel) => syncModalOpenClass(panel.isOpen());
  const has = () => document.body.classList.contains('modal-open');

  const openPanel = (): JournalPanel => {
    const p = new JournalPanel(document.body);
    p.setOpen(true);
    poll(p);
    expect(has()).toBe(true); // open => HUD hidden
    return p;
  };

  it('the ✕ close clears it', () => {
    const p = openPanel();
    fireDown(document.querySelector('.journal-header .overlay-close')!);
    poll(p);
    expect(p.isOpen()).toBe(false);
    expect(has()).toBe(false);
  });

  it('a backdrop tap clears it', () => {
    const p = openPanel();
    fireDown(document.querySelector('.journal-overlay')!); // press on the overlay itself
    poll(p);
    expect(has()).toBe(false);
  });

  it('Escape clears it', () => {
    const p = openPanel();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    poll(p);
    expect(has()).toBe(false);
  });

  it('a programmatic close clears it', () => {
    const p = openPanel();
    p.setOpen(false);
    poll(p);
    expect(has()).toBe(false);
  });
});
