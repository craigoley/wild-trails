import { describe, expect, it } from 'vitest';
import {
  STARTER_TOOL,
  toolMultiplier,
  isToolId,
  ownsTool,
  grantTool,
  equipTool,
  ownedToolsInOrder,
} from '../Tools';
import { createJournal } from '../../state/Journal';
import { CATCH } from '../../utils/constants';

describe('Nets — the lateral baseline (trap/tranq flat multipliers retired)', () => {
  it('the only net is the starter Hand Net, at the neutral 1.0 catch factor', () => {
    expect(STARTER_TOOL).toBe('net');
    expect(toolMultiplier('net')).toBe(1.0); // no flat catch-rate advantage exists
  });

  it('slice A changes NO catching: reach (attemptRadius) stays 2.6, the net is the 1.0 identity', () => {
    expect(CATCH.attemptRadius).toBe(2.6); // reach unchanged — proximityMultiplier/attemptRadius untouched
    expect(toolMultiplier(STARTER_TOOL)).toBe(1.0); // the starter adds nothing — today's catching exactly
  });

  it('isToolId guards unknown/retired ids (trap/tranq are gone)', () => {
    expect(isToolId('net')).toBe(true);
    expect(isToolId('trap')).toBe(false); // retired
    expect(isToolId('tranq')).toBe(false); // retired
    expect(isToolId(42)).toBe(false);
  });
});

describe('Nets — the durable owned/active inventory (slice A)', () => {
  it('a fresh journal owns + equips exactly the starter net', () => {
    const j = createJournal();
    expect(j.ownedTools).toEqual(['net']);
    expect(j.activeTool).toBe('net');
    expect(ownsTool(j, 'net')).toBe(true);
    expect(ownedToolsInOrder(j)).toEqual(['net']);
  });

  it('grantTool is idempotent (re-granting an owned net is a no-op)', () => {
    const j = createJournal();
    expect(grantTool(j, 'net')).toBe(false); // already owned
    expect(j.ownedTools).toEqual(['net']);
  });

  it('equipTool only equips an OWNED net', () => {
    const j = createJournal();
    expect(equipTool(j, 'net')).toBe(true);
    expect(j.activeTool).toBe('net');
  });
});
