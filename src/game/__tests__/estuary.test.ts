import { describe, expect, it } from 'vitest';
import {
  createWorld,
  unlockBiome,
  clampToUnlocked,
  currentBiome,
  isInsideBiome,
  isOpenBiome,
} from '../World';
import { effectiveCap, seasonalAbundance, pickSpecies, trySpawn } from '../Spawn';
import { eligibleSpecies } from '../Species';
import { finalCatchChance } from '../Catch';
import { createAnimalPool, activeAnimalCount } from '../Animal';
import { createRng } from '../../utils/rng';
import {
  BIOMES,
  BIOME_ORDER,
  BIOME_SET_UNLOCK,
  SPAWN,
  SEASONAL_POP_MIN_ACTIVE,
  SPECIES,
  SPECIES_ORDER,
  RESEARCH_PROJECTS,
  type Season,
  type SpeciesId,
} from '../../utils/constants';
import { isResearchGatedUnlock } from '../Missions';
import type { Vec2 } from '../../utils/math';

/**
 * §migration — the ESTUARY migration hub: a coastal mudflat whose IDENTITY is dramatic seasonal
 * HEADCOUNT (near-bare summer, thronged winter). These pin the NOVEL part (the additive BIOME_SEASONAL_POP
 * cap-scalar — the ONE new mechanic) and the guardrails (every existing biome byte-unchanged; the D1b
 * no-exclusion spine and the catch core both held at the DRAMATIC setting; single-biome species; a proven
 * full-cell fork-node). The LOOK/FEEL (bare summer vs thronged winter; the lesson lands) is Craig's device gate.
 */

const ALL_SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const ESTUARY = SPECIES_ORDER.filter((id) => SPECIES[id as SpeciesId].biome === 'estuary');
const WINTER_VISITORS = ['bartailedgodwit', 'greyplover', 'wigeon', 'pintail', 'sanderling'] as const;
const RESIDENTS = ['shelduck', 'ringedplover'] as const;
const out: Vec2 = { x: 0, y: 0 };

describe('§migration — ⚠️ THE HEADCOUNT LEVER (the crux): effectiveCap is the absolute population axis', () => {
  it('⚠️ the DRAMATIC swing: the estuary is near-bare in summer and thronged in winter', () => {
    const summer = effectiveCap('estuary', 'summer');
    const winter = effectiveCap('estuary', 'winter');
    expect(summer).toBeLessThan(winter); // the whole point — empty summer vs thronged winter
    expect(winter).toBe(SPAWN.maxAnimals); // winter THRONGS the flat to the full pool (12)
    expect(summer).toBeLessThanOrEqual(3); // summer is lone stragglers on bare mud (~2-3)
    // The shoulder seasons sit between (a genuine curve, not a step): spring < autumn < winter.
    expect(effectiveCap('estuary', 'spring')).toBeLessThan(effectiveCap('estuary', 'autumn'));
    expect(effectiveCap('estuary', 'autumn')).toBeLessThan(winter);
  });

  it('⚠️ the never-empty FLOOR holds for EVERY biome/season (anti-lockout on the headcount axis)', () => {
    for (const biome of BIOME_ORDER) {
      for (const season of ALL_SEASONS) {
        const cap = effectiveCap(biome, season);
        expect(cap).toBeGreaterThanOrEqual(SEASONAL_POP_MIN_ACTIVE); // never an empty biome (≥ 2)
        // ⚠️ It scales the cap DOWN, NEVER up — the pool ARRAY never needs to grow (no new allocation).
        expect(cap).toBeLessThanOrEqual(SPAWN.maxAnimals);
      }
    }
    // The estuary's summer is exactly the floor (it would round below 2 without it) — the guarantee bites.
    expect(effectiveCap('estuary', 'summer')).toBe(SEASONAL_POP_MIN_ACTIVE);
  });

  it('⚠️ every OMITTED biome is byte-unchanged: its cap is EXACTLY SPAWN.maxAnimals (the `?? 1` path)', () => {
    for (const biome of BIOME_ORDER) {
      if (biome === 'estuary') continue; // only the estuary opts into the lever
      for (const season of ALL_SEASONS) {
        expect(effectiveCap(biome, season)).toBe(SPAWN.maxAnimals); // today's behaviour, untouched
      }
    }
  });

  it('⚠️ trySpawn RESPECTS the season-scaled cap (the throng never overflows the bounded pool)', () => {
    const world = createWorld();
    unlockBiome(world, 'estuary');
    const rng = createRng(2026);
    // Summer: the active count never climbs past the near-bare cap; winter lets the flat fill far higher.
    for (const season of ['summer', 'winter'] as const) {
      const pool = createAnimalPool();
      for (let i = 0; i < 600; i++) {
        trySpawn(pool, world, 'estuary', 'day', season, 120, 116, rng);
        expect(activeAnimalCount(pool)).toBeLessThanOrEqual(effectiveCap('estuary', season));
        expect(pool.length).toBe(SPAWN.maxAnimals); // ⚠️ the pool ARRAY never grows — no per-frame alloc
      }
      if (season === 'winter') expect(activeAnimalCount(pool)).toBeGreaterThan(effectiveCap('estuary', 'summer'));
    }
  });
});

