/**
 * Trees: a small library of varied, vertex-coloured tree geometries built once and reused (scaled and turned) by
 * the city and highway cells. Each is a tapered trunk with a root flare and a few branches, under either a
 * broadleaf crown (a cluster of lumpy foliage masses, lighter on top and darker underneath, with leaf-level
 * colour speckle) or a conifer (stacked, drooping skirts). All share one material (mats.tree, vertex colours).
 *
 * Geometry is non-indexed with position, normal and colour only, so any mix merges in the Batcher.
 */
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../util/math.js';

let cache = null;
/** { broadleaf: [geometry x4], conifer: [geometry x2] } — each about 1 unit of crown radius, trunk base at y = 0. */
export function getTrees() {
  return cache || (cache = { broadleaf: [11, 23, 37, 51].map((s, k) => broadleaf(s, k)), conifer: [71, 89].map(conifer) });
}

function paint(geo, colorAt) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    colorAt(col, p.getX(i), p.getY(i), p.getZ(i), i);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

const finish = (geo) => {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
};

/** Tapered, slightly curved trunk with a flared base, plus optional branches, all bark-coloured. */
function trunk(rand, height, radius, branches, branchTopY) {
  const parts = [];
  const t = new THREE.CylinderGeometry(radius * 0.55, radius, height, 7, 3, true);
  t.translate(0, height / 2, 0);
  const tp = t.attributes.position;
  for (let i = 0; i < tp.count; i++) {                            // root flare and a gentle lean
    const y = tp.getY(i), w = 1 + 0.9 * Math.pow(Math.max(0, 1 - y / (height * 0.18)), 2);
    tp.setX(i, tp.getX(i) * w + Math.sin(y * 0.9) * 0.05);
    tp.setZ(i, tp.getZ(i) * w);
  }
  parts.push(t);
  for (let b = 0; b < branches; b++) {
    const a = rand() * 6.283, len = height * (0.35 + rand() * 0.25), y0 = height * (0.55 + rand() * 0.3);
    const br = new THREE.CylinderGeometry(radius * 0.12, radius * 0.3, len, 5, 1, true);
    br.translate(0, len / 2, 0);
    br.rotateZ(0.7 + rand() * 0.4);
    br.rotateY(a);
    br.translate(0, y0, 0);
    parts.push(br);
  }
  const g = BufferGeometryUtils.mergeBufferGeometries(parts.map((q) => finish(q)));
  g.computeVertexNormals();
  return paint(g, (c, x, y, z) => { const v = 0.85 + 0.3 * Math.sin(x * 23 + z * 17 + y * 5); c.setRGB(0.27 * v, 0.19 * v, 0.12 * v); });
}

/** A lumpy foliage mass: a subdivided icosahedron with noise-displaced vertices, flattened a little underneath. */
function lobe(rand, radius, cx, cy, cz, hue) {
  const g = new THREE.IcosahedronGeometry(1, 2);                  // (already non-indexed)
  const p = g.attributes.position, seed = rand() * 100;
  for (let i = 0; i < p.count; i += 3) {                          // vertices are displaced by position, so shared corners stay joined
    for (let k = 0; k < 3; k++) {
      const vx = p.getX(i + k), vy = p.getY(i + k), vz = p.getZ(i + k);
      const m = 1 + 0.28 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.7 + seed * 0.7) + 0.2 * Math.sin(vy * 4.3 + seed * 1.3);
      p.setXYZ(i + k, vx * m * radius + cx, (vy < 0 ? vy * 0.72 : vy) * m * radius + cy, vz * m * radius + cz);
    }
  }
  g.computeVertexNormals();
  const tint = hue;
  return paint(g, (c, x, y, z, i) => {
    const top = Math.min(1, Math.max(0, (y - cy) / radius * 0.5 + 0.5));            // lighter on top, darker underneath
    const h = Math.sin((i / 3 | 0) * 12.9898 + seed) * 43758.5453, speck = 0.88 + 0.24 * (h - Math.floor(h));   // per-face colour speckle
    const k = (0.55 + 0.6 * top) * speck;
    c.setRGB((0.17 + tint[0]) * k, (0.4 + tint[1]) * k, (0.14 + tint[2]) * k);
  });
}

function broadleaf(seed, variant) {
  const rand = rng(seed);
  const hue = [[0.0, 0.05, 0.0], [0.06, 0.04, -0.02], [-0.03, 0.0, 0.03], [0.1, 0.02, -0.04]][variant % 4];
  const H = 1.9 + rand() * 0.4;                                  // trunk height under the crown, in crown radii
  const parts = [trunk(rand, H * 1.15, 0.13, 3, H)];
  const n = 5 + (variant % 2);
  for (let i = 0; i < n; i++) {                                  // masses arranged around and above the trunk top
    const a = i / n * 6.283 + rand(), r = i === 0 ? 0 : 0.45 + rand() * 0.35;
    parts.push(lobe(rand, 0.62 + rand() * 0.32, Math.cos(a) * r, H + 0.35 + rand() * 0.55 + (i === 0 ? 0.55 : 0), Math.sin(a) * r, hue));
  }
  return BufferGeometryUtils.mergeBufferGeometries(parts.map(finish));
}

function conifer(seed) {
  const rand = rng(seed);
  const parts = [trunk(rand, 1.6, 0.12, 0, 0)];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1), r = 1.15 * (1 - f * 0.78), h = 1.5 - f * 0.4, y = 0.9 + f * 2.9;
    const cone = new THREE.ConeGeometry(r, h, 9, 2, true).toNonIndexed();
    const p = cone.attributes.position, seedI = rand() * 50;
    for (let k = 0; k < p.count; k++) {                          // ragged, drooping skirt edge
      const x = p.getX(k), z = p.getZ(k), edge = Math.max(0, -p.getY(k) / (h / 2));
      p.setXYZ(k, x * (1 + 0.12 * Math.sin(Math.atan2(z, x) * 5 + seedI) * edge), p.getY(k) - 0.18 * edge * edge + y, z * (1 + 0.12 * Math.cos(Math.atan2(z, x) * 5 + seedI) * edge));
    }
    cone.computeVertexNormals();
    parts.push(paint(cone, (c, x, yy) => { const k = 0.5 + 0.55 * f + 0.25 * Math.max(0, (yy - y) / h); c.setRGB(0.07 * k * 2, 0.24 * k * 1.6, 0.11 * k * 1.7); }));
  }
  return BufferGeometryUtils.mergeBufferGeometries(parts.map(finish));
}
