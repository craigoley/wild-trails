/**
 * Abstract input INTENT and the pure mappings that produce it. The intent is in
 * RAW SCREEN axes (+x = right, +y = down) — exactly what a key press or a touch
 * drag means on screen. The pure game layer (Player) rotates this into the world
 * plane by the iso angle; keeping the rotation there (not here) is what
 * guarantees keyboard and touch move IDENTICALLY (both feed the same intent
 * through the same rotation).
 *
 * NO three, NO DOM — this whole module is Node-testable. The impure side (DOM
 * listeners, the on-screen joystick) lives in src/input/Controls.ts and only
 * WRITES onto an InputIntent; the sim only READS it.
 *
 * Components are in [-1, 1]; magnitude may exceed 1 on the diagonal, so Player
 * normalizes after rotating.
 */

import { clamp } from '../utils/math';

export interface InputIntent {
  /** Horizontal move axis: -1 = left, +1 = right, 0 = none (screen space). */
  moveX: number;
  /** Vertical move axis: -1 = up, +1 = down, 0 = none (screen space). */
  moveY: number;
  /** EDGE actions — set true on the press by Controls, CONSUMED (set back to
   *  false) by the sim, so one press = one action. */
  catchPressed: boolean;
  baitDeploy: boolean;
  baitCycle: boolean;
  /** Deploy the portable hide at the player position (slice C). Edge action,
   *  consumed by the sim. */
  hideDeploy: boolean;
  /** Direct bait SELECTION: the bait index to select this step (chip 0 = first
   *  bait), or -1 = none. Edge action, consumed by the sim. */
  baitSelect: number;
  /** Toggle the Field Journal overlay (open/close). UI-only edge action,
   *  consumed at the boundary (not the sim). */
  journalToggle: boolean;
  /** Toggle the Missions overlay (open/close). UI-only edge action. */
  missionToggle: boolean;
  /** Toggle the Research overlay (open/close). UI-only edge action (§4.1.4 R0b). */
  researchToggle: boolean;
  /** Toggle the Bait selection sub-screen (open/close). UI-only edge action — bait
   *  TYPE-selection moved off the main HUD into a panel; DEPLOY stays a HUD button. */
  baitPanelToggle: boolean;
  /** Toggle audio mute (all sound on/off). UI-only edge action (Atmosphere A1). */
  muteToggle: boolean;
}

export function createIntent(): InputIntent {
  return {
    moveX: 0,
    moveY: 0,
    catchPressed: false,
    baitDeploy: false,
    baitCycle: false,
    hideDeploy: false,
    baitSelect: -1,
    journalToggle: false,
    missionToggle: false,
    researchToggle: false,
    baitPanelToggle: false,
    muteToggle: false,
  };
}

/** Keys (lowercased) that drive each screen direction. */
export const MOVE_KEYS = {
  left: ['arrowleft', 'a'],
  right: ['arrowright', 'd'],
  up: ['arrowup', 'w'],
  down: ['arrowdown', 's'],
} as const;

/** Keys (lowercased) for the edge actions. The on-screen buttons mirror these,
 *  one button per action, so touch and keyboard are at parity. */
export const ACTION_KEYS = {
  catch: [' ', 'f'],
  baitDeploy: ['b'],
  baitCycle: ['q'],
  hideDeploy: ['h'],
  journal: ['j'],
  missions: ['m'],
  research: ['r'],
  baitPanel: ['e'],
  mute: ['k'],
} as const;

/** Number keys for DIRECT bait selection, positional: index 0 = '1', 1 = '2', …
 *  (chip 1 selects the first bait). */
export const BAIT_SELECT_KEYS = ['1', '2', '3', '4', '5', '6'] as const; // §4.2 — '5' = shellfish (5th diet); §savanna — '6' = meat (6th diet)

/** The bait index a key selects, or -1 if the key isn't a bait-select key. Pure
 *  — the off-by-one guard ('1' -> index 0) is pinned in a test. */
export function baitIndexForKey(key: string): number {
  return (BAIT_SELECT_KEYS as readonly string[]).indexOf(key);
}

/** The two move axes (the whole intent in Phase 0) — the pure keyboard/touch
 *  mappings produce these and the adapter copies them onto the live intent. */
export interface MoveAxes {
  moveX: number;
  moveY: number;
}

const has = (keys: readonly string[], pressed: ReadonlySet<string>): boolean =>
  keys.some((k) => pressed.has(k));

/** Raw screen-space move axes from the set of currently-held keys. Pure. */
export function keyAxes(pressed: ReadonlySet<string>): MoveAxes {
  let x = 0;
  let y = 0;
  if (has(MOVE_KEYS.left, pressed)) x -= 1;
  if (has(MOVE_KEYS.right, pressed)) x += 1;
  if (has(MOVE_KEYS.up, pressed)) y -= 1;
  if (has(MOVE_KEYS.down, pressed)) y += 1;
  return { moveX: x, moveY: y };
}

/** Raw screen-space move axes from a touch-joystick drag offset (px) and the
 *  full-deflection range (px). Up-screen drag (dy < 0) yields moveY < 0,
 *  matching the up keys — so touch and keyboard produce the SAME axes for the
 *  same direction. */
export function dragAxes(dx: number, dy: number, range: number): MoveAxes {
  return {
    moveX: clamp(dx / range, -1, 1),
    moveY: clamp(dy / range, -1, 1),
  };
}
