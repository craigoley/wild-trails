/**
 * The warm title / start splash (Plan #11) — the inviting first impression. Game
 * name + one naturalist line + a primary button (Start on a first run, Continue
 * for a returning player) + a Skip-tutorial link on first runs. Closeable into
 * play (the shared dismiss helper: ✕ / Escape / backdrop). Zero-asset.
 *
 * READ-only; the callbacks let the boundary react. `onStart` = dismissed into play
 * (any normal dismiss); `onSkip` = dismissed AND skip the contextual prompts.
 */

import { START_SCREEN } from '../utils/constants';
import { addOverlayDismiss } from './overlayDismiss';

export class StartScreen {
  private readonly root: HTMLDivElement;
  private readonly primary: HTMLButtonElement;
  private readonly skip: HTMLButtonElement;
  private open = false;

  constructor(container: HTMLElement, callbacks: { onStart: () => void; onSkip: () => void }) {
    this.root = document.createElement('div');
    this.root.className = 'start-overlay';
    this.root.style.display = 'none';

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
      this.setOpen(false);
      callbacks.onStart();
    });

    this.skip = document.createElement('button');
    this.skip.className = 'start-skip';
    this.skip.textContent = START_SCREEN.skip;
    this.skip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.setOpen(false);
      callbacks.onSkip();
    });

    panel.append(title, tagline, this.primary, this.skip);

    // ✕ / Escape / backdrop dismiss = the same as the primary (just play).
    addOverlayDismiss(this.root, panel, () => this.open, () => {
      this.setOpen(false);
      callbacks.onStart();
    });
    container.appendChild(this.root);
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
