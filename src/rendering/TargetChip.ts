/**
 * §HUD catch-target (ii) — the play-screen TARGET CHIP. ONE quiet element (the slice-(i) thumbnail + a
 * tight "name · p/c" count), tucked in the top-left passive stack so it reads as an objective label, not
 * HUD soup. ⚠️ Contextual: hidden when there's no tracked target (and CSS hides it when a panel is open —
 * the #32 body.modal-open pattern). It PULSES (the `is-near` class) when the tracked species is near.
 * READS the resolved target; never mutates state. Rebuilds its DOM only when the target/count changes
 * (the per-frame `is-near` toggle is idempotent + cheap — no per-frame DOM churn, no alloc).
 */

import { SPECIES } from '../utils/constants';
import { speciesThumbHtml } from './speciesPortrait';
import type { CatchTarget } from '../game/catchTarget';

export class TargetChip {
  private readonly el: HTMLDivElement;
  private sig = '';

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud-target';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  /** Show the tracked target (portrait + name · p/c), or hide when null. `near` toggles the pulse. */
  update(target: CatchTarget | null, thumbUrl: string | null, near: boolean): void {
    if (!target) {
      if (this.sig !== '') {
        this.el.style.display = 'none';
        this.el.classList.remove('is-near');
        this.sig = '';
      }
      return;
    }
    const sig = `${target.species}|${target.progress}/${target.count}|${thumbUrl ? 1 : 0}`;
    if (sig !== this.sig) {
      this.sig = sig;
      const def = SPECIES[target.species];
      this.el.innerHTML =
        speciesThumbHtml(target.species, thumbUrl) +
        `<span class="hud-target-text">` +
        `<span class="hud-target-name">${def.displayName}</span>` +
        `<span class="hud-target-count">${target.progress}/${target.count}</span>` +
        `</span>`;
      this.el.style.display = '';
    }
    this.el.classList.toggle('is-near', near); // the gentle "there it is" pulse
  }
}
