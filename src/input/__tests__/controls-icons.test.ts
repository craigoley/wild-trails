// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Controls } from '../Controls';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Controls — top-right toggles use the consistent SVG icon set', () => {
  it('renders an inline SVG glyph (not an emoji) for every cluster toggle', () => {
    new Controls(document.body);
    for (const cls of [
      'action-journal',
      'action-missions',
      'action-research',
      'action-baitpanel',
      'action-mute',
    ]) {
      const btn = document.querySelector(`.${cls}`)!;
      expect(btn, cls).not.toBeNull();
      expect(btn.querySelector('svg'), `${cls} has an svg glyph`).not.toBeNull();
      expect(btn.getAttribute('aria-label'), `${cls} is labelled`).toBeTruthy();
    }
  });

  it('the bottom action buttons stay TEXT labels (CATCH/BAIT/HIDE), not icons', () => {
    new Controls(document.body);
    expect(document.querySelector('.action-catch')!.textContent).toContain('CATCH');
    // BAIT carries the selected-bait badge span, so assert the label text is present.
    expect(document.querySelector('.action-bait')!.textContent).toContain('BAIT');
    expect(document.querySelector('.action-hide')!.textContent).toContain('HIDE');
  });

  it('setMuted swaps the speaker glyph + toggles the muted class (stays an SVG)', () => {
    const c = new Controls(document.body);
    const mute = document.querySelector('.action-mute')!;
    c.setMuted(true);
    expect(mute.classList.contains('muted')).toBe(true);
    expect(mute.querySelector('svg')).not.toBeNull();
    expect(mute.getAttribute('aria-label')).toBe('Unmute sound');
    c.setMuted(false);
    expect(mute.classList.contains('muted')).toBe(false);
    expect(mute.querySelector('svg')).not.toBeNull();
  });
});
