/**
 * A simple, stylised Nissan 350Z (Z33) built from code, because no suitable model file with a clear licence was available.
 * It follows the pipeline cars' conventions: metres, nose towards +z, standing on y = 0, about 4.3 m long.
 * The body paint material is named 'z33_paint' so the car library gives it the same clear coat as the other cars.
 *
 * Shapes: the lower body and the greenhouse are side profiles (length along z, height along y) extruded across
 * the car and bevelled, which gives the soft, rounded look; everything else is a handful of boxes and cylinders.
 */
import * as THREE from 'three';

const std = (name, o) => Object.assign(new THREE.MeshStandardMaterial(o), { name });

/** Extrude a side profile [[z, y], ...] across the car (centred, `width` wide) with rounded edges. */
function profile(points, width, bevel) {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2);                       // shape x -> model z, extrusion -> model x
  g.computeVertexNormals();
  return g;
}

export function buildNissan350z() {
  const paint = std('z33_paint', { color: 0xc98a00, metalness: 0.6, roughness: 0.3 });
  const glass = std('glass', { color: 0x10161d, metalness: 0.6, roughness: 0.05 });
  const trim = std('trim', { color: 0x16171a, metalness: 0.1, roughness: 0.6 });
  const rubber = std('rubber', { color: 0x0c0c0e, metalness: 0, roughness: 0.9 });
  const rim = std('chrome_rim', { color: 0xc9ced4, metalness: 0.9, roughness: 0.25 });
  const lamp = std('headlight', { color: 0xe8eef2, emissive: 0x555a5e, metalness: 0.2, roughness: 0.1 });
  const tail = std('taillight', { color: 0xb00010, emissive: 0x40000a, metalness: 0.2, roughness: 0.15 });
  const scene = new THREE.Group();
  const add = (geo, mat, x, y, z, name) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (name) m.name = name; scene.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // lower body: short tail, long sloping bonnet, low nose (z = length, y = height)
  add(profile([
    [-2.05, 0.34], [-2.12, 0.55], [-2.05, 0.9], [-1.5, 0.99], [-0.6, 1.0], [0.45, 0.96], [1.2, 0.86], [1.85, 0.74],
    [2.08, 0.6], [2.1, 0.42], [1.95, 0.34], [1.5, 0.3], [-1.5, 0.3],
  ], 1.7, 0.1), paint, 0, 0, 0, 'body');
  // greenhouse: fastback roof running into the tail, steeply raked windscreen
  add(profile([[-1.35, 0.95], [-0.8, 1.3], [-0.2, 1.33], [0.35, 1.3], [0.95, 0.96]], 1.5, 0.04), glass, 0, 0, 0, 'glass');
  add(box(1.38, 0.05, 1.05), paint, 0, 1.345, -0.28, 'roof').rotation.x = 0.0;
  // front: grille, lower intake, splitter lip, headlights; rear: tail lights, bumper, ducktail, exhausts
  add(box(1.0, 0.16, 0.08), trim, 0, 0.55, 2.12, 'grille');
  add(box(1.5, 0.14, 0.1), trim, 0, 0.38, 2.08, 'intake');
  add(box(1.72, 0.04, 0.3), trim, 0, 0.3, 1.98, 'splitter');
  for (const s of [-1, 1]) {
    add(box(0.42, 0.12, 0.2), lamp, s * 0.62, 0.7, 2.0, 'headlight').rotation.y = s * 0.25;
    add(box(0.5, 0.1, 0.1), tail, s * 0.6, 0.82, -2.1, 'taillight');
    add(box(0.14, 0.1, 0.18), paint, s * 0.98, 1.0, 0.72, 'mirror');
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10).rotateX(Math.PI / 2), rim, s * 0.35, 0.36, -2.12, 'exhaust');
  }
  add(box(1.5, 0.1, 0.1), trim, 0, 0.5, -2.12, 'rear bumper');
  add(box(1.3, 0.05, 0.32), paint, 0, 1.0, -1.95, 'ducktail');
  // wheels: tyre, rim face and a dark centre, centred on each axle (wheelbase 2.65 m)
  const tyre = new THREE.CylinderGeometry(0.33, 0.33, 0.25, 24).rotateZ(Math.PI / 2);
  const face = new THREE.CylinderGeometry(0.22, 0.22, 0.27, 20).rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.07, 0.07, 0.29, 10).rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const z of [-1.32, 1.32]) {
    const x = sx * 0.8;
    add(tyre, rubber, x, 0.33, z, 'tyre');
    add(face, rim, x, 0.33, z, 'rim');
    add(hub, trim, x, 0.33, z, 'hub');
  }
  scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return scene;
}
