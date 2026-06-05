/**
 * Standard modal-dismiss affordances for a full-screen overlay, so a panel is
 * never a soft-trap. Wires THREE close paths onto an overlay:
 *   - a ✕ button in the panel (top-right),
 *   - a backdrop tap (a press on the overlay OUTSIDE the panel),
 *   - the Escape key (only when this overlay is open).
 * Together with the panel's existing open TOGGLE (J / M), that's touch parity
 * (✕ + backdrop) AND keyboard parity (Escape + the toggle). DOM-only — lives in
 * the rendering layer, never in src/game/.
 *
 * The caller owns the open STATE; this only makes the close TRANSITIONS reachable
 * via `isOpen` (read) + `close` (which should set the state to closed).
 */
export function addOverlayDismiss(
  root: HTMLElement,
  panel: HTMLElement,
  isOpen: () => boolean,
  close: () => void,
  /** Where the ✕ mounts — pass a NON-scrolling header so the close target never
   *  scrolls away on touch (Plan #7/#16 follow-up). Defaults to the panel. */
  mount: HTMLElement = panel,
): void {
  // ✕ close button — a ≥44px tap target (Apple HIG minimum) in the mount element.
  const x = document.createElement('button');
  x.className = 'overlay-close';
  x.setAttribute('aria-label', 'Close');
  x.textContent = '✕';
  // pointerdown (fires immediately on touch); stop it reaching the backdrop.
  x.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  mount.appendChild(x);

  // Backdrop tap: a press on the overlay itself (not bubbled from the panel).
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) close();
  });

  // Escape closes whichever overlay is open.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });
}
