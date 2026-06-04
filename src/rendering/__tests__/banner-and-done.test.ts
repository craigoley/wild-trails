// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { Banner } from '../Banner';
import { MissionPanel } from '../MissionPanel';
import { createJournal } from '../../state/Journal';
import { BANNER } from '../../utils/constants';
import type { MissionTelemetry } from '../MissionPanel';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Banner — shows queued messages, fades, then hides', () => {
  it('a queued message becomes visible on the next tick', () => {
    const b = new Banner(document.body);
    expect(b.visible).toBe(false); // nothing until enqueued + ticked
    b.enqueue('Mission complete: Meadow Survey', 'mission');
    b.tick(0.01);
    expect(b.visible).toBe(true);
    expect(b.text).toContain('Meadow Survey');
  });

  it('hides itself after its duration elapses (no permanent banner)', () => {
    const b = new Banner(document.body);
    b.enqueue('done', 'mission');
    b.tick(0.01);
    expect(b.visible).toBe(true);
    b.tick(BANNER.missionSec + 1); // run past its lifetime
    expect(b.visible).toBe(false);
  });

  it('queues sequentially — a completion then its unlock both get shown', () => {
    const b = new Banner(document.body);
    b.enqueue('Mission complete', 'mission');
    b.enqueue('New area unlocked: Woodland!', 'unlock');
    b.tick(0.01);
    expect(b.text).toContain('Mission complete');
    b.tick(BANNER.missionSec + 1); // expire the first (queue still has the unlock)
    b.tick(0.01); // pick up the next
    expect(b.text).toContain('Woodland');
  });
});

describe('MissionPanel — a completed mission renders the done/✓ state', () => {
  const telemetry: MissionTelemetry = {
    offered: 3,
    started: 1,
    progressed: 5,
    completed: 1,
    rewardsClaimed: 1,
  };

  it('a completed mission row gets the .done class and reads "Complete"', () => {
    const panel = new MissionPanel(document.body);
    const j = createJournal();
    j.missions['meadow-survey'] = { progress: 5, completed: true };
    panel.refresh(j, telemetry, false);

    const done = document.querySelector('.mission-overlay .mission-row.done');
    expect(done).not.toBeNull();
    expect(done!.textContent).toContain('✓');
    expect(done!.textContent).toContain('Complete');
  });

  it('an in-progress mission is NOT marked done', () => {
    const panel = new MissionPanel(document.body);
    const j = createJournal();
    j.missions['meadow-dusk'] = { progress: 1, completed: false };
    panel.refresh(j, telemetry, false);
    // The dusk row exists but isn't .done.
    const rows = [...document.querySelectorAll('.mission-row')];
    const duskRow = rows.find((r) => r.textContent?.includes('Dusk'));
    expect(duskRow).toBeDefined();
    expect(duskRow!.classList.contains('done')).toBe(false);
  });
});
