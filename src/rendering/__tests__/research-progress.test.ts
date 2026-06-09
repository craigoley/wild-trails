// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResearchPanel } from '../ResearchPanel';
import { createJournal } from '../../state/Journal';
import { startResearch, evaluateResearch } from '../../game/Research';
import { addCredits } from '../../game/Economy';

/**
 * The research PROGRESS INDICATOR (render-only). Research is ACTIVITY-DRIVEN (a catch counter,
 * no timer — R0a). The bar shows how far along by ACTIVITY (fill = progress/count, "N more
 * catches"), NEVER a time/ETA. These pin: the fill DERIVES from existing progress/count; the
 * bar only shows while in progress; and the indicator introduces NO time/duration text.
 */
const ev = (s: string, b: string, p: string) => ({ species: s, biome: b, phase: p }) as Parameters<typeof evaluateResearch>[1];

const fillFor = (project: string): HTMLElement | null => {
  const row = [...document.querySelectorAll('.research-row')].find((r) => r.querySelector('.research-name')?.textContent?.includes(project));
  return (row?.querySelector('.research-progress-fill') as HTMLElement) ?? null;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Research progress bar — fill DERIVES from progress/count (no new state)', () => {
  it('a started project shows a bar whose width = progress/count (0/3 -> 0%, 2/3 -> 67%, 3/3 -> 100%)', () => {
    const j = createJournal();
    addCredits(j, 50);
    startResearch(j, 'study-hedgehog'); // catch the hedgehog ×3
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());

    p.refresh(j);
    expect(fillFor('Hedgehog')!.style.width).toBe('0%'); // started, 0/3

    evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk'));
    evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk'));
    p.refresh(j);
    expect(fillFor('Hedgehog')!.style.width).toBe('67%'); // 2/3 -> round(66.6)

    evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk')); // 3/3 -> auto-completes (no top-up)
    p.refresh(j);
    // completed -> the bar is gone (the ✓ badge is the state); never a stuck full bar.
    expect(fillFor('Hedgehog')).toBeNull();
    expect(document.body.textContent).toContain('Complete ✓');
  });

  it('the bar shows ONLY while in progress — not before Start, not after completion', () => {
    const j = createJournal();
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    expect(fillFor('Hedgehog')).toBeNull(); // un-started -> Start button, no bar
    expect(document.body.textContent).toContain('Start'); // the un-started action is unchanged
  });
});

const rowFor = (project: string): HTMLElement =>
  [...document.querySelectorAll('.research-row')].find(
    (r) => r.querySelector('.research-name')?.textContent?.includes(project),
  ) as HTMLElement;

describe('Research progress — UNIFIED: the bar CARRIES its count + action (not a disconnected strip)', () => {
  it('a started project renders the action+count ON the bar (one element), not a separate activity line', () => {
    const j = createJournal();
    addCredits(j, 50);
    startResearch(j, 'study-hedgehog'); // Catch the Hedgehog · 0/3
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);

    const row = rowFor('Hedgehog');
    const bar = row.querySelector('.research-progress')!;
    expect(bar).not.toBeNull();
    // The label lives INSIDE the bar and carries the action + count (the unify) ...
    const label = bar.querySelector('.research-progress-label')!;
    expect(label).not.toBeNull();
    expect(label.textContent).toMatch(/Catch the hedgehog · 0 \/ 3/);
    // ... and the fill is still inside the same bar (so the bar IS the visual of that count).
    expect(bar.querySelector('.research-progress-fill')).not.toBeNull();
    // The OLD separate activity line is gone while studying — the count isn't fragmented off the bar.
    expect(row.querySelector('.research-activity')).toBeNull();
  });

  it('⚠️ a knowledge-gated row keeps the mastery line DISTINCT from the bar (#37 two-requirement)', () => {
    const j = createJournal();
    addCredits(j, 50);
    startResearch(j, 'study-after-dark'); // activity bar + a "by play" mastery challenge
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);

    const row = rowFor('Nocturnal');
    const bar = row.querySelector('.research-progress')!;
    // The activity is ON the bar ...
    expect(bar.querySelector('.research-progress-label')!.textContent).toMatch(/·\s*0 \/ 3/);
    // ... and the mastery requirement is a SEPARATE sibling line — NOT merged into the bar.
    const knowledge = row.querySelector('.research-knowledge')!;
    expect(knowledge).not.toBeNull();
    expect(knowledge.textContent).toContain('by play');
    expect(bar.querySelector('.research-knowledge')).toBeNull(); // distinct, never inside the bar
  });

  it('un-started shows the plain activity line (no bar yet) so the pre-Start read is intact', () => {
    const j = createJournal();
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    const row = rowFor('Hedgehog');
    expect(row.querySelector('.research-progress')).toBeNull(); // no bar before Start
    expect(row.querySelector('.research-activity')!.textContent).toMatch(/Catch the hedgehog · 0 \/ 3/);
  });
});

describe('Research progress — ⚠️ activity-remaining, NEVER a time/ETA (R0a)', () => {
  it('the indicator carries NO time/duration text (no minutes/seconds/ETA — research is activity-driven)', () => {
    const j = createJournal();
    addCredits(j, 50);
    startResearch(j, 'study-hedgehog');
    evaluateResearch(j, ev('hedgehog', 'meadow', 'dusk'));
    const p = new ResearchPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j);
    const text = document.body.textContent!.toLowerCase();
    // The read is the activity count (catch · X / N), never a clock.
    expect(text).toMatch(/catch the hedgehog · 1 \/ 3/);
    for (const timeWord of [' min', ' sec', 'minute', 'second', 'eta', '~', 'remaining time', 'time left']) {
      expect(text).not.toContain(timeWord);
    }
  });
});
