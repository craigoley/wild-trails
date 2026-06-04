/**
 * The Missions + rank overlay — a SIBLING to the Field Journal panel (the journal
 * is the dex; this is the to-do + progression). An HTML overlay built once;
 * `refresh` rebuilds from a cheap signature so an open panel costs ~nothing per
 * frame. Shows the current Field-Researcher rank, each mission's applied-behavior
 * task + its progress, and — under `?debug=1` — the offered→…→reward funnel.
 *
 * READS the journal + mission DATA, never mutates. DOM lives here in the
 * rendering layer, never in src/game/.
 */

import type { Journal } from '../state/Journal';
import { currentRank, rankPointsTotal } from '../game/Missions';
import { MISSIONS, MISSION_ORDER } from '../utils/constants';
import { addOverlayDismiss } from './overlayDismiss';

/** Funnel counts for the mission pipeline (debug-only, §5.5). */
export interface MissionTelemetry {
  offered: number;
  started: number;
  progressed: number;
  completed: number;
  rewardsClaimed: number;
}

export class MissionPanel {
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly debugLine: HTMLDivElement;
  private open = false;
  private signature = '';

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'mission-overlay';
    this.root.style.display = 'none';

    const panel = document.createElement('div');
    panel.className = 'mission-panel';
    this.root.appendChild(panel);

    this.header = document.createElement('div');
    this.header.className = 'mission-header';
    panel.appendChild(this.header);

    this.list = document.createElement('div');
    this.list.className = 'mission-list';
    panel.appendChild(this.list);

    this.debugLine = document.createElement('div');
    this.debugLine.className = 'mission-debug';
    panel.appendChild(this.debugLine);

    // Same close paths as the journal (this panel had the identical soft-trap).
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

  /** Rebuild from the journal + telemetry — only when something changed. */
  refresh(journal: Journal, telemetry: MissionTelemetry, debug: boolean): void {
    const sig =
      MISSION_ORDER.map((id) => {
        const p = journal.missions[id];
        return `${id}:${p ? `${p.progress}${p.completed ? 'c' : ''}` : '-'}`;
      }).join('|') +
      `|r${journal.rankPoints}s${Object.keys(journal.species).length}` +
      (debug ? `|t${telemetry.progressed},${telemetry.completed}` : '');
    if (sig === this.signature) return;
    this.signature = sig;

    const rank = currentRank(journal);
    this.header.textContent = `Missions — ${rank.name} · ${rankPointsTotal(journal)} pts`;

    this.list.replaceChildren();
    for (const id of MISSION_ORDER) {
      const def = MISSIONS[id];
      const prog = journal.missions[id];
      const done = prog?.completed ?? false;
      const at = prog?.progress ?? 0;
      const row = document.createElement('div');
      row.className = `mission-row${done ? ' done' : ''}`;
      row.innerHTML =
        `<div class="mission-title">${done ? '✓ ' : ''}${def.title}</div>` +
        `<div class="mission-desc">${def.description}</div>` +
        `<div class="mission-prog">${done ? 'Complete' : `${at} / ${def.requirement.count}`}` +
        ` · +${def.rewardPoints} pts</div>`;
      this.list.appendChild(row);
    }

    if (debug) {
      const t = telemetry;
      this.debugLine.textContent =
        `funnel — offered:${t.offered} started:${t.started} progressed:${t.progressed} ` +
        `completed:${t.completed} rewards:${t.rewardsClaimed}`;
      this.debugLine.style.display = 'block';
    } else {
      this.debugLine.style.display = 'none';
    }
  }
}
