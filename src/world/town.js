/**
 * Towns: one and two storey houses on the green highway cells just before the next city.
 *
 * townHouses(i, j) is pure and deterministic (it only needs the cell position), so the same list drives the
 * drawing (buildTown) and the collisions (every house is a solid axis-aligned box in grid space).
 */
import * as THREE from 'three';
import { C, INTERCHANGE_SPACING } from '../config.js';
import { rng } from '../util/math.js';
import { getAssets } from '../assets.js';
import { getGeoms } from './geometries.js';
import { Gt, isHwy, isTown, roadAt } from './zones.js';

const LOT = 24;                      // house lots sit on a 24 m lattice
const STOREY = 3.2;
const ROAD_GAP = 27;                 // lot centres stay this far from a road line (road, shoulder, cutting, then a garden)
const EDGE_GAP = 14;                 // ...and this far from a cell edge that has no road, so neighbouring lots never touch

/**
 * The houses of town cell (i, j): [{ x, z, hw, hd, ry, w, d, storeys, wall, roof, base, top, door, chimney }].
 * (x, z) is the centre in grid coordinates, hw/hd the half-sizes along x/z after turning, ry the turn (a multiple of 90 degrees).
 */
export function townHouses(i, j) {
  if (!isTown(i, j)) return [];
  const x0 = i * C, z0 = j * C, rand = rng(i * 1274126177 ^ j * 668265263 ^ 4242), out = [];
  const lo = (road) => road ? ROAD_GAP : EDGE_GAP, hi = (road) => C - lo(road);
  const xl = lo(roadAt(i, j, 'z')), xh = hi(roadAt(i + 1, j, 'z')), zl = lo(roadAt(i, j, 'x')), zh = hi(roadAt(i, j + 1, 'x'));
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      // draw first, then decide: the number of rand() calls per lot is fixed so lots do not shift when a neighbour is skipped
      const ox = (rand() - 0.5) * 5, oz = (rand() - 0.5) * 5, pick = rand(), tall = rand() < 0.45, k = rand() * 4 | 0;
      const wall = rand() * 6 | 0, roof = rand() * 3 | 0, wide = rand() < 0.4, deep = rand() < 0.3, chim = rand() < 0.6, side = rand() < 0.5 ? -1 : 1;
      const rx = 14 + a * LOT + ox, rz = 14 + b * LOT + oz;
      if (rx < xl || rx > xh || rz < zl || rz > zh || pick < 0.18) continue;           // a few empty plots: fields between the houses
      const x = x0 + rx, z = z0 + rz;
      const nx = Math.round(x / INTERCHANGE_SPACING) * INTERCHANGE_SPACING, nz = Math.round(z / INTERCHANGE_SPACING) * INTERCHANGE_SPACING;
      if (isHwy(nx / C, nz / C) && roadAt(nx / C, nz / C, 'x') && roadAt(nx / C, nz / C, 'z') && Math.max(Math.abs(x - nx), Math.abs(z - nz)) < 56) continue;   // the interchange's earthworks
      const w = wide ? 15 : 10, d = deep ? 15 : 10, turned = k & 1, hw = (turned ? d : w) / 2, hd = (turned ? w : d) / 2;
      const hs = [Gt(x - hw, z - hd), Gt(x + hw, z - hd), Gt(x - hw, z + hd), Gt(x + hw, z + hd)];
      const top = Math.max(...hs), bottom = Math.min(...hs);
      if (top - bottom > 3.2) continue;                                                // too steep to build on
      out.push({ x, z, hw, hd, ry: k * Math.PI / 2, w, d, storeys: tall ? 2 : 1, wall, roof, base: bottom, top, door: side, chimney: chim });
    }
  }
  return out;
}

/** Draw the houses into a Batcher (grid coordinates; the chunk manager bends the cell afterwards). */
export function buildTown(batch, houses) {
  const { mats } = getAssets();
  const G = getGeoms();
  const put = batch.put.bind(batch);
  for (const h of houses) {
    const wallH = h.storeys * STOREY, y0 = h.top + 0.35, roofH = 2.4 + 0.5 * (h.w + h.d - 20) / 5;
    // plinth: reaches down to the lowest corner so the house never floats on a slope
    put(G.box, mats.houseBase, h.x, (y0 + h.base - 0.6) / 2, h.z, 2 * h.hw + 0.4, y0 - h.base + 0.6, 2 * h.hd + 0.4);
    // walls: the window texture is tiled to the wall's size (5 m per window across, one row per storey)
    const body = new THREE.BoxGeometry(h.w, wallH, h.d), uv = body.attributes.uv;
    for (let q = 0; q < uv.count; q++) {
      const face = q >> 2, su = (face < 2 ? h.d : h.w) / 5;
      uv.setXY(q, uv.getX(q) * su, uv.getY(q) * h.storeys);
    }
    body.rotateY(h.ry).translate(h.x, y0 + wallH / 2, h.z);
    batch.add(mats.houseWalls[h.wall], body);
    // gable roof, ridge along the depth, with a small overhang
    put(G.gable, mats.houseRoofs[h.roof], h.x, y0 + wallH, h.z, h.w + 1.2, roofH, h.d + 1.2, h.ry);
    // front door (the +z face before turning) and its step, offset from the window columns
    const c = Math.cos(h.ry), s = Math.sin(h.ry), lx = h.w === 15 ? 2.5 * h.door : 0, lz = h.d / 2 + 0.06;
    const dx = h.x + lx * c + lz * s, dz = h.z - lx * s + lz * c;
    put(G.box, mats.houseDoor, dx, y0 + 1.05, dz, 1.1, 2.1, 0.16, h.ry);
    put(G.box, mats.houseBase, dx + 0.6 * s, y0 - 0.1, dz + 0.6 * c, 2.2, 0.3, 1.4, h.ry);
    if (h.chimney) {                                   // on the ridge, a little way along it
      const cl = h.d / 4, ch = roofH + 1.2;
      put(G.box, mats.chimney, h.x + cl * s, y0 + wallH + ch / 2 - 0.1, h.z + cl * c, 0.9, ch, 0.9);
    }
  }
}
