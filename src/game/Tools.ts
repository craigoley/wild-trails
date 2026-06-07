/**
 * Catch nets — the durable "tool in hand" (Nets & Gear arc, slice A). PURE over the
 * TOOLS table + the journal's owned/active net state. The Hand Net is the starter;
 * future biome nets are LATERAL (reach/condition, never a flat multiplier — the
 * trap/tranq flat multipliers were retired). `toolMultiplier` stays the neutral 1.0
 * identity so the catch FORMULA is unchanged; ownership/equip live in the journal so
 * they persist (v6).
 */

import { STARTER_TOOL, TOOL_ORDER, TOOLS, type ToolId } from '../utils/constants';
import type { Journal } from '../state/Journal';

export { STARTER_TOOL };
export type { ToolId } from '../utils/constants';

/** The catch-chance factor for a net — the neutral 1.0 identity (lateral by design;
 *  no net carries a flat catch-rate multiplier). Kept so finalCatchChance is unchanged. */
export function toolMultiplier(tool: ToolId): number {
  return TOOLS[tool].catchMultiplier;
}

/** The REACH of a net, world units (slice B0) — the attempt gate + proximity denominator.
 *  Per-net so biome nets (B1) answer reach LATERALLY; the starter equals the current
 *  CATCH.attemptRadius (so B0 is behavior-neutral). */
export function toolReach(tool: ToolId): number {
  return TOOLS[tool].reach;
}

/** Is `id` a real net id (guards migration / persisted input). */
export function isToolId(id: unknown): id is ToolId {
  return typeof id === 'string' && id in TOOLS;
}

/** Does the player own this net? */
export function ownsTool(journal: Journal, id: ToolId): boolean {
  return journal.ownedTools.includes(id);
}

/** Grant a net to the player (idempotent). Returns false if already owned. The
 *  PRICE/credits are the caller's concern (the shop) — this is the inventory write. */
export function grantTool(journal: Journal, id: ToolId): boolean {
  if (journal.ownedTools.includes(id)) return false;
  journal.ownedTools.push(id);
  return true;
}

/** Equip an OWNED net as the active one. Returns false (no-op) if not owned. */
export function equipTool(journal: Journal, id: ToolId): boolean {
  if (!journal.ownedTools.includes(id)) return false;
  journal.activeTool = id;
  return true;
}

/** The owned nets in canonical (TOOL_ORDER) order — for the gear UI. */
export function ownedToolsInOrder(journal: Journal): ToolId[] {
  return TOOL_ORDER.filter((id) => journal.ownedTools.includes(id));
}
