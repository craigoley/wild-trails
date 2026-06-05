/**
 * The Field Supply (§12 slice 1b) — spend credits on EXTRA baseline-bait quantity.
 * A panel mirroring the Journal/Mission overlay (overlay → panel → non-scrolling
 * header with the ✕ → bounded scroll body), so it reuses the hard-won #28/#30/#31
 * scroll architecture + overlayDismiss. NEW panel — the other panels are untouched.
 *
 * Buying is the PURE transaction (Economy.buyBait): the cap is checked BEFORE the
 * spend, so credits are never lost to a clamped bait. The button shows WHY it can't
 * buy ("Full" at cap, the price greyed when unaffordable) — never a silent no-op.
 * READS the journal + live bait state; the buy mutates them; onBuy() persists.
 */

import { addOverlayDismiss } from './overlayDismiss';
import { baitBuyState, buyBait } from '../game/Economy';
import type { BaitState } from '../game/Bait';
import type { Journal } from '../state/Journal';
import { BAIT, BAIT_DISPLAY, BAIT_ORDER, CREDITS, SHOP, type BaitId } from '../utils/constants';

export class ShopPanel {
  private readonly root: HTMLDivElement;
  private readonly balance: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private open = false;
  private journal: Journal | null = null;
  private baitState: BaitState | null = null;
  /** Persist the purchase (credits spent + bait gained) at the boundary. */
  private readonly onBuy: () => void;

  constructor(container: HTMLElement, onBuy: () => void) {
    this.onBuy = onBuy;
    this.root = document.createElement('div');
    this.root.className = 'shop-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'shop-panel';
    this.root.appendChild(panel);

    // Non-scrolling header bar (title + the ✕) — the close target never scrolls away.
    const headerBar = document.createElement('div');
    headerBar.className = 'shop-header';
    panel.appendChild(headerBar);
    const title = document.createElement('div');
    title.className = 'shop-header-title';
    title.textContent = `${SHOP.glyph} ${SHOP.title}`;
    headerBar.appendChild(title);

    // Bounded scroll body — balance + blurb + the buyable rows.
    const scroll = document.createElement('div');
    scroll.className = 'shop-scroll';
    panel.appendChild(scroll);

    this.balance = document.createElement('div');
    this.balance.className = 'shop-balance';
    scroll.appendChild(this.balance);

    const blurb = document.createElement('div');
    blurb.className = 'shop-blurb';
    blurb.textContent = SHOP.blurb;
    scroll.appendChild(blurb);

    this.list = document.createElement('div');
    this.list.className = 'shop-list';
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

  /** Rebuild from the current journal + live bait state (call on open + after a buy). */
  refresh(journal: Journal, baitState: BaitState): void {
    this.journal = journal;
    this.baitState = baitState;
    this.balance.textContent = `${CREDITS.glyph} ${journal.credits}`;
    this.list.replaceChildren();
    for (const id of BAIT_ORDER) this.list.appendChild(this.row(id));
  }

  private row(id: BaitId): HTMLDivElement {
    const journal = this.journal!;
    const baitState = this.baitState!;
    const row = document.createElement('div');
    row.className = 'shop-row';

    const info = document.createElement('div');
    info.className = 'shop-info';
    info.textContent = `${BAIT_DISPLAY[id].label} — ${baitState.counts[id]} / ${BAIT.maxCount}`;

    const btn = document.createElement('button');
    btn.className = 'shop-buy';
    const state = baitBuyState(journal, baitState, id);
    if (state === 'at-cap') {
      btn.textContent = SHOP.fullLabel; // "Full" — never a save-up prompt
      btn.disabled = true;
      btn.classList.add('full');
    } else {
      btn.textContent = `${CREDITS.glyph} ${SHOP.baitPrice}`;
      btn.disabled = state === 'cant-afford'; // greyed; the price reads as "needed"
    }
    // A disabled button doesn't fire pointerdown; buyBait also guards (defence in depth).
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (buyBait(journal, baitState, id)) {
        this.onBuy(); // persist
        this.refresh(journal, baitState); // reflect the new balance + count + button state
      }
    });

    row.append(info, btn);
    return row;
  }
}
