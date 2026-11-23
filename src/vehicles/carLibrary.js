/**
 * The game's vehicles. Every car, whether you drive it, it drives itself in traffic, or it is parked at the
 * kerb, is a glTF model from the library in assets/models/ — nothing is built in code.
 *
 *   assets/models/ferrari.glb   Ferrari 458 Italia (three.js examples), with a modelled cockpit
 *   assets/models/kenney/*.glb  Kenney Car Kit (CC0): ordinary cars, sports cars and race cars
 *
 * loadCarLibrary() must finish before the game starts (main.js awaits it; tests call registerCar with stand-ins).
 *
 * makeCar(name) and makeTrafficCar(i) return { root, tilt, spin, front, wheelR, eye, setSteer }:
 *   root  - place and rotate this          tilt  - body group (lean / pitch it for body roll)
 *   spin  - wheel groups; rotate .x        front - front wheel pivots; rotate .y to steer
 *   wheelR - wheel radius in world units   eye - driver's eye (cockpit / hood camera)   setSteer(x) - turn the steering wheel
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from '../config.js';

const library = new Map();    // name -> template scene (never modified after registration)
const Y = new THREE.Vector3(0, 1, 0);

/** One material (the kit's shared colour palette) for every Kenney car, so a whole kerb of parked cars batches. */
let kenneyMaterial = null;

export const hasCar = (name) => library.has(name);
export const registerCar = (name, scene) => { library.set(name, scene); };
export const trafficNames = () => CAR.library.traffic.filter(hasCar);
export const parkedNames = () => CAR.library.parked.filter(hasCar);
export const playerNames = () => Object.keys(CAR.library.player).filter(hasCar);

/** Load every model. Resolves to the names loaded; throws if any file is missing, since nothing can stand in for it. */
export async function loadCarLibrary() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(CAR.library.dracoPath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const jobs = [];
  for (const [name, spec] of Object.entries(CAR.library.player)) {
    jobs.push(loader.loadAsync(spec.url).then((gltf) => registerCar(name, spec.kind === 'ferrari' ? prepareFerrari(gltf.scene) : prepareKenney(gltf.scene))));
  }
  for (const name of CAR.library.traffic) {
    if (hasCar(name) || CAR.library.player[name]) continue;
    jobs.push(loader.loadAsync(CAR.library.kenneyDir + name + '.glb').then((gltf) => registerCar(name, prepareKenney(gltf.scene))));
  }
  try { await Promise.all(jobs); } finally { draco.dispose(); }
  return [...library.keys()];
}

/* ------------------------------------------------------------------ preparing templates */

/**
 * The Kenney cars are chunky cartoons: tall, wide, with oversized wheels. Bring them closer to a real car's
 * proportions (and so to the Ferrari's) by narrowing and lowering the body and fitting smaller wheels that
 * sit on the ground. Runs once per template, on the model's top-level nodes (body, wheels, door, spare wheel).
 */
function proportion(scene) {
  const P = CAR.library.proportions, axle = 0.3 * P.wheel;     // the Kenney wheel radius is 0.3
  for (const node of scene.children) {
    if (/^wheel-(front|back)-(left|right)$/.test(node.name)) {
      node.position.set(node.position.x * P.width, axle, node.position.z);   // axle at the new wheel radius, so the tyre touches the ground
      node.scale.setScalar(P.wheel);
    } else if (/^wheel-back$/.test(node.name)) {                              // a spare wheel on the back of an SUV: keep it round
      node.position.set(node.position.x, node.position.y * P.height, node.position.z);
      node.scale.setScalar(P.wheel);
    } else {
      node.position.set(node.position.x * P.width, node.position.y * P.height, node.position.z);
      node.scale.set(P.width, P.height, 1);
    }
  }
}

