/**
 * Device SETTINGS — small, local preferences kept SEPARATE from the save (the Journal).
 * Settings are per-DEVICE, not progression, so they live in their OWN localStorage key and
 * carry NO schema version / migration (unlike the versioned Journal). Every access is
 * try/catch-wrapped (Safari Private Mode throws on setItem) and degrades to defaults — it
 * NEVER throws. No Web Audio / DOM here — just localStorage (Node-safe under jsdom).
 *
 * A1 (§4.3): just `muted` (the audio mute toggle). Default OFF (muted: false) — atmosphere is
 * the point, at a gentle volume — but the player's choice is remembered across reloads.
 */

const SETTINGS_KEY = 'wild-trails:settings';

export interface Settings {
  /** Is all sound muted? Default false (sound on). */
  muted: boolean;
}

function defaults(): Settings {
  return { muted: false };
}

/** Load device settings (a fresh default if absent / corrupt / unavailable). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults();
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return { muted: obj.muted === true };
  } catch {
    return defaults();
  }
}

/** Persist device settings. A failed write (private mode) is a silent no-op. */
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // unavailable / private mode — the in-memory value still holds for this session
  }
}
