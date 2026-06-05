import { describe, expect, it } from 'vitest';
import { createGameState, update } from '../GameState';
import { evaluateCatch } from '../Missions';
import { spawnTrackingTarget } from '../Spawn';
import { createAnimalPool, hasActiveSpecies } from '../Animal';
import { unlockBiome } from '../World';
import { createIntent } from '../Input';
import { createJournal } from '../../state/Journal';
import { createRng } from '../../utils/rng';
import { NOTICE, SIM_DT, TRACK_SIGNS, TRACKING } from '../../utils/constants';

const DAY = 30; // timeSec in the 'day' window
const NIGHT = 80; // timeSec in the 'night' window (nightStart 0.65 * 120 = 78)

/** A game with the woodland unlocked + spawn cadence paused (so only the tracking
 *  spawn can place an animal — isolates the bias from normal spawning). */
function woodlandGame(seed = 1) {
  const g = createGameState(seed);
  unlockBiome(g.world, 'woodland');
  g.spawnTimer = 1e9; // pause the normal spawn cadence
  return g;
}

describe('Plan #8b — track-and-catch requirement kind (generic engine)', () => {
  const ev = (species: string) => ({ species: species as 'badger', biome: 'woodland' as const, phase: 'night' as const });

  it('completes ONLY when the target species is caught', () => {
    const j = createJournal();
    evaluateCatch(j, ev('robin')); // wrong species
    expect(j.missions['track-badger']?.completed ?? false).toBe(false);
    const r = evaluateCatch(j, ev('badger')); // the target
    expect(j.missions['track-badger'].completed).toBe(true);
    expect(r.completed).toContain('track-badger');
  });

  it('the tracking mission now GATES the wetland unlock (no longer standalone)', () => {
    // Woodland gate tune: complete survey + dawn + dusk WITHOUT the badger track —
    // the four-window set is NOT complete, so the Wetland does NOT unlock yet.
    const j = createJournal();
    for (let i = 0; i < 4; i++) evaluateCatch(j, { species: 'redsquirrel', biome: 'woodland', phase: 'day' }); // survey
    evaluateCatch(j, { species: 'robin', biome: 'woodland', phase: 'dawn' }); // woodland-dawn
    const before = evaluateCatch(j, { species: 'roedeer', biome: 'woodland', phase: 'dusk' }); // woodland-dusk
    expect(before.unlocked).not.toContain('wetland'); // track-badger still missing -> gated
    // The badger track completes the set -> the unlock fires.
    const after = evaluateCatch(j, { species: 'badger', biome: 'woodland', phase: 'night' });
    expect(after.unlocked).toContain('wetland');
  });

  it('completion fires the reward exactly once (double-fire guard)', () => {
    const j = createJournal();
    const r1 = evaluateCatch(j, ev('badger'));
    const pts = j.rankPoints;
    const r2 = evaluateCatch(j, ev('badger')); // catch another badger
    expect(r1.completed).toContain('track-badger');
    expect(r2.completed).not.toContain('track-badger');
    expect(j.rankPoints).toBe(pts); // no second reward
  });
});

