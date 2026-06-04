/**
 * The HUD time-of-day indicator — the last invisible core mechanic made legible.
 * Always visible (top-left), it shows the current phase as an icon + LABEL (the
 * instant "it's dusk now" read) plus a small sky ARC with a sun/moon dot that
 * sweeps as the cycle advances — teaching "time passes and loops" (§5).
 *
 * READS game.dayPhase + game.timeSec; never mutates. DOM lives here in the
 * rendering layer (the pure mapping/geometry is in timeOfDayDisplay). Zero-asset
 * (CSS arc + unicode phase glyph).
 */

import type { DayPhase } from '../utils/constants';
import {
  cycleFraction,
  dotPosition,
  phaseIcon,
  phaseIsNight,
  phaseLabel,
} from './timeOfDayDisplay';

export class TimeIndicator {
  private readonly iconEl: HTMLSpanElement;
  private readonly labelEl: HTMLSpanElement;
  private readonly dot: HTMLDivElement;

  constructor(container: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud-time';

    // Phase pill: icon + label (the instant read).
    const pill = document.createElement('div');
    pill.className = 'time-pill';
    this.iconEl = document.createElement('span');
    this.iconEl.className = 'time-icon';
    this.labelEl = document.createElement('span');
    this.labelEl.className = 'time-label';
    pill.append(this.iconEl, this.labelEl);

    // Sky arc with the moving sun/moon dot (the advancement read).
    const arc = document.createElement('div');
    arc.className = 'time-arc';
    this.dot = document.createElement('div');
    this.dot.className = 'time-dot';
    arc.appendChild(this.dot);

    root.append(pill, arc);
    container.appendChild(root);
  }

  /** Reflect the live phase + cycle progress. Called each frame from main. */
  update(phase: DayPhase, timeSec: number): void {
    this.iconEl.textContent = phaseIcon(phase);
    this.labelEl.textContent = phaseLabel(phase);
    this.dot.classList.toggle('moon', phaseIsNight(phase));

    const { leftPct, topPct } = dotPosition(cycleFraction(timeSec));
    this.dot.style.left = `${leftPct}%`;
    this.dot.style.top = `${topPct}%`;
  }
}
