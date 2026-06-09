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
import { canStartResearch, isResearchReady, researchState } from '../game/Research';
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
    const done = Math.min(s.progress, count);
    const pct = count > 0 ? Math.round((done / count) * 100) : 0; // fill DERIVES from progress/count
    const studying = s.started && !s.completed; // the bar shows ONLY while in progress
    // §4.1c/R2 — a knowledge-gated project ALSO shows its mastery-challenge state (the #37
    // pattern) so a TWO-requirement project never hides one. Shown until the project completes;
    // satisfied ONLY by play (journal.missions) — never a time/ETA.
    const challenge = p.knowledgeRequirement && !s.completed ? p.knowledgeRequirement : null;
    const challengeDone = challenge ? journal.missions[challenge]?.completed === true : false;

    // The activity NAMES what advances it; the count is the activity-remaining read (N more
    // catches) — never a time estimate (research is activity-driven, R0a).
    const activityText = `${describeActivity(p.activityRequirement)} · ${done} / ${count}`;
    info.innerHTML =
      `<div class="research-name">${p.name}</div>` +
      `<div class="research-blurb">${p.blurb}</div>` +
      // UNIFIED progress element (while studying): the bar CARRIES its own label, so an empty
      // 0/N bar reads as "Catch in the … · 0/N — fills as you catch", not a disconnected inert
      // strip. The label sits ON the fill (the fill = progress/count, derived; NO timer/ETA).
      // Not-yet-started / completed: the plain activity line (no bar — Start / ✓ is the action).
      (studying
        ? `<div class="research-progress" role="progressbar" aria-valuenow="${done}" aria-valuemax="${count}" aria-label="${activityText}">` +
          `<div class="research-progress-fill" style="width: ${pct}%"></div>` +
          `<div class="research-progress-label">${activityText}</div></div>`
        : `<div class="research-activity">${activityText}</div>`) +
      // §4.1c/R2 — the mastery-challenge requirement stays a DISTINCT line (the #37 two-requirement
      // legibility): the BAR is the activity; THIS is the separate "by play" knowledge gate.
      (challenge
        ? `<div class="research-knowledge${challengeDone ? ' done' : ''}">` +
          `${challengeDone ? '✓' : '+'} ${MISSIONS[challenge]?.title ?? 'a research challenge'} — by play</div>`
        : '');
    row.appendChild(info);

    const ctl = this.control(id, p, s);
    if (ctl) row.appendChild(ctl); // started-but-in-progress has no right-hand action (the bar is the status)
    return row;
  }

  /** The right-hand ACTION (Start / Complete / Done badge), or null while simply in progress —
   *  the progress bar + the knowledge line (in the info) ARE the status now (not a dead label). */
  private control(id: string, p: (typeof RESEARCH_PROJECTS)[string], s: { started: boolean; progress: number; completed: boolean }): HTMLElement | null {
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

    // Started + ready (activity + knowledge done) -> Complete (charges any top-up).
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

    // Started but not ready (activity short, or the §4.1c knowledge gate unmet) — no action;
    // the bar shows how far + the knowledge line shows what's left.
    return null;
  }
}
