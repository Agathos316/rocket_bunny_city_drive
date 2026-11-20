/**
 * Car body geometry: lofted shells and the five model profiles.
 *
 * A body is described by stations [z, halfWidth, yBottom, yTop] from tail (-z) to nose (+z). loft() sweeps a
 * rounded cross-section through them. Each model has a body shell (b), glass cabin (c), roof panel (r) and
 * a few numbers that position its lights, wing and fenders. All five carry the Rocket Bunny widebody kit.
 */
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Sweep a superellipse cross-section through stations. `n` sets how square the section is (2 = oval).
 * Vertex colours darken the underside so the body reads as 3D.
 */
export function loft(stations, segments, n) {
  const pos = [], idx = [], col = [], L = stations.length;
  stations.forEach(([z, w, y0, y1]) => {
    const cy = (y0 + y1) / 2, hy = (y1 - y0) / 2;
    for (let k = 0; k < segments; k++) {
      const a = k / segments * 6.2832, c = Math.cos(a), s = Math.sin(a);
      pos.push(Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * w, cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * hy, z);
      const b = 0.35 + 0.65 * Math.pow(s * 0.5 + 0.5, 0.9);
      col.push(b, b, b);
    }
  });
  for (let i = 0; i < L - 1; i++) {
    for (let k = 0; k < segments; k++) {
      const a = i * segments + k, b = i * segments + (k + 1) % segments;
      idx.push(a, b, a + segments, b, b + segments, a + segments);
    }
  }
  for (const [i, flip] of [[0, 1], [L - 1, 0]]) {   // end caps
    const c = pos.length / 3, [z, , y0, y1] = stations[i];
    pos.push(0, (y0 + y1) / 2, z); col.push(0.7, 0.7, 0.7);
    for (let k = 0; k < segments; k++) {
      const a = i * segments + k, b = i * segments + (k + 1) % segments;
      flip ? idx.push(c, b, a) : idx.push(c, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Thin racing-stripe shell hugging the body line. Needs a uv attribute to merge with other flat-coloured parts. */
function stripe(points) {
  const g = loft(points.map(([z, y]) => [z, 0.12, y - 0.03, y + 0.012]), 10, 2.2);
  g.deleteAttribute('color');
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

/** Silver rim lips and spokes on both faces of a wheel. */
function wheelFace() {
  const parts = [];
  for (const sx of [-1, 1]) {
    const t = new THREE.TorusGeometry(0.26, 0.03, 6, 20).rotateY(Math.PI / 2);
    t.translate(sx * 0.125, 0, 0);
    parts.push(t);
    for (let k = 0; k < 5; k++) {
      const b = new THREE.BoxGeometry(0.03, 0.5, 0.045);
      b.rotateX(k * Math.PI / 5);
      b.translate(sx * 0.125, 0, 0);
      parts.push(b);
    }
  }
  return BufferGeometryUtils.mergeBufferGeometries(parts);
}

let cache = null;
export function getCarGeometry() {
  return cache || (cache = build());
}

function build() {
  const shared = {
    arch: new THREE.CylinderGeometry(0.5, 0.5, 0.38, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),   // flared over-fender
    lip: new THREE.TorusGeometry(0.5, 0.045, 6, 20, Math.PI).rotateY(Math.PI / 2),
    tire: new THREE.TorusGeometry(0.27, 0.1, 10, 24).rotateY(Math.PI / 2),
    rim: wheelFace(),
    disc: new THREE.CylinderGeometry(0.26, 0.26, 0.22, 20).rotateZ(Math.PI / 2),
  };

  const supra = {
    b: loft([[-2.2, .74, .36, .78], [-2, .92, .32, .92], [-1.4, 1, .29, .95], [-.2, 1, .27, .9], [.9, .98, .27, .82], [1.6, .92, .27, .68], [2, .8, .27, .56], [2.22, .62, .3, .46]], 22, 3),
    c: loft([[-1.55, .55, .84, .9], [-1.2, .7, .84, 1.08], [-.5, .78, .84, 1.26], [.2, .76, .84, 1.28], [.7, .68, .84, 1.1], [1.05, .54, .84, .9]], 16, 2.4),
    r: loft([[-1.1, .5, 1.08, 1.1], [-.5, .6, 1.245, 1.27], [.15, .58, 1.265, 1.29], [.6, .5, 1.1, 1.12]], 16, 2.6),
    F: 2.22, B: -2.2, sw: 1.6, wy: 1.4, wz: -2, hl: [.22, .075], hy: .53, tl: .34, ty: .78, mz: .45,
    fh: .8, rh: .94, bz: -.1,
  };
  const mustang = {
    b: loft([[-2.4, .8, .34, .82], [-2.2, .96, .3, .9], [-1.5, 1.03, .28, .94], [-.3, 1.03, .27, .92], [1, 1.02, .27, .9], [1.9, .98, .27, .84], [2.3, .9, .3, .74], [2.42, .8, .34, .6]], 22, 3.2),
    c: loft([[-2, .6, .86, .92], [-1.6, .74, .86, 1.1], [-.8, .8, .86, 1.27], [0, .78, .86, 1.3], [.5, .7, .86, 1.1], [.85, .56, .86, .92]], 16, 2.4),
    r: loft([[-1.7, .5, 1.1, 1.12], [-.8, .65, 1.265, 1.29], [-.1, .63, 1.285, 1.31], [.35, .5, 1.1, 1.13]], 16, 2.6),
    F: 2.42, B: -2.4, sw: 1.75, wy: 1.32, wz: -2.2, hl: [.2, .09], hy: .68, tl: .42, ty: .76, mz: .1,
    fh: .88, rh: .92, bz: -.35,
    stripes: [
      stripe([[1.05, .9], [1.9, .84], [2.3, .75]]),
      stripe([[-1.6, 1.12], [-.8, 1.29], [-.1, 1.31], [.35, 1.13]]),
      stripe([[-2.3, .86], [-2.2, .9], [-1.5, .94], [-1.1, .94]]),
    ],
  };
  const porsche = {
    b: loft([[-2.2, .8, .34, .84], [-2, .98, .3, .98], [-1.3, 1.02, .28, 1], [-.2, 1, .27, .82], [1, .95, .27, .7], [1.8, .88, .27, .6], [2.1, .74, .29, .5], [2.2, .58, .32, .42]], 22, 3),
    c: loft([[-1.7, .5, .84, .92], [-1.3, .66, .84, 1.12], [-.5, .76, .84, 1.28], [.3, .74, .84, 1.26], [.8, .66, .84, 1.05], [1.1, .52, .84, .86]], 16, 2.4),
    r: loft([[-1.2, .48, 1.1, 1.12], [-.5, .6, 1.245, 1.27], [.2, .58, 1.24, 1.265], [.7, .5, 1.05, 1.07]], 16, 2.6),
    F: 2.2, B: -2.2, sw: 1.6, wy: 1.38, wz: -2.05, hl: [.15, .15], hy: .6, tl: .12, ty: .8, mz: .4,
    fh: .66, rh: 1, bz: -.15,
  };
  const gtr = {
    b: loft([[-2.3, .82, .34, .86], [-2.1, .98, .3, .96], [-1.4, 1.03, .28, .98], [-.2, 1.03, .27, .94], [1, 1.02, .27, .88], [1.9, .96, .27, .76], [2.25, .82, .3, .6], [2.35, .7, .34, .5]], 22, 3.2),
    c: loft([[-1.5, .6, .86, .94], [-1.2, .74, .86, 1.12], [-.5, .8, .86, 1.28], [.4, .78, .86, 1.3], [.85, .7, .86, 1.12], [1.15, .56, .86, .94]], 16, 2.4),
    r: loft([[-1.2, .5, 1.1, 1.12], [-.5, .65, 1.265, 1.29], [.1, .64, 1.285, 1.31], [.55, .5, 1.1, 1.13]], 16, 2.6),
    F: 2.35, B: -2.3, sw: 1.75, wy: 1.42, wz: -2.1, hl: [.2, .07], hy: .66, tl: .1, ty: .8, mz: .3,
    fh: .86, rh: .98, bz: -.1,
  };
  const civic = {
    b: loft([[-2.15, .8, .34, .9], [-1.9, .96, .3, .96], [-1.2, 1, .28, .94], [0, 1, .27, .88], [1, .97, .27, .78], [1.8, .9, .27, .64], [2.1, .76, .28, .5], [2.2, .62, .32, .44]], 22, 3),
    c: loft([[-1.9, .62, .84, .95], [-1.6, .72, .84, 1.2], [-.7, .78, .84, 1.35], [.3, .76, .84, 1.34], [.8, .68, .84, 1.12], [1.1, .54, .84, .9]], 16, 2.4),
    r: loft([[-1.5, .5, 1.2, 1.22], [-.7, .65, 1.325, 1.35], [.2, .63, 1.32, 1.345], [.65, .5, 1.1, 1.13]], 16, 2.6),
    F: 2.2, B: -2.15, sw: 1.6, wy: 1.52, wz: -2.05, hl: [.2, .07], hy: .6, tl: .24, ty: .84, mz: .35,
    fh: .76, rh: .94, bz: -.2,
  };

  return { shared, models: { supra, mustang, porsche, gtr, civic } };
}
