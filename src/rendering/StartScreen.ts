/**
 * The warm title / start splash (Plan #11, polished #11-follow-up) — the inviting
 * first impression. A procedural dawn-meadow scene (gradient sky + a soft rising
 * sun + layered hill silhouettes, all zero-asset CSS/SVG) behind a field-guide
 * card: game name in a system SERIF + one naturalist line + a primary button
 * (Start on a first run, Continue for a returning player) + a Skip link.
 *
 * The backdrop is OPAQUE (a splash reveals nothing of the world behind it — unlike
 * the translucent gameplay panels). Dismissed by the primary button, a backdrop
 * tap, or Escape — all "begin play"; the ✕ is gone (Start IS the action). Skip
 * additionally suppresses the contextual onboarding prompts.
 *
 * READ-only; the callbacks let the boundary react. `onStart` = begin play (any
 * normal dismiss); `onSkip` = begin play AND skip the prompts.
 */

import { START_SCREEN } from '../utils/constants';

/** Inline SVG hill silhouettes (procedural, zero-asset) — layered for depth. */
const HILLS_SVG =
  '<svg class="start-hills" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
  '<path class="hill-far" d="M0 22 Q 26 13 52 19 T 100 17 V40 H0 Z"/>' +
  '<path class="hill-mid" d="M0 29 Q 32 21 58 26 T 100 25 V40 H0 Z"/>' +
  '<path class="hill-near" d="M0 35 Q 38 29 64 33 T 100 32 V40 H0 Z"/>' +
  '</svg>';

export class StartScreen {
  private readonly root: HTMLDivElement;
  private readonly primary: HTMLButtonElement;
  private readonly skip: HTMLButtonElement;
  private open = false;

  constructor(container: HTMLElement, callbacks: { onStart: () => void; onSkip: () => void }) {
    this.root = document.createElement('div');
    this.root.className = 'start-overlay';
    this.root.style.display = 'none';

    // The procedural dawn-meadow scene (opaque) — sits behind the card.
    const scene = document.createElement('div');
    scene.className = 'start-scene';
    scene.innerHTML = `<div class="start-sun"></div>${HILLS_SVG}`;
    this.root.appendChild(scene);

    const panel = document.createElement('div');
    panel.className = 'start-panel';
    this.root.appendChild(panel);

    const title = document.createElement('div');
    title.className = 'start-title';
    title.textContent = START_SCREEN.title;

    const tagline = document.createElement('div');
    tagline.className = 'start-tagline';
    tagline.textContent = START_SCREEN.tagline;

    this.primary = document.createElement('button');
    this.primary.className = 'start-primary';
    this.primary.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.begin(callbacks.onStart);
    });

    this.skip = document.createElement('button');
    this.skip.className = 'start-skip';
    this.skip.textContent = START_SCREEN.skip;
    this.skip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.begin(callbacks.onSkip);
    });

    panel.append(title, tagline, this.primary, this.skip);

    // Begin-play dismiss paths — NO ✕ (Start is the action). A backdrop tap (a
    // press on the overlay itself, not the card) and Escape both begin play.
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root || e.target === scene) this.begin(callbacks.onStart);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.begin(callbacks.onStart);
    });

    container.appendChild(this.root);
  }

  private begin(cb: () => void): void {
    this.setOpen(false);
    cb();
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.root.style.display = open ? 'flex' : 'none';
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Show the splash. `firstRun` picks the button label + whether Skip appears. */
  show(firstRun: boolean): void {
    this.primary.textContent = firstRun ? START_SCREEN.start : START_SCREEN.continue;
    this.skip.style.display = firstRun ? 'block' : 'none'; // nothing to skip if returning
    this.setOpen(true);
  }
}
