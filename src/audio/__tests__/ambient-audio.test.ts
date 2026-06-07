// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../AudioEngine';
import { AmbientAudio } from '../AmbientAudio';
import { AUDIO } from '../../utils/constants';

/**
 * A minimal Web Audio mock — jsdom has no AudioContext. It records the AudioParam ramps so we
 * can assert the mute bus + the biome crossfade without a real audio device.
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
  createGain = (): FakeGain => new FakeGain();
  createBiquadFilter = (): FakeFilter => new FakeFilter();
  createBufferSource = (): FakeSource => new FakeSource();
  createOscillator = (): FakeSource => new FakeSource();
  createBuffer = (_ch: number, len: number): FakeBuffer => new FakeBuffer(len);
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

describe('AmbientAudio — gesture-gated start + the biome crossfade (A1)', () => {
  const make = (): { ambient: AmbientAudio; audio: AudioEngine } => {
    const audio = new AudioEngine();
    audio.init();
    const ambient = new AmbientAudio(audio.context!, audio.master!);
    return { ambient, audio };
  };

  it('does NOT start on construction — only on the explicit gesture call (the mobile gate)', () => {
    withMockAudio();
    const { ambient } = make();
    expect(ambient.isStarted()).toBe(false); // not auto-started on load
    ambient.start();
    expect(ambient.isStarted()).toBe(true);
    ambient.start(); // idempotent
    expect(ambient.isStarted()).toBe(true);
  });

  it('setScene is a no-op before start() and when the biome+phase are unchanged', () => {
    withMockAudio();
    const { ambient } = make();
    ambient.setScene('meadow', 'day'); // before start -> nothing
    ambient.start();
    ambient.setScene('meadow', 'day'); // first call: ramps the meadow voice in
    const voiceParam = findVoiceParam(ambient);
    const callsAfterFirst = voiceParam.linearRampToValueAtTime.mock.calls.length;
    ambient.setScene('meadow', 'day'); // UNCHANGED -> no further work
    expect(voiceParam.linearRampToValueAtTime.mock.calls.length).toBe(callsAfterFirst);
  });

  it('a biome CHANGE crossfades the meadow voice (ramps the gain — no abrupt cut)', () => {
    withMockAudio();
    const { ambient } = make();
    ambient.start();
    const voiceParam = findVoiceParam(ambient);

    ambient.setScene('meadow', 'day'); // in the meadow -> voice ramps toward voiceGain
    expect(voiceParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(AUDIO.voiceGain, expect.any(Number));

    ambient.setScene('woodland', 'day'); // leaving -> voice ramps OUT to 0 (the crossfade)
    expect(voiceParam.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, expect.any(Number));
  });
});

/** Reach the voice GainNode's gain param on the AmbientAudio instance (private — test-only). */
function findVoiceParam(ambient: AmbientAudio): FakeParam {
  const voice = (ambient as unknown as { voice: FakeGain }).voice;
  return voice.gain;
}
