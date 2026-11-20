/**
 * Ground surfaces that follow the terrain: the highway terrain grid and road ribbons.
 */
import * as THREE from 'three';
import { C } from '../config.js';
import { clamp } from '../util/math.js';
import { Gt, Hr, tunnelFlag, tunnelWeight } from './zones.js';

/**
 * One cell of terrain (20 x 20 quads). Vertex colours give grass, rock or desert sand; the hillside is
 * cut open wherever a tunnel mouth meets an open road cutting so you can see into the tunnel.
 */
export function terrainGeometry(x0, z0, desert) {
  const N = 20, step = C / N, pos = [], nor = [], col = [], idx = [];
  for (let a = 0; a <= N; a++) {
    for (let b = 0; b <= N; b++) {
      const x = x0 + a * step, z = z0 + b * step, y = Gt(x, z);
      const nx = Gt(x - 1, z) - Gt(x + 1, z), nz = Gt(x, z - 1) - Gt(x, z + 1), l = Math.hypot(nx, 2, nz);
      const t = clamp(y / 40, 0, 1), rk = clamp((y - 26) / 14, 0, 1), tw = tunnelWeight(x, z);
      let cr = 0.2 + 0.3 * t + 0.3 * rk, cg = 0.5 + 0.1 * t - 0.1 * rk, cb = 0.17 + 0.1 * t + 0.25 * rk;
      if (desert) { cr = 0.82 - 0.25 * t - 0.1 * rk; cg = 0.66 - 0.22 * t - 0.1 * rk; cb = 0.4 - 0.12 * t; }
      pos.push(x, y, z);
      nor.push(nx / l, 2 / l, nz / l);
      col.push(cr + (0.45 - cr) * tw, cg + (0.44 - cg) * tw, cb + (0.43 - cb) * tw);
    }
  }
  const flags = [];
  for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) flags.push(tunnelFlag(x0 + a * step, z0 + b * step));
  // drop triangles that would bridge from the cut road level up onto a tunnel roof (they'd seal the tunnel mouth)
  const tri = (p, q, w) => {
    const f = [flags[p], flags[q], flags[w]];
    if (!(f.includes(1) && f.includes(-1))) idx.push(p, q, w);
  };
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const p = a * (N + 1) + b;
      tri(p, p + 1, p + N + 1);
      tri(p + 1, p + N + 2, p + N + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/**
 * A road strip of half-width `w` that follows the road-grade height (or a custom height function `heightAt`).
 * X = true runs along x, otherwise along z. Subdivided into 20 pieces so it bends with the world.
 */
export function ribbon(X, x0, z0, t0, t1, w, lift, heightAt) {
  const N = 20, pos = [], nor = [], uv = [], idx = [];
  for (let k = 0; k <= N; k++) {
    const t = t0 + (t1 - t0) * k / N;
    for (const s of [-1, 1]) {
      const x = X ? x0 + t : x0 + s * w, z = X ? z0 + s * w : z0 + t;
      pos.push(x, (heightAt ? heightAt(x, z) : Hr(x, z)) + lift, z);
      nor.push(0, 1, 0);
      uv.push(k / N, s > 0 ? 1 : 0);
    }
  }
  for (let k = 0; k < N; k++) {
    const a = k * 2;
    X ? idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
