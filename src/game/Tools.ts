/**
 * Catch tools — PURE accessor over the TOOLS table in constants. NET is the
 * tier-1 baseline (1.0x); TRAP and TRANQ are stronger flat multipliers that
 * UNLOCK with missions (PR #8). For now the player starts with NET; the others
 * are gated by their `unlocked` flag but remain selectable from the table so the
 * catch math can be tested across tiers.
 */

import { STARTER_TOOL, TOOL_ORDER, TOOLS, type ToolId } from '../utils/constants';

export { STARTER_TOOL };
export type { ToolId } from '../utils/constants';

/** The flat catch-chance multiplier for a tool. */
export function toolMultiplier(tool: ToolId): number {
  return TOOLS[tool].catchMultiplier;
}

/** Is the tool currently unlocked (selectable in-game)? */
export function isToolUnlocked(tool: ToolId): boolean {
  return TOOLS[tool].unlocked;
}

/** Tools the player can currently select, in order (NET only until PR #8). */
export function availableTools(): ToolId[] {
  return TOOL_ORDER.filter((id) => TOOLS[id].unlocked);
}