/** Kenney cars: one shared palette material (sRGB texture; the renderer's output is linear, which keeps the colours rich). */
function prepareKenney(scene) {
  proportion(scene);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!kenneyMaterial) {
      kenneyMaterial = o.material;
      kenneyMaterial.metalness = 0.1;
      kenneyMaterial.roughness = 0.6;
      kenneyMaterial.envMapIntensity = 0.4;
    }
    o.material = kenneyMaterial;
    o.castShadow = true;
    o.frustumCulled = false;
  });
  return scene;
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

const KENNEY_WHEELS = [['wheel-front-left', true], ['wheel-front-right', true], ['wheel-back-left', false], ['wheel-back-right', false]];

function buildKenney(name, scale, eye) {
  const scene = library.get(name).clone(true);
  const root = new THREE.Group(), tilt = new THREE.Group();
  tilt.add(scene);
  root.add(tilt);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const { spin, front } = rigWheels(scene, tilt, KENNEY_WHEELS);
  return { root, tilt, spin, front, wheelR: 0.3 * CAR.library.proportions.wheel * scale, eye: new THREE.Vector3(...eye), setSteer() {} };
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
  model.rotation.y = spec.rotateY;           // the model's nose is -z; the game's cars face +z
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
  return { root, tilt, spin, front, wheelR: 0.36 * CAR.scale, eye: new THREE.Vector3(...spec.eye).applyAxisAngle(Y, spec.rotateY), setSteer };
}

/** The player's car: `name` is a key of CAR.library.player. */
export function makeCar(name) {
  const spec = CAR.library.player[name];
  if (!spec || !hasCar(name)) throw new Error(`Car model "${name}" is not loaded`);
  return spec.kind === 'ferrari' ? buildFerrari(spec) : buildKenney(name, CAR.library.kenneyScale, spec.eye);
}

/** A traffic car; `index` picks the body style, so traffic is a mix of sedans, SUVs, taxis, vans... */
export function makeTrafficCar(index) {
  const names = trafficNames();
  if (!names.length) throw new Error('No traffic car models are loaded');
  return buildKenney(names[index % names.length], CAR.library.kenneyScale, [0, 0.9, 0.2]);
}

/** Free the per-car paint (the shared templates' geometry and materials stay). */
export function disposeCar(car) {
  car.root.traverse((o) => { if (o.isMesh && o.material.userData.owned) o.material.dispose(); });
}

/* ------------------------------------------------------------------ parked cars */

const parkedGeo = new Map();
export const parkedMaterial = () => kenneyMaterial || library.get(parkedNames()[0]).children.find((o) => o.isMesh)?.material;

/**
 * One merged geometry for a parked car of the given model: body and wheels with their node transforms baked in,
 * scaled to world units, nose towards +z. Indexed, with position, normal and uv only, so it batches into a cell.
 */
export function getParkedGeometry(name) {
  if (parkedGeo.has(name)) return parkedGeo.get(name);
  const scene = library.get(name), scale = CAR.library.kenneyScale;
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = new THREE.BufferGeometry();
    for (const a of ['position', 'normal', 'uv']) g.setAttribute(a, o.geometry.attributes[a].clone());
    g.setIndex(o.geometry.index.clone());
    g.applyMatrix4(o.matrixWorld);
    g.scale(scale, scale, scale);
    parts.push(g);
  });
  const merged = BufferGeometryUtils.mergeBufferGeometries(parts);
  parts.forEach((g) => g.dispose());
  parkedGeo.set(name, merged);
  return merged;
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);

/** Add a parked car to a Batcher at grid position (x, z) facing `ry`. The model is picked by position, so a kerb has a mix. */
export function putParkedCar(batcher, x, z, ry) {
  const names = parkedNames();
  const pick = names[Math.abs(Math.floor(x * 7 + z * 13)) % names.length];
  _m.compose(_p.set(x, 0, z), _q.setFromAxisAngle(Y, ry), _s);
  batcher.add(parkedMaterial(), getParkedGeometry(pick).clone().applyMatrix4(_m));
}
