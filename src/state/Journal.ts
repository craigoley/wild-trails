/**
 * The Field Journal — the player's persistent creature dex, and the OleyArcade
 * fleet's FIRST real localStorage collection. A static, client-side title: no
 * backend, no accounts, no network. The journal is cross-session meta-progress,
 * so it lives at the boundary (main), NOT in the per-run GameState.
 *
 * SAFETY (load-bearing — this is the fleet's first persistence):
 *  - Every localStorage access is wrapped in try/catch. Safari Private Mode
 *    throws on setItem (and can throw on reads); a failed read/write is a no-op
 *    that degrades to an in-memory journal — it NEVER escapes as an exception.
 *  - Corrupt / unparseable stored JSON falls back to a fresh empty store.
 *  - The schema is VERSIONED and load routes through a migration hook, so Plan
 *    #8 can bump the version and upgrade old stores without a reset.
 *
 * SCHEMA (v1): only CAUGHT species get an entry — absence === not found yet, so
 * the "silhouette" logic is just "does this species have an entry". The record
 * is a clean what/when: caught + how many times + when first caught. Catch METHOD
 * (bait/tool/cover) is deliberately NOT persisted.
 */

const STORAGE_KEY = 'wild-trails:journal';

/** Current persisted schema version. Bump when the shape changes incompatibly;
 *  add a step to `migrate` so old stores upgrade rather than reset. */
export const JOURNAL_SCHEMA_VERSION = 1;

/** Per-species record. An entry exists IFF the species has been caught. */
export interface SpeciesRecord {
  /** Always true (an entry only exists once caught) — explicit for the schema. */
  caught: true;
  /** How many times this species has been caught. */
  catchCount: number;
  /** When it was FIRST caught (epoch ms). Never changes after the first catch. */
  firstCaughtAt: number;
}

export interface Journal {
  /** Persisted schema version. */
  schemaVersion: number;
  /** Per-species progress, keyed by species id. Only caught species appear. */
  species: Record<string, SpeciesRecord>;
}

/** A fresh, empty journal (nothing found yet). */
export function createJournal(): Journal {
  return { schemaVersion: JOURNAL_SCHEMA_VERSION, species: {} };
}

// ---------------------------------------------------------------------------
// Pure record + query API (no DOM — fully Node-testable)
// ---------------------------------------------------------------------------

/**
 * Record a successful catch. The FIRST catch of a species creates its entry
 * (catchCount = 1, firstCaughtAt = now); subsequent catches increment catchCount
 * and LEAVE firstCaughtAt unchanged (re-stamping the date on every catch is the
 * classic bug this guards against). `nowMs` is passed in so the pure layer never
 * reads the clock.
 */
export function recordCatch(journal: Journal, speciesId: string, nowMs: number): void {
  const entry = journal.species[speciesId];
  if (entry) {
    entry.catchCount += 1;
  } else {
    journal.species[speciesId] = { caught: true, catchCount: 1, firstCaughtAt: nowMs };
  }
}

/** Has this species been found (caught at least once)? Drives the silhouette. */
export function isFound(journal: Journal, speciesId: string): boolean {
  return journal.species[speciesId] !== undefined;
}

/** Number of species found (caught) — the "X of N found" header count. */
export function foundCount(journal: Journal): number {
  return Object.keys(journal.species).length;
}

// ---------------------------------------------------------------------------
// Migration + (de)serialization
// ---------------------------------------------------------------------------

/** Type guard for a well-formed v1 species record. */
function isSpeciesRecord(v: unknown): v is SpeciesRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.caught === true && typeof r.catchCount === 'number' && typeof r.firstCaughtAt === 'number';
}

/**
 * The migration HOOK: turn an arbitrary parsed payload into a valid current-
 * schema Journal. Routes by `schemaVersion`. v1 has nothing to migrate FROM, so
 * a current-version payload is sanitized through and anything older/missing/
 * unknown resets to a fresh store — but the hook EXISTS and fires, so Plan #8
 * can add `case 1 -> 2` upgrade steps here without touching callers.
 */
export function migrate(parsed: unknown): Journal {
  if (typeof parsed !== 'object' || parsed === null) return createJournal();
  const obj = parsed as { schemaVersion?: unknown; species?: unknown };

  // Future upgrades insert here: e.g. if (obj.schemaVersion === 1) obj = up_1to2(obj).
  if (obj.schemaVersion !== JOURNAL_SCHEMA_VERSION) return createJournal();

  const species: Record<string, SpeciesRecord> = {};
  if (typeof obj.species === 'object' && obj.species !== null) {
    for (const [id, rec] of Object.entries(obj.species as Record<string, unknown>)) {
      if (isSpeciesRecord(rec)) species[id] = rec;
    }
  }
  return { schemaVersion: JOURNAL_SCHEMA_VERSION, species };
}

/**
 * Load the journal from localStorage, degrading SAFELY to a fresh store on ANY
 * failure (private mode, quota, corrupt JSON, version mismatch). Never throws.
 */
export function loadJournal(): Journal {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createJournal();
    return migrate(JSON.parse(raw));
  } catch {
    return createJournal();
  }
}

/**
 * Persist the journal. A private-mode / quota failure is swallowed (a no-op) so
 * the game keeps running with the in-memory journal — a failed save must NEVER
 * crash the game.
 */
export function saveJournal(journal: Journal): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // Private-mode / quota failure: keep running with the in-memory journal.
  }
}
