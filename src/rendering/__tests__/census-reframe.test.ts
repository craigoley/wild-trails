// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { JournalPanel } from '../JournalPanel';
import { createJournal, recordCatch } from '../../state/Journal';
import { PANEL_LABELS, SPECIES_INFO } from '../../utils/constants';

/**
 * §4.3 — the CENSUS REFRAME (the journal as a record-that-matters). Copy + light display only: the
 * chosen minimal word-swaps make the journal READ as a naturalist's record, IMPLIED meaning, honest
 * facts UNTOUCHED. These pins lock the four word-swaps + the parchment status colour, and — the
 * heart — that the honest status SENTENCES are byte-identical (only the FRAME shifts, never the fact).
 */

const head = (s: string) => s.slice(0, 30);
const MEADOW = ['fieldmouse', 'rabbit', 'quail', 'hedgehog'] as const; // a fully-recordable biome

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('census reframe — the four chosen word-swaps render (collection → record)', () => {
  it('the header counter reads "recorded", not "found" (a record, not a tally)', () => {
    const p = new JournalPanel(document.body);
    p.refresh(createJournal());
    const title = document.querySelector('.journal-title')!.textContent!;
    expect(title).toContain(`of ${'62'} ${PANEL_LABELS.recordedWord}`); // "… of 55 recorded"
    expect(title).toContain('recorded');
    expect(title).not.toContain('found'); // the collection word is gone
  });

  it('the species-card status LABEL reads "In the wild", not "Status" (a field note, not a stat)', () => {
    const j = createJournal();
    recordCatch(j, 'hedgehog', 1);
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const label = document.querySelector('.card-status .card-label')!.textContent!;
    expect(label).toBe(PANEL_LABELS.statusLabel);
    expect(label).toBe('In the wild');
    expect(document.querySelector('.journal-grid')!.textContent).not.toContain('Status');
  });

  it('a fully-studied biome reads "known" (comprehension), not "4 of 4" (a perfect score)', () => {
    const j = createJournal();
    for (const id of MEADOW) recordCatch(j, id, 1); // record the whole meadow roster
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const meadow = [...document.querySelectorAll('.journal-biome')].find((h) =>
      h.textContent!.startsWith('Meadow'),
    )!;
    // The header text node (the thriving word is a separate appended span — read just the header).
    expect(meadow.firstChild!.textContent).toBe(`Meadow — ${PANEL_LABELS.biomeKnown}`); // "Meadow — known"
    expect(meadow.firstChild!.textContent).not.toContain('of'); // the bare score is gone once known
  });

  it('an INCOMPLETE biome keeps its "X of N" score (the gap still pulls — only COMPLETE → known)', () => {
    const j = createJournal();
    recordCatch(j, 'fieldmouse', 1); // 1 of 4 — not yet known
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const meadow = [...document.querySelectorAll('.journal-biome')].find((h) =>
      h.textContent!.startsWith('Meadow'),
    )!;
    expect(meadow.textContent).toContain('1 of 4'); // still a score while there's a gap
    expect(meadow.textContent).not.toContain('known');
  });

  it('the undiscovered slot reads "Not yet recorded" (the record vocabulary)', () => {
    const p = new JournalPanel(document.body);
    p.refresh(createJournal());
    const sil = document.querySelector('.journal-silhouette')!;
    expect(sil.textContent).toContain(PANEL_LABELS.notYetRecorded);
    expect(sil.textContent).not.toContain('Not yet found');
  });
});

describe('census reframe — ⚠️ the honest status SENTENCES are byte-UNTOUCHED (the heart)', () => {
  it('the emotional anchors are byte-identical — the reframe changes the FRAME, never the fact', () => {
    // If any of these sentences ever drifts, the reframe has overstepped from frame to fact. Pin the
    // exact bytes (em-dashes + curly quotes included) for the declining gull, the recovering seal,
    // and the near-threatened curlew — the lines that carry the weight.
    expect(SPECIES_INFO.herringgull.status).toBe(
      'Surprisingly red-listed and in decline — the bold “town gull” masks a real fall in our wild seabird colonies.',
    );
    expect(SPECIES_INFO.greyseal.status).toBe(
      'A conservation success — Britain now safeguards nearly half the world’s grey seals, back from the brink.',
    );
    expect(SPECIES_INFO.curlew.status).toBe(
      'Near-threatened and falling fast — and Britain is a global stronghold, so the curlew is the upland’s biggest single stake.',
    );
  });

  it('the rendered card prints the honest sentence VERBATIM after the (only) reframed label', () => {
    const j = createJournal();
    recordCatch(j, 'herringgull', 1);
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const status = document.querySelector('.card-status')!.textContent!;
    // The card status = the new label + the UNCHANGED sentence (the sentence is not mutated by render).
    expect(status).toBe(`${PANEL_LABELS.statusLabel}${SPECIES_INFO.herringgull.status}`);
    expect(status).toContain(head(SPECIES_INFO.herringgull.status));
  });
});

describe('census reframe — restraint pin (no subtitle — the journal BEING a record is enough)', () => {
  it('NO "record of the living world" subtitle is added — stating the meaning is the preachy edge', () => {
    const j = createJournal();
    recordCatch(j, 'rabbit', 1);
    const p = new JournalPanel(document.body);
    p.refresh(j);
    const text = document.querySelector('.journal-panel')!.textContent!;
    expect(text.toLowerCase()).not.toContain('record of the living world');
    expect(text.toLowerCase()).not.toContain('census of the living world');
  });

  // NOTE: the status COLOUR (hopeful-green → calm parchment, `.card-status` in style.css) is a FEEL
  // change, not behaviour — and vitest runs CSS-less (style imports resolve empty), matching the
  // project convention that colours are gated by Craig's device playtest, not unit-tested. The
  // parchment value lives in src/style.css; the tonal gate (does the fact read honest, unled?) is
  // the iPhone playtest on this draft.
});
