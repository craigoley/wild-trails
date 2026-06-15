/**
 * §validation — a PURE-NODE bug-hunt over the game logic (no browser needed). Exercises the data +
 * the sim far beyond the freeze-frame L2 baselines, hunting for real defects. REPORT-ONLY: it prints
 * findings; it changes no game code. Run: `npx tsx scripts/validate-node.ts`.
 */
import { SPECIES, SPECIES_ORDER, SPECIES_DETAIL, MISSION_ORDER, ANIMAL, ETHOGRAM, SIM_DT, SPAWN } from '../src/utils/constants';
import { speciesDetailFor } from '../src/game/speciesDetail';
import { createJournal } from '../src/state/Journal';
import { createWorld } from '../src/game/World';
import { createPlayer } from '../src/game/Player';
import { createAnimalPool, spawnAnimal, updateAnimal, behaviorSpeed, type AnimalBehavior } from '../src/game/Animal';
import { finalCatchChance } from '../src/game/Catch';
import { createRng } from '../src/utils/rng';

let findings = 0;
const FLAG = (sev: 'HIGH' | 'MED' | 'LOW' | 'INFO', msg: string) => {
  if (sev !== 'INFO') findings++;
  console.log(`[${sev}] ${msg}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

console.log('\n=== A. The wary/bold split (the 4.0 detectionRadius threshold) ===');
{
  const wary = SPECIES_ORDER.filter((id) => SPECIES[id].detectionRadius >= SPECIES_DETAIL.waryThreshold);
  const bold = SPECIES_ORDER.filter((id) => SPECIES[id].detectionRadius < SPECIES_DETAIL.waryThreshold);
  const n = SPECIES_ORDER.length;
  console.log(`  threshold=${SPECIES_DETAIL.waryThreshold} → wary ${wary.length}/${n}, bold ${bold.length}/${n}`);
  const pctWary = Math.round((wary.length / n) * 100);
  if (wary.length === 0 || bold.length === 0) FLAG('HIGH', `degenerate split (all one side) — the tip never varies`);
  else if (pctWary < 15 || pctWary > 85) FLAG('MED', `lopsided split (${pctWary}% wary) — most species read the same; consider retuning the 4.0 threshold`);
  else ok(`balanced-ish split (${pctWary}% wary) — the tip meaningfully varies`);
}

console.log('\n=== B. speciesDetailFor — every mission renders complete (no undefined/NaN/empty) ===');
{
  const j = createJournal();
  for (const id of MISSION_ORDER) {
    const d = speciesDetailFor(id, j);
    if (!d) { FLAG('HIGH', `speciesDetailFor('${id}') returned null for a real mission`); continue; }
    const bad: string[] = [];
    if (!d.displayName) bad.push('displayName');
    if (!d.habitat) bad.push('habitat');
    if (!d.activity) bad.push('activity');
    if (!d.baitLabel) bad.push('baitLabel');
    if (typeof d.warinessTip !== 'string' || !d.warinessTip) bad.push('warinessTip');
    if (!Number.isFinite(d.count) || !Number.isFinite(d.progress)) bad.push('progress/count NaN');
    if (!d.why.tracked) bad.push('why.tracked');
    if (bad.length) FLAG('HIGH', `${id} → missing/bad: ${bad.join(', ')}`);
  }
  ok(`swept ${MISSION_ORDER.length} missions`);
}

console.log('\n=== C. behaviorSpeed mapping sane for all states ===');
{
  for (const b of ['rest', 'forage', 'vigilance', 'locomote'] as AnimalBehavior[]) {
    const s = behaviorSpeed(b);
    if (!Number.isFinite(s) || s < 0) FLAG('HIGH', `behaviorSpeed('${b}') = ${s}`);
  }
  ok('all four states map to a finite ≥0 speed');
}

console.log('\n=== D. D2 live-sim SOAK — many animals × many steps (NaN / bounds / stuck / catch) ===');
{
  const world = createWorld();
  // unlock everything so all biomes have animals to roam
  for (const id of Object.keys(world.biomes)) world.biomes[id].unlocked = true;
  const pool = createAnimalPool();
  const rng = createRng(12345);
  // spawn one of every species at its biome centre-ish
  const spawned: number[] = [];
  for (const id of SPECIES_ORDER) {
    const b = world.biomes[SPECIES[id].biome].def.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const a = spawnAnimal(pool, id, cx, cy);
    if (a) spawned.push(pool.indexOf(a));
  }
  console.log(`  spawned ${spawned.length} animals (pool cap ${SPAWN.maxAnimals})`);
  const player = createPlayer(0, 0);
  const STEPS = 20000; // ~5.5 min of sim at SIM_DT
  let nanSeen = 0, outOfBounds = 0, moved = 0, fleeStates = 0;
  const behaviorHits: Record<string, number> = { rest: 0, forage: 0, vigilance: 0, locomote: 0 };
  for (let step = 0; step < STEPS; step++) {
    // wander the player around the whole map so flee/approach trigger live
    player.x = 60 + 60 * Math.sin(step * 0.03);
    player.y = 60 + 60 * Math.cos(step * 0.021);
    for (const i of spawned) {
      const a = pool[i];
      if (!a.active) continue;
      const before = { x: a.x, y: a.y };
      updateAnimal(a, player, world, rng, SIM_DT);
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) nanSeen++;
      const bb = world.biomes[SPECIES[a.species].biome].def.bounds;
      const pad = 1.0;
      if (a.x < bb.minX - pad || a.x > bb.maxX + pad || a.y < bb.minY - pad || a.y > bb.maxY + pad) outOfBounds++;
      if (a.x !== before.x || a.y !== before.y) moved++;
      if (a.aiState === 'flee') fleeStates++;
      if (a.aiState === 'wander') behaviorHits[a.behavior]++;
    }
  }
  if (nanSeen) FLAG('HIGH', `${nanSeen} NaN positions during the soak`); else ok('no NaN positions across the soak');
  if (outOfBounds) FLAG('HIGH', `${outOfBounds} out-of-biome positions (clamp leak)`); else ok('every animal stayed clamped to its biome');
  if (moved === 0) FLAG('HIGH', 'no animal ever moved (stuck)'); else ok(`animals moved (${moved} move-steps)`);
  if (fleeStates === 0) FLAG('MED', 'no flee ever triggered live (the player never got close enough?)'); else ok(`flee triggered live (${fleeStates} flee-steps) → override works`);
  console.log(`  calm behavior distribution: ${JSON.stringify(behaviorHits)}`);
  const missing = Object.entries(behaviorHits).filter(([, v]) => v === 0).map(([k]) => k);
  if (missing.length) FLAG('MED', `behavior state(s) never visited: ${missing.join(', ')}`); else ok('all four ethogram states visited live');
  // the catch path still works for a behaving animal
  const sampleA = pool[spawned[0]];
  const chance = finalCatchChance(SPECIES[sampleA.species], { dist: 1, tool: 'net', biome: SPECIES[sampleA.species].biome, correctBait: false, fleeing: sampleA.aiState === 'flee' });
  if (!Number.isFinite(chance) || chance < 0 || chance > 1) FLAG('HIGH', `finalCatchChance invalid: ${chance}`); else ok(`catch path intact (sample chance ${chance.toFixed(3)})`);
}

console.log('\n=== E. Bounded constants sanity ===');
{
  if (ETHOGRAM.forageSpeed >= ANIMAL.wanderSpeed) FLAG('LOW', 'forageSpeed not < wanderSpeed');
  const budget = ETHOGRAM.defaultBudget;
  const sum = budget.rest + budget.forage + budget.vigilance + budget.locomote;
  console.log(`  defaultBudget sum=${sum.toFixed(2)} (relative weights; the picker normalizes)`);
  for (const b of ['rest', 'forage', 'vigilance', 'locomote'] as const) {
    const [lo, hi] = ETHOGRAM.dwell[b];
    if (lo <= 0 || hi < lo) FLAG('MED', `dwell.${b} range invalid [${lo},${hi}]`);
  }
  ok('ethogram constants within sane bounds');
}

console.log(`\n=== SUMMARY: ${findings} flagged finding(s) ===\n`);
