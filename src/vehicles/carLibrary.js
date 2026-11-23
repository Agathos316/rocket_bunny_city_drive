/**
 * The game's vehicles. Every car, whether you drive it, it drives itself in traffic, or it is parked at the
 * kerb, is a glTF model from assets/models/ (see its README for sources and licences); nothing is built in code.
 * The entries are listed in CAR.library.cars (config.js).
 *
 * loadCarLibrary() must finish before the game starts (main.js awaits it; tests call registerCar with stand-ins).
 *
 * Most models were prepared by tools/car-pipeline: nose towards +z, in metres, with three detail levels as nodes
 * LOD0 (near), LOD1 and LOD2 (far). Traffic and parked cars use all three through THREE.LOD, so distant cars are
 * cheap; the player's car always uses LOD0. The Ferrari is the odd one out: it has a modelled cockpit and a
 * steering wheel that turns.
 *
 * makeCar(name) and makeTrafficCar(i, color) return { root, tilt, spin, front, wheelR, eye, setSteer, paint }:
 *   root  - place and rotate this          tilt  - body group (lean / pitch it for body roll)
 *   spin / front - wheel groups to spin and steer (only the Ferrari has them)
 *   eye - driver's eye in model units (null if the car has no cockpit)   setSteer(x) - turn the steering wheel
 *   paint(color) - repaint the body (cars with a recolourable paint material)
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js';
import { CAR } from '../config.js';

const library = new Map();    // name -> template scene (never modified after registration)
const Y = new THREE.Vector3(0, 1, 0);
const specOf = (name) => CAR.library.cars[name];

export const hasCar = (name) => library.has(name);
export const registerCar = (name, scene) => { library.set(name, scene); };
export const playerNames = () => Object.keys(CAR.library.cars).filter(hasCar);
export const trafficNames = () => Object.keys(CAR.library.cars).filter((n) => specOf(n).traffic && hasCar(n));
export const hasCockpit = (name) => !!specOf(name)?.cockpit;

/** Load every model. Resolves to the names loaded; rejects if any file fails, since nothing can stand in for it. */
export async function loadCarLibrary() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(CAR.library.dracoPath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  try {
    await Promise.all(Object.entries(CAR.library.cars).map(async ([name, spec]) => {
      const gltf = await loader.loadAsync(spec.url);
      registerCar(name, spec.kind === 'ferrari' ? prepareFerrari(gltf.scene) : prepareCar(gltf.scene, spec));
    }));
  } finally {
    draco.dispose();
  }
  return [...library.keys()];
}

/* ------------------------------------------------------------------ preparing templates */

const CHROME = /chrome|rim|disc|disk|brake|mirror|exhaust/i;

/**
 * Tune the materials the files came with (glTF's defaults are fully metallic and fully rough, which looks black),
 * give the body paint a clear coat, and set up shadows. Runs once per model.
 */
function prepareCar(scene, spec) {
  const swapped = new Map();
  const fix = (m) => {
    if (swapped.has(m)) return swapped.get(m);
    let out = m;
    if (spec.paint && m.name === spec.paint) {
      out = new THREE.MeshPhysicalMaterial({ color: m.color, map: m.map, metalness: 0.25, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.55 });
      out.name = m.name;
      out.userData.isPaint = true;
    } else if (/glass|window/i.test(m.name) && !m.map) {          // some files ship windows as opaque white: make them dark, shiny and see-through
      m.transparent = true;
      m.opacity = Math.min(m.opacity, 0.45);
      m.depthWrite = false;
      if (m.color.r + m.color.g + m.color.b > 1.2) m.color.set(0x10161d);
      m.metalness = 0.6;
      m.roughness = 0.05;
      m.envMapIntensity = 1.2;
    } else {
      if (!m.metalnessMap) m.metalness = Math.min(m.metalness, CHROME.test(m.name) ? 0.9 : 0.2);
      if (!m.roughnessMap) m.roughness = Math.min(m.roughness, 0.6);
      m.envMapIntensity = 0.7;
      if (m.transparent) m.depthWrite = false;
    }
    swapped.set(m, out);
    return out;
  };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    o.castShadow = !o.material.transparent;
    o.receiveShadow = false;
    if (o.isSkinnedMesh) o.frustumCulled = false;
  });
  if (spec.length) normalise(scene, spec);
  return scene;
}

