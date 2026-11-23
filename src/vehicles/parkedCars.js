/**
 * Parked cars: ordinary cars from the glTF kit once it has loaded; until then (and as a fallback) a cheap version of
 * each sports-car model with its colour baked into vertex colours, so a whole
 * kerb of them merges into the city cell's mesh. Geometry for each model is built once and reused.
 */
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from '../config.js';
import { getAssets } from '../assets.js';
import { getGeoms } from '../world/geometries.js';
import { getCarGeometry } from './carModels.js';
import { getParkedGeometry, parkedMaterial, parkedNames } from './gltfCar.js';

const UP = new THREE.Vector3(0, 1, 0);
const cache = {};
let wheelCyl = null;

function colourAttribute(geo, r, g, b) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let q = 0; q < n; q++) { a[q * 3] = r; a[q * 3 + 1] = g; a[q * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
}

/** Two merged pieces per model: `paint` (tinted with the car colour) and `fixed` (glass, tyres, lamps). */
function parkedGeometry(name) {
  if (cache[name]) return cache[name];
  const G = getGeoms();
  const { shared, models } = getCarGeometry();
  const D = models[name];
  const S = CAR.scale, paint = [], fixed = [];
  wheelCyl = wheelCyl || new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2);

  const add = (geo, list, rgb, sx, sy, sz, x, y, z) => {
    const q = geo.clone();
    q.deleteAttribute('uv');
    q.scale(sx * S, sy * S, sz * S);
    q.translate(x * S, y * S, z * S);
    if (rgb) colourAttribute(q, rgb[0], rgb[1], rgb[2]);
    else if (!q.attributes.color) colourAttribute(q, 0.85, 0.85, 0.85);
    list.push(q);
  };

  add(D.b, paint, 0, 1, 1, 1, 0, 0, 0); add(D.r, paint, 0, 1, 1, 1, 0, 0, 0);
  add(D.c, fixed, [.05, .09, .14], 1, 1, 1, 0, 0, 0);
  add(G.sph, paint, 0, 1.05, .035, .3, 0, D.wy, D.wz);                                      // wing blade
  add(G.box, fixed, [.07, .07, .08], D.sw, .05, .42, 0, .22, D.F - .14);                    // splitter
  for (const s of [-1, 1]) {
    add(G.box, fixed, [1, .95, .75], .4, .1, .12, s * .62, D.hy, D.F - .18);                // headlights
    add(G.box, fixed, [1, .12, .1], D.tl * 1.5 + .2, .1, .08, s * .6, D.ty, D.B + .1);      // tail lights
    for (const f of [1, -1]) {
      add(shared.arch, paint, 0, 1, 1, 1, s * .99, .37, f * 1.38);                          // over-fender
      add(wheelCyl, fixed, [.06, .06, .06], .3, .37, .37, s * .98, .37, f * 1.38);          // tyre
      add(wheelCyl, fixed, [.8, .8, .82], .33, .26, .26, s * .98, .37, f * 1.38);           // rim
    }
  }
  return cache[name] = {
    paint: BufferGeometryUtils.mergeBufferGeometries(paint),
    fixed: BufferGeometryUtils.mergeBufferGeometries(fixed),
  };
}

/** Add a parked car of the given model and colour to a Batcher, at grid position (x, z) facing `ry`. */
export function putParkedCar(batcher, name, color, x, z, ry) {
  const names = parkedNames();
  if (names.length) {                                   // ordinary cars from the Kenney kit, picked by position so a kerb has a mix
    const pick = names[Math.abs(Math.floor(x * 7 + z * 13)) % names.length];
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(1, 1, 1));
    batcher.add(parkedMaterial(), getParkedGeometry(pick).clone().applyMatrix4(m));
    return;
  }
  const pg = parkedGeometry(name);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(1, 1, 1));
  const tint = new THREE.Color(color);
  const paint = pg.paint.clone().applyMatrix4(m), ca = paint.attributes.color;
  for (let q = 0; q < ca.count; q++) ca.setXYZ(q, ca.getX(q) * tint.r, ca.getY(q) * tint.g, ca.getZ(q) * tint.b);
  batcher.add(getAssets().mats.parkedPaint, paint, pg.fixed.clone().applyMatrix4(m));
}