describe('§migration — ⚠️ D1b NO-EXCLUSION holds at the DRAMATIC setting (every species findable every season)', () => {
  it('eligibility is season-INDEPENDENT: every estuary species is eligible in every season', () => {
    expect(ESTUARY.sort()).toEqual([...WINTER_VISITORS, ...RESIDENTS].sort()); // the net-new roster
    // eligibleSpecies takes biome + phase only (no season) — so the list is identical every season.
    const ids = eligibleSpecies('estuary', 'day').map((s) => s.id).sort();
    for (const id of ESTUARY) expect(ids).toContain(id);
  });

  it('the RESIDENTS are flat 1.0 every season (they hold the bare summer mudflat — always present)', () => {
    for (const id of RESIDENTS) {
      for (const season of ALL_SEASONS) {
        expect(seasonalAbundance(SPECIES[id], season)).toBe(1); // no seasonTag → byte 1.0
      }
    }
  });

  it('⚠️ a winter-visitor is STILL surfaceable in a 2-slot SUMMER estuary (non-zero draw via the floor)', () => {
    // Even at the dramatic low-headcount summer setting, the season-independent eligibility + the abundance
    // floor keep every migrant findable: a seeded summer run still yields the bar-tailed godwit.
    for (const id of WINTER_VISITORS) expect(seasonalAbundance(SPECIES[id], 'summer')).toBeGreaterThan(0);
    const eligible = eligibleSpecies('estuary', 'day');
    const rng = createRng(99);
    let godwitInSummer = 0;
    for (let i = 0; i < 5000; i++) {
      if (pickSpecies(eligible, 'summer', rng)!.id === 'bartailedgodwit') godwitInSummer++;
    }
    expect(godwitInSummer).toBeGreaterThan(0); // ⚠️ never season-locked, even on the bare summer flat
  });

  it('the composition swing rides the headcount swing: the godwit is commoner in winter than summer', () => {
    const eligible = eligibleSpecies('estuary', 'day');
    const draw = (season: Season): number => {
      const rng = createRng(7);
      let n = 0;
      for (let i = 0; i < 5000; i++) if (pickSpecies(eligible, season, rng)!.id === 'bartailedgodwit') n++;
      return n;
    };
    expect(draw('winter')).toBeGreaterThan(draw('summer')); // a throng OF migrants in winter
  });
});

describe('§migration — ⚠️ the CATCH CORE is untouched (a biome is data + the cap-read, never a NEW formula term)', () => {
  it('finalCatchChance has NO season / population term — the headcount lever never enters the odds', () => {
    // The catch formula takes only {dist, tool, biome, correctBait, fleeing} — NO season, NO abundance,
    // NO headcount. The estuary species are caught by the byte-unchanged formula; the dramatic seasonal
    // swing (effectiveCap) is a SPAWN-cadence read, entirely separate from the catch odds. Pinned: two
    // identical ctx calls are equal (deterministic — no hidden seasonal input could vary them).
    const ctx = { dist: 0.5, tool: 'net' as const, biome: 'estuary' as const, correctBait: false, fleeing: false };
    expect(finalCatchChance(SPECIES.shelduck, ctx)).toBe(finalCatchChance(SPECIES.shelduck, ctx));
    // The pre-existing home-biome bonus (biomeMatch) applies to the estuary EXACTLY like every biome — a
    // home catch beats an away catch (proof the formula is unchanged + un-special-cased, not that biome is absent).
    const home = finalCatchChance(SPECIES.shelduck, ctx);
    const away = finalCatchChance(SPECIES.shelduck, { ...ctx, biome: 'meadow' });
    expect(home).toBeGreaterThan(away);
  });
});

