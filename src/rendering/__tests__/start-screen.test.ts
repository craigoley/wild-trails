// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartScreen } from '../StartScreen';
import { START_SCREEN } from '../../utils/constants';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('StartScreen — closeable into play (not an uncloseable modal)', () => {
  it('the primary button dismisses it and calls onStart', () => {
    const onStart = vi.fn();
    const s = new StartScreen(document.body, { onStart, onSkip: vi.fn() });
    s.show(true);
    expect(s.isOpen()).toBe(true);
    fireDown(document.querySelector('.start-primary')!);
    expect(s.isOpen()).toBe(false);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('Escape / backdrop also begin play (onStart) — there is NO ✕ on a splash', () => {
    const onStart = vi.fn();
    const s = new StartScreen(document.body, { onStart, onSkip: vi.fn() });

    // The ✕ was removed in the dawn-meadow polish — Start IS the action.
    s.show(true);
    expect(document.querySelector('.start-overlay .overlay-close')).toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(s.isOpen()).toBe(false);

    s.show(true);
    fireDown(document.querySelector('.start-overlay')!); // backdrop
    expect(s.isOpen()).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it('Skip dismisses AND calls onSkip (suppress onboarding)', () => {
    const onSkip = vi.fn();
    const s = new StartScreen(document.body, { onStart: vi.fn(), onSkip });
    s.show(true);
    fireDown(document.querySelector('.start-skip')!);
    expect(s.isOpen()).toBe(false);
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('a returning player sees "Continue" and no Skip option', () => {
    const s = new StartScreen(document.body, { onStart: vi.fn(), onSkip: vi.fn() });
    s.show(false);
    expect(document.querySelector('.start-primary')!.textContent).toBe(START_SCREEN.continue);
    expect((document.querySelector('.start-skip') as HTMLElement).style.display).toBe('none');
  });
});
