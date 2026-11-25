/**
 * Collision tests for the player's car, which is treated as three circles along its length.
 *
 *   blocks()     solid city blocks (rounded rectangles): the car is pushed out and bounces; leaving a bridge = water
 *   bumps()      speed bumps: kick the car into the air
 *   parkedCars() hitting a parked car
 *   traffic()    hitting a moving car (cars behind you can't crash into you)
 *
 * blocks(), parkedCars() and traffic() report a crash; the game decides what a crash means (restart).
 * Block and parked-car tests run in grid space; the car lives in world space, so points are converted first.
 */
import { C, RD, PK, COLLISION } from './config.js';
import { capsulePoints } from './util/math.js';
import { isHwy, isRiver, isStn, toGrid } from './world/zones.js';

const CORNER = 7;   // radius of the rounded block corners

export class Collisions {
  /** @param {import('./world/chunkManager.js').ChunkManager} chunks */
  constructor(chunks) {
    this.chunks = chunks;
  }

  /** Push the car out of city blocks (bouncing it); returns true if the car left a bridge into the river. */
  blocks(p) {
    const r = COLLISION.blockRadius, half = C / 2 - RD - PK;
    for (let pass = 0; pass < 2; pass++) {
      for (const [wx, wz] of capsulePoints(p.x, p.z, p.h, COLLISION.capsuleOffset)) {
        const [cx, cz] = toGrid(wx, wz);
        const i = Math.floor(cx / C), j = Math.floor(cz / C);
        const bx = cx - (i + 0.5) * C, bz = cz - (j + 0.5) * C;
        const qx = Math.abs(bx) - (half - CORNER), qz = Math.abs(bz) - (half - CORNER);
        const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
        const dist = Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - CORNER;   // signed distance to the rounded block

        if (isRiver(i, j)) {
          const zr = cz - j * C, lane = Math.round(cx / C) * C;
          if (zr > RD && zr < C - RD && Math.abs(cx - lane) > COLLISION.waterHalfWidth) return true;
        }
        if (dist < r && !isHwy(i, j) && !isStn(i, j) && !isRiver(i, j)) {
          let nx, nz;
          if (ox > 0 || oz > 0) { const l = Math.hypot(ox, oz); nx = Math.sign(bx) * ox / l; nz = Math.sign(bz) * oz / l; }
          else if (qx > qz) { nx = Math.sign(bx); nz = 0; }
          else { nx = 0; nz = Math.sign(bz); }
          const penetration = r - dist;
          p.x += nx * penetration;
          p.z += nz * penetration;
          p.v *= Math.abs(p.v) > 3 ? -COLLISION.blockBounce : 0.5;
        }
      }
    }
    return false;
  }

  /** Push the car out of houses (solid boxes in grid space); same bounce as a city block. */
  houses(p) {
    const r = COLLISION.blockRadius;
    for (let pass = 0; pass < 2; pass++) {
      for (const [wx, wz] of capsulePoints(p.x, p.z, p.h, COLLISION.capsuleOffset)) {
        const [cx, cz] = toGrid(wx, wz);
        const ci = Math.floor(cx / C), cj = Math.floor(cz / C);
        for (let a = -1; a <= 1; a++) {
          for (let b = -1; b <= 1; b++) {
            const cell = this.chunks.get(ci + a, cj + b);
            if (!cell || !cell.houses.length) continue;
            for (const h of cell.houses) {
              const bx = cx - h.x, bz = cz - h.z, qx = Math.abs(bx) - h.hw, qz = Math.abs(bz) - h.hd;
              const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
              const dist = Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0);
              if (dist >= r) continue;
              let nx, nz;
              if (ox > 0 || oz > 0) { const l = Math.hypot(ox, oz); nx = Math.sign(bx) * ox / l; nz = Math.sign(bz) * oz / l; }
              else if (qx > qz) { nx = Math.sign(bx) || 1; nz = 0; }
              else { nx = 0; nz = Math.sign(bz) || 1; }
              p.x += nx * (r - dist);
              p.z += nz * (r - dist);
              p.v *= Math.abs(p.v) > 3 ? -COLLISION.blockBounce : 0.5;
            }
          }
        }
      }
    }
  }

  /** Speed bumps in the cells around the car. */
  bumps(p) {
    const [gx, gz] = toGrid(p.x, p.z);
    const ci = Math.floor(gx / C), cj = Math.floor(gz / C);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const cell = this.chunks.get(ci + a, cj + b);
        if (!cell) continue;
        for (const bump of cell.bumps) {
          const inside = bump.ax === 'z'
            ? Math.abs(gz - bump.z) < 0.9 && Math.abs(gx - bump.x) < RD
            : Math.abs(gx - bump.x) < 0.9 && Math.abs(gz - bump.z) < RD;
          if (inside && !bump.in && Math.abs(p.v) > 1 && p.y < 0.3) {
            p.hop(p.v);
            if (Math.abs(p.v) > COLLISION.bumpFastSpeed) p.v *= COLLISION.bumpSlowdown;
          }
          bump.in = inside;
        }
      }
    }
  }

  /** True if the car hits a parked car. */
  parkedCars(p) {
    const [gx, gz] = toGrid(p.x, p.z);
    const ci = Math.floor(gx / C), cj = Math.floor(gz / C), off = COLLISION.capsuleOffset;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const list = this.chunks.parked.get((ci + a) + ',' + (cj + b));
        if (!list) continue;
        for (const car of list) {
          if (Math.abs(car.x - gx) > 9 || Math.abs(car.z - gz) > 9) continue;
          for (const [wx, wz] of capsulePoints(p.x, p.z, p.h, off)) {
            const [qx, qz] = toGrid(wx, wz);
            for (const o of [-off, 0, off]) {
              if (Math.hypot(qx - (car.x + car.hx * o), qz - (car.z + car.hz * o)) < COLLISION.carHitDistance) return true;
            }
          }
        }
      }
    }
    return false;
  }

  /** True if the car hits a moving car. A car that is behind you (and you're not reversing) can't crash into you. */
  traffic(p, cars) {
    const off = COLLISION.capsuleOffset, mine = capsulePoints(p.x, p.z, p.h, off);
    for (const o of cars) {
      if (!o.on || Math.abs(o.wx - p.x) > 9 || Math.abs(o.wz - p.z) > 9) continue;
      if ((o.wx - p.x) * Math.sin(p.h) + (o.wz - p.z) * Math.cos(p.h) < 0 && p.v > -1) continue;
      for (const [ax, az] of mine) {
        for (const [bx, bz] of capsulePoints(o.wx, o.wz, o.wh, off)) {
          if (Math.hypot(ax - bx, az - bz) < COLLISION.carHitDistance) return true;
        }
      }
    }
    return false;
  }
}
