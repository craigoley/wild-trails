import { describe, expect, it } from 'vitest';
import { STARTER_TOOL, availableTools, isToolUnlocked, toolMultiplier } from '../Tools';

describe('Tools — tiers and gating', () => {
  it('multipliers ascend NET < TRAP < TRANQ', () => {
    expect(toolMultiplier('net')).toBeLessThan(toolMultiplier('trap'));
    expect(toolMultiplier('trap')).toBeLessThan(toolMultiplier('tranq'));
  });

  it('NET is the 1.0x baseline', () => {
    expect(toolMultiplier('net')).toBe(1.0);
  });

  it('only NET is unlocked to start; the player begins with NET', () => {
    expect(isToolUnlocked('net')).toBe(true);
    expect(isToolUnlocked('trap')).toBe(false);
    expect(isToolUnlocked('tranq')).toBe(false);
    expect(availableTools()).toEqual(['net']);
    expect(STARTER_TOOL).toBe('net');
  });
});
