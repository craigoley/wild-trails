/**
 * The Field Journal — the player's persistent cross-session store, and the
 * OleyArcade fleet's first real localStorage collection. Static, client-side: no
 * backend, no accounts, no network. It lives at the boundary (main), NOT in the
 * per-run GameState.
 *
 * SAFETY (load-bearing — and now the first time the fleet MIGRATES real data):
 *  - Every localStorage access is wrapped in try/catch. A failed read/write is a
 *    no-op that degrades to an in-memory store — it NEVER escapes as an exception
 *    (Safari Private Mode throws on setItem).
 *  - Corrupt / unparseable JSON falls back to a fresh store.
 *  - The schema is VERSIONED; load routes through `migrate`, which UPGRADES old
 *    stores step by step (v1 -> v2 here) rather than resetting them. A v1 player
 *    keeps every caught species and gains empty progression state.
 *
 * SCHEMA v2: species dex (unchanged from v1) + missions progress + rank points +
 * mission-granted biome unlocks. Only CAUGHT species get a species entry
 * (absence === not found). Catch METHOD is still not persisted.
 */

import type { BiomeId, SpeciesId } from '../utils/constants';

const STORAGE_KEY = 'wild-trails:journal';

/** Current persisted schema version. Bump + add a `migrate` step when the shape
 *  changes incompatibly, so old stores upgrade rather than reset. */
export const JOURNAL_SCHEMA_VERSION = 2;

/** Per-species dex record. An entry exists IFF the species has been caught. */
export interface SpeciesRecord {
  /** Always true (an entry only exists once caught) — explicit for the schema. */
  caught: true;
  /** How many times this species has been caught. */
  catchCount: number;
  /** When it was FIRST caught (epoch ms). Never changes after the first catch. */
  firstCaughtAt: number;
}

/** Per-mission progress. An entry appears the first time a mission progresses. */
export interface MissionProgress {
  /** Catches counted toward the requirement so far. */
  progress: number;
  /** Requirement met — reward already fired (so it never fires twice). */
  completed: boolean;
}

export interface Journal {
  /** Persisted schema version. */
  schemaVersion: number;
  /** Per-species dex, keyed by species id. Only caught species appear. */
  species: Record<string, SpeciesRecord>;
  /** Per-mission progress, keyed by mission id. */
  missions: Record<string, MissionProgress>;
  /** Field-Researcher rank points earned (from missions). */
  rankPoints: number;
  /** Biome ids unlocked via missions (beyond the always-open Meadow). */
  unlockedBiomes: string[];
}

/** A fresh, empty journal (nothing found, no progression). */
export function createJournal(): Journal {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    species: {},
    missions: {},
    rankPoints: 0,
    unlockedBiomes: [],
  };
}

// ---------------------------------------------------------------------------
// Pure species record + query API (no DOM — fully Node-testable)
// ---------------------------------------------------------------------------

/**
 * Record a successful catch. The FIRST catch of a species creates its entry
 * (catchCount = 1, firstCaughtAt = now); subsequent catches increment catchCount
 * and LEAVE firstCaughtAt unchanged (re-stamping the date is the classic bug).
 * `nowMs` is passed in so the pure layer never reads the clock.
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

/** Is a biome unlocked in the persistent store (a mission granted it)? World
 *  applies these at boot; missions add to them mid-session. */
export function isBiomeUnlockedInJournal(journal: Journal, id: BiomeId): boolean {
  return journal.unlockedBiomes.includes(id);
}

// ---------------------------------------------------------------------------
// Migration + (de)serialization
// ---------------------------------------------------------------------------

function isSpeciesRecord(v: unknown): v is SpeciesRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.caught === true && typeof r.catchCount === 'number' && typeof r.firstCaughtAt === 'number';
}

function isMissionProgress(v: unknown): v is MissionProgress {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.progress === 'number' && typeof r.completed === 'boolean';
}

function sanitizeSpecies(raw: unknown): Record<string, SpeciesRecord> {
  const out: Record<string, SpeciesRecord> = {};
  if (typeof raw === 'object' && raw !== null) {
    for (const [id, rec] of Object.entries(raw as Record<string, unknown>)) {
      if (isSpeciesRecord(rec)) out[id] = rec;
    }
  }
  return out;
}

function sanitizeMissions(raw: unknown): Record<string, MissionProgress> {
  const out: Record<string, MissionProgress> = {};
  if (typeof raw === 'object' && raw !== null) {
    for (const [id, rec] of Object.entries(raw as Record<string, unknown>)) {
      if (isMissionProgress(rec)) out[id] = rec;
    }
  }
  return out;
}

function sanitizeUnlocked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/**
 * Upgrade a v1 store to v2: keep ALL caught species, add empty mission/rank/
 * unlock state. This is the load-bearing step — a v1 player must lose nothing.
 */
function up_1to2(v1: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 2,
    species: v1.species ?? {},
    missions: {},
    rankPoints: 0,
    unlockedBiomes: [],
  };
}

/**
 * The migration HOOK: turn an arbitrary parsed payload into a valid current-
 * schema Journal. Old versions upgrade STEP BY STEP (v1 -> v2) BEFORE the version
 * reject, so existing data is preserved; anything still off-version (or garbage)
 * resets to a fresh store. Never throws.
 */
export function migrate(parsed: unknown): Journal {
  if (typeof parsed !== 'object' || parsed === null) return createJournal();
  let obj = parsed as Record<string, unknown>;

  // Upgrade chain — each step bumps the version and fills new fields.
  if (obj.schemaVersion === 1) obj = up_1to2(obj);
  // (future: if (obj.schemaVersion === 2) obj = up_2to3(obj); ...)

  if (obj.schemaVersion !== JOURNAL_SCHEMA_VERSION) return createJournal();

  const rankPoints =
    typeof obj.rankPoints === 'number' && obj.rankPoints >= 0 ? obj.rankPoints : 0;
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    species: sanitizeSpecies(obj.species),
    missions: sanitizeMissions(obj.missions),
    rankPoints,
    unlockedBiomes: sanitizeUnlocked(obj.unlockedBiomes),
  };
}

/**
 * Load the journal from localStorage, degrading SAFELY to a fresh store on ANY
 * failure (private mode, quota, corrupt JSON, off-version). Never throws.
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

// Re-exported so the mission engine can type catch events without re-importing.
export type { BiomeId, SpeciesId };
