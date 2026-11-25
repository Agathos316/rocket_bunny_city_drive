/**
 * Where people walk, as pure functions of (cell, time): nothing is stored, so a person is always exactly where the
 * clock says, and the same cell always has the same people.
 *
 *   city cells   4 people strolling round the footpath that rings the block (the car can never reach the footpath)
 *   town cells   someone in the front garden of about every second house, pacing to and fro (the car can hit them)
 */
import { C, RD, PK } from '../config.js';
import { rng } from '../util/math.js';
import { Gt, isHwy, isRiver, isStn, isTown } from './zones.js';
import { townHouses } from './town.js';

const WALK = 1.4;                                  // m/s
const LOOP_HALF = C / 2 - RD - PK - 2.5;           // the footpath's middle line, clear of the street trees
const SHIRTS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xecf0f1, 0xe67e22, 0x1abc9c];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4a3a, 0x1b1b1f, 0x4b6584];
const SKIN = [0xf1c8a5, 0xd9a07a, 0xb97a56, 0x8a5a3c, 0x5c3b28];

function look(rand) {
  return { shirt: SHIRTS[rand() * SHIRTS.length | 0], pants: PANTS[rand() * PANTS.length | 0], skin: SKIN[rand() * SKIN.length | 0], height: 0.92 + rand() * 0.18 };
}

/** The walkers of cell (i, j): [{ kind, ..., shirt, pants, skin, height, solid }] */
export function walkersFor(i, j) {
  const out = [], rand = rng(i * 2246822519 ^ j * 3266489917 ^ 99);
  if (isTown(i, j)) {
    townHouses(i, j).forEach((h, n) => {
      const r = rand(), who = look(rand);
      if (r < 0.5) return;
      const s = Math.sin(h.ry), c = Math.cos(h.ry), out2 = h.d / 2 + 4.5 + r * 3;     // in front of the door, local +z
      out.push({ kind: 'line', ax: h.x + out2 * s - 4 * c, az: h.z + out2 * c + 4 * s, bx: h.x + out2 * s + 4 * c, bz: h.z + out2 * c - 4 * s, phase: rand() * 20, solid: true, ...who });
    });
  } else if (!isHwy(i, j) && !isRiver(i, j) && !isStn(i, j)) {
    for (let n = 0; n < 4; n++) out.push({ kind: 'loop', cx: i * C + C / 2, cz: j * C + C / 2, phase: rand(), dir: rand() < 0.5 ? -1 : 1, solid: false, ...look(rand) });
  }
  return out;
}

/** Position and heading (grid space) of walker w at time t: { x, z, y, hx, hz, step } where step is the walk-cycle phase. */
export function walkerAt(w, t, out = {}) {
  if (w.kind === 'loop') {
    const side = 2 * LOOP_HALF, L = 4 * side, s = (((w.phase * L + w.dir * WALK * t) % L) + L) % L, e = Math.min(3, s / side | 0), u = s - e * side - LOOP_HALF;
    // edges run anticlockwise: south (+x), east (+z), north (-x), west (-z)
    const px = [u, LOOP_HALF, -u, -LOOP_HALF][e], pz = [-LOOP_HALF, u, LOOP_HALF, -u][e];
    const dx = [1, 0, -1, 0][e] * w.dir, dz = [0, 1, 0, -1][e] * w.dir;
    out.x = w.cx + px; out.z = w.cz + pz; out.y = 0.3; out.hx = dx; out.hz = dz;
  } else {
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az), L = 2 * len, s = ((w.phase * WALK + WALK * t) % L), f = s < len ? s / len : 2 - s / len;
    out.x = w.ax + (w.bx - w.ax) * f; out.z = w.az + (w.bz - w.az) * f;
    const sg = s < len ? 1 : -1;
    out.hx = (w.bx - w.ax) / len * sg; out.hz = (w.bz - w.az) / len * sg;
    out.y = Gt(out.x, out.z);
  }
  out.step = t * WALK * 3.4 + w.phase * 7;
  return out;
}
