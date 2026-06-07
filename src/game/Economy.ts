/**
 * Economy currency (§12 slice 1a) — PURE earn/spend over the Journal (no three/DOM/
 * Math.random; Node-testable, like Missions.ts). Credits are SEPARATE from rank:
 * earning/spending here never touches `rankPoints`. The balance is never negative.
 *
 * Slice 1a is the currency PRIMITIVE only: earn (catches + research milestones),
 * a spend guard (nothing spends yet — the shop is 1b), and persistence (v5). No
 * shop, no premium bait, no catch-rate effect — credits buy lateral enrichment later.
 */

import { BAIT, CREDITS, NET_PRICE, SHOP, SPECIES, SPECIES_ORDER, type BaitId, type SpeciesId } from '../utils/constants';
import { isFound, type Journal } from '../state/Journal';
import { addBait, type BaitState } from './Bait';
import { grantTool, ownsTool, type ToolId } from './Tools';

/** Add credits. A non-positive delta is a no-op; the balance only ever grows here. */
export function addCredits(journal: Journal, n: number): void {
  if (n <= 0) return;
  journal.credits += Math.floor(n);
}

/** Spend credits. Returns false and leaves the balance UNCHANGED when there isn't
 *  enough (or n <= 0) — the overspend guard. The balance is never negative. */
export function spendCredits(journal: Journal, n: number): boolean {
  const cost = Math.floor(n);
  if (cost <= 0 || journal.credits < cost) return false;
  journal.credits -= cost;
  return true;
}

export interface CatchCredits {
  total: number;
  newSpecies: boolean;
  biomeComplete: boolean;
}

/**
 * Credits a catch earns — computed from the PRE-catch journal (call before
 * recordCatch). +perCatch always (skill); +perNewSpecies on a first catch
 * (discovery); +perBiomeComplete when this catch fills the last gap in its biome's
 * journal (research milestone). Pure — reads the journal, never mutates it.
 */
export function creditsForCatch(journal: Journal, speciesId: SpeciesId): CatchCredits {
  const newSpecies = !isFound(journal, speciesId);
  const biome = SPECIES[speciesId].biome;
  // This catch completes the biome iff it's a NEW species and every OTHER species
  // native to that biome is already found (so it's the last gap).
  const biomeComplete =
    newSpecies &&
    SPECIES_ORDER.filter((id) => SPECIES[id].biome === biome).every(
      (id) => id === speciesId || isFound(journal, id),
    );
  const total =
    CREDITS.perCatch +
    (newSpecies ? CREDITS.perNewSpecies : 0) +
    (biomeComplete ? CREDITS.perBiomeComplete : 0);
  return { total, newSpecies, biomeComplete };
}

// ---------------------------------------------------------------------------
// The Field Supply — buy extra baseline-bait quantity (§12 slice 1b)
// ---------------------------------------------------------------------------

/** Whether a bait type can be bought right now (and why not). 'at-cap' is checked
 *  BEFORE 'cant-afford' so a full type never reads as "save up" — it's just full. */
export type BaitBuyState = 'ok' | 'cant-afford' | 'at-cap';

export function baitBuyState(journal: Journal, baitState: BaitState, baitId: BaitId): BaitBuyState {
  if (baitState.counts[baitId] >= BAIT.maxCount) return 'at-cap';
  if (journal.credits < SHOP.baitPrice) return 'cant-afford';
  return 'ok';
}

/**
 * Buy one purchase of a bait type. The CAP IS CHECKED BEFORE SPENDING — at the cap
 * we no-op and return false, so credits are NEVER spent for bait that addBait would
 * silently clamp away (that would read as a scam). Only on 'ok' do we spend then
 * add. Pure transaction over the existing v5 state — no schema change.
 */
export function buyBait(journal: Journal, baitState: BaitState, baitId: BaitId): boolean {
  if (baitBuyState(journal, baitState, baitId) !== 'ok') return false;
  spendCredits(journal, SHOP.baitPrice); // guaranteed to succeed (we just checked affordability)
  addBait(baitState, baitId, SHOP.buyQuantity); // capped at maxCount; we're below it
  return true;
}

/** Can the player buy this net? `owned` | `cant-afford` | `ok` (drives the shop button). */
export function netBuyState(journal: Journal, id: ToolId): 'owned' | 'cant-afford' | 'ok' {
  if (ownsTool(journal, id)) return 'owned';
  if (journal.credits < NET_PRICE) return 'cant-afford';
  return 'ok';
}

/**
 * Buy a biome net in the Field Supply (§12, slice B1): spend NET_PRICE + OWN it. Returns
 * false (no spend) if already owned or unaffordable. The ownership itself is `grantTool` —
 * independent of WHAT triggers it — so a future research-completion (§4.1.4) can grant the
 * same net WITHOUT a payment by calling grantTool directly; the shop is just one trigger.
 */
export function buyNet(journal: Journal, id: ToolId): boolean {
  if (netBuyState(journal, id) !== 'ok') return false;
  spendCredits(journal, NET_PRICE); // guaranteed (affordability just checked)
  grantTool(journal, id); // the swappable ownership primitive
  return true;
}
