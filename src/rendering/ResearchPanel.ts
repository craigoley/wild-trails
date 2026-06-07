/**
 * The Research panel (§4.1.4 R0b) — the first player-facing research surface. It CLONES
 * the established panel/scroll architecture EXACTLY (overlay → panel → non-scrolling header
 * with the ✕ → bounded scroll body), like MissionPanel / ShopPanel / JournalPanel, so the
 * hard-won #28/#30/#31/#32 mobile-scroll behaviour is reused, not reinvented.
 *
 * READS the journal + the static project DATA; Start / Complete fire the boundary callbacks
 * (which spend credits, advance state, and persist). Procedural, zero-asset; DOM lives here
 * in the rendering layer, never in src/game/.
 */

import { addOverlayDismiss } from './overlayDismiss';
import { canStartResearch, isResearchReady, knowledgeMet, researchState } from '../game/Research';
import type { Journal } from '../state/Journal';
import {
  BIOMES,
  CREDITS,
  MISSIONS,
  RESEARCH_ORDER,
  RESEARCH_PROJECTS,
  SPECIES,
  type ResearchActivity,
} from '../utils/constants';

/** A short legible description of what advances a project (the teaching axes). */
function describeActivity(a: ResearchActivity): string {
  switch (a.kind) {
    case 'catch-species':
      return `Catch the ${SPECIES[a.species].displayName.toLowerCase()}`;
    case 'catch-in-biome':
      return `Catch in the ${BIOMES[a.biome].displayName}`;
    case 'catch-in-phase':
      return `Catch at ${a.phase}`;
  }
}

export class ResearchPanel {
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly balance: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private open = false;
  private signature = '';
  private journal: Journal | null = null;
  /** Start a project (spend the cost + persist) — wired at the boundary. */
  private readonly onStart: (id: string) => void;
  /** Complete a ready project (charge any top-up + apply the reward + persist). */
  private readonly onComplete: (id: string) => void;

  constructor(container: HTMLElement, onStart: (id: string) => void, onComplete: (id: string) => void) {
    this.onStart = onStart;
    this.onComplete = onComplete;

    this.root = document.createElement('div');
    this.root.className = 'research-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'research-panel';
    this.root.appendChild(panel);

    // Non-scrolling header bar (title + the ✕) — the close target never scrolls away.
    const headerBar = document.createElement('div');
    headerBar.className = 'research-header';
    panel.appendChild(headerBar);
    this.header = document.createElement('div');
    this.header.className = 'research-header-title';
    headerBar.appendChild(this.header);

    // Dedicated SCROLL BODY (flex:1; min-height:0) — the balance + the project list.
    const scroll = document.createElement('div');
    scroll.className = 'research-scroll';
    panel.appendChild(scroll);

    this.balance = document.createElement('div');
    this.balance.className = 'research-balance';
    scroll.appendChild(this.balance);

    this.list = document.createElement('div');
    this.list.className = 'research-list';
    scroll.appendChild(this.list);

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

  /** Rebuild from the journal — only when research state / credits changed. */
  refresh(journal: Journal): void {
    this.journal = journal;
    const sig =
      RESEARCH_ORDER.map((id) => {
        const s = journal.research[id];
        return `${id}:${s ? `${s.started ? 's' : ''}${s.progress}${s.completed ? 'c' : ''}` : '-'}`;
      }).join('|') + `|c${journal.credits}`;
    if (sig === this.signature) return;
    this.signature = sig;

    this.header.textContent = 'Research';
    this.balance.textContent = `${CREDITS.glyph} ${journal.credits}`;
    this.list.replaceChildren();
    for (const id of RESEARCH_ORDER) this.list.appendChild(this.row(id));
  }

  private row(id: string): HTMLDivElement {
    const journal = this.journal!;
    const p = RESEARCH_PROJECTS[id];
    const s = researchState(journal, id);
    const row = document.createElement('div');
    row.className = 'research-row';

    const info = document.createElement('div');
    info.className = 'research-info';
    const count = p.activityRequirement.count;
    info.innerHTML =
      `<div class="research-name">${p.name}</div>` +
      `<div class="research-blurb">${p.blurb}</div>` +
      `<div class="research-activity">${describeActivity(p.activityRequirement)} — ${Math.min(s.progress, count)}/${count}</div>`;
    row.appendChild(info);

    row.appendChild(this.control(id, p, s));
    return row;
  }

  /** The right-hand control: Start / In-progress / Needs-knowledge / Complete / Done. */
  private control(id: string, p: (typeof RESEARCH_PROJECTS)[string], s: { started: boolean; progress: number; completed: boolean }): HTMLElement {
    const journal = this.journal!;

    if (s.completed) {
      const done = document.createElement('div');
      done.className = 'research-done';
      done.textContent = 'Complete ✓';
      return done;
    }

    if (!s.started) {
      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      btn.textContent = `Start ${CREDITS.glyph} ${p.cost}`;
      btn.disabled = !canStartResearch(journal, id);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onStart(id);
        this.refresh(journal);
      });
      return btn;
    }

    // Started. Ready (activity + knowledge done) -> Complete (charges any top-up).
    if (isResearchReady(journal, id)) {
      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      btn.textContent = p.creditTopUp !== undefined ? `Complete ${CREDITS.glyph} ${p.creditTopUp}` : 'Complete';
      btn.disabled = p.creditTopUp !== undefined && journal.credits < p.creditTopUp;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onComplete(id);
        this.refresh(journal);
      });
      return btn;
    }

    // Started but not ready — the activity is short of its count, or (the §4.1c wrap) the
    // KNOWLEDGE requirement isn't met yet. Surface which, so it's never a silent gate.
    const note = document.createElement('div');
    note.className = 'research-need';
    if (!knowledgeMet(journal, p) && p.knowledgeRequirement) {
      const m = MISSIONS[p.knowledgeRequirement];
      note.textContent = `Needs: ${m ? m.title : 'a research challenge'}`;
    } else {
      note.textContent = 'In progress';
    }
    return note;
  }
}
