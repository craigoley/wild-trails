// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TargetChip } from '../TargetChip';
import { MissionPanel } from '../MissionPanel';
import { createJournal } from '../../state/Journal';
import { SPECIES } from '../../utils/constants';
import type { CatchTarget } from '../../game/catchTarget';

/**
 * §HUD catch-target (ii) — the play-screen chip + tap-to-track (DOM). ⚠️ Contextual: hidden with no
 * target; the portrait + count when tracked; the .is-near pulse class toggles. Tap-to-track adds a quiet
 * button per active mission row → the boundary callback. The clean-not-cluttered FEEL is Craig's gate.
 */

const target = (over: Partial<CatchTarget>): CatchTarget => ({ species: 'hedgehog', progress: 0, count: 3, ...over });

describe('TargetChip — contextual presence + the count + the near pulse', () => {
  it('null target → hidden; a tracked target → shown with the portrait + name + count', () => {
    const chip = new TargetChip(document.body);
    const el = document.querySelector('.hud-target') as HTMLElement;

    chip.update(null, null, false);
    expect(el.style.display).toBe('none'); // contextual — nothing tracked, nothing shown

    chip.update(target({ progress: 1 }), null, false);
    expect(el.style.display).not.toBe('none');
    expect(el.querySelector('.species-thumb')).not.toBeNull(); // the slice-(i) portrait
    expect(el.querySelector('.hud-target-name')!.textContent).toBe(SPECIES.hedgehog.displayName);
    expect(el.querySelector('.hud-target-count')!.textContent).toBe('1/3');
    document.body.innerHTML = '';
  });

  it('⚠️ pulses (.is-near) only when the target is near (a gentle nudge, toggled per frame)', () => {
    const chip = new TargetChip(document.body);
    const el = document.querySelector('.hud-target') as HTMLElement;
    chip.update(target({}), null, true);
    expect(el.classList.contains('is-near')).toBe(true);
    chip.update(target({}), null, false);
    expect(el.classList.contains('is-near')).toBe(false); // off when not near
    document.body.innerHTML = '';
  });
});

describe('MissionPanel — tap-to-track (the chip’s override)', () => {
  it('active rows carry a Track button; clicking it fires onTrack + marks it tracking', () => {
    const panel = new MissionPanel(document.body);
    let tracked: string | null = null;
    panel.setOnTrack((id) => (tracked = id));
    panel.refresh(createJournal(), { offered: 0, started: 0, progressed: 0, completed: 0, rewardsClaimed: 0 }, false);

    const btn = document.querySelector('.mission-track') as HTMLButtonElement;
    expect(btn).not.toBeNull(); // a quiet track affordance on an active mission
    expect(btn.dataset.mid).toBeTruthy();
    btn.click();
    expect(tracked).toBe(btn.dataset.mid); // the boundary got the tracked id
    expect(btn.classList.contains('is-tracked')).toBe(true); // reflected in place (no full refresh)
    document.body.innerHTML = '';
  });
});
