// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { JournalPanel } from '../JournalPanel';
import { MissionPanel } from '../MissionPanel';
import { createJournal } from '../../state/Journal';

/**
 * Pins the STRUCTURE of the iOS scroll/exit fix (Plan #7/#16 follow-up): the ✕
 * lives in the NON-scrolling header bar (so it never scrolls away on touch), and
 * the content lives in a dedicated scroll BODY.
 *
 * ⚠️ HONEST LIMIT: jsdom has NO layout/touch engine, so it CANNOT confirm that iOS
 * Safari actually touch-scrolls the body or that the ✕ is thumb-reachable. Those —
 * the real bugs — can only be validated by a real-iPhone playtest. The min-height:0
 * + dvh + ≥44px + safe-area pieces live in style.css and are NOT asserted here. This
 * test only guards the DOM architecture that makes the CSS fix possible.
 */

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Journal panel — scroll/exit structure', () => {
  it('the ✕ is in the fixed header; the grid is in the scroll body', () => {
    new JournalPanel(document.body);
    // ✕ in the non-scrolling header bar...
    expect(document.querySelector('.journal-header > .overlay-close')).not.toBeNull();
    // ...and NOT inside the scroll area (where it could scroll away on touch).
    expect(document.querySelector('.journal-scroll .overlay-close')).toBeNull();
    // The species grid scrolls within the dedicated body.
    expect(document.querySelector('.journal-scroll > .journal-grid')).not.toBeNull();
  });

  it('refreshing the header title does NOT remove the ✕ (separate elements)', () => {
    const p = new JournalPanel(document.body);
    p.refresh(createJournal()); // sets the title text
    expect(document.querySelector('.journal-header > .overlay-close')).not.toBeNull();
    expect(document.querySelector('.journal-title')).not.toBeNull();
  });
});

describe('Mission panel — same structure', () => {
  it('the ✕ is in the fixed header; the list is in the scroll body', () => {
    new MissionPanel(document.body);
    expect(document.querySelector('.mission-header > .overlay-close')).not.toBeNull();
    expect(document.querySelector('.mission-scroll .overlay-close')).toBeNull();
    expect(document.querySelector('.mission-scroll > .mission-list')).not.toBeNull();
  });
});
