// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopPanel } from '../ShopPanel';
import { createBaitState } from '../../game/Bait';
import { createJournal } from '../../state/Journal';
import { addCredits } from '../../game/Economy';
import { grantTool } from '../../game/Tools';
import { BAIT, BAIT_ORDER, RESEARCH_GATED_BAITS, SHOP, TOOL_ORDER } from '../../utils/constants';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ShopPanel — scroll architecture + close (matches the other panels)', () => {
  it('has the bounded scroll body with the list inside, and a ✕ in the fixed header', () => {
    const p = new ShopPanel(document.body, vi.fn(), vi.fn());
    p.refresh(createJournal(), createBaitState());
    // Same #28/#30/#31 structure as the journal/mission panels.
    expect(document.querySelector('.shop-scroll > .shop-list')).not.toBeNull();
    expect(document.querySelector('.shop-header > .overlay-close')).not.toBeNull();
    expect(document.querySelector('.shop-scroll .overlay-close')).toBeNull(); // ✕ never in the scroll
  });

  it('closes via the ✕ (overlayDismiss)', () => {
    const p = new ShopPanel(document.body, vi.fn(), vi.fn());
    p.refresh(createJournal(), createBaitState());
    p.setOpen(true);
    expect(p.isOpen()).toBe(true);
    fireDown(document.querySelector('.shop-header .overlay-close')!);
    expect(p.isOpen()).toBe(false);
  });
});

describe('ShopPanel — rows, balance, and button states', () => {
  it('shows the balance + a buy row per bait type', () => {
    const j = createJournal();
    addCredits(j, 7);
    const p = new ShopPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j, createBaitState());
    expect(document.querySelector('.shop-balance')!.textContent).toContain('7');
    // Bait rows only (the net rows are .shop-net-row — see the gear test below). §4.1.5: a
    // research-gated bait (fish) is HIDDEN until its study unlocks it, so a fresh journal shows
    // the 3 always-stocked diets, not all of BAIT_ORDER.
    const unlocked = BAIT_ORDER.filter((id) => !RESEARCH_GATED_BAITS.includes(id));
    expect(document.querySelectorAll('.shop-row:not(.shop-net-row)')).toHaveLength(unlocked.length);
  });

  it('lists ALL nets — the starter Equipped, the un-owned biome nets show the research hint (R1)', () => {
    const j = createJournal();
    const p = new ShopPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j, createBaitState());
    const netRows = document.querySelectorAll('.shop-net-row');
    expect(netRows).toHaveLength(TOOL_ORDER.length); // 3: hand + dip + throwing
    expect(document.querySelector('.shop-section')!.textContent).toBe(SHOP.netsHeader);
    // The starter Hand Net (owned + active) shows the Equipped badge.
    expect(netRows[0].querySelector('.net-name')!.textContent).toBe('Hand Net');
    expect(netRows[0].querySelector('.net-equipped')!.textContent).toBe(SHOP.equippedLabel);
    // ⚠️ R1: the shop-buy is GONE — un-owned biome nets point at their research project,
    // never a Buy button (research is the single acquisition path; no dual-path).
    expect(document.querySelectorAll('.shop-net-row .shop-buy')).toHaveLength(0);
    const hints = document.querySelectorAll('.shop-net-row .net-research-hint');
    expect(hints).toHaveLength(2); // dip + throwing
    expect([...hints].map((h) => h.textContent).join(' ')).toContain('Research to unlock');
  });

  it('a research-GRANTED biome net shows Equip (acquired via research, not the shop) (R1)', () => {
    const j = createJournal();
    grantTool(j, 'dip-net'); // as a completed research project would (the swappable seam)
    const onEquip = vi.fn();
    const p = new ShopPanel(document.body, vi.fn(), onEquip);
    p.refresh(j, createBaitState());
    const dipRow = [...document.querySelectorAll('.shop-net-row')].find((r) => r.textContent!.includes('Dip-net'))!;
    expect(dipRow.querySelector('.net-research-hint')).toBeNull(); // owned -> no hint
    fireDown(dipRow.querySelector('.shop-buy')!); // the Equip button
    expect(j.activeTool).toBe('dip-net');
    expect(onEquip).toHaveBeenCalledWith('dip-net');
  });

  it("a full bait reads 'Full' and is disabled; an unaffordable one is disabled", () => {
    const j = createJournal(); // 0 credits -> all unaffordable
    const bait = createBaitState();
    bait.counts.seeds = BAIT.maxCount; // full
    const p = new ShopPanel(document.body, vi.fn(), vi.fn());
    p.refresh(j, bait);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.shop-buy')];
    const full = buttons.find((b) => b.textContent === SHOP.fullLabel)!;
    expect(full.disabled).toBe(true);
    // every buy button is disabled here (full OR can't-afford)
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it('an affordable, below-cap buy spends + adds + persists (onBuy) + refreshes', () => {
    const onBuy = vi.fn();
    const j = createJournal();
    addCredits(j, 10);
    const bait = createBaitState();
    bait.counts.seeds = 5;
    const p = new ShopPanel(document.body, onBuy, vi.fn());
    p.refresh(j, bait);
    const firstBuy = document.querySelector<HTMLButtonElement>('.shop-buy')!;
    expect(firstBuy.disabled).toBe(false);
    fireDown(firstBuy);
    expect(j.credits).toBe(10 - SHOP.baitPrice); // spent
    expect(bait.counts.seeds).toBe(5 + SHOP.buyQuantity); // added
    expect(onBuy).toHaveBeenCalled(); // persisted
    expect(document.querySelector('.shop-balance')!.textContent).toContain(String(10 - SHOP.baitPrice)); // re-rendered
  });
});
