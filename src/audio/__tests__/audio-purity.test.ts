import { describe, expect, it } from 'vitest';

/**
 * ⚠️ The pure-core guard (Atmosphere A1): audio is a RENDER-SIDE concern. src/game/ +
 * src/state/ must import NO Web Audio — the deterministic sim + the L1 harness depend on that
 * purity (and on Node-testability — there is no AudioContext in Node). This scans the source
 * (via Vite's import.meta.glob, no node types needed) so an accidental `new AudioContext()` /
 * Web-Audio call in the core fails CI permanently.
 */

// Eagerly load every core source file as raw text. The __tests__ dirs are excluded by the
// glob pattern (only direct + nested non-test .ts) — tests may MOCK Web Audio; we guard the
// shipping code. (Vite resolves these at build time relative to this file.)
const coreFiles = {
  ...import.meta.glob('../../game/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../state/**/*.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const audioFiles = import.meta.glob('../../audio/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const WEB_AUDIO = /\bAudioContext\b|webkitAudioContext|createGain|createOscillator|createBufferSource|createBiquadFilter|\.destination\b/;

describe('purity — the pure core imports no Web Audio (A1)', () => {
  it('src/game/ + src/state/ reference no Web Audio API (audio is render-side only)', () => {
    const offenders = Object.entries(coreFiles)
      .filter(([path]) => !path.includes('__tests__'))
      .filter(([, src]) => WEB_AUDIO.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('the audio subsystem DOES use Web Audio (in src/audio/ — the guard is meaningful)', () => {
    const usesWebAudio = Object.entries(audioFiles)
      .filter(([path]) => !path.includes('__tests__'))
      .some(([, src]) => WEB_AUDIO.test(src));
    expect(usesWebAudio).toBe(true);
  });
});
