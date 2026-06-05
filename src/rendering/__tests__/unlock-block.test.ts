// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { MissionPanel } from '../MissionPanel';
import { createJournal } from '../../state/Journal';

const telemetry = { offered: 0, started: 0, progressed: 0, completed: 0, rewardsClaimed: 0 };

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('MissionPanel — the "Reach new lands" unlock block (§17.1)', () => {
  it('renders the carrot inside the scroll body (scroll architecture untouched)', () => {
    const p = new MissionPanel(document.body);
    p.refresh(createJournal(), telemetry, false);
    // The block lives INSIDE the scroll body — the #28/#30/#31 structure is intact.
    expect(document.querySelector('.mission-scroll > .mission-list .unlock-line')).not.toBeNull();
    const list = document.querySelector('.mission-list')!;
    expect(list.textContent).toContain('Reach new lands');
    // In-progress carrot: the set→biome relationship + a "done of total".
    expect(list.textContent).toContain('Complete the Meadow missions to reach the Woodland');
    expect(list.textContent).toContain('0 of 3');
  });

  it('an already-unlocked set reads as a quiet ✓ line (the path walked)', () => {
    const j = createJournal();
    j.unlockedBiomes = ['woodland']; // Meadow set already opened the Woodland
    const p = new MissionPanel(document.body);
    p.refresh(j, telemetry, false);
    const opened = [...document.querySelectorAll('.unlock-line.done')].map((e) => e.textContent);
    expect(opened.some((t) => t!.includes('✓') && t!.includes('Woodland'))).toBe(true);
  });

  it('shows no carrot for the terminal Highlands (it unlocks nothing)', () => {
    const p = new MissionPanel(document.body);
    p.refresh(createJournal(), telemetry, false);
    const lines = [...document.querySelectorAll('.unlock-line')].map((e) => e.textContent);
    // Three gating sets unlock Woodland/Wetland/Highlands; none is a "reach the …"
    // line for a Highlands SET (Highlands has no missions / no onward biome).
    expect(lines.some((t) => t!.includes('Highlands missions'))).toBe(false);
  });
});
