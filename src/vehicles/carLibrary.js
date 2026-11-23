/**
 * The game's vehicles. Every car, whether you drive it, it drives itself in traffic, or it is parked at the
 * kerb, is a glTF model from the library in assets/models/ — nothing is built in code.
 *
 *   assets/models/ferrari.glb   Ferrari 458 Italia (three.js examples), with a modelled cockpit
 *   assets/models/kenney/*.glb  Kenney Car Kit (CC0): the sports and race cars you can drive
 *   assets/models/camry.glb     Toyota Camry 2020 (CC BY 4.0): every car in traffic and parked at the kerb
 *
 * loadCarLibrary() must finish before the game starts (main.js awaits it; tests call registerCar with stand-ins).
 *
 * makeCar(name) and makeTrafficCar(color) return { root, tilt, spin, front, wheelR, eye, setSteer }:
 *   root  - place and rotate this          tilt  - body group (lean / pitch it for body roll)
 *   spin  - wheel groups; rotate .x        front - front wheel pivots; rotate .y to steer
 *   wheelR - wheel radius in world units   eye - driver's eye (cockpit / hood camera)   setSteer(x) - turn the steering wheel
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CAR } from '../config.js';

const library = new Map();    // name -> template scene (never modified after registration)
const Y = new THREE.Vector3(0, 1, 0);

/** One material (the kit's shared colour palette) for every Kenney car, so a whole kerb of parked cars batches. */
let kenneyMaterial = null;

export const hasCar = (name) => library.has(name);
export const registerCar = (name, scene) => { library.set(name, scene); };
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
  jobs.push(loader.loadAsync(CAR.library.camry.url).then((gltf) => registerCar('camry', prepareCamry(gltf.scene))));
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

/** Camry: clear-coated paint (recoloured per car) and gentler reflections on everything else. The file is in metres, nose towards +z. */
function prepareCamry(scene) {
  const paint = CAR.library.camry.paintMaterial;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === paint) {
      o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.55 });
      o.material.userData.isPaint = true;
      o.geometry.computeVertexNormals();      // the file's paint panels were mesh-reduced, which leaves their normals lumpy
    } else {
      o.material.envMapIntensity = 0.7;
    }
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

/**
 * A Camry for traffic or parking, painted `color`. The wheels are part of one merged mesh in the file, so they do not spin.
 * Materials are shared except the paint, which is the car's own.
 */
export function makeTrafficCar(color) {
  if (!hasCar('camry')) throw new Error('The Camry model is not loaded');
  const scene = library.get('camry').clone(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.material.userData.isPaint) return;
    o.material = o.material.clone();
    o.material.userData.owned = true;
    o.material.color.set(color);
  });
  const root = new THREE.Group(), tilt = new THREE.Group();
  tilt.add(scene);
  root.add(tilt);
  root.scale.setScalar(CAR.scale);
  return { root, tilt, spin: [], front: [], wheelR: 0.33 * CAR.scale, eye: new THREE.Vector3(0, 1.1, 0), setSteer() {}, paint: (c) => scene.traverse((o) => { if (o.isMesh && o.material.userData.owned) o.material.color.set(c); }) };
}

/** Free the per-car paint (the shared templates' geometry and materials stay). */
export function disposeCar(car) {
  car.root.traverse((o) => { if (o.isMesh && o.material.userData.owned) o.material.dispose(); });
}
