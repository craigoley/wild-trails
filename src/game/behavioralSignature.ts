/**
 * §4.6 D2 (iii) — the READABLE behavioural SIGNATURE seam. PURE, Node-testable: NO three,
 * NO DOM. This is the clean, stable, public READOUT that D3 (identify-by-behavior) will consume — it
 * COMPOSES what slices (i)+(ii) already produce into one tidy signal, and adds NO new behaviour, motion,
 * or UI. It is a read, not a feature.
 *
 * The behavioural signature = how an animal reads at a glance: its LIVE ethogram state (slice i), its species SIGNATURE
 * beat (slice ii), its characteristic TIME-BUDGET + the dominant activity that budget implies (slice ii),
 * and the static identify-by-behaviour descriptors already in the species def (habitat / activity window /
 * gait). D3 will match an observed animal to a species by THIS signal — so it is kept clean + documented
 * + forward-compatible, with no speculative D3 fields.
 */

import { getSpecies, speciesBudget, speciesSignature } from './Species';
import type { Animal, AnimalBehavior } from './Animal';
import type {
  ActivityWindow,
  BiomeId,
  EthogramBudget,
  GaitKind,
  SignatureKind,
} from '../utils/constants';

/** The four calm ethogram states, in a FIXED order — the tie-break order for `dominant` (first wins). */
const BEHAVIOR_ORDER: readonly AnimalBehavior[] = ['rest', 'forage', 'vigilance', 'locomote'];

/**
 * The readable behavioural signature D3 reads to identify a species by how it behaves. A clean compose
 * of existing state — no new behaviour. `behavior` is LIVE (this animal, right now); the rest are the
 * species' characteristic behavioural signature.
 */
export interface BehavioralSignature {
  /** The LIVE ethogram state this animal is in right now (slice i): rest / forage / vigilance / locomote. */
  behavior: AnimalBehavior;
  /** The species' SIGNATURE beat (slice ii): 'bob' (dipper) / 'wag' (wagtail) / 'none'. */
  signature: SignatureKind;
  /** The species' characteristic time-budget over the calm states (slice ii) — "what it mostly does". */
  budget: EthogramBudget;
  /** The single state the species spends the MOST time in (argmax over `budget`, first-wins on a tie) —
   *  the at-a-glance dominant activity (the heron's vigilance, the mouse's forage). */
  dominant: AnimalBehavior;
  /** Static identify-by-behaviour descriptors (already in the species def). */
  habitat: BiomeId;
  activity: ActivityWindow;
  gait: GaitKind;
}

/** The dominant (highest-weight) calm state in a budget — first-wins over BEHAVIOR_ORDER on a tie. */
export function dominantBehavior(budget: EthogramBudget): AnimalBehavior {
  let best = BEHAVIOR_ORDER[0];
  let bestW = budget[best];
  for (const b of BEHAVIOR_ORDER) {
    if (budget[b] > bestW) {
      bestW = budget[b];
      best = b;
    }
  }
  return best;
}

/**
 * The readable behavioural signature for an animal — the D3 identify-by-behavior seam. PURE: composes the
 * animal's LIVE behaviour with its species' signature / budget / descriptors. Deterministic for a given
 * animal state; reads existing data, mutates nothing.
 */
export function currentSignature(animal: Animal): BehavioralSignature {
  const def = getSpecies(animal.species);
  const budget = speciesBudget(animal.species);
  return {
    behavior: animal.behavior,
    signature: speciesSignature(animal.species),
    budget,
    dominant: dominantBehavior(budget),
    habitat: def.biome,
    activity: def.activityWindow,
    gait: def.gait,
  };
}
