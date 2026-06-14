/**
 * PURE presentation grouping for the Research panel (no DOM/three — unit-testable),
 * mirroring journalGroups. Groups projects BY AREA in world order, and applies the
 * focus rule: an ACCESSED area shows its projects fully; a NOT-yet-accessed area
 * collapses to a teaser + (when reachable) its how-to-reach breadcrumb.
 *
 * THE HIDE RULE (the crux): a project is HIDDEN iff its ACTIVITY is locked to a
 * not-yet-accessed area (un-actionable clutter). It is SHOWN iff its activity area
 * is accessed (you can do the work — this keeps the gating BREADCRUMBS visible) OR
 * it is already `started` (the old-save in-flight safety — never hide a project
 * mid-flight). The engine is untouched; this only decides what the panel renders.
 */

import {
  BIOME_ORDER,
  BIOMES,
  RESEARCH_ORDER,
  RESEARCH_PROJECTS,
  SPECIES,
  type BiomeId,
  type ResearchProject,
} from '../utils/constants';
import type { Journal } from '../state/Journal';

/** Is an area reachable yet? Meadow always; the others once earned. Mirrors the
 *  journal's single source of truth (journalGroups.ts:37) so the two surfaces agree. */
export function isAreaAccessed(journal: Journal, biome: BiomeId): boolean {
  return biome === 'meadow' || journal.unlockedBiomes.includes(biome);
}

/** The biome a project's ACTIVITY is locked to (where you DO the work), or null if it
 *  isn't biome-locked (catch-in-phase — doable in any accessed area at the right time). */
export function activityBiome(p: ResearchProject): BiomeId | null {
  const a = p.activityRequirement;
  if (a.kind === 'catch-in-biome') return a.biome;
  if (a.kind === 'catch-species') return SPECIES[a.species].biome;
  return null; // catch-in-phase
}

/** Is a `biome-access` (gating) project — the one whose reward OPENS its area. These are
 *  the how-to-reach BREADCRUMBS; an "internal" project is anything else (tools/bait/dex). */
export function isGatingProject(p: ResearchProject): boolean {
  return p.reward.kind === 'biome-access';
}

/** P1 — the biome a project is DISPLAYED under. A gating (biome-access) project shows under its
 *  ACTIVITY area (the accessed prereq where you DO the unlock work), NOT its locked target `area`,
 *  so the startable card lives where it's actionable and the locked target shows only a breadcrumb.
 *  Internal projects (and any non-biome-locked gating — none today) stay in their own `area`. The
 *  ENGINE is untouched; this only decides which section the panel renders the card in. */
export function displayArea(p: ResearchProject): BiomeId {
  if (isGatingProject(p)) {
    const a = activityBiome(p);
    if (a !== null) return a; // relocate to the accessed prereq area
  }
  return p.area;
}

/** P1 — the biome-access project that OPENS `area` (reward.biome === area), or null if `area` isn't
 *  research-gated (the gentle, mission-set gates — e.g. the wetland). Drives the locked-area
 *  breadcrumb ("Reach by completing 'X Access' in the [prereq]"). */
function gatingProjectFor(area: BiomeId): ResearchProject | null {
  for (const id of RESEARCH_ORDER) {
    const p = RESEARCH_PROJECTS[id];
    if (p.reward.kind === 'biome-access' && p.reward.biome === area) return p;
  }
  return null;
}

/** THE HIDE RULE: shown iff its activity area is accessed (actionable) OR it's started. */
export function isProjectVisible(journal: Journal, p: ResearchProject): boolean {
  if (journal.research[p.id]?.started) return true; // in-flight safety — never hide mid-study
  const b = activityBiome(p);
  return b === null || isAreaAccessed(journal, b);
}

export interface ResearchAreaGroup {
  area: BiomeId;
  displayName: string;
  /** Reachable yet? Accessed → render the projects fully; not → collapse to a teaser. */
  accessed: boolean;
  /** Project ids to render as full cards (the visible ones), in RESEARCH_ORDER. */
  visibleIds: string[];
  /** Does this area have ≥1 HIDDEN internal project (collapsed away)? Drives the
   *  "more to study here once you arrive" teaser (don't promise more if there's none). */
  hasHiddenInternal: boolean;
  /** P1 — for a LOCKED area, the breadcrumb describing how to reach it: the (relocated) access
   *  project's name + the accessed PREREQ area you do the work in. Set ONLY when that prereq is
   *  itself accessed (the one-area-ahead horizon); null when the area is accessed, when no research
   *  gates it, or when the prereq is still locked (then the section reads "more lands ahead"). */
  reach: { projectName: string; prereqName: string } | null;
}

/**
 * Group the research registry by DISPLAY area in BIOME_ORDER (P1: a gating project displays under
 * its accessed activity area, not its locked target). Areas with NO project (woodland) are skipped.
 * For each area, partition its projects into the visible cards (shown) and the hidden internals
 * (teased), and — for a locked area — compute the how-to-reach breadcrumb (one-area-ahead only).
 */
export function groupResearchByArea(journal: Journal): ResearchAreaGroup[] {
  const groups: ResearchAreaGroup[] = [];
  for (const area of BIOME_ORDER) {
    const ids = RESEARCH_ORDER.filter((id) => displayArea(RESEARCH_PROJECTS[id]) === area);
    if (ids.length === 0) continue; // no research displays in this area (e.g. woodland) — no section

    const accessed = isAreaAccessed(journal, area);
    const visibleIds = ids.filter((id) => isProjectVisible(journal, RESEARCH_PROJECTS[id]));
    const hasHiddenInternal = ids.some(
      (id) =>
        !isProjectVisible(journal, RESEARCH_PROJECTS[id]) && !isGatingProject(RESEARCH_PROJECTS[id]),
    );
    // P1 — a locked area's reach breadcrumb: named only when its access project's prereq (activity)
    // area is itself accessed (the one-area-ahead horizon). Else null → "more lands ahead".
    let reach: ResearchAreaGroup['reach'] = null;
    if (!accessed) {
      const g = gatingProjectFor(area);
      const prereq = g ? activityBiome(g) : null;
      if (g && prereq !== null && isAreaAccessed(journal, prereq)) {
        reach = { projectName: g.name, prereqName: BIOMES[prereq].displayName };
      }
    }

    groups.push({
      area,
      displayName: BIOMES[area].displayName,
      accessed,
      visibleIds,
      hasHiddenInternal,
      reach,
    });
  }
  return groups;
}
