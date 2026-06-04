/**
 * The impure input adapter: owns every DOM listener and folds them into the pure
 * `InputIntent` the game layer reads. The ONLY place that touches window/DOM for
 * input, so src/game/ stays Node-testable.
 *
 * Scheme:
 *  - Desktop: WASD / arrow keys move; SPACE/F = catch; B = deploy bait; Q =
 *    cycle bait type.
 *  - Mobile: an on-screen JOYSTICK (drag anywhere) + on-screen CATCH / BAIT / ↻
 *    buttons — one per edge action, mirroring the keys.
 *
 * Keyboard and touch are at PARITY: both write the SAME axes / edge flags onto
 * the same intent. Edge actions are set on the PRESS and CONSUMED by the sim, so
 * one press = one action.
 */

import { ACTION_KEYS, createIntent, dragAxes, keyAxes, type InputIntent } from '../game/Input';
import { TOUCH } from '../utils/constants';

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
    this.makeActionButton(target, 'CATCH', 'action-catch', () => {
      this.intent.catchPressed = true;
    });
    this.makeActionButton(target, 'BAIT', 'action-bait', () => {
      this.intent.baitDeploy = true;
    });
    this.makeActionButton(target, '↻', 'action-cycle', () => {
      this.intent.baitCycle = true;
    });

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hint = document.createElement('div');
    hint.className = 'touch-hint';
    hint.textContent = isTouch
      ? 'Drag to roam · CATCH · BAIT'
      : 'WASD roam · Space catch · B bait · Q cycle';
    target.appendChild(hint);
  }

  /** Create an on-screen button that fires an edge action on press. */
  private makeActionButton(
    target: HTMLElement,
    label: string,
    className: string,
    fire: () => void,
  ): void {
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