/** For an un-pipelined, un-skinned file with a `length` in its spec: scale to that length, centre it and stand it on the ground. */
function normalise(scene, spec) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = spec.length / Math.max(size.x, size.z);
  scene.scale.multiplyScalar(k);
  scene.position.set(-c.x * k, -box.min.y * k, -c.z * k);
}

/** Ferrari: replace the file's flat default materials with clear-coated paint, glass, chrome, rubber. */
function prepareFerrari(scene) {
  const swap = new Map();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const make = (m) => {
    const n = m.name;
    if (n === 'Body_Color') {
      const paint = new THREE.MeshPhysicalMaterial({ color: CAR.playerColor, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25 });
      paint.userData.isPaint = true;
      return paint;
    }
    if (/Taillight/i.test(n)) return new THREE.MeshPhysicalMaterial({ color: 0xc00000, emissive: 0x500000, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 });
    if (/Projector/i.test(n)) return new THREE.MeshPhysicalMaterial({ color: 0xcfd6dc, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.8, envMapIntensity: 1.5 });
    if (/glass/i.test(n)) return new THREE.MeshPhysicalMaterial({ color: 0x0c141c, metalness: 0.6, roughness: 0.02, transparent: true, opacity: 0.2, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
    if (/chrome/i.test(n)) return std({ color: m.color, metalness: 1, roughness: 0.08, envMapIntensity: 1.4 });
    if (/metal_gray/i.test(n)) return std({ color: m.color, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.1 });
    if (/Carbon/i.test(n)) return std({ color: 0x25272b, metalness: 0.4, roughness: 0.35, envMapIntensity: 0.9 });
    if (/Tires/i.test(n)) return std({ color: m.color, metalness: 0, roughness: 0.85 });
    if (/Leather/i.test(n)) return std({ color: m.color, metalness: 0, roughness: 0.55, envMapIntensity: 0.5 });
    if (/Turn_Signal|Yellow|Blue/i.test(n)) return std({ color: m.color, metalness: 0.3, roughness: 0.3 });
    return std({ color: m.color, metalness: 0.1, roughness: 0.65, envMapIntensity: 0.6 });
  };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!swap.has(o.material)) swap.set(o.material, make(o.material));
    o.material = swap.get(o.material);
    o.castShadow = o.name === 'body' || o.name === 'main' || /^(trim|metal|plastic_gray|interior_dark|grills)$/.test(o.name);
    o.receiveShadow = false;   // no self-shadow acne, which would be very visible from inside the cockpit
    o.frustumCulled = false;
    if (o.material.transparent) o.renderOrder = 2;
  });
  return scene;
}

/* ------------------------------------------------------------------ building cars */

/** Wrap each named wheel node in a (steer pivot >) spin group centred on the wheel, inside `tilt`. */
function rigWheels(scene, tilt, ids) {
  const box = new THREE.Box3(), c = new THREE.Vector3(), spin = [], front = [];
  tilt.updateMatrixWorld(true);
  for (const [id, isFront] of ids) {
    const node = scene.getObjectByName(id);
    if (!node) continue;
    box.setFromObject(node).getCenter(c);
    const pivot = new THREE.Group(), sp = new THREE.Group();
    pivot.position.copy(tilt.worldToLocal(c.clone()));
    tilt.add(pivot);
    pivot.add(sp);
    tilt.updateMatrixWorld(true);
    sp.attach(node);
    spin.push(sp);
    if (isFront) front.push(pivot);
  }
  return { spin, front };
}

