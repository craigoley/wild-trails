// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopPanel } from '../ShopPanel';
import { createBaitState } from '../../game/Bait';
import { createJournal } from '../../state/Journal';
import { addCredits } from '../../game/Economy';
import { BAIT, BAIT_ORDER, SHOP } from '../../utils/constants';

const fireDown = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ShopPanel — scroll architecture + close (matches the other panels)', () => {
  it('has the bounded scroll body with the list inside, and a ✕ in the fixed header', () => {
    const p = new ShopPanel(document.body, vi.fn());
    p.refresh(createJournal(), createBaitState());
    // Same #28/#30/#31 structure as the journal/mission panels.
    expect(document.querySelector('.shop-scroll > .shop-list')).not.toBeNull();
    expect(document.querySelector('.shop-header > .overlay-close')).not.toBeNull();
    expect(document.querySelector('.shop-scroll .overlay-close')).toBeNull(); // ✕ never in the scroll
  });

  it('closes via the ✕ (overlayDismiss)', () => {
    const p = new ShopPanel(document.body, vi.fn());
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
    const p = new ShopPanel(document.body, vi.fn());
    p.refresh(j, createBaitState());
    expect(document.querySelector('.shop-balance')!.textContent).toContain('7');
    expect(document.querySelectorAll('.shop-row')).toHaveLength(BAIT_ORDER.length);
  });

  it("a full bait reads 'Full' and is disabled; an unaffordable one is disabled", () => {
    const j = createJournal(); // 0 credits -> all unaffordable
    const bait = createBaitState();
    bait.counts.seeds = BAIT.maxCount; // full
    const p = new ShopPanel(document.body, vi.fn());
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
    const p = new ShopPanel(document.body, onBuy);
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
