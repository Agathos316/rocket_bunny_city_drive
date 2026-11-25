/**
 * A stylised Nissan 350Z (Z33) built from code, because no suitable model file with a clear licence was available.
 * It follows the pipeline cars' conventions: metres, nose towards +z, standing on y = 0, about 4.3 m long.
 * The body paint material is named 'z33_paint' so the car library gives it the same clear coat as the other cars.
 *
 * The body and the greenhouse are "lofts": a row of cross-sections along the car, each a rounded rectangle whose
 * width and height follow the real car's silhouette (long bonnet, flared haunches, short tail, fastback glass).
 * Details (lights, pillars, door shuts, five-spoke wheels, a simple interior) are small boxes and cylinders.
 */
import * as THREE from 'three';

const std = (name, o) => Object.assign(new THREE.MeshStandardMaterial(o), { name });
const sp = (v, p) => Math.sign(v) * Math.abs(v) ** p;

/**
 * Loft cross-sections [[z, yBottom, yTop, halfWidth], ...] (rear to front) into one smooth closed mesh.
 * `n` is the squareness of each section (2 = ellipse, 4 = nearly a rounded rectangle). The ends are closed by a
 * tiny section so the nose and tail round off.
 */
function loft(stations, n, seg = 36) {
  const st = stations.slice();
  const cap = (s, dz) => { const m = (s[1] + s[2]) / 2; return [s[0] + dz, m - (s[2] - s[1]) * 0.18, m + (s[2] - s[1]) * 0.18, s[3] * 0.3]; };
  st.unshift(cap(st[0], -0.04));
  st.push(cap(st[st.length - 1], 0.04));
  const pos = [], idx = [];
  for (const [z, y0, y1, hw] of st) {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pos.push(hw * sp(Math.cos(a), 2 / n), (y0 + y1) / 2 + (y1 - y0) / 2 * sp(Math.sin(a), 2 / n), z);
    }
  }
  for (let k = 0; k < st.length - 1; k++) {
    for (let j = 0; j < seg; j++) {
      const a = k * seg + j, b = k * seg + (j + 1) % seg, c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);
    }
  }
  for (const [k, flip] of [[0, true], [st.length - 1, false]]) {
    const ci = pos.length / 3, [z, y0, y1] = st[k];
    pos.push(0, (y0 + y1) / 2, z);
    for (let j = 0; j < seg; j++) {
      const a = k * seg + j, b = k * seg + (j + 1) % seg;
      idx.push(...(flip ? [ci, b, a] : [ci, a, b]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildNissan350z() {
  const paint = std('z33_paint', { color: 0xc98a00, metalness: 0.6, roughness: 0.3 });
  const glass = std('glass', { color: 0x10161d, metalness: 0.6, roughness: 0.05 });
  const trim = std('trim', { color: 0x141518, metalness: 0.1, roughness: 0.6 });
  const rubber = std('rubber', { color: 0x0c0c0e, metalness: 0, roughness: 0.9 });
  const rim = std('chrome_rim', { color: 0xd5d9de, metalness: 0.5, roughness: 0.3 });
  const caliper = std('caliper', { color: 0xb01818, metalness: 0.3, roughness: 0.5 });
  const lens = std('headlight', { color: 0xc3ccd2, emissive: 0x1c1e20, metalness: 0.2, roughness: 0.08 });
  const amber = std('indicator', { color: 0xd98a1a, emissive: 0x3a2204, roughness: 0.2 });
  const tail = std('taillight', { color: 0xb00010, emissive: 0x4a000c, metalness: 0.2, roughness: 0.15 });
  const seat = std('seat', { color: 0x2a2a2e, roughness: 0.8 });
  const scene = new THREE.Group();
  const add = (geo, mat, x, y, z, name) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (name) m.name = name; scene.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  /** A round bar between two points (pillars). */
  const bar = (a, b, r, mat, name) => {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), m = add(new THREE.CylinderGeometry(r, r, v.length(), 8), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, name);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  };

  // body: [z, bottom, top, half width]; flared rear haunches, high deck, long bonnet falling to a low nose
  add(loft([
    [-2.1, 0.46, 0.84, 0.66], [-2.0, 0.36, 0.95, 0.82], [-1.75, 0.31, 1.0, 0.89], [-1.3, 0.29, 1.03, 0.93],
    [-0.6, 0.29, 1.0, 0.91], [0.3, 0.29, 0.97, 0.9], [1.0, 0.29, 0.92, 0.92], [1.45, 0.3, 0.84, 0.91],
    [1.85, 0.32, 0.75, 0.85], [2.05, 0.34, 0.68, 0.72], [2.12, 0.4, 0.6, 0.55],
  ], 3.4), paint, 0, 0, 0, 'body');
  // greenhouse (glass), with the roof panel, pillars and a fastback rear
  add(loft([
    [-1.42, 0.97, 1.02, 0.5], [-1.2, 0.97, 1.14, 0.63], [-0.85, 0.97, 1.27, 0.7], [-0.4, 0.97, 1.335, 0.73],
    [0.1, 0.97, 1.345, 0.73], [0.5, 0.97, 1.27, 0.72], [0.85, 0.96, 1.1, 0.7], [1.0, 0.95, 1.01, 0.64],
  ], 2.7), glass, 0, 0, 0, 'glass');
  add(loft([[-0.95, 1.22, 1.285, 0.5], [-0.4, 1.25, 1.348, 0.56], [0.1, 1.25, 1.358, 0.56], [0.5, 1.2, 1.282, 0.55]], 3.5), paint, 0, 0, 0, 'roof');
  for (const s of [-1, 1]) {
    bar([s * 0.67, 0.99, 0.96], [s * 0.55, 1.23, 0.46], 0.03, paint, 'A pillar');
    bar([s * 0.7, 1.0, -0.38], [s * 0.66, 1.22, -0.4], 0.028, trim, 'B pillar');
    bar([s * 0.55, 1.22, -0.88], [s * 0.47, 1.0, -1.38], 0.05, paint, 'C pillar');
    add(box(0.012, 0.64, 0.012), trim, s * 0.915, 0.62, 0.62, 'door shut');                 // door front shut line
    add(box(0.012, 0.64, 0.012), trim, s * 0.905, 0.62, -0.45, 'door shut');                // door rear shut line
    add(box(0.012, 0.012, 1.1), trim, s * 0.91, 0.28 + 0.07, 0.08, 'sill line');
    add(box(0.03, 0.04, 0.2), trim, s * 0.915, 0.86, -0.3, 'handle');
    add(box(0.1, 0.2, 1.7), trim, s * 0.86, 0.3, 0.05, 'side skirt');
    add(box(0.16, 0.1, 0.2), paint, s * 0.98, 1.0, 0.78, 'mirror');
    bar([s * 0.8, 0.98, 0.8], [s * 0.92, 1.0, 0.78], 0.02, trim, 'mirror stalk');
    // front: boomerang headlights wrapping onto the wings, indicators, fog lamps, intake
    add(box(0.42, 0.08, 0.14), lens, s * 0.6, 0.69, 1.93, 'headlight').rotation.set(0.25, s * 0.4, 0);
    add(box(0.14, 0.05, 0.1), amber, s * 0.8, 0.66, 1.8, 'indicator').rotation.y = s * 0.7;
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12).rotateX(Math.PI / 2), lens, s * 0.62, 0.4, 2.07, 'fog lamp');
    // rear: boomerang tail lights, exhausts, reflector
    add(box(0.62, 0.1, 0.1), tail, s * 0.55, 0.9, -2.0, 'taillight').rotation.y = -s * 0.28;
    add(box(0.14, 0.18, 0.1), tail, s * 0.8, 0.86, -1.93, 'taillight').rotation.y = -s * 0.7;
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12).rotateX(Math.PI / 2), rim, s * 0.38, 0.4, -2.08, 'exhaust');
  }
  add(box(1.04, 0.14, 0.12), trim, 0, 0.56, 2.08, 'grille');
  add(box(1.3, 0.13, 0.1), trim, 0, 0.4, 2.07, 'intake');
  add(box(1.6, 0.035, 0.2), trim, 0, 0.31, 2.0, 'splitter');
  add(box(1.45, 0.12, 0.1), trim, 0, 0.46, -2.0, 'rear bumper');
  add(box(1.2, 0.18, 0.1), trim, 0, 0.35, -2.0, 'diffuser');
  add(box(0.5, 0.12, 0.02), rim, 0, 0.68, -2.075, 'plate');
  add(box(1.5, 0.045, 0.3), paint, 0, 1.0, -1.9, 'ducktail');

  // interior seen through the glass: floor, dash, two seats with headrests, steering wheel
  add(box(1.25, 0.08, 1.6), seat, 0, 0.93, 0, 'floor');
  add(box(1.3, 0.2, 0.3), trim, 0, 1.02, 0.78, 'dash');
  for (const s of [-1, 1]) {
    add(box(0.42, 0.1, 0.45), seat, s * 0.33, 1.0, -0.15, 'seat');
    add(box(0.42, 0.3, 0.1), seat, s * 0.33, 1.13, -0.42, 'seat back');
    add(box(0.2, 0.1, 0.08), seat, s * 0.33, 1.3, -0.42, 'headrest');
  }
  add(new THREE.TorusGeometry(0.13, 0.015, 6, 14).rotateX(-0.9), trim, -0.33, 1.13, 0.52, 'steering wheel');

  // wheels: tyre, five-spoke rim, brake disc and caliper, over a dark wheel arch
  const tyre = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 28).rotateZ(Math.PI / 2);
  const lip = new THREE.CylinderGeometry(0.24, 0.24, 0.255, 24).rotateZ(Math.PI / 2);
  const dark = new THREE.CylinderGeometry(0.13, 0.13, 0.27, 24).rotateZ(Math.PI / 2);
  const arch = new THREE.CylinderGeometry(0.39, 0.39, 0.06, 28).rotateZ(Math.PI / 2);
  const disc = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20).rotateZ(Math.PI / 2);
  const spoke = new THREE.BoxGeometry(0.03, 0.2, 0.055).translate(0, 0.11, 0);   // one spoke, hub outwards, turned five times
  for (const sx of [-1, 1]) {
    for (const z of [-1.32, 1.32]) {
      const x = sx * 0.8;
      add(arch, trim, sx * 0.88, 0.395, z, 'wheel arch');
      add(tyre, rubber, x, 0.33, z, 'tyre');
      add(lip, rim, x, 0.33, z, 'rim');
      add(dark, trim, x, 0.33, z, 'rim face');
      add(disc, rim, sx * 0.7, 0.33, z, 'brake disc');
      add(box(0.06, 0.1, 0.18), caliper, sx * 0.7, 0.4, z + 0.12, 'caliper');
      for (let k = 0; k < 5; k++) add(spoke, rim, sx * 0.935, 0.33, z, 'spoke').rotation.x = k * Math.PI * 2 / 5;
    }
  }
  scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return scene;
}
