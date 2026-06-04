import { describe, expect, it } from 'vitest';
import { createPlayer, updatePlayer, type PlayerState } from '../Player';
import { createIntent, type InputIntent } from '../Input';
import { CAMERA, SIM_DT, TUNING, WORLD, PLAYER } from '../../utils/constants';

const DT = SIM_DT;

/** Step the player N times holding a fixed intent. */
function step(p: PlayerState, intent: Partial<InputIntent>, n: number): void {
  const full: InputIntent = { ...createIntent(), ...intent };
  for (let i = 0; i < n; i++) updatePlayer(p, full, DT);
}

const speed = (p: PlayerState): number => Math.hypot(p.vx, p.vy);

/**
 * Screen projection of a world velocity (game x = vx, game y = vy) under the
 * REAL iso camera, derived purely from CAMERA's offset (no three.js). The camera
 * sits at offset (ox, oy, oz) looking at the focus with world-up = +y; this
 * mirrors three's lookAt basis:
 *   Zc = normalize(ox, oy, oz)            (focus -> camera)
 *   Xc = normalize(worldUp × Zc) = normalize(oz, 0, -ox)   (screen-right)
 *   Yc = Zc × Xc                                            (screen-up)
 * A world velocity is (vx, 0, vy) in three coords; screen-right = v·Xc,
 * screen-up = v·Yc. This is the iso-mapping regression guard: under the 45° yaw,
 * "up" input must still project straight up the screen even though it is a world
 * diagonal — the exact bug that breaks an iso camera when the yaw is wired wrong.
 */
function project(p: PlayerState): { right: number; up: number } {
  const { offsetX: ox, offsetY: oy, offsetZ: oz } = CAMERA;
  const zl = Math.hypot(ox, oy, oz);
  const zc = [ox / zl, oy / zl, oz / zl];
  const xl = Math.hypot(oz, ox);
  const xc = [oz / xl, 0, -ox / xl];
  const yc = [
    zc[1] * xc[2] - zc[2] * xc[1],
    zc[2] * xc[0] - zc[0] * xc[2],
    zc[0] * xc[1] - zc[1] * xc[0],
  ];
  const v = [p.vx, 0, p.vy];
  return {
    right: v[0] * xc[0] + v[1] * xc[1] + v[2] * xc[2],
    up: v[0] * yc[0] + v[1] * yc[1] + v[2] * yc[2],
  };
}

describe('Player movement — snappy velocity ramp', () => {
  it('accelerates toward maxSpeed over a few steps, not instantly', () => {
    const p = createPlayer(0, 0);
    step(p, { moveX: 1 }, 1);
    expect(speed(p)).toBeGreaterThan(0);
    expect(speed(p)).toBeLessThan(TUNING.maxSpeed);
    step(p, { moveX: 1 }, 8);
    expect(speed(p)).toBeCloseTo(TUNING.maxSpeed, 5);
  });

  it('ramps without overshoot — non-decreasing speed, capped at maxSpeed', () => {
    const p = createPlayer(0, 0);
    let last = 0;
    let strictlyRoseAtLeastOnce = false;
    for (let i = 0; i < 8; i++) {
      updatePlayer(p, { ...createIntent(), moveX: 1 }, DT);
      expect(speed(p)).toBeGreaterThanOrEqual(last - 1e-9);
      expect(speed(p)).toBeLessThanOrEqual(TUNING.maxSpeed + 1e-9);
      if (speed(p) > last) strictlyRoseAtLeastOnce = true;
      last = speed(p);
    }
    expect(strictlyRoseAtLeastOnce).toBe(true); // a real ramp, not an instant jump
  });

  it('friction decays speed to rest within a few steps after release', () => {
    const p = createPlayer(0, 0);
    step(p, { moveX: 1 }, 12);
    expect(speed(p)).toBeGreaterThan(0);
    step(p, {}, 6);
    expect(speed(p)).toBeCloseTo(0, 5);
  });
});

describe('Player movement — iso input mapping', () => {
  it('projects "up" input straight up the screen (no left/right drift)', () => {
    const p = createPlayer(0, 0);
    step(p, { moveY: -1 }, 12); // hold "up" until at full speed
    const s = project(p);
    expect(s.up).toBeGreaterThan(0); // moves up the screen
    expect(Math.abs(s.right)).toBeLessThan(1e-6); // and not sideways
  });

  it('projects "right" input straight right across the screen', () => {
    const p = createPlayer(0, 0);
    step(p, { moveX: 1 }, 12);
    const s = project(p);
    expect(s.right).toBeGreaterThan(0);
    expect(Math.abs(s.up)).toBeLessThan(1e-6);
  });
});

describe('Player movement — world bounds', () => {
  it('clamps the player inside the world, never past the ground edge', () => {
    const p = createPlayer(0, 0);
    step(p, { moveX: 1 }, 2000); // shove hard into the +x wall
    const bound = WORLD.halfSize - PLAYER.radius;
    expect(p.x).toBeLessThanOrEqual(bound + 1e-9);
    expect(p.x).toBeGreaterThanOrEqual(-bound - 1e-9);
  });
});
