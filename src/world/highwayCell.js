/**
 * One highway cell: rolling terrain (grass or desert), roads on every third grid line, tunnels where a hill
 * covers the road, bridges where the ground drops away, interchanges with sweeping corner ramps, and scenery.
 *
 * Deterministic per (i, j); the rand() call order matters. Grid coordinates; bent into world space by the chunk manager.
 */
import * as THREE from 'three';
import { C, RD } from '../config.js';
import { rng } from '../util/math.js';
import { Batcher } from '../util/batcher.js';
import { getAssets } from '../assets.js';
import { getGeoms } from './geometries.js';
import { Fe, Gh, Hr, dzf, isDesert, roadAt } from './zones.js';
import { ribbon, terrainGeometry } from './surfaces.js';
import { getTrees } from './trees.js';
import { buildTown, townHouses } from './town.js';

export function generateHighway(i, j) {
  const { mats, castsShadow } = getAssets();
  const G = getGeoms();
  const group = new THREE.Group(), owned = [], batch = new Batcher();
  const put = batch.put.bind(batch);
  const x0 = i * C, z0 = j * C;
  const rand = rng(i * 374761393 ^ j * 668265263 ^ 91);
  const desert = isDesert(i, j);

  const addMesh = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    group.add(m);
    owned.push(geo);
  };
  addMesh(terrainGeometry(x0, z0, desert), mats.terrain);

  for (const axis of ['x', 'z']) {
    if (!roadAt(i, j, axis)) continue;
    const X = axis === 'x';
    addMesh(ribbon(X, x0, z0, 0, C, RD, 0.06), desert ? mats.desertRoad : mats.highway);
    addMesh(ribbon(X, x0, z0, 8, C - 8, 0.17, 0.12), mats.dashLine);

    // a tunnel is anywhere the hill covers the road, or the road's edges (+-2.7)
    const tunnelAt = (t) => {
      const x = X ? x0 + t : x0, z = X ? z0 : z0 + t;
      return [0, -2.7, 2.7].some((o) => dzf(Fe(X ? x + o : x, X ? z : z + o)) > 0.05);
    };
    for (let k = 0; k < 20; k++) {
      const t = k * 5 + 2.5, x = X ? x0 + t : x0, z = X ? z0 : z0 + t;
      const R = Hr(x, z), ground = Gh(x, z), dz = dzf(Fe(x, z));
      const inTunnel = tunnelAt(t);
      if (inTunnel) {                     // concrete portal face where a tunnel starts or ends
        for (const e of [-1, 1]) {
          if (tunnelAt(t + e * 5)) continue;
          const pt = t + e * 2.5, px = X ? x0 + pt : x0, pz = X ? z0 : z0 + pt;
          put(G.portal, mats.concrete, px, Hr(px, pz), pz, 1, 1, 1, X ? Math.PI / 2 : 0);
        }
      }
      if (dz > 0.05 || inTunnel) {
        put(G.tunnel, mats.concrete, x, R, z, 1, 1, 1, X ? Math.PI / 2 : 0);   // tunnel slice
      } else if (R - ground > 2.5) {      // bridge: deck, rails, piers
        put(G.box, mats.concrete, x, R - 0.6, z, X ? 5.4 : 18, 1.2, X ? 18 : 5.4);
        put(G.box, mats.concrete, X ? x : x - 8.9, R + 0.45, X ? z - 8.9 : z, X ? 5.4 : 0.3, 0.9, X ? 0.3 : 5.4);
        put(G.box, mats.concrete, X ? x : x + 8.9, R + 0.45, X ? z + 8.9 : z, X ? 5.4 : 0.3, 0.9, X ? 0.3 : 5.4);
        if (k % 3 === 0) put(G.cyl, mats.concrete, x, (ground + R - 1.2) / 2, z, 1.6, R - ground - 1.2, 1.6);
      }
    }
  }

  // interchange: junction plus four large sweeping corner ramps
  if (roadAt(i, j, 'x') && roadAt(i, j, 'z')) {
    put(G.junction, mats.interchange, x0, 0, z0);
    for (let k = 0; k < 4; k++) put(G.interchangeRamp, mats.interchange, x0, 0, z0, 1, 1, 1, k * Math.PI / 2);
  }

  // towns: houses (nothing is drawn or removed unless this is a town cell)
  const houses = townHouses(i, j);
  const nearHouse = (x, z) => houses.some((h) => Math.abs(x - h.x) < h.hw + 3 && Math.abs(z - h.z) < h.hd + 3);
  buildTown(batch, houses);

  // scenery: trees and rocks, or cacti and rocks in the desert
  for (let n = 0; n < 10; n++) {
    const x = x0 + 20 + rand() * (C - 40), z = z0 + 20 + rand() * (C - 40), y = Gh(x, z);
    const s = 1.6 + rand() * 1.2, hh = 2.5 + rand() * 1.5;
    if (houses.length && nearHouse(x, z)) { if (!desert) rand(); continue; }   // (keeps the draw order, so nothing else moves)
    if (desert) {
      if (n % 2) {
        put(G.cyl, mats.cactus, x, y + hh / 2, z, 0.45, hh, 0.45);
        put(G.cyl, mats.cactus, x + 0.9, y + hh * 0.6, z, 0.28, hh * 0.45, 0.28);
      } else {
        put(G.leaf, mats.rock, x, y + s * 0.3, z, s * 1.4, s * 0.7, s);
      }
    } else {
      const pick = rand() * 3 | 0, trees = getTrees(), k = s * 0.58 + hh * 0.08;
      put(pick === 2 ? trees.conifer[n & 1] : trees.broadleaf[(n + pick) % 4], mats.tree, x, y - 0.1, z, k, k * (0.9 + hh * 0.1), k, n * 2.1);
    }
  }

  // the interchange surface rides on the road grade, so lift each vertex to it
  batch.build(group, owned, castsShadow, (mat, geo) => {
    if (mat !== mats.interchange) return;
    const p = geo.attributes.position;
    for (let q = 0; q < p.count; q++) p.setY(q, Hr(p.getX(q), p.getZ(q)) + 0.07);
  });

  return { group, owned, bumps: [], parked: null, houses };
}
