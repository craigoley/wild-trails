/**
 * The impure input adapter: owns every DOM listener and folds them into the pure
 * `InputIntent` the game layer reads. The ONLY place that touches window/DOM for
 * input, so src/game/ stays Node-testable.
 *
 * Scheme (a roaming game — move is the whole control surface in Phase 0):
 *  - Desktop: WASD / arrow keys move.
 *  - Mobile: an on-screen JOYSTICK (drag anywhere; a thumb tracks the drag).
 *
 * Keyboard and touch are at PARITY: both write the SAME screen-space axes onto
 * the same intent, and the pure Player rotates them through the same iso angle.
 * So a given direction moves the player identically however it was entered.
 */

import { createIntent, dragAxes, keyAxes, type InputIntent } from '../game/Input';
import { TOUCH } from '../utils/constants';

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

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hint = document.createElement('div');
    hint.className = 'touch-hint';
    hint.textContent = isTouch ? 'Drag to roam' : 'WASD / arrows to roam';
    target.appendChild(hint);
  }

  private static makeStick(className: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = className;
    el.style.display = 'none';
    return el;
  }

  // --- Keyboard -------------------------------------------------------------
  private onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.add(e.key.toLowerCase());
    this.syncKeyAxes();
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
