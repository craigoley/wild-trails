/**
 * Pure mapping from a mission-eval result to the player-facing banner messages —
 * NO DOM, so the "completion -> notice" and "unlock -> notice" links are unit-
 * testable. The boundary (main) feeds these to the Banner renderer.
 *
 * Banners reuse the existing fade-notice pattern; this just composes the copy
 * from the mission + biome DATA so the message names what happened.
 */

import type { MissionEval } from '../game/Missions';
import type { ResearchEval } from '../game/Research';
import { researchState } from '../game/Research';
import type { Journal } from '../state/Journal';
import { BIOMES, MISSIONS, RESEARCH_PROJECTS } from '../utils/constants';

export type BannerKind = 'mission' | 'unlock' | 'hint' | 'research';

export interface BannerMessage {
  text: string;
  kind: BannerKind;
}

/**
 * One banner per mission completed + one per biome unlocked this event. Unlocks
 * come LAST so the spine's payoff is the message left on screen. Empty when
 * nothing completed/unlocked (the common case — no banner spam per catch).
 */
export function missionBannerMessages(result: MissionEval): BannerMessage[] {
  const out: BannerMessage[] = [];
  for (const id of result.completed) {
    const m = MISSIONS[id];
    if (m) out.push({ text: `Mission complete: ${m.title}  ·  +${m.rewardPoints} pts`, kind: 'mission' });
  }
  for (const id of result.unlocked) {
    out.push({ text: `New area unlocked: ${BIOMES[id].displayName}!`, kind: 'unlock' });
  }
  // §4.1b teaching hints (warm misses on active research challenges) — gentle, never
  // a failure. Only one per event (dedup) so a catch can't spam the same hint twice.
  for (const hint of [...new Set(result.hints)]) {
    out.push({ text: hint, kind: 'hint' });
  }
  return out;
}

/**
 * The catch-time research NUDGE (R0b): a brief progress line when a catch advanced a
 * project ("Nocturnal Field Study — 2/3"), and a completion line when one finished. Reads
 * the post-event journal for the current progress. Empty when nothing research-y happened
 * (the common case). Reuses the Banner — no new HUD element.
 */
export function researchBannerMessages(journal: Journal, result: ResearchEval): BannerMessage[] {
  const out: BannerMessage[] = [];
  const done = new Set(result.completed);
  for (const id of result.progressed) {
    if (done.has(id)) continue; // a project that completed this event shows the completion line below
    const p = RESEARCH_PROJECTS[id];
    if (p) out.push({ text: `${p.name} — ${researchState(journal, id).progress}/${p.activityRequirement.count}`, kind: 'research' });
  }
  for (const id of result.completed) {
    const p = RESEARCH_PROJECTS[id];
    if (p) out.push({ text: `Research complete: ${p.name}`, kind: 'research' });
  }
  return out;
}
