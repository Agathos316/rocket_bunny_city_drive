/**
 * Builds a car: body shell, glass, roof, Rocket Bunny widebody kit, model-specific details and four wheels.
 * Static parts are merged into a handful of meshes; wheels stay separate so they can spin and steer.
 *
 * makeCar() returns { root, tilt, spin, front }:
 *   root  - place and rotate this
 *   tilt  - body group; lean/pitch it for body roll
 *   spin  - wheel groups; rotate .x to spin
 *   front - front wheel pivots; rotate .y to steer
 */
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from '../config.js';
import { getAssets } from '../assets.js';
import { getGeoms } from '../world/geometries.js';
import { getCarGeometry } from './carModels.js';

/** Place a scaled copy of `geo` inside group `g`. */
function part(g, geo, mat, sx, sy, sz, x, y, z, rx) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  m.castShadow = true;
  g.add(m);
  return m;
}

/** Signature details per model: grilles, lamps, vents and so on. */
const DETAILS = {
  supra: (t, p, D) => {
    p(t, 'sph', 'dark', .62, .11, .12, 0, .4, 2.16); p(t, 'sph', 'dark', .28, .02, .5, 0, .72, 1.5); p(t, 'box', 'tail', 1.3, .04, .04, 0, .82, -2.18);
    for (const s of [-1, 1]) {
      p(t, 'sph', 'dark', .03, .09, .3, s * .995, .5, .95); p(t, 'sph', 'dark', .14, .07, .1, s * .78, .36, 2.1); p(t, 'box', 'lamp', .5, .03, .05, s * .55, .62, 2.08);
    }
  },
  mustang: (t, p) => {
    p(t, 'box', 'dark', 1.25, .17, .05, 0, .46, 2.42); p(t, 'sph', 'dark', .36, .03, .55, 0, .89, 1.55);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) p(t, 'box', 'tail', .1, .28, .05, s * (.28 + k * .17), .74, -2.38);   // tri-bar tail lamps
      p(t, 'box', 'lamp', .45, .03, .05, s * .62, .78, 2.36); p(t, 'sph', 'dark', .1, .1, .06, s * .78, .42, 2.36);
    }
  },
  porsche: (t, p) => {
    p(t, 'sph', 'dark', .5, .08, .12, 0, .38, 2.15); p(t, 'box', 'tail', 1.4, .05, .05, 0, .82, -2.18); p(t, 'box', 'dark', .8, .1, .02, 0, .9, -2.15);
    for (const s of [-1, 1]) { p(t, 'sph', 'dark', .2, .2, .04, s * .62, .6, 2.05); p(t, 'sph', 'lamp', .07, .07, .05, s * .62, .6, 2.1); }   // round LED lamps
  },
  gtr: (t, p) => {
    p(t, 'box', 'dark', 1, .22, .05, 0, .5, 2.33);
    for (const s of [-1, 1]) {
      for (const x of [.3, .55]) p(t, 'sph', 'tail', .16, .16, .05, s * x, .8, -2.28);   // four round tail lamps
      p(t, 'box', 'dark', .6, .04, .4, s * .25, .83, 1.5); p(t, 'box', 'dark', .03, .12, .3, s * 1.02, .6, .9);
    }
  },
  civic: (t, p) => {
    p(t, 'box', 'dark', 1.1, .18, .05, 0, .44, 2.18);
    for (let k = -1; k <= 1; k++) p(t, 'sph', 'dark', .09, .09, .05, k * .22, .3, -2.15);   // triple exhaust
    for (const s of [-1, 1]) p(t, 'sph', 'dark', .16, .08, .1, s * .78, .34, 2.14);
  },
};

