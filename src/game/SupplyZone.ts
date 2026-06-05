/**
 * The walk-in interaction for the Field Supply post (§12 1b-revise) — a PURE
 * no-reopen-trap state machine (no DOM/three; Node-testable). The shop opens on the
 * ENTRY EDGE (walking into a post's zone), never every frame inside — so closing the
 * ✕ while still standing in the zone can't instantly reopen it.
 *
 * `armed` = "ready to open on entering a zone". Entering consumes it; it re-arms
 * only once the player is cleanly OUT of every zone AND no panel is open (so a blind
 * keyboard walk-out while the panel is open can't sneak a re-arm and reopen on close).
 * Close is ✕-only (no auto-close-on-leave, per the design call).
 */

export interface SupplyZoneState {
  armed: boolean;
}

/** Fresh state — armed, so the first time you walk into a post it opens. */
export function createSupplyZone(): SupplyZoneState {
  return { armed: true };
}

/**
 * Advance one frame. Returns true exactly on the entry edge — open the Field Supply
 * NOW. `inZone` = the player is within a post's zone (supplyPostAt !== null);
 * `panelOpen` = the shop panel is currently open.
 */
export function shouldOpenSupply(
  state: SupplyZoneState,
  inZone: boolean,
  panelOpen: boolean,
): boolean {
  // Re-arm only when cleanly outside AND nothing open — so a close-while-inside
  // (still in the zone) stays closed until the player leaves and re-enters.
  if (!inZone && !panelOpen) state.armed = true;
  if (inZone && state.armed && !panelOpen) {
    state.armed = false; // consume — one open per visit
    return true;
  }
  return false;
}
