// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { WinScreen } from '../WinScreen';
import { createJournal } from '../../state/Journal';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('WinScreen — closeable, dismisses INTO free-roam (not an uncloseable modal)', () => {
  it('show() opens it; the ✕ closes it', () => {
    const win = new WinScreen(document.body);
    expect(win.isOpen()).toBe(false);
    win.show(createJournal());
    expect(win.isOpen()).toBe(true);
    fireDown(document.querySelector('.win-overlay .overlay-close')!);
    expect(win.isOpen()).toBe(false); // back to free-roam
  });

  it('Escape and a backdrop tap also dismiss it', () => {
    const win = new WinScreen(document.body);
    win.show(createJournal());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(win.isOpen()).toBe(false);

    win.show(createJournal());
    fireDown(document.querySelector('.win-overlay')!); // backdrop
    expect(win.isOpen()).toBe(false);
  });

  it('renders the completion summary (title + the field-guide stats)', () => {
    const win = new WinScreen(document.body);
    win.show(createJournal());
    const text = document.querySelector('.win-panel')!.textContent ?? '';
    expect(text).toContain('Field Guide Complete');
    expect(text).toContain('creatures catalogued');
  });
});
