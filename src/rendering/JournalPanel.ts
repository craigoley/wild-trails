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
import { addOverlayDismiss } from './overlayDismiss';
import { groupSpeciesByBiome } from './journalGroups';
import {
  ACTIVITY_LABEL,
  BAIT_DISPLAY,
  BIOMES,
  PANEL_LABELS,
  SPECIES,
  SPECIES_INFO,
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

    // NON-scrolling header BAR (title + the ✕) — stays put while the body scrolls,
    // so the close target never scrolls away on touch (Plan #7/#16 follow-up). The
    // title is its own element (refresh sets THAT, so it can't wipe the ✕).
    const headerBar = document.createElement('div');
    headerBar.className = 'journal-header';
    panel.appendChild(headerBar);

    this.header = document.createElement('div');
    this.header.className = 'journal-title';
    headerBar.appendChild(this.header);

    // Dedicated SCROLL BODY (flex:1; min-height:0 — the iOS scroll enabler). The
    // grid lives inside it so it scrolls within the bounded panel, not past it.
    const scroll = document.createElement('div');
    scroll.className = 'journal-scroll';
    panel.appendChild(scroll);

    this.grid = document.createElement('div');
    this.grid.className = 'journal-grid';
    scroll.appendChild(this.grid);

    // Close paths (✕ / backdrop tap / Escape). The ✕ mounts in the fixed header bar
    // (not the scroll body) so it's always visible + thumb-reachable on mobile.
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

  /** Rebuild the roster from the journal — but only when it actually changed (a
   *  cheap signature of found-state + counts), so an open panel costs nothing
   *  per frame. */
  refresh(journal: Journal): void {
    const sig =
      SPECIES_ORDER.map((id) => {
        const rec = journal.species[id];
        return rec ? `${id}:${rec.catchCount}` : `${id}:-`;
      }).join('|') + `|u${journal.unlockedBiomes.join(',')}`; // re-render when a biome unlocks (locked header)
    if (sig === this.signature) return;
    this.signature = sig;

    this.header.textContent = `Field Journal — ${foundCount(journal)} of ${SPECIES_ORDER.length} found`;

    // Grouped by biome (presentation only — groupSpeciesByBiome is pure). Each
    // biome gets a header with its found/total; undiscovered species still render
    // as silhouettes (names never leaked), and locked biomes are marked.
    this.grid.replaceChildren();
    for (const g of groupSpeciesByBiome(journal)) {
      const head = document.createElement('div');
      head.className = `journal-biome${g.unlocked ? '' : ' locked'}`;
      head.textContent = `${g.displayName} — ${g.found} of ${g.total}${g.unlocked ? '' : PANEL_LABELS.lockedSuffix}`;
      this.grid.appendChild(head);
      for (const id of g.ids) {
        this.grid.appendChild(
          isFound(journal, id) ? JournalPanel.card(id, journal) : JournalPanel.silhouette(),
        );
      }
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
    const info = SPECIES_INFO[id as keyof typeof SPECIES_INFO];
    // A field-guide PAGE, not a flashcard (§4.1a, P2): the field note SYNTHESIS leads
    // (when + diet + habitat + behaviour -> "look there, then"); the discrete facts
    // stay below as a quiet at-a-glance reference.
    body.innerHTML =
      `<div class="card-name">${def.displayName}</div>` +
      `<div class="card-fieldnote">${info.fieldNote}</div>` +
      `<div class="card-facts">` +
      `<span>Diet: ${BAIT_DISPLAY[def.bait].label}</span>` +
      `<span>Habitat: ${BIOMES[def.biome].displayName}</span>` +
      `<span>${ACTIVITY_LABEL[def.activityWindow]}</span>` +
      `</div>` +
      `<div class="card-section"><span class="card-label">Behaviour</span>${info.behaviour}</div>` +
      `<div class="card-section card-funfact"><span class="card-label">Did you know</span>${def.profile}</div>` +
      `<div class="card-section card-status"><span class="card-label">Status</span>${info.status}</div>` +
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
