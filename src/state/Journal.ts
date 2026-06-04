/**
 * The Field Journal — the player's persistent creature dex, backed by
 * localStorage. This is the ONLY persistence in the game: a static, client-side
 * title with no backend, no accounts, and no network calls.
 *
 * Every access is wrapped in try/catch: Safari Private Mode throws on
 * `localStorage` writes (and can throw on reads), so the game must degrade to an
 * in-memory journal rather than crash. Load also tolerates a partial or
 * older-version payload (it merges over the defaults) so a malformed entry never
 * takes the game down.
 *
 * Phase 0 ships only the shape + safe load/save + a version field; NO species
 * are populated yet. The catch loop writes `seen`/`caught`/`bestCatchShakes` per
 * species in a later phased PR — this guard is what those writes go through.
 */

const STORAGE_KEY = 'wild-trails:journal';

/** Bump when the persisted shape changes incompatibly; load() migrates/falls
 *  back to defaults on a mismatch rather than trusting a stale shape. */
export const JOURNAL_VERSION = 1;

/** Per-species record in the Field Journal. */
export interface SpeciesRecord {
  /** Has the player ever encountered this species in the wild? */
  seen: boolean;
  /** Has the player ever successfully caught this species? */
  caught: boolean;
  /** Fewest shakes a successful catch ever took (lower = a cleaner catch);
   *  0 = never caught. */
  bestCatchShakes: number;
}

export interface Journal {
  /** Schema version of the persisted payload. */
  version: number;
  /** Per-species progress, keyed by species id. Empty until the catch loop
   *  lands; populated lazily as species are seen/caught. */
  species: Record<string, SpeciesRecord>;
}

export function createJournal(): Journal {
  return { version: JOURNAL_VERSION, species: {} };
}

/**
 * Load the Field Journal from localStorage, degrading SAFELY to a fresh in-memory
 * journal on any failure (private mode, quota, corrupt JSON) or version mismatch.
 * Never throws.
 */
export function loadJournal(): Journal {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createJournal();
    const parsed = JSON.parse(raw) as Partial<Journal>;
    // Unknown / older version: don't trust the shape — start fresh. (Real
    // migrations slot in here when the schema first changes.)
    if (parsed.version !== JOURNAL_VERSION) return createJournal();
    return {
      version: JOURNAL_VERSION,
      species: parsed.species ?? {},
    };
  } catch {
    return createJournal();
  }
}

/**
 * Persist the Field Journal. A private-mode / quota failure is swallowed so the
 * game keeps running with the in-memory journal — a failed save must NEVER crash
 * the game.
 */
export function saveJournal(journal: Journal): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // Private-mode / quota failure: keep running with the in-memory journal.
  }
}
