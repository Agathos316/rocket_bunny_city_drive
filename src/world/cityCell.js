/**
 * One city cell (block): buildings, footpath, road markings, crosswalks, traffic lights, kerbside parking,
 * trees, speed bumps, and (depending on the cell) a petrol station or a river with a ramped bridge.
 *
 * Deterministic: the same (i, j) always builds the same block. The order of the rand() calls below matters,
 * so do not reorder them without expecting the city to change.
 *
 * Works in grid coordinates; the chunk manager bends the finished group into world space.
 */
import * as THREE from 'three';
import { C, RD, PK, CAR } from '../config.js';
import { rng } from '../util/math.js';
import { Batcher } from '../util/batcher.js';
import { getAssets } from '../assets.js';
import { getGeoms } from './geometries.js';
import { Hr, bridgeY, isHwy, isRiver, isStn, roadAt, roadStyle } from './zones.js';
import { ribbon } from './surfaces.js';
import { buildStation } from './station.js';
import { getTrees } from './trees.js';
import { putParkedCar } from '../vehicles/parkedCars.js';

export function generateCity(i, j, { signals }) {
  const { mats, castsShadow } = getAssets();
  const G = getGeoms();
  const group = new THREE.Group(), owned = [], bumps = [], parked = [], batch = new Batcher();
  const put = batch.put.bind(batch);
  const rand = rng(i * 374761393 ^ j * 668265263 ^ 77);
  const x0 = i * C, z0 = j * C, cx = x0 + C / 2, cz = z0 + C / 2;
  const river = isRiver(i, j), station = isStn(i, j);

  if (!river) put(G.footpath, mats.footpath, cx, 0, cz);

  /* ---- buildings: a 3 x 3 grid of towers (none on river or petrol-station blocks) ---- */
  const pitch = (C - 2 * RD - 2 * PK) / 3;
  for (const a of [-1, 0, 1]) {
    for (const b of [-1, 0, 1]) {
      const w = 15 + rand() * 5, d = 15 + rand() * 5;
      const h = rand() < 0.22 ? 10 + rand() * 18 : 32 + rand() * 95;
      const style = mats.buildings[rand() * mats.buildings.length | 0];
      const px = cx + a * pitch, pz = cz + b * pitch;
      if (station || river) continue;
      const tower = new THREE.BoxGeometry(w, h, d), uv = tower.attributes.uv;
      for (let k = 0; k < uv.count; k++) {                       // tile the window texture to the tower's size
        const face = k >> 2, su = (face < 2 ? d : w) / 6;
        uv.setXY(k, uv.getX(k) * su, uv.getY(k) * h / 6);
      }
      put(tower, style, px, h / 2 + 0.3, pz);
      tower.dispose();
      put(G.box, mats.roof, px, h + 0.36, pz, w, 0.12, d);       // roof slab
      if (h > 50 && rand() < 0.5) put(G.box, mats.roof, px, h + 3.4, pz, w * 0.4, 6, d * 0.4);   // rooftop plant
    }
  }

  /* ---- road looks and centre lines: four styles, each constant along a whole road ---- */
  for (const axis of [0, 1]) {
    if (axis && river) continue;
    const style = roadStyle(axis, axis ? i : j), ry = axis ? Math.PI / 2 : 0;
    const at = (t, l) => axis ? [x0 + l, z0 + C / 2 + t] : [x0 + C / 2 + t, z0 + l];
    if (style) { const p = at(0, 0); put(G.roadOverlay, mats.roadOverlay[style], p[0], 0.02, p[1], 1, 1, 1, ry); }
    if (style < 2) { const p = at(0, 0); put(G.dashLine, mats.dashLine, p[0], 0.03, p[1], 1, 1, 1, ry); }
    if (style === 2) for (const l of [-0.35, 0.35]) { const p = at(0, l); put(G.solidLine, mats.yellowLine, p[0], 0.03, p[1], 1, 1, 1, ry); }
    if (style === 1) for (const l of [-7.3, 7.3]) { const p = at(0, l); put(G.solidLine, mats.whiteLine, p[0], 0.03, p[1], 1, 1, 1, ry); }
  }

  /* ---- perimeter roads: a real road (surface, centre dashes, junction patches) on every edge shared with a highway cell,
          so the city is ringed by proper roads and highways that arrive at it meet a proper intersection ---- */
  {
    const addRoad = (X, ox, oz) => {              // X = runs along x; (ox, oz) = start of the road line
      for (const [geo, mat] of [[ribbon(X, ox, oz, 0, C, RD, 0.1), mats.highway], [ribbon(X, ox, oz, 8, C - 8, 0.17, 0.14), mats.dashLine]]) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        group.add(mesh);
        owned.push(geo);
      }
      for (const t of [0, C]) {                   // junction patch at both ends
        const px = X ? ox + t : ox, pz = X ? oz : oz + t;
        put(G.junction, mats.highway, px, Hr(px, pz) + 0.1, pz);
      }
    };
    if (!river) {
      if (isHwy(i - 1, j)) addRoad(false, x0, z0);                 // west edge
      if (isHwy(i + 1, j) && !roadAt(i + 1, j, 'z')) addRoad(false, x0 + C, z0);   // east edge (the highway cell draws its own if it has a road there)
    }
    if (isHwy(i, j - 1)) addRoad(true, x0, z0);                    // south edge
    if (isHwy(i, j + 1) && !roadAt(i, j + 1, 'x')) addRoad(true, x0, z0 + C);    // north edge
  }

  /* ---- traffic lights: four corner poles, each with a head facing each approach ---- */
  const group2 = (i + j) & 1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = x0 + sx * 10, pz = z0 + sz * 10;
      put(G.box, mats.signalPole, px, 3, pz, 0.3, 6, 0.3);
      for (let axis = 0; axis < 2; axis++) {
        const hx = axis === 0 ? px + sx * 0.5 : px, hz = axis === 0 ? pz : pz + sz * 0.5;
        put(G.box, mats.signalPole, hx, 5.2, hz, axis ? 0.7 : 0.4, 1.8, axis ? 0.4 : 0.7);
        for (let c = 0; c < 3; c++) {
          put(G.lampSphere, signals.lamp(group2, axis, c), hx + (axis === 0 ? sx * 0.22 : 0), 5.8 - c * 0.6, hz + (axis === 1 ? sz * 0.22 : 0), 0.25, 0.25, 0.25);
        }
      }
    }
  }

  /* ---- kerbside parking: marked bays in the strip beside each road, some with parked cars ---- */
  for (const axis of [0, 1]) {
    for (const side of [-1, 1]) {
      // no bays on the side that faces a river, highway or petrol station (there's no kerb there)
      const ni = axis && side < 0 ? i - 1 : i, nj = !axis && side < 0 ? j - 1 : j;
      if (isRiver(ni, nj) || isStn(ni, nj) || isHwy(ni, nj)) continue;
      const ry = axis ? Math.PI / 2 : 0;
      const at = (t, l) => axis ? [x0 + side * l, z0 + t] : [x0 + t, z0 + side * l];
      for (let k = 0; k <= 7; k++) { const p = at(20 + k * 8.5, 10.5); put(G.parkingBay, mats.whiteLine, p[0], 0.035, p[1], 1, 1, 1, ry); }
      { const p = at(50.25, 8.1); put(G.parkingEdge, mats.whiteLine, p[0], 0.035, p[1], 60.5, 1, 1, ry); }
      for (let k = 0; k < 7; k++) {
        if (!(rand() < 0.45)) continue;
        const p = at(24.25 + k * 8.5, 10.5), f = rand() < 0.5 ? 1 : -1;
        const hx = axis ? 0 : f, hz = axis ? f : 0;
        const model = CAR.models[rand() * CAR.models.length | 0];
        const colour = CAR.parkedColors[rand() * CAR.parkedColors.length | 0];
        putParkedCar(batch, model, colour, p[0], p[1], axis ? (f > 0 ? 0 : Math.PI) : (f > 0 ? Math.PI / 2 : -Math.PI / 2));
        parked.push({ x: p[0], z: p[1], hx, hz });
      }
    }
  }

  if (station) buildStation(batch, cx, cz);

  /* ---- river: water, low banks, and a ramped bridge carrying the north-south road ---- */
  if (river) {
    put(G.water, mats.water, x0 + C / 2, 0.1, z0 + C / 2);
    for (const zz of [z0 + RD + 0.3, z0 + C - RD - 0.3]) put(G.box, mats.footpath, x0 + C / 2, 0.4, zz, C - 26, 0.8, 0.6);
    const deckHeight = (x, z) => bridgeY(z - z0);
    for (const [geo, mat] of [[ribbon(false, x0, z0, RD, C - RD, 9.3, 0.05, deckHeight), mats.highway], [ribbon(false, x0, z0, RD, C - RD, 0.17, 0.1, deckHeight), mats.dashLine]]) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      group.add(mesh);
      owned.push(geo);
    }
    for (let k = 0; k < 28; k++) {                                                       // rails and girders
      const t = RD + (k + 0.5) * 3, hh = bridgeY(t);
      for (const s of [-1, 1]) {
        put(G.box, mats.concrete, x0 + s * 9.4, hh + 0.55, z0 + t, 0.3, 1, 3.1);
        put(G.box, mats.concrete, x0 + s * 9.4, hh - 0.5, z0 + t, 0.5, 0.9, 3.1);
      }
    }
    for (let k = 0; k < 7; k++) {                                                        // piers
      const t = RD + (k + 0.5) * 12, hh = bridgeY(t);
      if (hh > 1) put(G.cyl, mats.concrete, x0, hh / 2 - 0.4, z0 + t, 1.6, hh, 1.6);
    }
  }

  /* ---- crosswalks on every arm of the intersection ---- */
  for (const s of [-1, 1]) {
    put(G.crosswalk, mats.crosswalk, x0 + s * 10.7, 0.035, z0);
    put(G.crosswalk, mats.crosswalk, x0, 0.035, z0 + s * 10.7, 1, 1, 1, Math.PI / 2);
  }

  /* ---- street trees along the footpath edge ---- */
  for (let n = 0; n < (river ? 0 : 8); n++) {
    const side = rand() * 4 | 0, off = (rand() - 0.5) * 60, inset = C / 2 - RD - PK - 0.7;
    const tx = cx + (side < 2 ? (side ? inset : -inset) : off), tz = cz + (side < 2 ? off : (side === 2 ? inset : -inset));
    const trunk = 2.2 + rand() * 1.2, crown = 1.4 + rand() * 0.8, pick = rand() * 3 | 0;
    const trees = getTrees(), geo = pick === 2 && n % 4 === 0 ? trees.conifer[n & 1] : trees.broadleaf[(n + pick) % 4];
    put(geo, mats.tree, tx, 0.3, tz, crown * 0.52 + trunk * 0.1, crown * 0.52 + trunk * 0.1, crown * 0.52 + trunk * 0.1, n * 2.4 + tx);   // (no extra rand() call: the order below must not change)
  }

  batch.build(group, owned, castsShadow);

  /* ---- speed bumps: separate meshes so the physics can find them; tagged so the world bend leaves their shape alone ---- */
  const addBump = (x, z, axis) => {
    const m = new THREE.Mesh(G.box, mats.speedBump);
    m.scale.set(axis === 'z' ? 2 * RD : 1.4, 0.16, axis === 'z' ? 1.4 : 2 * RD);
    m.castShadow = m.receiveShadow = true;
    m.position.set(x, 0.08, z);
    m.userData.isBump = true;
    group.add(m);
    bumps.push({ x, z, ax: axis, in: false });
  };
  if (!river && ((i === 0 && j === 0) || rand() < 0.5)) addBump(x0, cz, 'z');
  if (rand() < 0.5) addBump(cx, z0, 'x');

  return { group, owned, bumps, parked };
}
