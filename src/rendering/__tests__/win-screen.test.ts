// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { WinScreen } from '../WinScreen';
import { WIN } from '../../utils/constants';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('WinScreen — closeable, dismisses INTO free-roam (not an uncloseable modal)', () => {
  it('show() opens it; the ✕ closes it', () => {
    const win = new WinScreen(document.body);
    expect(win.isOpen()).toBe(false);
    win.show();
    expect(win.isOpen()).toBe(true);
    fireDown(document.querySelector('.win-overlay .overlay-close')!);
    expect(win.isOpen()).toBe(false); // back to free-roam
  });

  it('Escape and a backdrop tap also dismiss it (free-roam behaviour unchanged)', () => {
    const win = new WinScreen(document.body);
    win.show();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(win.isOpen()).toBe(false);

    win.show();
    fireDown(document.querySelector('.win-overlay')!); // backdrop
    expect(win.isOpen()).toBe(false);
  });

  it('§4.3 capstone — shows the quiet statement + the free-roam line (the census voice, arrived)', () => {
    const win = new WinScreen(document.body);
    win.show();
    const text = document.querySelector('.win-panel')!.textContent ?? '';
    expect(text).toContain(WIN.lead); // "The world is known, and it flourishes."
    expect(text).toContain('flourishes');
    expect(text).toContain(WIN.freeRoam);
  });

  it('⚠️ the SCORECARD is gone — no count / regions / rank / "complete" / "full" (collection residue)', () => {
    const win = new WinScreen(document.body);
    win.show();
    const text = (document.querySelector('.win-panel')!.textContent ?? '').toLowerCase();
    expect(text).not.toContain('catalogued'); // the N-of-N count
    expect(text).not.toContain('regions explored');
    expect(text).not.toContain('rank');
    expect(text).not.toContain('field guide'); // "Field Guide Complete" / "your field guide is full"
    expect(text).not.toContain('complete');
    expect(text).not.toContain('🌿');
  });
});
