/**
 * §4.3 CAPSTONE — the win, reframed. NOT a certificate/scorecard ("caught them all") but the
 * through-line's quiet summit: the census's biome `known · flourishing` read scaled to the WHOLE
 * WORLD. The presentation REVEALS the living world (a gentle wash, no opaque card — see style.css)
 * with one quiet line over it; the warm, still-breathing world (TL1/TL2/CJ) IS the statement. A
 * CLOSEABLE overlay — dismissing it returns to free-roam; nothing resets. Fired ONCE by the boundary
 * (the persisted `won` flag), at the UNCHANGED win condition (only the meaning shifts, not the moment).
 *
 * READS the journal; never mutates. DOM lives here in the rendering layer. Zero-asset. "and it
 * flourishes" is honest, not asserted — `worldThriving()` at a real completion lands in the
 * `flourishing` band (pinned in Thriving's tests).
 */

import { WIN } from '../utils/constants';
import { addOverlayDismiss } from './overlayDismiss';

export class WinScreen {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private open = false;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'win-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'win-panel';
    this.root.appendChild(panel);

    // No title bar, no scorecard — just the quiet statement over the revealed living world.
    this.body = document.createElement('div');
    this.body.className = 'win-body';
    panel.appendChild(this.body);

    // Closeable — you dismiss it INTO free-roam (✕ / backdrop / Escape).
    addOverlayDismiss(this.root, panel, () => this.open, () => this.setOpen(false));
    container.appendChild(this.root);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.root.style.display = open ? 'flex' : 'none';
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Show the capstone — the quiet statement over the revealed living world. The scorecard is gone;
   *  the living world (behind the gentle wash) carries it. "and it flourishes" is honest by the win
   *  condition (every creature recorded → worldThriving in the flourishing band, pinned). */
  show(): void {
    this.body.replaceChildren();
    this.body.appendChild(this.line('win-lead', WIN.lead));
    this.body.appendChild(this.line('win-freeroam', WIN.freeRoam));
    this.setOpen(true);
  }

  private line(cls: string, text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  }
}
