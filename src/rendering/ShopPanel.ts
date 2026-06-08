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
import { equipTool, ownsTool } from '../game/Tools';
import { researchProjectForTool, isBaitUnlocked } from '../game/Research';
import type { BaitState } from '../game/Bait';
import type { Journal } from '../state/Journal';
import { BAIT, BAIT_DISPLAY, BAIT_ORDER, CREDITS, SHOP, TOOLS, TOOL_ORDER, type BaitId, type ToolId } from '../utils/constants';

export class ShopPanel {
  private readonly root: HTMLDivElement;
  private readonly balance: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private open = false;
  private journal: Journal | null = null;
  private baitState: BaitState | null = null;
  /** Persist the purchase (credits spent + bait gained) at the boundary. */
  private readonly onBuy: () => void;
  /** Equip a net: sync the live sim's active tool + persist (boundary callback). */
  private readonly onEquip: (toolId: ToolId) => void;

  constructor(container: HTMLElement, onBuy: () => void, onEquip: (toolId: ToolId) => void) {
    this.onBuy = onBuy;
    this.onEquip = onEquip;
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
    // §4.1.5 — a research-gated bait (fish) is OFFERED only once its study project is complete
    // (the unlock derives from journal.research). The 3 original diets always show.
    for (const id of BAIT_ORDER) {
      if (isBaitUnlocked(journal, id)) this.list.appendChild(this.row(id));
    }
    // Nets & Gear — the durable-net section (buy / equip). B1: ALL nets listed; owned ones
    // Equip/Equipped, unowned ones Buy. The flavor lines teach which net suits which biome.
    const gearHeader = document.createElement('div');
    gearHeader.className = 'shop-section';
    gearHeader.textContent = SHOP.netsHeader;
    this.list.appendChild(gearHeader);
    for (const id of TOOL_ORDER) this.list.appendChild(this.netRow(id));
  }

  /** One owned-net row: name + flavor + Equipped badge / Equip button. */
  private netRow(id: ToolId): HTMLDivElement {
    const journal = this.journal!;
    const def = TOOLS[id];
    const row = document.createElement('div');
    row.className = 'shop-row shop-net-row';

    const info = document.createElement('div');
    info.className = 'shop-info';
    info.innerHTML = `<div class="net-name">${def.displayName}</div><div class="net-flavor">${def.flavor}</div>`;

    const active = journal.activeTool === id;
    const owned = ownsTool(journal, id);
    let ctl: HTMLElement;
    if (active) {
      // The equipped net — a quiet badge.
      ctl = document.createElement('div');
      ctl.className = 'net-equipped';
      ctl.textContent = SHOP.equippedLabel;
    } else if (owned) {
      // Owned but not active — Equip it (the #51 wiring).
      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      btn.textContent = SHOP.equipLabel;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (equipTool(journal, id)) {
          this.onEquip(id); // sync game.tool + persist
          this.refresh(journal, this.baitState!);
        }
      });
      ctl = btn;
    } else {
      // Unowned — research is the SINGLE acquisition path now (R1; the shop-buy retired).
      // Point the player at the project that earns it, so it's never a dead end.
      const project = researchProjectForTool(id);
      ctl = document.createElement('div');
      ctl.className = 'net-research-hint';
      ctl.textContent = project ? `Research to unlock: ${project.name}` : 'Locked';
    }

    row.append(info, ctl);
    return row;
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
    // Disabled buttons still fire pointerdown (unlike click); buyBait guards (defence in depth).
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
