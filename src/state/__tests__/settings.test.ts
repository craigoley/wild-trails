// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../Settings';

beforeEach(() => {
  localStorage.clear();
});

describe('Settings — device mute, persisted separately from the save (A1)', () => {
  it('defaults to NOT muted (sound on) when nothing is stored', () => {
    expect(loadSettings()).toEqual({ muted: false });
  });

  it('a saved mute persists across a reload (round-trips through localStorage)', () => {
    saveSettings({ muted: true });
    expect(loadSettings().muted).toBe(true);
    saveSettings({ muted: false });
    expect(loadSettings().muted).toBe(false);
  });

  it('uses its OWN key (wild-trails:settings) — NOT the journal save (no schema bump)', () => {
    saveSettings({ muted: true });
    expect(localStorage.getItem('wild-trails:settings')).toContain('muted');
    expect(localStorage.getItem('wild-trails:journal')).toBeNull(); // the save is untouched
  });

  it('degrades to the default on corrupt / non-boolean stored data (never throws)', () => {
    localStorage.setItem('wild-trails:settings', 'not json {{{');
    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual({ muted: false });
    localStorage.setItem('wild-trails:settings', JSON.stringify({ muted: 'yes' }));
    expect(loadSettings().muted).toBe(false); // non-boolean -> false
  });
});
