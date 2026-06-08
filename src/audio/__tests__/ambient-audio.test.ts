// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../AudioEngine';
import { AmbientAudio } from '../AmbientAudio';
import { AUDIO } from '../../utils/constants';

/**
 * A minimal Web Audio mock — jsdom has no AudioContext. The create* methods are spies so we
 * can assert the mute bus works AND that the ambient builds NO synthesis nodes (A1b: silent).
 */
class FakeParam {
  value = 0;
  setValueAtTime = vi.fn((v: number) => ((this.value = v), this));
  linearRampToValueAtTime = vi.fn((v: number) => ((this.value = v), this));
  exponentialRampToValueAtTime = vi.fn(() => this);
  cancelScheduledValues = vi.fn(() => this);
}
class FakeNode {
  connect = vi.fn((n: unknown) => n);
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeFilter extends FakeNode {
  type = '';
  frequency = new FakeParam();
  Q = new FakeParam();
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  frequency = new FakeParam();
  type = '';
  start = vi.fn();
  stop = vi.fn();
}
class FakeBuffer {
  len: number;
  constructor(len: number) {
    this.len = len;
  }
  getChannelData(): Float32Array {
    return new Float32Array(this.len);
  }
}
class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  createGain = vi.fn((): FakeGain => new FakeGain());
  createBiquadFilter = vi.fn((): FakeFilter => new FakeFilter());
  createBufferSource = vi.fn((): FakeSource => new FakeSource());
  createOscillator = vi.fn((): FakeSource => new FakeSource());
  createBuffer = vi.fn((_ch: number, len: number): FakeBuffer => new FakeBuffer(len));
  resume = vi.fn(() => Promise.resolve());
}

const withMockAudio = () => vi.stubGlobal('AudioContext', FakeAudioContext as unknown);

afterEach(() => vi.unstubAllGlobals());

describe('AudioEngine — headless-safe init + the master-bus mute (A1)', () => {
  it('init() does NOT throw when Web Audio is unavailable (headless/no-device); stays silent', () => {
    vi.stubGlobal('AudioContext', undefined);
    const a = new AudioEngine();
    expect(() => a.init()).not.toThrow(); // no Ctor -> silent no-op
    expect(a.context).toBeNull();
    expect(() => a.setMuted(true)).not.toThrow(); // guarded — no context
  });

  it('mute routes through the master bus (ramps it to 0 / back); the flag is remembered', () => {
    withMockAudio();
    const a = new AudioEngine();
    a.init();
    const master = a.master as unknown as FakeGain;
    expect(a.isMuted()).toBe(false);
    expect(master.gain.value).toBe(AUDIO.masterGain); // un-muted level

    a.setMuted(true);
    expect(a.isMuted()).toBe(true);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number)); // -> silent

    a.setMuted(false);
    expect(a.isMuted()).toBe(false);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(AUDIO.masterGain, expect.any(Number));
  });

  it('a context created already muted starts the master at 0 (persisted-mute respected)', () => {
    withMockAudio();
    const a = new AudioEngine();
    a.setMuted(true); // before init (no context yet) — just sets the flag
    a.init();
    expect((a.master as unknown as FakeGain).gain.value).toBe(0); // built muted
  });
});

describe('AmbientAudio — silent-ready: lifecycle kept, synthesis stripped (A1b)', () => {
  const make = (): { ambient: AmbientAudio; audio: AudioEngine; ctx: FakeAudioContext } => {
    const audio = new AudioEngine();
    audio.init();
    const ambient = new AmbientAudio(audio.context!, audio.master!);
    return { ambient, audio, ctx: audio.context as unknown as FakeAudioContext };
  };

  it('does NOT start on construction — only on the explicit gesture call (the mobile gate kept)', () => {
    withMockAudio();
    const { ambient } = make();
    expect(ambient.isStarted()).toBe(false); // not auto-started on load
    ambient.start();
    expect(ambient.isStarted()).toBe(true);
    ambient.start(); // idempotent
    expect(ambient.isStarted()).toBe(true);
  });

  it('⚠️ SILENT-READY: start() + setScene build NO synthesis nodes (the static is gone)', () => {
    withMockAudio();
    const { ambient, ctx } = make();
    // The master gain was built by AudioEngine.init() — clear so we measure only the ambient.
    ctx.createGain.mockClear();
    ctx.createBufferSource.mockClear();
    ctx.createOscillator.mockClear();
    ctx.createBiquadFilter.mockClear();

    ambient.start();
    ambient.setScene('meadow', 'day');
    ambient.setScene('woodland', 'night'); // a biome change — still silent

    expect(ctx.createBufferSource).not.toHaveBeenCalled(); // no noise sources (the "static")
    expect(ctx.createOscillator).not.toHaveBeenCalled(); // no LFO
    expect(ctx.createBiquadFilter).not.toHaveBeenCalled(); // no filters
    expect(ctx.createGain).not.toHaveBeenCalled(); // no wind / voice gains
  });

  it('setScene is a no-op before start(); after start it tracks state silently (never throws)', () => {
    withMockAudio();
    const { ambient } = make();
    expect(() => ambient.setScene('meadow', 'day')).not.toThrow(); // before start -> nothing
    ambient.start();
    expect(() => {
      ambient.setScene('meadow', 'day');
      ambient.setScene('meadow', 'day'); // unchanged -> no-op
      ambient.setScene('woodland', 'night'); // changed -> tracked, still silent
    }).not.toThrow();
  });
});
