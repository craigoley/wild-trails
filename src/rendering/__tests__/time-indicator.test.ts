// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { TimeIndicator } from '../TimeIndicator';
import { TIME } from '../../utils/constants';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('TimeIndicator — reflects the live phase + cycle progress', () => {
  it('shows the current phase label + icon', () => {
    const ind = new TimeIndicator(document.body);
    ind.update('dusk', 0);
    expect(document.querySelector('.time-label')!.textContent).toBe('Dusk');
    expect(document.querySelector('.time-icon')!.textContent).toBe('🌆');
  });

  it('uses the moon dot at night, the sun dot otherwise', () => {
    const ind = new TimeIndicator(document.body);
    const dot = document.querySelector('.time-dot')!;

    ind.update('day', 0);
    expect(dot.classList.contains('moon')).toBe(false);

    ind.update('night', 0);
    expect(dot.classList.contains('moon')).toBe(true);
  });

  it('moves the dot along the arc as time advances (left% tracks the cycle)', () => {
    const ind = new TimeIndicator(document.body);
    const dot = document.querySelector('.time-dot') as HTMLDivElement;

    ind.update('dawn', 0); // frac 0 -> left horizon
    expect(dot.style.left).toBe('0%');

    ind.update('dusk', TIME.cyclePeriodSec / 2); // frac 0.5 -> arc apex
    expect(dot.style.left).toBe('50%');
  });
});
