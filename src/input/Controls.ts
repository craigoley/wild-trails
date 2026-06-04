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
import { BAIT_DISPLAY, BAIT_ORDER, TOUCH } from '../utils/constants';

const includes = (keys: readonly string[], k: string): boolean => keys.includes(k);

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
  private readonly baitHint: HTMLDivElement;

  // Bait tray — one chip per bait type; each shows icon + label + count, with a
  // count span updated each frame and selected/empty classes toggled.
  private readonly trayChips: HTMLButtonElement[] = [];
  private readonly trayCounts: HTMLSpanElement[] = [];

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
    // Field Journal toggle (also the 'J' key).
    this.makeActionButton(target, '📓', 'action-journal', () => {
      this.intent.journalToggle = true;
    });
    // Missions toggle (also the 'M' key).
    this.makeActionButton(target, '🎯', 'action-missions', () => {
      this.intent.missionToggle = true;
    });
    // Bait tray — replaces the old ↻ cycler. One tappable chip per bait type,
    // always visible, showing what you have / what's selected / how much is left.
    this.buildBaitTray(target);

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
      ? 'Drag to roam · CATCH · BAIT · tap a chip to pick bait'
      : 'WASD roam · Space catch · B bait · 1/2/3 pick bait';
    target.appendChild(hint);
  }

  /** Build the always-visible bait tray: one chip per bait type. Tapping a chip
   *  sets the direct-select intent (the sim ignores it if that bait is empty). */
  private buildBaitTray(target: HTMLElement): void {
    const tray = document.createElement('div');
    tray.className = 'bait-tray';
    BAIT_ORDER.forEach((id, index) => {
      const disp = BAIT_DISPLAY[id];
      const chip = document.createElement('button');
      chip.className = `bait-chip chip-${disp.icon}`;
      chip.innerHTML =
        `<span class="chip-icon icon-${disp.icon}"></span>` +
        `<span class="chip-label">${index + 1} ${disp.label}</span>`;
      const count = document.createElement('span');
      count.className = 'chip-count';
      chip.appendChild(count);
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.intent.baitSelect = index;
      });
      chip.addEventListener('touchstart', (e) => e.stopPropagation());
      tray.appendChild(chip);
      this.trayChips.push(chip);
      this.trayCounts.push(count);
    });
    target.appendChild(tray);
  }

  /** Reflect bait state on the tray each frame: counts, the selected highlight,
   *  and the greyed/non-selectable state for empty baits (the #5.3 scarcity made
   *  visible). READS bait state; never mutates it. */
  setBaitTray(bait: BaitState): void {
    for (let i = 0; i < BAIT_ORDER.length; i++) {
      const id = BAIT_ORDER[i];
      this.trayCounts[i].textContent = `×${bait.counts[id]}`;
      this.trayChips[i].classList.toggle('selected', bait.selected === id);
      this.trayChips[i].classList.toggle('empty', !isBaitSelectable(bait, id));
    }
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
    if (includes(ACTION_KEYS.journal, k)) this.intent.journalToggle = true;
    if (includes(ACTION_KEYS.missions, k)) this.intent.missionToggle = true;
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
