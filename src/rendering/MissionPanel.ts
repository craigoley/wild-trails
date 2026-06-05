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
import { MISSIONS, MISSION_ORDER, PANEL_LABELS, UNLOCK_COPY } from '../utils/constants';
import { addOverlayDismiss } from './overlayDismiss';
import { groupMissions } from './missionGroups';
import { unlockLines } from './unlockLines';

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

    // NON-scrolling header BAR (title + the ✕) — the close target never scrolls
    // away. The title is its own element so refresh can't wipe the ✕.
    const headerBar = document.createElement('div');
    headerBar.className = 'mission-header';
    panel.appendChild(headerBar);

    this.header = document.createElement('div');
    this.header.className = 'mission-header-title';
    headerBar.appendChild(this.header);

    // Dedicated SCROLL BODY (flex:1; min-height:0) — the list + debug scroll here.
    const scroll = document.createElement('div');
    scroll.className = 'mission-scroll';
    panel.appendChild(scroll);

    this.list = document.createElement('div');
    this.list.className = 'mission-list';
    scroll.appendChild(this.list);

    this.debugLine = document.createElement('div');
    this.debugLine.className = 'mission-debug';
    scroll.appendChild(this.debugLine);

    // The ✕ mounts in the fixed header bar (always visible + thumb-reachable).
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

    // Active / Completed SECTIONS (presentation only — groupMissions is pure over
    // the same journal state). An empty section renders no header (no forlorn empty
    // "Completed" early game).
    this.list.replaceChildren();
    // §17.1 — the "Reach new lands" carrot: make the set→biome-unlock link legible,
    // at the top of the scroll body (above the missions). Pure (unlockLines).
    this.appendUnlockBlock(journal);
    const { active, completed } = groupMissions(journal);
    this.appendSection(PANEL_LABELS.missionsActive, active, journal);
    this.appendSection(PANEL_LABELS.missionsCompleted, completed, journal);

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

  /** The "Reach new lands" block (§17.1): one line per gating set that unlocks a
   *  biome — in-progress shows the goal + "done of total"; an earned one shows a
   *  quiet ✓; terminal sets (no onward biome) are omitted. No-op if none apply. */
  private appendUnlockBlock(journal: Journal): void {
    const lines = unlockLines(journal).filter((l) => l.unlocks !== null);
    if (lines.length === 0) return;
    const head = document.createElement('div');
    head.className = 'mission-section';
    head.textContent = UNLOCK_COPY.blockHeader;
    this.list.appendChild(head);
    for (const l of lines) {
      const row = document.createElement('div');
      row.className = `unlock-line${l.alreadyUnlocked ? ' done' : ''}`;
      if (l.alreadyUnlocked) {
        row.textContent = UNLOCK_COPY.opened(l.unlocksName!);
      } else {
        row.innerHTML =
          `<div class="unlock-goal">${UNLOCK_COPY.toReach(l.setName, l.unlocksName!)}</div>` +
          `<div class="unlock-prog">${l.done} of ${l.total}</div>`;
      }
      this.list.appendChild(row);
    }
  }

  /** Append a section header + its mission rows. No-op (no header) when empty. */
  private appendSection(label: string, ids: readonly string[], journal: Journal): void {
    if (ids.length === 0) return;
    const head = document.createElement('div');
    head.className = 'mission-section';
    head.textContent = label;
    this.list.appendChild(head);
    for (const id of ids) this.list.appendChild(MissionPanel.row(id, journal));
  }

  /** One mission row (unchanged markup; just extracted for the section split). */
  private static row(id: string, journal: Journal): HTMLDivElement {
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
    return row;
  }
}