export function makeCar(color, detail, modelName = CAR.defaultModel) {
  const { mats, car: M } = getAssets();
  const G = getGeoms();
  const { shared, models } = getCarGeometry();
  const D = models[modelName] || models[CAR.defaultModel];

  const root = new THREE.Group(), tilt = new THREE.Group();
  root.add(tilt);
  const body = M.paint(new THREE.Color(color).multiplyScalar(0.85));
  const bodyVC = M.paint(color);
  bodyVC.vertexColors = true;
  body.side = bodyVC.side = THREE.DoubleSide;
  root.scale.setScalar(CAR.scale);

  const geo = { box: G.box, sph: G.sph, cyl: G.cyl };
  const mat = { dark: M.dark, tail: M.tail, lamp: M.lamp };
  const p = (g, geoName, matName, ...rest) => part(g, geo[geoName], mat[matName], ...rest);

  // some traffic cars get a black roof; the player's car keeps a body-colour roof
  const roofMat = (!detail && Math.random() < CAR.blackRoofChance) ? M.blackRoof() : bodyVC;
  part(tilt, D.b, bodyVC, 1, 1, 1, 0, 0, 0); part(tilt, D.c, M.glass, 1, 1, 1, 0, 0, 0); part(tilt, D.r, roofMat, 1, 1, 1, 0, 0, 0);
  part(tilt, G.box, M.plate, .55, .12, .03, 0, .38, D.F - .01); part(tilt, G.box, M.plate, .55, .12, .03, 0, .56, D.B + .02);   // number plates

  for (const s of [-1, 1]) {
    part(tilt, G.box, M.dark, .02, .42, .02, s * .995, .62, .7); part(tilt, G.box, M.dark, .02, .42, .02, s * .995, .62, -.3);   // door shut-lines
    part(tilt, G.box, M.rim, .03, .04, .2, s, .74, -.05);                                                                          // door handle
    part(tilt, G.sph, M.dark, D.hl[0] * 1.3, D.hl[1] * 1.5, .1, s * .62, D.hy, D.F - .2);                                        // headlight bezel
    part(tilt, G.cyl, M.rim, .08, .22, .08, s * .45, .3, D.B - .05, Math.PI / 2);                                                  // exhaust tip
    part(tilt, G.sph, body, .28, .2, .85, s * .82, D.fh, 1.38); part(tilt, G.sph, body, .3, .24, .95, s * .84, D.rh, -1.38);     // raised front fenders, rear haunches
    part(tilt, G.box, body, .045, .42, .07, s * .79, 1.06, D.bz); part(tilt, G.box, M.dark, .03, .035, 1.7, s * .79, .87, D.bz);   // B-pillar, window trim
    part(tilt, G.box, body, .3, .02, .24, s * .86, .24, D.F - .32);                                                                // kit canards
  }
  if (D.stripes) for (const g of D.stripes) for (const sx of [-.2, .2]) part(tilt, g, M.plate, 1, 1, 1, sx, 0, 0);               // racing stripes
  DETAILS[modelName]?.(tilt, p, D);

  part(tilt, G.box, M.dark, D.sw, .05, .42, 0, .22, D.F - .14); part(tilt, G.box, M.dark, 1.5, .1, .35, 0, .27, D.B + .1);       // splitter, diffuser
  part(tilt, G.sph, body, 1.05, .035, .3, 0, D.wy, D.wz);                                                                         // GT wing blade
  for (const s of [-1, 1]) {
    part(tilt, G.sph, body, .07, .11, 1.15, s * 1.0, .31, 0);                                      // side skirts
    part(tilt, G.sph, M.lamp, D.hl[0], D.hl[1], .12, s * .62, D.hy, D.F - .18);                    // headlights
    part(tilt, G.sph, M.tail, D.tl, .06, .08, s * .6, D.ty, D.B + .1);                             // tail lights
    part(tilt, G.box, body, .04, .5, .1, s * .55, D.wy - .27, D.wz + .03);                         // wing uprights
    part(tilt, G.box, body, .04, .24, .48, s * 1.08, D.wy, D.wz);                                  // wing end plates
    part(tilt, G.sph, body, .09, .06, .07, s * .86, .97, D.mz);                                    // mirrors
    for (const f of [1, -1]) {
      part(tilt, shared.arch, body, 1, 1, 1, s * .99, .37, f * 1.38);                              // flared over-fender arch
      part(tilt, shared.lip, body, 1, 1, 1, s * 1.17, .37, f * 1.38);
      if (detail) for (let k = 0; k < 6; k++) {                                                    // fender bolts (player's car only)
        const t = .3 + k * .5;
        part(tilt, G.sph, M.dark, .035, .035, .035, s * 1.2, .37 + .5 * Math.sin(t), f * 1.38 - .5 * Math.cos(t));
      }
    }
  }

  mergeStatic(tilt);

  // wheels stay as separate groups so they can spin and steer
  const spin = [], front = [];
  for (const s of [-1, 1]) {
    for (const f of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * .98, .37, f * 1.38);
      tilt.add(pivot);
      const sp = new THREE.Group();
      pivot.add(sp);
      spin.push(sp);
      if (f > 0) front.push(pivot);
      const tire = new THREE.Mesh(shared.tire, M.tire);
      tire.scale.x = 1.5;
      tire.castShadow = true;
      sp.add(tire, new THREE.Mesh(shared.rim, M.rim), new THREE.Mesh(shared.disc, M.dark));
    }
  }
  return { root, tilt, spin, front };
}

/** Merge all plain meshes under `tilt` into one mesh per material. */
function mergeStatic(tilt) {
  const byMaterial = new Map(), meshes = [];
  tilt.children.forEach((m) => {
    if (!m.isMesh) return;
    m.updateMatrix();
    const g = m.geometry.clone().applyMatrix4(m.matrix);
    let list = byMaterial.get(m.material);
    if (!list) byMaterial.set(m.material, list = []);
    list.push(g);
    meshes.push(m);
  });
  meshes.forEach((m) => tilt.remove(m));
  for (const [material, list] of byMaterial) {
    const merged = list.length > 1 ? BufferGeometryUtils.mergeBufferGeometries(list) : list[0];
    const parts = merged ? [merged] : list;   // fall back to separate meshes if the pieces are incompatible
    for (const geometry of parts) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.userData.ownsGeometry = true;
      tilt.add(mesh);
    }
  }
}

/** Free the geometry a car owns (merged body parts). Shared wheel geometry is left alone. */
export function disposeCar(car) {
  car.root.traverse((o) => { if (o.isMesh && o.userData.ownsGeometry) o.geometry.dispose(); });
}
