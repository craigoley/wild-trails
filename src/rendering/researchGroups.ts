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
  /** Is this area's gating breadcrumb VISIBLE (its access project is actionable)? This is
   *  the one-area-ahead horizon: true = "more to study here"; false = "more lands ahead". */
  gatingVisible: boolean;
}

/**
 * Group the research registry by area in BIOME_ORDER. Areas with NO project (woodland)
 * are skipped. For each area, partition its projects into the visible cards (shown) and
 * the hidden internals (teased), and flag whether its gating breadcrumb is reachable.
 */
export function groupResearchByArea(journal: Journal): ResearchAreaGroup[] {
  const groups: ResearchAreaGroup[] = [];
  for (const area of BIOME_ORDER) {
    const ids = RESEARCH_ORDER.filter((id) => RESEARCH_PROJECTS[id].area === area);
    if (ids.length === 0) continue; // no research in this area (e.g. woodland) — no section

    const visibleIds = ids.filter((id) => isProjectVisible(journal, RESEARCH_PROJECTS[id]));
    const hasHiddenInternal = ids.some(
      (id) =>
        !isProjectVisible(journal, RESEARCH_PROJECTS[id]) && !isGatingProject(RESEARCH_PROJECTS[id]),
    );
    const gatingId = ids.find((id) => isGatingProject(RESEARCH_PROJECTS[id]));
    const gatingVisible = gatingId ? isProjectVisible(journal, RESEARCH_PROJECTS[gatingId]) : false;

    groups.push({
      area,
      displayName: BIOMES[area].displayName,
      accessed: isAreaAccessed(journal, area),
      visibleIds,
      hasHiddenInternal,
      gatingVisible,
    });
  }
  return groups;
}
