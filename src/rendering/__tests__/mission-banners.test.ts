import { describe, expect, it } from 'vitest';
import { missionBannerMessages } from '../missionBanners';
import type { MissionEval } from '../../game/Missions';
import { MISSIONS, BIOMES } from '../../utils/constants';

const evalResult = (over: Partial<MissionEval>): MissionEval => ({
  progressed: [],
  completed: [],
  unlocked: [],
  pointsAwarded: 0,
  ...over,
});

describe('missionBannerMessages — completion + unlock fire player-facing notices', () => {
  it('a completed mission yields a mission banner naming it + the reward', () => {
    const msgs = missionBannerMessages(evalResult({ completed: ['meadow-survey'] }));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].kind).toBe('mission');
    expect(msgs[0].text).toContain(MISSIONS['meadow-survey'].title); // "Meadow Survey"
    expect(msgs[0].text).toContain(`+${MISSIONS['meadow-survey'].rewardPoints} pts`);
  });

  it('a biome unlock yields a distinct unlock banner naming the area', () => {
    const msgs = missionBannerMessages(evalResult({ unlocked: ['woodland'] }));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].kind).toBe('unlock');
    expect(msgs[0].text).toContain(BIOMES.woodland.displayName); // "Woodland"
  });

  it('completion + unlock in one event: both fire, unlock LAST (the payoff lingers)', () => {
    const msgs = missionBannerMessages(
      evalResult({ completed: ['meadow-dusk'], unlocked: ['woodland'] }),
    );
    expect(msgs.map((m) => m.kind)).toEqual(['mission', 'unlock']);
  });

  it('a catch that completes nothing produces NO banner (no per-catch spam)', () => {
    expect(missionBannerMessages(evalResult({ progressed: ['meadow-survey'] }))).toEqual([]);
  });
});
