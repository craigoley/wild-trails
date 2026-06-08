/**
 * The impure input adapter: owns every DOM listener and folds them into the pure
 * `InputIntent` the game layer reads. The ONLY place that touches window/DOM for
 * input, so src/game/ stays Node-testable.
 *
 * Scheme:
 *  - Desktop: WASD / arrow keys move; SPACE/F = catch; B = deploy bait; 1/2/3 =
 *    select bait (the tray); Q = cycle bait (fallback).
 *  - Mobile: an on-screen JOYSTICK (drag anywhere), CATCH / BAIT buttons, and a
 *    always-visible BAIT TRAY — tap a chip to select that bait.
 *
 * Keyboard and touch are at PARITY: both write the SAME axes / edge flags onto
 * the same intent. Edge actions are set on the PRESS and CONSUMED by the sim, so
 * one press = one action.
 */

import {
  ACTION_KEYS,
  baitIndexForKey,
  createIntent,
  dragAxes,
  keyAxes,
  type InputIntent,
} from '../game/Input';
import type { BaitState } from '../game/Bait';
import { isBaitSelectable } from '../game/Bait';
import { BAIT_DISPLAY, TOUCH } from '../utils/constants';

const includes = (keys: readonly string[], k: string): boolean => keys.includes(k);

/**
 * Roam-drag begins ONLY on the game world — the WebGL canvas. A touch on the HUD,
 * a button, or an open panel has a NON-canvas target; the roam handler must skip it
 * so its preventDefault() doesn't cancel the panel's native iOS scroll (scroll fix
 * v4 — the measured cause). Touch events keep their initial target, so roam
 * OWNERSHIP is decided here at touchstart and stays stable for the whole touch:
 * a drag that starts on the canvas keeps roaming even if it slides over a panel,
 * and a touch that starts on a panel never becomes a roam. Panel-agnostic (no
 * panel/overlay class list to keep in sync), and it correctly forbids world-roam
 * while any modal is open.
 */
export function isRoamTouchTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLCanvasElement;
}

export class Controls {
  readonly intent: InputIntent = createIntent();

  private readonly pressed = new Set<string>();

  // On-screen joystick (touch). One active touch drives the move axes.
  private readonly stickBase: HTMLDivElement;
  private readonly stickThumb: HTMLDivElement;
  private moveTouchId: number | null = null;
  private moveOX = 0;
  private moveOY = 0;

  // Action-button handles, so the render loop can reflect game state on them
  // (CATCH arms + shows the chance; a first-time "try bait" hint).
  private readonly catchBtn: HTMLButtonElement;
  private readonly baitBtn: HTMLButtonElement;
  /** Badge on the BAIT button showing the currently-selected bait (icon + count). */
  private readonly baitCurrent: HTMLSpanElement;
  /** Last-rendered "selected:count" key, so the per-frame badge update is a no-op
   *  unless it actually changed (no per-frame DOM churn). */
  private lastBaitKey = '';
  private readonly muteBtn: HTMLButtonElement;
  private readonly baitHint: HTMLDivElement;

  constructor(target: HTMLElement = document.body) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('touchstart', this.onTouchStart, { passive: false });
    target.addEventListener('touchmove', this.onTouchMove, { passive: false });
    target.addEventListener('touchend', this.onTouchEnd);
    target.addEventListener('touchcancel', this.onTouchEnd);

    this.stickBase = Controls.makeStick('touch-stick-base');
    this.stickThumb = Controls.makeStick('touch-stick-thumb');
    target.append(this.stickBase, this.stickThumb);
    this.hideStick();