describe('§migration — the BIOME + topology (a proven full-cell fork-node east of tidal, zero clamp change)', () => {
  it('a tier-7 cell east of the Tidal, prereq tidal, single-successor (the proven node, not the ribbon)', () => {
    expect(BIOMES.estuary.tier).toBe(7); // past the tier-6 Tidal
    expect(BIOMES.estuary.prereq).toBe('tidal');
    expect(BIOMES.estuary.bounds).toEqual({ minX: 100, minY: 100, maxX: 140, maxY: 140 }); // a full square cell
    expect(BIOMES.estuary.adjacent).toEqual(['tidal']);
  });

  it('the unlock tree: tidal→estuary (tidal no longer terminal); estuary is terminal (no cycle)', () => {
    expect(BIOME_SET_UNLOCK.tidal).toEqual(['estuary']); // the Tidal's first arm
    expect(BIOME_SET_UNLOCK.estuary).toBeUndefined(); // terminal — unlocks nothing
    // Each new biome appears exactly once as a successor (a tree, not a graph).
    const successors = BIOME_ORDER.flatMap((b) => [...(BIOME_SET_UNLOCK[b] ?? [])]);
    expect(successors.filter((s) => s === 'estuary')).toHaveLength(1);
    // Research-gated like every sibling outer biome — its project owns the unlock.
    expect(isResearchGatedUnlock('estuary')).toBe(true);
    expect(RESEARCH_PROJECTS['unlock-the-estuary'].reward).toEqual({ kind: 'biome-access', biome: 'estuary' });
  });

  it('⚠️ ZERO clamp change: the full-cell node traverses + contains correctly (the full-edge assumption holds)', () => {
    const w = createWorld();
    unlockBiome(w, 'tidal'); // unlock BOTH sides so the shared seam is open (traversal across it)
    unlockBiome(w, 'estuary');
    expect(currentBiome(w, 120, 120)).toBe('estuary'); // resolves inside the cell
    // A point INSIDE is unclamped (reachable); the tidal|estuary seam is open (traversal works).
    clampToUnlocked(w, 120, 120, 0.3, out);
    expect([out.x, out.y]).toEqual([120, 120]);
    clampToUnlocked(w, 100, 120, 0.3, out); // the shared (x=100) tidal|estuary edge — interior of the union
    expect(out.x).toBeCloseTo(100);
    // NO over-permit: a point east of the estuary (x>140, the open void) is clamped back onto the cell.
    clampToUnlocked(w, 150, 120, 0.3, out);
    expect(out.x).toBeLessThanOrEqual(140 - 0.3 + 1e-9);
    expect(isInsideBiome(w, 'estuary', 120, 120)).toBe(true);
  });

  it('the open mudflat is an OPEN biome (few/no hides → the throwing-net condition, like the coast)', () => {
    expect(isOpenBiome('estuary')).toBe(true);
  });
});

describe('§migration — the NET-NEW species (single-biome, proven baits; dramatic migrants vs residents)', () => {
  it('every estuary species is SINGLE-biome and uses a proven bait (no new diet, no multi-biome)', () => {
    expect(ESTUARY).toHaveLength(7);
    for (const id of ESTUARY) {
      expect(SPECIES[id as SpeciesId].biome).toBe('estuary');
      expect(['seeds', 'greens', 'insects', 'fish', 'shellfish']).toContain(SPECIES[id as SpeciesId].bait);
    }
  });

  it('⚠️ the existing waders are NOT reused (knot/dunlin/redshank stay TIDAL — the one-biome model)', () => {
    for (const id of ['knot', 'dunlin', 'redshank'] as const) expect(SPECIES[id].biome).toBe('tidal');
    expect(SPECIES.curlew.biome).toBe('moor');
    expect(SPECIES.brentgoose.biome).toBe('coast');
  });

  it('the dramatic migrants are winter-visitors; the residents are flat (the empty/thronged split)', () => {
    for (const id of WINTER_VISITORS) expect(SPECIES[id].seasonTag).toBe('winter-visitor');
    for (const id of RESIDENTS) expect(SPECIES[id].seasonTag).toBeUndefined();
  });

  it('⚠️ anti-lockout: the easiest estuary catch is a RESIDENT (the shelduck), catchable BAIT-LESS', () => {
    const rates = ESTUARY.map((id) => SPECIES[id as SpeciesId].baseCatchRate);
    expect(Math.max(...rates)).toBe(SPECIES.shelduck.baseCatchRate); // the resident valve tops the roster
    expect(RESIDENTS).toContain('shelduck');
    const chance = finalCatchChance(SPECIES.shelduck, { dist: 0.5, tool: 'net', biome: 'estuary', correctBait: false, fleeing: false });
    expect(chance).toBeGreaterThan(0.4); // a bare, in-biome, point-blank shelduck has real odds (present all summer)
  });
});
