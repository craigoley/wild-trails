/**
 * The Field Journal overlay — the educational payload. An HTML panel (crisp,
 * accessible text) that shows the full Meadow roster: a CARD for each caught
 * species (confirming what play taught — diet, habitat, activity + a short "did
 * you know") with its catch count + first-caught date, and a dimmed "???"
 * SILHOUETTE for each not-yet-found species (the visible gap that pulls — §5.5).
 * A header counts "X of N found".
 *
 * READS the journal + the static species DATA; never mutates. Procedural,
 * zero-asset (CSS silhouettes — no image files). DOM lives here in the rendering
 * layer, never in src/game/.
 */

import type { Journal } from '../state/Journal';
import { foundCount, isFound } from '../state/Journal';
import {
  ACTIVITY_LABEL,
  BAIT_DISPLAY,
  BIOMES,
  SPECIES,
  SPECIES_ORDER,
} from '../utils/constants';

export class JournalPanel {
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private open = false;
  /** Cheap rebuild guard: the content only changes when found/counts change. */
  private signature = '';

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'journal-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'journal-panel';
    this.root.appendChild(panel);

    this.header = document.createElement('div');
    this.header.className = 'journal-header';
    panel.appendChild(this.header);

    this.grid = document.createElement('div');
    this.grid.className = 'journal-grid';
    panel.appendChild(this.grid);

    container.appendChild(this.root);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.root.style.display = open ? 'flex' : 'none';
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Rebuild the roster from the journal — but only when it actually changed (a
   *  cheap signature of found-state + counts), so an open panel costs nothing
   *  per frame. */
  refresh(journal: Journal): void {
    const sig = SPECIES_ORDER.map((id) => {
      const rec = journal.species[id];
      return rec ? `${id}:${rec.catchCount}` : `${id}:-`;
    }).join('|');
    if (sig === this.signature) return;
    this.signature = sig;

    this.header.textContent = `Field Journal — ${foundCount(journal)} of ${SPECIES_ORDER.length} found`;

    this.grid.replaceChildren();
    for (const id of SPECIES_ORDER) {
      this.grid.appendChild(
        isFound(journal, id) ? JournalPanel.card(id, journal) : JournalPanel.silhouette(),
      );
    }
  }

  /** A filled species card. */
  private static card(id: string, journal: Journal): HTMLDivElement {
    const def = SPECIES[id as keyof typeof SPECIES];
    const rec = journal.species[id]!;
    const card = document.createElement('div');
    card.className = 'journal-card';

    const swatch = document.createElement('div');
    swatch.className = 'card-swatch';
    swatch.style.background = `#${def.color.toString(16).padStart(6, '0')}`;
    card.appendChild(swatch);

    const body = document.createElement('div');
    body.className = 'card-body';
    const date = new Date(rec.firstCaughtAt).toLocaleDateString();
    body.innerHTML =
      `<div class="card-name">${def.displayName}</div>` +
      `<div class="card-facts">` +
      `<span>Diet: ${BAIT_DISPLAY[def.bait].label}</span>` +
      `<span>Habitat: ${BIOMES[def.biome].displayName}</span>` +
      `<span>${ACTIVITY_LABEL[def.activityWindow]}</span>` +
      `</div>` +
      `<div class="card-profile">${def.profile}</div>` +
      `<div class="card-meta">Caught ×${rec.catchCount} · first ${date}</div>`;
    card.appendChild(body);
    return card;
  }

  /** A dimmed, nameless slot for an undiscovered species (the pull). */
  private static silhouette(): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'journal-card journal-silhouette';
    card.innerHTML =
      `<div class="silhouette-shape"></div>` +
      `<div class="card-body"><div class="card-name">???</div>` +
      `<div class="card-meta">Not yet found</div></div>`;
    return card;
  }
}