    // On-screen action buttons (mirror the keys; one per edge action).
    this.catchBtn = this.makeActionButton(target, 'CATCH', 'action-catch', () => {
      this.intent.catchPressed = true;
    });
    this.baitBtn = this.makeActionButton(target, 'BAIT', 'action-bait', () => {
      this.intent.baitDeploy = true;
    });
    // A small badge on the BAIT button showing the SELECTED bait (icon + count) —
    // the at-a-glance "what will I deploy" the always-visible tray used to give, now
    // that type-selection lives in the bait sub-screen. Updated each frame.
    this.baitCurrent = document.createElement('span');
    this.baitCurrent.className = 'bait-current';
    this.baitBtn.appendChild(this.baitCurrent);
    // Portable hide deploy (slice C; also the 'H' key) — mobile PARITY with the key.
    this.makeActionButton(target, 'HIDE', 'action-hide', () => {
      this.intent.hideDeploy = true;
    });
    // Top-right panel toggles share a flex container so they lay out side by
    // side (and future toggles flow in without hand-placed coords / collisions).
    const topRight = document.createElement('div');
    topRight.className = 'hud-topright';
    target.appendChild(topRight);
    // Field Journal toggle (also the 'J' key).
    this.makeActionButton(topRight, '📓', 'action-journal', () => {
      this.intent.journalToggle = true;
    });
    // Missions toggle (also the 'M' key).
    this.makeActionButton(topRight, '🎯', 'action-missions', () => {
      this.intent.missionToggle = true;
    });
    // Research toggle (also the 'R' key) — §4.1.4 R0b.
    this.makeActionButton(topRight, '🔬', 'action-research', () => {
      this.intent.researchToggle = true;
    });
    // Bait selection sub-screen toggle — type-selection moved off the main HUD into
    // a panel (declutter); the BAIT button still deploys the selected bait one-tap.
    this.makeActionButton(topRight, '🪱', 'action-baitpanel', () => {
      this.intent.baitPanelToggle = true;
    });
    // Mute toggle (also the 'K' key) — Atmosphere A1. The glyph reflects the live state.
    this.muteBtn = this.makeActionButton(topRight, '🔊', 'action-mute', () => {
      this.intent.muteToggle = true;
    });
    // First-time affordance: a small "try bait" pointer near the BAIT button,
    // shown only when a target is armed but unbaited and bait was never used.
    this.baitHint = document.createElement('div');
    this.baitHint.className = 'bait-hint';
    this.baitHint.textContent = 'try BAIT ↓';
    this.baitHint.style.display = 'none';
    target.appendChild(this.baitHint);

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hint = document.createElement('div');
    hint.className = 'touch-hint';
    hint.textContent = isTouch
      ? 'Drag to roam · CATCH · BAIT · 🪱 to pick bait'
      : 'WASD roam · Space catch · B bait · 1/2/3 pick bait';
    target.appendChild(hint);
  }

  /** Reflect the SELECTED bait on the BAIT button's badge (icon + remaining count),
   *  greyed when that bait is empty. The at-a-glance read the always-visible tray
   *  used to give, now that type-selection lives in the bait sub-screen. READS bait
   *  state; never mutates it. Guarded so the per-frame call only rewrites the DOM
   *  when the selection or count actually changed (no per-frame allocation). */
  setCurrentBait(bait: BaitState): void {
    const id = bait.selected;
    const count = bait.counts[id];
    const key = `${id}:${count}`;
    if (key === this.lastBaitKey) return;
    this.lastBaitKey = key;
    const disp = BAIT_DISPLAY[id];
    this.baitCurrent.innerHTML =
      `<span class="chip-icon icon-${disp.icon}"></span>` +
      `<span class="bait-current-count">×${count}</span>`;
    this.baitCurrent.classList.toggle('empty', !isBaitSelectable(bait, id));
  }

  /** Create an on-screen button that fires an edge action on press. */
  private makeActionButton(
    target: HTMLElement,
    label: string,
    className: string,
    fire: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `action-btn ${className}`;
    btn.textContent = label;
    // pointerdown (not click) so it fires immediately on touch; preventDefault
    // stops the synthetic double-tap / focus-scroll.
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fire();
    });
    btn.addEventListener('touchstart', (e) => e.stopPropagation());
    target.appendChild(btn);
    return btn;
  }

  /** Reflect the catch target on the CATCH button: armed shows the live chance,
   *  out-of-range dims it (so the player learns range by watching it "arm"). */
  setCatchState(armed: boolean, chance: number): void {
    this.catchBtn.classList.toggle('disabled', !armed);
    this.catchBtn.textContent = armed ? `CATCH ${Math.round(chance * 100)}%` : 'CATCH';
  }

  /** Show/hide the first-time "try bait" affordance. */
  setBaitHint(show: boolean): void {
    this.baitHint.style.display = show ? 'block' : 'none';
  }

  /** Reflect the mute state on the 🔊/🔇 button (Atmosphere A1). Called at boot (to show the
   *  persisted state) + on each toggle. */
  setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
    this.muteBtn.classList.toggle('muted', muted);
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  /** Brief confirmation pulse on the BAIT button when bait is deployed. */
  pulseBait(): void {
    this.baitBtn.classList.remove('pulse');
    void this.baitBtn.offsetWidth; // reflow so the animation re-triggers
    this.baitBtn.classList.add('pulse');
  }

  private static makeStick(className: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = className;
    el.style.display = 'none';
    return el;
  }

  // --- Keyboard -------------------------------------------------------------
  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    const fresh = !this.pressed.has(k); // ignore auto-repeat for edge actions
    this.pressed.add(k);
    this.syncKeyAxes();
    if (!fresh) return;
    if (includes(ACTION_KEYS.catch, k)) {
      e.preventDefault();
      this.intent.catchPressed = true;
    }
    if (includes(ACTION_KEYS.baitDeploy, k)) this.intent.baitDeploy = true;
    if (includes(ACTION_KEYS.baitCycle, k)) this.intent.baitCycle = true;
    if (includes(ACTION_KEYS.hideDeploy, k)) this.intent.hideDeploy = true;
    if (includes(ACTION_KEYS.journal, k)) this.intent.journalToggle = true;
    if (includes(ACTION_KEYS.missions, k)) this.intent.missionToggle = true;
    if (includes(ACTION_KEYS.research, k)) this.intent.researchToggle = true;
    if (includes(ACTION_KEYS.mute, k)) this.intent.muteToggle = true;
    // 1/2/3 direct-select the corresponding bait chip.
    const baitIdx = baitIndexForKey(k);
    if (baitIdx >= 0) this.intent.baitSelect = baitIdx;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.key.toLowerCase());
    this.syncKeyAxes();
  };

  /** Fold the held keys into the intent (touch overrides while a stick touch is
   *  active — see onTouchMove). */
  private syncKeyAxes(): void {
    if (this.moveTouchId !== null) return; // a touch drag owns the axes
    const a = keyAxes(this.pressed);
    this.intent.moveX = a.moveX;
    this.intent.moveY = a.moveY;
  }

  // --- Touch joystick -------------------------------------------------------
  private onTouchStart = (e: TouchEvent): void => {
    if (this.moveTouchId !== null) return;
    // Only the game world (canvas) starts a roam. A panel / HUD / button touch
    // passes through untouched — so its native iOS scroll isn't cancelled by our
    // preventDefault (scroll fix v4). onTouchMove gates on moveTouchId, so a skipped
    // touch never enters roam state.
    if (!isRoamTouchTarget(e.target)) return;
    const t = e.changedTouches[0];
    if (!t) return;
    e.preventDefault();
    this.moveTouchId = t.identifier;
    this.moveOX = t.clientX;
    this.moveOY = t.clientY;
    this.showStick(t.clientX, t.clientY);
    this.updateThumb(0, 0);
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.moveTouchId === null) return;
    const t = Controls.findTouch(e.changedTouches, this.moveTouchId);
    if (!t) return;
    e.preventDefault();
    const dx = t.clientX - this.moveOX;
    const dy = t.clientY - this.moveOY;
    const a = dragAxes(dx, dy, TOUCH.stickRange);
    this.intent.moveX = a.moveX;
    this.intent.moveY = a.moveY;
    this.updateThumb(a.moveX * TOUCH.stickRange, a.moveY * TOUCH.stickRange);
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.moveTouchId === null) return;
    if (!Controls.findTouch(e.changedTouches, this.moveTouchId)) return;
    this.moveTouchId = null;
    this.hideStick();
    this.syncKeyAxes(); // fall back to whatever keys are still held (usually none)
    if (this.moveTouchId === null && this.pressed.size === 0) {
      this.intent.moveX = 0;
      this.intent.moveY = 0;
    }
  };

  private static findTouch(list: TouchList, id: number): Touch | null {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }

  private showStick(cx: number, cy: number): void {
    this.stickBase.style.display = 'block';
    this.stickThumb.style.display = 'block';
    this.stickBase.style.left = `${cx}px`;
    this.stickBase.style.top = `${cy}px`;
  }

  private hideStick(): void {
    this.stickBase.style.display = 'none';
    this.stickThumb.style.display = 'none';
  }

  private updateThumb(dx: number, dy: number): void {
    this.stickThumb.style.left = `${this.moveOX + dx}px`;
    this.stickThumb.style.top = `${this.moveOY + dy}px`;
  }
}
