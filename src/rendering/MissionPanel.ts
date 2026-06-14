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
import { MISSIONS, MISSION_ORDER, PANEL_LABELS, UNLOCK_COPY, type SpeciesId } from '../utils/constants';
import { addOverlayDismiss } from './overlayDismiss';
import { groupMissions } from './missionGroups';
import { unlockLines } from './unlockLines';
import { speciesForChallenge } from '../game/catchTarget';
import { speciesThumbHtml } from './speciesPortrait';

/** §HUD catch-target (i) — the cached species thumbnail getter (set from main with the RTT); defaults to
 *  the colour+gait SWATCH (null) until wired, so the portraits read with or without the GL thumbnail. */
type ThumbUrl = (species: SpeciesId) => string | null;

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
  /** §HUD catch-target (ii) — tap-to-track: the in-session tracked mission (null = the auto default) +
   *  the boundary callback. Display-only; no persistence (the chip re-computes its default each load). */
  private trackedId: string | null = null;
  private onTrack: (id: string) => void = () => {};

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

    // §HUD catch-target (ii) — tap-to-track (delegated): a row's "Track" button sets THIS mission as the
    // chip's tracked target. Toggles the buttons in place (no full refresh) + notifies the boundary.
    this.list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.mission-track') as HTMLElement | null;
      const mid = btn?.dataset.mid;
      if (!mid) return;
      this.trackedId = mid;
      for (const b of this.list.querySelectorAll<HTMLElement>('.mission-track')) {
        const on = b.dataset.mid === mid;
        b.classList.toggle('is-tracked', on);
        b.textContent = on ? '◉ Tracking' : '◎ Track';
      }
      this.onTrack(mid);
    });

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
        // §4.1c: an escalated gate ALSO lists its required research challenge(s) with
        // their ✓/+ state, so the player is TOLD what's required (never a silent wall).
        const research = l.requiredChallenges
          .map((c) => `<div class="unlock-research${c.done ? ' done' : ''}">${UNLOCK_COPY.andResearch(c.title, c.done)}</div>`)
          .join('');
        // §4.1.4 R2 — a research-WRAPPED gate (the Highlands) ALSO lists its research
        // project + live state, so the research step is never a silent wall.
        const p = l.requiredResearch;
        const projectLine = p
          ? `<div class="unlock-research${p.completed ? ' done' : ''}">${UNLOCK_COPY.andResearchProject(p.name, p.started, p.progress, p.count, p.completed)}</div>`
          : '';
        // P2: a HEAD row (goal + progress, space-between) over the stacked research sub-lines —
        // the goal no longer competes with the count on one baseline, so each reads full-width.
        row.innerHTML =
          `<div class="unlock-head">` +
          `<div class="unlock-goal">${UNLOCK_COPY.toReach(l.setName, l.unlocksName!)}</div>` +
          `<div class="unlock-prog">${l.done} of ${l.total}</div>` +
          `</div>` +
          research +
          projectLine;
      }
      this.list.appendChild(row);
    }
  }

  /** §HUD catch-target (i) — wire the cached species-thumbnail getter (the RTT, from main). */
  setThumbnails(thumbUrl: ThumbUrl): void {
    this.thumbUrl = thumbUrl;
  }
  private thumbUrl: ThumbUrl = () => null; // default: the swatch fallback

  /** §HUD catch-target (ii) — wire the tap-to-track callback (the boundary stores the override). */
  setOnTrack(fn: (id: string) => void): void {
    this.onTrack = fn;
  }
  /** §HUD catch-target (ii) — reflect the active tracked mission (the auto default or the override). */
  setTracked(id: string | null): void {
    this.trackedId = id;
  }

  /** Append a section header + its mission rows. No-op (no header) when empty. */
  private appendSection(label: string, ids: readonly string[], journal: Journal): void {
    if (ids.length === 0) return;
    const head = document.createElement('div');
    head.className = 'mission-section';
    head.textContent = label;
    this.list.appendChild(head);
    for (const id of ids) this.list.appendChild(this.row(id, journal));
  }

  /** One mission row — a species PORTRAIT (catch-target) + the text/progress. */
  private row(id: string, journal: Journal): HTMLDivElement {
    const def = MISSIONS[id];
    const prog = journal.missions[id];
    const done = prog?.completed ?? false;
    const at = prog?.progress ?? 0;
    const species = speciesForChallenge(def.requirement); // §HUD — which species to PORTRAY
    const row = document.createElement('div');
    row.className = `mission-row${done ? ' done' : ''}`;
    const tracked = this.trackedId === id;
    row.innerHTML =
      speciesThumbHtml(species, this.thumbUrl(species)) +
      `<div class="mission-rowtext">` +
      `<div class="mission-title">${done ? '✓ ' : ''}${def.title}</div>` +
      `<div class="mission-desc">${def.description}</div>` +
      `<div class="mission-prog">${done ? 'Complete' : `${at} / ${def.requirement.count}`}` +
      ` · +${def.rewardPoints} pts</div>` +
      // §HUD catch-target (ii) — a quiet tap-to-track affordance (incomplete missions only) → the chip.
      (done ? '' : `<button class="mission-track${tracked ? ' is-tracked' : ''}" data-mid="${id}">${tracked ? '◉ Tracking' : '◎ Track'}</button>`) +
      `</div>`;
    return row;
  }
}
