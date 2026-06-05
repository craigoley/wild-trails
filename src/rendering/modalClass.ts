/**
 * The `modal-open` body flag (mobile layering fix). While ANY overlay panel is open,
 * the gameplay HUD (bait tray + action buttons + top-right toggles + joystick) is
 * hidden via CSS — it otherwise bled through the translucent journal/mission backdrop
 * AND stayed interactive behind the modal (a stray touch could hit CATCH/BAIT).
 *
 * Driven by POLLING the panels' open state from the main loop, not by the open/close
 * call sites — so it clears correctly on EVERY close path (✕ / backdrop / Escape /
 * programmatic), since all of them end with the panel reporting isOpen() === false.
 * Generalizes to any overlay (win screen, future panels) with no per-panel CSS.
 */
export function syncModalOpenClass(anyOpen: boolean, body: HTMLElement = document.body): void {
  body.classList.toggle('modal-open', anyOpen);
}
