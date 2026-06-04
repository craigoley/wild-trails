/**
 * Time of day — PURE, Node-testable. Maps the run clock (`timeSec`) onto a
 * looping day-night cycle of four phases (dawn -> day -> dusk -> night). The
 * phase gates which species are out (crepuscular animals at dawn/dusk, etc), so
 * this is the heart of the "time of day = real behaviour" mechanic.
 *
 * All boundaries live in `TIME` (constants); this module is just the lookup.
 */

import { TIME, type DayPhase } from '../utils/constants';

export type { DayPhase } from '../utils/constants';

/** The day phase at `timeSec`. The clock loops every `TIME.cyclePeriodSec`;
 *  negative times wrap correctly too. */
export function dayPhaseAt(timeSec: number): DayPhase {
  const period = TIME.cyclePeriodSec;
  const frac = (((timeSec % period) + period) % period) / period; // [0, 1)
  if (frac >= TIME.nightStart) return 'night';
  if (frac >= TIME.duskStart) return 'dusk';
  if (frac >= TIME.dayStart) return 'day';
  return 'dawn';
}
