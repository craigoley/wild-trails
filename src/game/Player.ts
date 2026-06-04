/**
 * Pure player state and its update step. ZERO three.js / DOM imports.
 *
 * Movement is velocity-based and SNAPPY (accel/friction ramp): raw screen input
 * is rotated onto the world plane by the iso angle, normalized, then the
 * velocity eases toward `maxSpeed` in that direction (and decays under friction
 * on release). The player is clamped to the world bounds. There is no catch,
 * stealth, or AI here yet — those land in later phased PRs.
 *
 * For render interpolation the player keeps its PREVIOUS sim-step position
 * alongside the current one; the renderer lerps between them by the frame alpha.
 */

import { ISO_YAW, PLAYER, TUNING, WORLD } from '../utils/constants';
import { clamp } from '../utils/math';
import type { InputIntent } from './Input';

// Rotation that maps raw SCREEN input (+x right, +y down) onto the world plane
// (the real 45° under the iso camera). Computed ONCE from ISO_YAW.
const ISO_COS = Math.cos(-ISO_YAW);
const ISO_SIN = Math.sin(-ISO_YAW);

export interface PlayerState {
  /** Current world position, world units. */
  x: number;
  y: number;
  /** Position at the start of the current sim step (for render interpolation). */
  prevX: number;
  prevY: number;
  /** Velocity, world units per second. */
  vx: number;
  vy: number;
  /** Facing unit vector (world); tracks the last move direction. Used by the
   *  renderer to orient the marker, and later by tracking/catch facing. */
  facingX: number;
  facingY: number;
}

export function createPlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: 1,
  };
}

/** Move velocity toward (tx, ty) by at most `maxDelta`, preserving direction. */
function approachVelocity(player: PlayerState, tx: number, ty: number, maxDelta: number): void {
  const dvx = tx - player.vx;
  const dvy = ty - player.vy;
  const dist = Math.hypot(dvx, dvy);
  if (dist <= maxDelta || dist === 0) {
    player.vx = tx;
    player.vy = ty;
    return;
  }
  player.vx += (dvx / dist) * maxDelta;
  player.vy += (dvy / dist) * maxDelta;
}

/**
 * Advance the player one fixed step: rotate raw input onto the world plane, ramp
 * velocity toward the target (or decay under friction), update facing, then
 * integrate and clamp to the world bounds.
 */
export function updatePlayer(player: PlayerState, intent: InputIntent, dt: number): void {
  player.prevX = player.x;
  player.prevY = player.y;

  // Rotate raw screen input into the world plane, then normalize.
  const rx = intent.moveX * ISO_COS - intent.moveY * ISO_SIN;
  const ry = intent.moveX * ISO_SIN + intent.moveY * ISO_COS;
  const len = Math.hypot(rx, ry);
  const hasInput = len > 0;
  const mdx = hasInput ? rx / len : 0;
  const mdy = hasInput ? ry / len : 0;

  if (hasInput) {
    player.facingX = mdx;
    player.facingY = mdy;
  }

  const targetVx = hasInput ? mdx * TUNING.maxSpeed : 0;
  const targetVy = hasInput ? mdy * TUNING.maxSpeed : 0;
  const rate = hasInput ? TUNING.accel : TUNING.friction;
  approachVelocity(player, targetVx, targetVy, rate * dt);

  // Integrate, then clamp to the world so the player can't roam off the ground.
  const bound = WORLD.halfSize - PLAYER.radius;
  player.x = clamp(player.x + player.vx * dt, -bound, bound);
  player.y = clamp(player.y + player.vy * dt, -bound, bound);
}
