// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Controls } from '../Controls';

/**
 * The top-right HUD overlap fix is primarily CSS layout (coordinates), which jsdom
 * can't compute. What IS testable — and what prevents the collision from
 * reappearing — is the STRUCTURE: the two panel-toggle buttons must share one
 * layout container instead of being independently positioned. (The visual
 * non-overlap itself is a post-merge playtest check.)
 */
describe('Controls — top-right toggles share a layout container', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('journal + mission toggles live inside .hud-topright (not loose at the root)', () => {
    new Controls(document.body);
    const cluster = document.querySelector('.hud-topright');
    expect(cluster).not.toBeNull();

    const journal = document.querySelector('.action-journal');
    const missions = document.querySelector('.action-missions');
    expect(journal).not.toBeNull();
    expect(missions).not.toBeNull();
    // Both are children of the shared cluster — the structural fix.
    expect(journal!.parentElement).toBe(cluster);
    expect(missions!.parentElement).toBe(cluster);
  });

  it('the toggle buttons keep pointer-events enabled (still tappable, no occlusion)', () => {
    new Controls(document.body);
    // The buttons carry .action-btn, whose CSS (and the .hud-topright override)
    // re-enables pointer events even though the cluster is click-through.
    const journal = document.querySelector('.action-journal');
    expect(journal!.classList.contains('action-btn')).toBe(true);
  });
});
