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
 *    stores step by step (v1 -> v2 -> v3 -> v4 -> v5) rather than resetting them.
 *    An old player keeps every caught species and gains new fields at safe defaults.
 *
 * SCHEMA v6: species dex + missions progress + rank points + mission-granted
 * biome unlocks + durable bait counts + `won` flag + `credits` balance (§12) +
 * owned/active catch nets (Nets & Gear slice A). Only CAUGHT species get a species
 * entry (absence === not found).
 */

import { BAIT, BAIT_ORDER, STARTER_TOOL, TOOL_ORDER, TOOLS, type BaitId, type BiomeId, type ToolId } from '../utils/constants';

const STORAGE_KEY = 'wild-trails:journal';

/** Current persisted schema version. Bump + add a `migrate` step when the shape
 *  changes incompatibly, so old stores upgrade rather than reset. */
export const JOURNAL_SCHEMA_VERSION = 6;

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
  /** Durable bait counts per type — the one bit of session state persisted (v3).
   *  The active deployment / selection / timer are transient (recomputed fresh). */
  bait: Record<BaitId, number>;
  /** Has the "Field Guide Complete" win been celebrated (v4)? Set once when the
   *  win condition is first met, so the celebration fires ONCE; play continues
   *  freely afterward and this persists (no reset post-win, §14). */
  won: boolean;
  /** Spendable economy currency (v5, §12) — earned from catches + research
   *  milestones. SEPARATE from rankPoints (rank = knowledge/progression; credits =
   *  the spendable economy). Never negative. Nothing to spend on until §12 slice 1b. */
  credits: number;
  /** Durable catch nets the player OWNS (v6, Nets & Gear slice A). The starter Hand
   *  Net is always owned; biome nets are bought in the shop (a later slice). */
  ownedTools: ToolId[];
  /** The equipped net — must always be one of `ownedTools` (sanitized on load). */
  activeTool: ToolId;
}

/** Full-bait counts (the fresh-game / safe-default value), startingCount per type. */
function defaultBait(): Record<BaitId, number> {
  const counts = {} as Record<BaitId, number>;
  for (const id of BAIT_ORDER) counts[id] = BAIT.startingCount;
  return counts;
}

/** A fresh, empty journal (nothing found, no progression, full bait). */
export function createJournal(): Journal {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    species: {},
    missions: {},
    rankPoints: 0,
    unlockedBiomes: [],
    bait: defaultBait(),
    won: false,
    credits: 0,
    ownedTools: [STARTER_TOOL],
    activeTool: STARTER_TOOL,
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

/** Sync live bait counts into the journal for persistence (sanitized to the cap).
 *  Called by autosave before a write so the durable counts are current. */
export function setBaitCounts(journal: Journal, counts: Record<BaitId, number>): void {
  journal.bait = sanitizeBait(counts);
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
 * Per-type bait counts, sanitized: a missing key / negative / non-finite value
 * falls back to startingCount (a v2 upgrade or a corrupt count is never punished);
 * valid counts are clamped to [0, maxCount] (no hoarding past the cap via a hand-
 * edited store). Always returns a full set for every BAIT_ORDER type.
 */
function sanitizeBait(raw: unknown): Record<BaitId, number> {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = {} as Record<BaitId, number>;
  for (const id of BAIT_ORDER) {
    const v = obj[id];
    out[id] = typeof v === 'number' && Number.isFinite(v) && v >= 0
      ? Math.min(v, BAIT.maxCount)
      : BAIT.startingCount;
  }
  return out;
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
 * Upgrade a v2 store to v3: keep species/missions/rank/unlocks verbatim, add
 * DURABLE bait at the safe default (full counts) — a returning v2 player isn't
 * punished for the upgrade. Spreads the rest so nothing is dropped.
 */
function up_2to3(v2: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v2,
    schemaVersion: 3,
    bait: defaultBait(),
  };
}

/** Upgrade a v3 store to v4: keep everything, add the win flag at `false` (an
 *  existing player hasn't been shown the completion celebration — it fires when
 *  they next meet the condition, exactly once). */
function up_3to4(v3: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v3,
    schemaVersion: 4,
    won: false,
  };
}

/** Upgrade a v4 store to v5 (§12): keep everything, add the credits balance at 0
 *  (an existing player starts the economy with nothing — earned through play). */
function up_4to5(v4: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v4,
    schemaVersion: 5,
    credits: 0,
  };
}

/** Upgrade a v5 store to v6 (Nets & Gear slice A): keep everything, grant exactly the
 *  starter Hand Net (owned + equipped) — a returning player loses nothing and starts
 *  with precisely today's single net. */
function up_5to6(v5: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v5,
    schemaVersion: 6,
    ownedTools: [STARTER_TOOL],
    activeTool: STARTER_TOOL,
  };
}

/** Sanitize the persisted net inventory: drop unknown ids, ALWAYS own the starter,
 *  return owned in canonical order, and clamp the active net to an owned one. */
function sanitizeTools(ownedRaw: unknown, activeRaw: unknown): { ownedTools: ToolId[]; activeTool: ToolId } {
  const owned = new Set<ToolId>([STARTER_TOOL]); // the starter is always owned
  if (Array.isArray(ownedRaw)) {
    for (const id of ownedRaw) if (typeof id === 'string' && id in TOOLS) owned.add(id as ToolId);
  }
  const ownedTools = TOOL_ORDER.filter((id) => owned.has(id));
  const activeTool: ToolId =
    typeof activeRaw === 'string' && owned.has(activeRaw as ToolId) ? (activeRaw as ToolId) : STARTER_TOOL;
  return { ownedTools, activeTool };
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

  // Upgrade chain — each step bumps the version and fills new fields, so an old
  // store flows all the way up (v1 -> v2 -> v3 -> v4 -> v5).
  if (obj.schemaVersion === 1) obj = up_1to2(obj);
  if (obj.schemaVersion === 2) obj = up_2to3(obj);
  if (obj.schemaVersion === 3) obj = up_3to4(obj);
  if (obj.schemaVersion === 4) obj = up_4to5(obj);
  if (obj.schemaVersion === 5) obj = up_5to6(obj);

  if (obj.schemaVersion !== JOURNAL_SCHEMA_VERSION) return createJournal();

  const rankPoints =
    typeof obj.rankPoints === 'number' && obj.rankPoints >= 0 ? obj.rankPoints : 0;
  const credits = typeof obj.credits === 'number' && obj.credits >= 0 ? Math.floor(obj.credits) : 0;
  const { ownedTools, activeTool } = sanitizeTools(obj.ownedTools, obj.activeTool);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    species: sanitizeSpecies(obj.species),
    missions: sanitizeMissions(obj.missions),
    rankPoints,
    unlockedBiomes: sanitizeUnlocked(obj.unlockedBiomes),
    bait: sanitizeBait(obj.bait),
    won: obj.won === true,
    credits,
    ownedTools,
    activeTool,
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

/**
 * A dedup-guarded autosaver: writes only when the journal actually CHANGED since
 * the last write, so rapid autosave triggers (bait deploys, tab blur right after a
 * catch) don't thrash localStorage. Returns whether a write happened. The save fn
 * is injected so the dedup is unit-testable without a real store.
 */
export function createAutosaver(save: (j: Journal) => void = saveJournal): (j: Journal) => boolean {
  let lastSnapshot = '';
  return (journal: Journal): boolean => {
    const snapshot = JSON.stringify(journal);
    if (snapshot === lastSnapshot) return false; // unchanged — skip the write
    lastSnapshot = snapshot;
    save(journal);
    return true;
  };
}
