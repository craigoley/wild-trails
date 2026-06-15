/**
 * §chip-detail — the target-chip detail BOTTOM SHEET. Tapping the play-screen chip opens this: a sheet
 * that rises from the bottom edge (thumb-reachable, near the action buttons) showing the tracked
 * species' LEAD (portrait + name + catch progress) and three tight sections — WHERE / HOW / WHY. The
 * WORLD stays visible above a LIGHT scrim (spatial context kept — not a full-screen modal). Dismissal
 * is never a trap: a drag-handle, a scrim tap, the ✕, and Escape (addOverlayDismiss).
 *
 * READS the assembled detail (speciesDetailFor — pure) + the cached thumbnail; never mutates state.
 * DOM lives here in the rendering layer, never in src/game/.
 */

import { addOverlayDismiss } from './overlayDismiss';
import { speciesThumbHtml } from './speciesPortrait';
import { speciesDetailFor, type SpeciesDetail } from '../game/speciesDetail';
import type { Journal } from '../state/Journal';
import type { SpeciesId } from '../utils/constants';

type ThumbUrl = (species: SpeciesId) => string | null;

export class DetailSheet {
  private readonly root: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private open = false;
  /** The cached species-thumbnail getter (the slice-(i) RTT, from main); swatch fallback until wired. */
  private thumbUrl: ThumbUrl = () => null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'detail-overlay';
    this.root.style.display = 'none';

    this.sheet = document.createElement('div');
    this.sheet.className = 'detail-sheet';
    this.root.appendChild(this.sheet);

    // The drag-handle (an obvious "pull down to close" affordance) — a tap on it also closes.
    const handle = document.createElement('div');
    handle.className = 'detail-handle';
    handle.setAttribute('role', 'button');
    handle.setAttribute('aria-label', 'Close');
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setOpen(false);
    });
    this.sheet.appendChild(handle);

    this.body = document.createElement('div');
    this.body.className = 'detail-body';
    this.sheet.appendChild(this.body);

    // ✕ (on the sheet, not a scrolled-away header) + a scrim tap + Escape — the standard close paths.
    addOverlayDismiss(this.root, this.sheet, () => this.open, () => this.setOpen(false), this.sheet);
    container.appendChild(this.root);
  }

  /** §HUD catch-target (i) — wire the cached species-thumbnail getter (the RTT, from main). */
  setThumbnails(thumbUrl: ThumbUrl): void {
    this.thumbUrl = thumbUrl;
  }

  isOpen(): boolean {
    return this.open;
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.root.style.display = open ? 'flex' : 'none';
  }

  /**
   * Open the sheet for the chip's tracked mission (the SAME `trackedId` the chip resolves → the sheet
   * details exactly what the chip shows). No-op if the detail can't assemble (unknown id / no target).
   */
  openFor(trackedId: string, journal: Journal): void {
    const detail = speciesDetailFor(trackedId, journal);
    if (!detail) return;
    this.render(detail);
    this.setOpen(true);
  }

  /** Build the sheet's DOM from the assembled detail (lead + WHERE / HOW / WHY). Inputs are our own
   *  constants (species/mission text), not user input — no escaping needed. */
  private render(d: SpeciesDetail): void {
    const tracked = d.why.tracked;
    const trackedLine = tracked
      ? `<div class="detail-line detail-why-tracked"><b>${tracked.title}</b> · ${tracked.progress}/${tracked.count} · +${tracked.points} pts</div>`
      : '';
    const alsoLine = d.why.alsoServes.length
      ? `<div class="detail-line detail-also"><span class="detail-also-label">Also serves:</span> ${d.why.alsoServes.join(', ')}</div>`
      : '';

    this.body.innerHTML =
      // LEAD — portrait + name + catch progress.
      `<div class="detail-lead">` +
      speciesThumbHtml(d.species, this.thumbUrl(d.species)) +
      `<div class="detail-lead-text">` +
      `<div class="detail-name">${d.displayName}</div>` +
      `<div class="detail-progress">${d.progress}/${d.count} caught</div>` +
      `</div></div>` +
      // WHERE — habitat + activity window.
      `<div class="detail-section"><div class="detail-h">Where</div>` +
      `<div class="detail-line">${d.habitat} · ${d.activity}</div></div>` +
      // HOW — the diet's bait + the derived wary/bold approach tip.
      `<div class="detail-section"><div class="detail-h">How</div>` +
      `<div class="detail-line">Bait with <b>${d.baitLabel}</b>.</div>` +
      `<div class="detail-line detail-tip">${d.warinessTip}</div></div>` +
      // WHY — the tracked goal, prominent; then the "also serves" names (if any).
      `<div class="detail-section"><div class="detail-h">Why</div>` +
      trackedLine +
      alsoLine +
      `</div>`;
  }
}
