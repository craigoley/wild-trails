/**
 * PURE presentation grouping for the Field Journal (no DOM/three — unit-testable).
 * Groups the roster by biome in world order, with per-biome found counts, so the
 * panel can show "Woodland — 2 of 4" sections instead of one flat 13-card list.
 *
 * Returns IDS only — it never exposes an undiscovered species' name (the panel
 * still renders a silhouette for un-found ids). No state mutation, no game logic.
 */

import { BIOME_ORDER, BIOMES, SPECIES, SPECIES_ORDER, type BiomeId } from '../utils/constants';
import { isFound, type Journal } from '../state/Journal';

export interface BiomeGroup {
  biome: BiomeId;
  displayName: string;
  /** This biome's species ids, in SPECIES_ORDER (names NOT exposed). */
  ids: string[];
  /** How many of them the player has found. */
  found: number;
  /** Total species native to this biome. */
  total: number;
  /** Reachable yet? Meadow always; the others once earned (the locked affordance). */
  unlocked: boolean;
}

/** Group the roster by biome in BIOME_ORDER with per-biome found/total. The found
 *  counts sum to foundCount(journal) and the totals sum to SPECIES_ORDER.length. */
export function groupSpeciesByBiome(journal: Journal): BiomeGroup[] {
  return BIOME_ORDER.map((biome) => {
    const ids = SPECIES_ORDER.filter((id) => SPECIES[id].biome === biome);
    return {
      biome,
      displayName: BIOMES[biome].displayName,
      ids,
      found: ids.filter((id) => isFound(journal, id)).length,
      total: ids.length,
      unlocked: biome === 'meadow' || journal.unlockedBiomes.includes(biome),
    };
  });
}