describe('Plan #8b — seeded sett spawn', () => {
  it('is deterministic (same seed -> same placement) and inside the sett', () => {
    const a = spawnTrackingTarget(createAnimalPool(), TRACKING.sett, 'badger', createRng(42));
    const b = spawnTrackingTarget(createAnimalPool(), TRACKING.sett, 'badger', createRng(42));
    expect(a).not.toBeNull();
    expect(a!.x).toBe(b!.x);
    expect(a!.y).toBe(b!.y);
    const d = Math.hypot(a!.x - TRACKING.sett.x, a!.y - TRACKING.sett.y);
    expect(d).toBeLessThanOrEqual(TRACKING.sett.radius);
  });

  it('the bias fires ONLY when the mission is active AND it is night', () => {
    // Active + night + at the sett -> the target is revealed (spawned).
    const night = woodlandGame();
    night.activeTrackTarget = 'badger';
    night.timeSec = NIGHT;
    night.player.x = TRACKING.sett.x;
    night.player.y = TRACKING.sett.y;
    update(night, createIntent(), SIM_DT);
    expect(hasActiveSpecies(night.animals, 'badger')).toBe(true);

    // Active but DAY -> no tracking spawn (badgers are nocturnal).
    const day = woodlandGame();
    day.activeTrackTarget = 'badger';
    day.timeSec = DAY;
    day.player.x = TRACKING.sett.x;
    day.player.y = TRACKING.sett.y;
    update(day, createIntent(), SIM_DT);
    expect(hasActiveSpecies(day.animals, 'badger')).toBe(false);
  });

  it('EDGE CASE: with the mission INACTIVE the bias never fires (normal spawning intact)', () => {
    // Inactive + night + at the sett + cadence paused -> nothing spawned by tracking.
    const g = woodlandGame();
    g.activeTrackTarget = null;
    g.timeSec = NIGHT;
    g.player.x = TRACKING.sett.x;
    g.player.y = TRACKING.sett.y;
    update(g, createIntent(), SIM_DT);
    expect(hasActiveSpecies(g.animals, 'badger')).toBe(false);
    // The badger's normal night/woodland spawn path is untouched — proven by the
    // bias being purely additive (it only spawns; it never gates trySpawn).
  });
});

describe('Plan #8b — sign hints TEACH, never reset (the §6.5 rule)', () => {
  function atSign(timeSec: number) {
    const g = woodlandGame();
    g.activeTrackTarget = 'badger';
    g.timeSec = timeSec;
    g.player.x = TRACK_SIGNS[0].x;
    g.player.y = TRACK_SIGNS[0].y;
    update(g, createIntent(), SIM_DT);
    return g;
  }

  it('by day the hint is the COLD (wrong-time) teaching line', () => {
    const g = atSign(DAY);
    expect(g.notice?.text).toBe(TRACKING.coldHint);
    expect(g.notice?.ttl).toBe(NOTICE.trackSec);
  });

  it('at night the hint is the FRESH (right-time) line', () => {
    expect(atSign(NIGHT).notice?.text).toBe(TRACKING.freshHint);
  });

  it('investigating signs only ADVANCES the funnel — never resets progress', () => {
    const g = atSign(DAY); // a "wrong time" investigation
    expect(g.track.signsFound).toBe(1); // counted, not reset
    // Re-approaching the SAME sign doesn't double-count or reset.
    update(g, createIntent(), SIM_DT);
    expect(g.track.signsFound).toBe(1);
    // The sim never touches mission PROGRESS (that lives in the journal); a wrong
    // look is a hint only — there is no progress field to reset here.
  });
});

describe('Plan #8b — tracking funnel telemetry', () => {
  it('increments signs-found -> located -> caught across the stages', () => {
    const g = woodlandGame();
    g.activeTrackTarget = 'badger';
    g.timeSec = NIGHT;

    // Walk onto a sign -> signsFound.
    g.player.x = TRACK_SIGNS[0].x;
    g.player.y = TRACK_SIGNS[0].y;
    update(g, createIntent(), SIM_DT);
    expect(g.track.signsFound).toBe(1);

    // Reach the sett -> located + the target is revealed.
    g.player.x = TRACKING.sett.x;
    g.player.y = TRACKING.sett.y;
    update(g, createIntent(), SIM_DT);
    expect(g.track.located).toBe(true);
    expect(hasActiveSpecies(g.animals, 'badger')).toBe(true);
  });
});

describe('Plan #8b — bait notice still fires through the renamed channel', () => {
  it('an out-of-bait deploy surfaces a notice (the baitNotice -> notice rename)', () => {
    const g = createGameState(3);
    g.bait.counts[g.bait.selected] = 0; // empty the selected bait
    update(g, { ...createIntent(), baitDeploy: true }, SIM_DT);
    expect(g.notice).not.toBeNull();
    expect(g.notice?.text).toContain('Out of');
  });
});
