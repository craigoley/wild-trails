import { describe, expect, it } from 'vitest';
import {
  startResearch,
  evaluateResearch,
  researchState,
  researchProjectForTool,
} from '../Research';
import { ownsTool, grantTool } from '../Tools';
import { addCredits } from '../Economy';
import { createJournal } from '../../state/Journal';
import { RESEARCH_PROJECTS } from '../../utils/constants';

/**
 * R1 — the biome nets (dip-net + throwing-net) are earned through RESEARCH (study the
 * habitat -> grantTool the net). Research is the SINGLE acquisition path (the #57 shop-buy
 * retired). These pin BOTH nets independently + the single-path + anti-lockout + the
 * transition. The reward DISPATCH (grantTool) lives at main's boundary; here we assert the
 * engine yields the grant-tool reward, then apply it via the same grantTool seam.
 */
const inBiome = (biome: string) => ({ species: 'frog', biome, phase: 'day' }) as Parameters<typeof evaluateResearch>[1];

const completeNetProject = (id: string, biome: string) => {
  const j = createJournal();
  addCredits(j, RESEARCH_PROJECTS[id].cost);
  startResearch(j, id);
  let reward = null;
  for (let i = 0; i < RESEARCH_PROJECTS[id].activityRequirement.count; i++) {
    const r = evaluateResearch(j, inBiome(biome));
    if (r.rewards.length) reward = r.rewards[0];
  }
  return { j, reward };
};

describe('R1 — EACH net is earned by its own research project (pinned independently)', () => {
  it('study-the-wetland completes by wetland catches and yields the dip-net grant', () => {
    const { j, reward } = completeNetProject('study-the-wetland', 'wetland');
    expect(researchState(j, 'study-the-wetland').completed).toBe(true);
    expect(reward).toEqual({ kind: 'grant-tool', toolId: 'dip-net' });
    grantTool(j, 'dip-net'); // as main's applyResearchReward does
    expect(ownsTool(j, 'dip-net')).toBe(true);
  });

  it('study-the-uplands completes by highlands catches and yields the throwing-net grant', () => {
    const { j, reward } = completeNetProject('study-the-uplands', 'highlands');
    expect(researchState(j, 'study-the-uplands').completed).toBe(true);
    expect(reward).toEqual({ kind: 'grant-tool', toolId: 'throwing-net' });
    grantTool(j, 'throwing-net');
    expect(ownsTool(j, 'throwing-net')).toBe(true);
  });

  it('the 2 net projects are catch-in-biome ×4 with a grant-tool reward (naturalist, small, reachable)', () => {
    for (const [id, toolId, biome] of [
      ['study-the-wetland', 'dip-net', 'wetland'],
      ['study-the-uplands', 'throwing-net', 'highlands'],
    ] as const) {
      const p = RESEARCH_PROJECTS[id];
      expect(p.activityRequirement).toEqual({ kind: 'catch-in-biome', biome, count: 4 });
      expect(p.reward).toEqual({ kind: 'grant-tool', toolId });
    }
  });
});

describe('R1 — ⚠️ the single coherent acquisition path', () => {
  it('researchProjectForTool maps each biome net to its project (the shop hint source); the starter has none', () => {
    expect(researchProjectForTool('dip-net')?.id).toBe('study-the-wetland');
    expect(researchProjectForTool('throwing-net')?.id).toBe('study-the-uplands');
    expect(researchProjectForTool('net')).toBeNull(); // the starter isn't research-gated
  });

  it('buyNet/netBuyState are gone — there is no free shop-buy path (research is the only way)', async () => {
    const economy = (await import('../Economy')) as Record<string, unknown>;
    expect(economy.buyNet).toBeUndefined();
    expect(economy.netBuyState).toBeUndefined();
  });
});

describe('R1 — ⚠️ anti-lockout / laterality unchanged (research gates ACCESS, not necessity)', () => {
  it('the net research activity is catch-only (any net) — the STARTER earns the net (no net needed to earn a net)', () => {
    // catch-in-biome reads {species, biome, phase}, never the tool — so the starter Hand
    // Net completes it. Research gating a net never requires already owning a net.
    const { j } = completeNetProject('study-the-wetland', 'wetland');
    expect(researchState(j, 'study-the-wetland').completed).toBe(true);
    expect(j.activeTool).toBe('net'); // never had to switch off the starter to earn it
  });
});

describe('R1 — the transition (existing saves stay coherent)', () => {
  it('a pre-R1 save where a net was already owned keeps it; completing its research re-grants (idempotent no-op)', () => {
    const j = createJournal();
    grantTool(j, 'dip-net'); // a pre-R1 shop-bought save: the net is already owned
    expect(ownsTool(j, 'dip-net')).toBe(true);

    addCredits(j, RESEARCH_PROJECTS['study-the-wetland'].cost);
    startResearch(j, 'study-the-wetland');
    for (let i = 0; i < 4; i++) evaluateResearch(j, inBiome('wetland'));
    grantTool(j, 'dip-net'); // applying the reward on an already-owned net = no-op

    expect(ownsTool(j, 'dip-net')).toBe(true); // still owned — no broken/contradictory state
  });
});
