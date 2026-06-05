// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls, isRoamTouchTarget } from '../Controls';

/**
 * Scroll fix v4 (the MEASURED cause): the roam touch handler used to preventDefault
 * + enter roam state for ANY touch on #app, including panel touches that bubble up —
 * which cancels native iOS scroll. The fix: roam only begins when the touch target
 * is the game canvas. These tests pin that decision.
 *
 * ⚠️ jsdom has no touch/scroll engine — it CANNOT confirm iOS native scroll resumes.
 * That's the real gate (Craig, on-device). This only pins the handler PREDICATE.
 */

describe('isRoamTouchTarget — roam only on the game canvas', () => {
  it('a canvas target is a roam surface; everything else is not', () => {
    expect(isRoamTouchTarget(document.createElement('canvas'))).toBe(true);
    // A panel scroll body / any non-canvas element / null -> NOT a roam surface.
    const scroll = document.createElement('div');
    scroll.className = 'journal-scroll';
    expect(isRoamTouchTarget(scroll)).toBe(false);
    expect(isRoamTouchTarget(document.createElement('div'))).toBe(false);
    expect(isRoamTouchTarget(document.createElement('button'))).toBe(false);
    expect(isRoamTouchTarget(null)).toBe(false);
  });
});

describe('onTouchStart — only the canvas enters roam (so panel touches scroll)', () => {
  let controls: { onTouchStart: (e: unknown) => void; moveTouchId: number | null };

  beforeEach(() => {
    document.body.innerHTML = '';
    const app = document.createElement('div');
    document.body.appendChild(app);
    controls = new Controls(app) as unknown as typeof controls;
  });

  const touch = (target: EventTarget, id: number) => {
    const preventDefault = vi.fn();
    return {
      e: { target, changedTouches: [{ identifier: id, clientX: 10, clientY: 10 }], preventDefault },
      preventDefault,
    };
  };

  it('a NON-canvas touch (panel) does NOT preventDefault + never enters roam', () => {
    const scroll = document.createElement('div');
    scroll.className = 'journal-scroll';
    const { e, preventDefault } = touch(scroll, 1);
    controls.onTouchStart(e);
    expect(preventDefault).not.toHaveBeenCalled(); // native scroll left alone
    expect(controls.moveTouchId).toBeNull(); // never owns the touch as a roam
  });

  it('a CANVAS touch preventDefaults + owns the roam (world-roam unchanged)', () => {
    const canvas = document.createElement('canvas');
    const { e, preventDefault } = touch(canvas, 2);
    controls.onTouchStart(e);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(controls.moveTouchId).toBe(2); // roam owned for the whole touch
  });

  it('edge case: roam ownership is decided at touchstart by target, then stable', () => {
    // A canvas touchstart owns the roam (id 7); a later panel touchstart while that
    // roam is active is ignored (moveTouchId already set) — so the canvas drag keeps
    // roaming even if it slides over a panel.
    controls.onTouchStart(touch(document.createElement('canvas'), 7).e);
    expect(controls.moveTouchId).toBe(7);
    const panel = document.createElement('div');
    panel.className = 'mission-scroll';
    controls.onTouchStart(touch(panel, 8).e);
    expect(controls.moveTouchId).toBe(7); // unchanged — the canvas still owns it
  });
});
