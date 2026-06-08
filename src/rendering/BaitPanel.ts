/**
 * Bait selection — a SUB-SCREEN panel (Craig's call: declutter the main HUD by
 * moving the always-visible bait tray into a panel). Mirrors the Journal/Mission/
 * Shop overlay EXACTLY (overlay → panel → non-scrolling header with the ✕ →
 * bounded scroll body) so it reuses the hard-won #28/#30/#31/#32 scroll + safe-area
 * + modal-open architecture. A NEW panel — the others are untouched.
 *
 * Type-SELECTION is rare (pick a bait, then deploy it many times via the on-screen
 * BAIT button), so it belongs a tap away in a panel — the frequent DEPLOY stays a
 * one-tap button on the main HUD. Tapping a row SELECTS (via the onSelect callback,
 * which writes the existing baitSelect intent — the pure sim path is unchanged) and
 * closes the panel, so the flow is: open → tap a bait → deploy.
 *
 * READS bait state; the selection flows through the intent, never mutated here.
 */

import { addOverlayDismiss } from './overlayDismiss';
import { isBaitSelectable, type BaitState } from '../game/Bait';
import { BAIT_DISPLAY, BAIT_ORDER, type BaitId } from '../utils/constants';

export class BaitPanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private open = false;
  /** Select a bait by its BAIT_ORDER index (writes the baitSelect intent at the
   *  boundary — the same path the 1/2/3 keys use). */
  private readonly onSelect: (index: number) => void;

  constructor(container: HTMLElement, onSelect: (index: number) => void) {
    this.onSelect = onSelect;
    this.root = document.createElement('div');
    this.root.className = 'bait-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'bait-panel';
    this.root.appendChild(panel);

    // Non-scrolling header bar (title + the ✕) — the close target never scrolls away.
    const headerBar = document.createElement('div');
    headerBar.className = 'bait-header';
    panel.appendChild(headerBar);
    const title = document.createElement('div');
    title.className = 'bait-header-title';
    title.textContent = '🪱 Bait';
    headerBar.appendChild(title);

    // Bounded scroll body — the selectable bait rows.
    const scroll = document.createElement('div');
    scroll.className = 'bait-scroll';
    panel.appendChild(scroll);

    this.list = document.createElement('div');
    this.list.className = 'bait-select-list';
    scroll.appendChild(this.list);

    addOverlayDismiss(this.root, panel, () => this.open, () => this.setOpen(false), headerBar);
    container.appendChild(this.root);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.root.style.display = open ? 'flex' : 'none';
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Rebuild the rows from the live bait state. `isUnlocked` hides a research-gated
   *  bait (fish) until its study completes — exactly like the old tray. Call on open. */
  refresh(bait: BaitState, isUnlocked: (id: BaitId) => boolean): void {
    this.list.replaceChildren();
    BAIT_ORDER.forEach((id, index) => {
      if (!isUnlocked(id)) return;
      this.list.appendChild(this.row(id, index, bait));
    });
  }

  /** One selectable bait row: diet icon + label + count. Selected = highlighted;
   *  empty (count 0) = greyed (the #5.3 scarcity made visible). Tapping selects +
   *  closes (pick → deploy). */
  private row(id: BaitId, index: number, bait: BaitState): HTMLButtonElement {
    const disp = BAIT_DISPLAY[id];
    const selected = bait.selected === id;
    const empty = !isBaitSelectable(bait, id);

    const row = document.createElement('button');
    row.className = 'bait-select-row';
    if (selected) row.classList.add('selected');
    if (empty) row.classList.add('empty');
    row.innerHTML =
      `<span class="chip-icon icon-${disp.icon}"></span>` +
      `<span class="bait-select-label">${index + 1} ${disp.label}</span>` +
      `<span class="bait-select-count">×${bait.counts[id]}</span>`;

    row.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onSelect(index); // writes baitSelect; the sim ignores it if this bait is empty
      this.setOpen(false); // pick → close → deploy
    });
    // Don't let a row tap start a world-roam (same guard the old chips used).
    row.addEventListener('touchstart', (e) => e.stopPropagation());

    return row;
  }
}
