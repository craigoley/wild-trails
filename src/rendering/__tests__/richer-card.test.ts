// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { JournalPanel } from '../JournalPanel';
import { createJournal, recordCatch, JOURNAL_SCHEMA_VERSION } from '../../state/Journal';
import { SPECIES_INFO } from '../../utils/constants';

const head = (s: string) => s.slice(0, 30); // a stable prefix to match against textContent

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Richer species card (§4.1a) — field-guide page for a DISCOVERED species', () => {
  it('shows the field-note synthesis + behaviour + status + the kept at-a-glance row', () => {
    const j = createJournal();
    recordCatch(j, 'hedgehog', 1);
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const grid = document.querySelector('.journal-grid')!;
    expect(document.querySelector('.card-fieldnote')).not.toBeNull(); // the hero element
    expect(grid.textContent).toContain(head(SPECIES_INFO.hedgehog.fieldNote));
    expect(grid.textContent).toContain(head(SPECIES_INFO.hedgehog.behaviour));
    expect(grid.textContent).toContain(head(SPECIES_INFO.hedgehog.status));
    expect(grid.textContent).toContain('Diet:'); // the quiet at-a-glance facts kept
  });

  it('an UNDISCOVERED species stays ??? — no name or field note leaked (the reveal gate)', () => {
    const j = createJournal(); // nothing found
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const grid = document.querySelector('.journal-grid')!;
    expect(grid.textContent).not.toContain('Hedgehog');
    expect(grid.textContent).not.toContain(head(SPECIES_INFO.hedgehog.fieldNote));
    expect(document.querySelectorAll('.journal-silhouette').length).toBeGreaterThan(0);
  });

  it('the richer cards live INSIDE the scroll body (scroll architecture intact)', () => {
    const j = createJournal();
    recordCatch(j, 'frog', 1);
    const p = new JournalPanel(document.body);
    p.refresh(j);
    expect(document.querySelector('.journal-scroll .journal-grid .card-fieldnote')).not.toBeNull();
  });

  it('discovery alone reveals the card (all-on-catch; current schema v6)', () => {
    expect(JOURNAL_SCHEMA_VERSION).toBe(6);
  });
});
