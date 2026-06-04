/**
 * The "Field Guide Complete" win screen (Plan #10) — the §14 completion payoff.
 * A warm naturalist's certificate (species discovered, biomes explored, the
 * Field-Researcher title), NOT a high-score. It's a CLOSEABLE overlay (the shared
 * dismiss helper) — dismissing it returns to free-roam; nothing resets. Fired ONCE
 * by the boundary (a persisted `won` flag guards re-firing).
 *
 * READS the journal; never mutates. DOM lives here in the rendering layer.
 * Zero-asset (a CSS flourish + a unicode glyph).
 */

import type { Journal } from '../state/Journal';
import { currentRank } from '../game/Missions';
import { foundCount } from '../state/Journal';
import { BIOMES, SPECIES_ORDER, WIN, type BiomeId } from '../utils/constants';
import { addOverlayDismiss } from './overlayDismiss';

export class WinScreen {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private open = false;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'win-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'win-panel';
    this.root.appendChild(panel);

    const title = document.createElement('div');
    title.className = 'win-title';
    title.textContent = WIN.title;
    panel.appendChild(title);

    this.body = document.createElement('div');
    this.body.className = 'win-body';
    panel.appendChild(this.body);

    // Closeable — you dismiss it INTO free-roam (✕ / backdrop / Escape).
    addOverlayDismiss(this.root, panel, () => this.open, () => this.setOpen(false));
    container.appendChild(this.root);
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.root.style.display = open ? 'flex' : 'none';
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Build the certificate summary from the completed journal, then show it. */
  show(journal: Journal): void {
    const biomes = [...journal.unlockedBiomes];
    if (!biomes.includes('meadow')) biomes.unshift('meadow'); // always-open home
    const names = biomes.map((b) => BIOMES[b as BiomeId]?.displayName ?? b).join(' · ');

    this.body.replaceChildren();
    this.body.appendChild(this.stat(`${foundCount(journal)} of ${SPECIES_ORDER.length} creatures catalogued`));
    this.body.appendChild(this.stat(`Regions explored: ${names}`));
    this.body.appendChild(this.stat(`Rank: ${currentRank(journal).name}`));
    this.body.appendChild(this.line('win-blurb', WIN.blurb));
    this.body.appendChild(this.line('win-freeroam', WIN.freeRoam));
    this.setOpen(true);
  }

  private stat(text: string): HTMLDivElement {
    return this.line('win-stat', text);
  }

  private line(cls: string, text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  }
}