function buildFerrari(spec) {
  const scene = library.get('ferrari').clone(true);
  scene.traverse((o) => {              // the paint is per car, so a colour change never touches the shared template
    if (!o.isMesh || !o.material.userData.isPaint) return;
    o.material = o.material.clone();
    o.material.userData.owned = true;
    o.material.color.set(CAR.playerColor);
  });
  const root = new THREE.Group(), tilt = new THREE.Group(), model = new THREE.Group();
  model.rotation.y = spec.rotateY;
  model.add(scene);
  tilt.add(model);
  root.add(tilt);
  root.scale.setScalar(CAR.scale);
  root.updateMatrixWorld(true);
  const { spin, front } = rigWheels(scene, tilt, [['wheel_fl', true], ['wheel_fr', true], ['wheel_rl', false], ['wheel_rr', false]]);

  // steering wheel: its rim and hub turn about the column axis (the column itself stays put)
  let setSteer = () => {};
  const sw = scene.getObjectByName('steering_wheel');
  if (sw) {
    const hub = new THREE.Group(), axis = new THREE.Vector3(...spec.steerAxis).applyAxisAngle(Y, spec.rotateY), q = new THREE.Quaternion();
    hub.position.set(...spec.steerCentre).applyAxisAngle(Y, spec.rotateY);
    tilt.add(hub);
    tilt.updateMatrixWorld(true);
    for (const part of [...sw.children]) if (part.name !== 'steering_column') hub.attach(part);
    setSteer = (steer) => { hub.quaternion.copy(q.setFromAxisAngle(axis, steer * CAR.steeringWheelLock)); };
  }
  return { root, tilt, spin, front, wheelR: 0.36 * CAR.scale, eye: new THREE.Vector3(...spec.eye).applyAxisAngle(Y, spec.rotateY), setSteer, paint() {} };
}

/**
 * A pipeline-built or raw car. `lod` = use all three detail levels (traffic and parked cars); otherwise only the
 * best one. `color` repaints the body if the model has a paint material (traffic cars).
 */
function buildCar(name, { lod, color }) {
  const spec = specOf(name), template = library.get(name);
  const scene = spec.raw ? SkeletonUtils.clone(template) : template.clone(true);   // skinned meshes must be cloned with their own bones
  const owned = [];
  scene.traverse((o) => {              // paint is per car so recolouring never touches the shared template
    if (!o.isMesh || !o.material.userData?.isPaint) return;
    o.material = o.material.clone();
    o.material.userData.owned = true;
    owned.push(o.material);
  });
  const root = new THREE.Group(), tilt = new THREE.Group(), model = new THREE.Group();
  if (spec.raw) {
    model.rotation.y = spec.rotateY || 0;
    model.scale.setScalar(spec.scale || 1);
    model.add(scene);
  } else {
    const levels = ['LOD0', 'LOD1', 'LOD2'].map((n) => scene.getObjectByName(n));
    if (levels[0] && lod) {
      const group = new THREE.LOD(), [d1, d2] = CAR.library.lodDistances;
      levels.forEach((node, i) => { if (node) { scene.remove(node); group.addLevel(node, [0, d1, d2][i]); } });
      group.addLevel(new THREE.Object3D(), CAR.library.cullDistance);
      model.add(group);
    } else {
      for (const n of levels.slice(1)) if (n) scene.remove(n);
      model.add(scene);
    }
  }
  tilt.add(model);
  root.add(tilt);
  root.scale.setScalar(CAR.scale);
  const paint = (c) => { for (const m of owned) m.color.set(c); };
  if (color !== undefined) paint(color);
  return { root, tilt, spin: [], front: [], wheelR: 0.33 * CAR.scale, eye: null, setSteer() {}, paint };
}

/** The player's car: `name` is a key of CAR.library.cars. */
export function makeCar(name) {
  const spec = specOf(name);
  if (!spec || !hasCar(name)) throw new Error(`Car model "${name}" is not loaded`);
  return spec.kind === 'ferrari' ? buildFerrari(spec) : buildCar(name, { lod: false });
}

/** A traffic or parked car: model `index` of the traffic models (cycling), painted `color`, with distance detail levels. */
export function makeTrafficCar(index, color) {
  const names = trafficNames();
  if (!names.length) throw new Error('No traffic car models are loaded');
  return buildCar(names[index % names.length], { lod: true, color });
}

/** Free the per-car paint (the shared templates' geometry and other materials stay). */
export function disposeCar(car) {
  car.root.traverse((o) => { if (o.isMesh && o.material.userData?.owned) o.material.dispose(); });
}
