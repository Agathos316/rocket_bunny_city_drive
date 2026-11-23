/**
 * Cars loaded from glTF/GLB files (currently the Ferrari 458 Italia, which has a modelled cockpit).
 *
 * The files are loaded once, asynchronously (loadGltfCars); until then, or if a file cannot be loaded, the game
 * keeps using the procedural cars. buildGltfCar() turns a loaded model into the same shape makeCar() returns:
 *   { root, tilt, spin, front, eye, setSteer }
 * plus `eye` (the driver's eye in model units, for the cockpit camera) and `setSteer(x)` (turns the steering wheel).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR } from '../config.js';

const loaded = new Map();   // model name -> gltf.scene (shared template; each build clones it)

export const hasGltfCar = (name) => loaded.has(name);

/** Load every model in CAR.glbModels. Resolves to the list of names that loaded; failures are reported, not thrown. */
export async function loadGltfCars(onLoaded) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(CAR.dracoPath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const ok = [];
  await Promise.all(Object.entries(CAR.glbModels).map(async ([name, spec]) => {
    try {
      const gltf = await loader.loadAsync(spec.url);
      loaded.set(name, prepare(gltf.scene, spec));
      ok.push(name);
      onLoaded?.(name);
    } catch (error) {
      console.warn(`Could not load the ${name} model; using the built-in cars instead.`, error);
    }
  }));
  draco.dispose();
  return ok;
}

/** Replace the file's flat default materials with ones that shine: clear-coated paint, glass, chrome, rubber. */
function prepare(scene, spec) {
  const swap = new Map();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const make = (m) => {
    const n = m.name, glass = /glass/i.test(n);
    if (n === 'Body_Color') {
      const paint = new THREE.MeshPhysicalMaterial({ color: CAR.playerColor, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25 });
      paint.userData.isPaint = true;
      return paint;
    }
    if (/Taillight/i.test(n)) return new THREE.MeshPhysicalMaterial({ color: 0xc00000, emissive: 0x500000, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 });
    if (/Projector/i.test(n)) return new THREE.MeshPhysicalMaterial({ color: 0xcfd6dc, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.8, envMapIntensity: 1.5 });
    if (glass) return new THREE.MeshPhysicalMaterial({ color: 0x0c141c, metalness: 0.6, roughness: 0.02, transparent: true, opacity: 0.2, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
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
  scene.userData.spec = spec;
  return scene;
}

/** Build a ready-to-drive car from a loaded model. `color` repaints the body. */
export function buildGltfCar(name, color) {
  const spec = CAR.glbModels[name];
  const scene = loaded.get(name).clone(true);
  const Y = new THREE.Vector3(0, 1, 0);

  scene.traverse((o) => {              // the paint is per car, so a colour change never touches the shared template
    if (!o.isMesh || !o.material.userData.isPaint) return;
    o.material = o.material.clone();
    o.material.userData.owned = true;
    o.material.color.set(color);
  });

  const root = new THREE.Group(), tilt = new THREE.Group(), model = new THREE.Group();
  model.rotation.y = spec.rotateY;           // the model's nose is -z; the game's cars face +z
  model.add(scene);
  tilt.add(model);
  root.add(tilt);
  root.scale.setScalar(CAR.scale * (spec.scale || 1));
  root.updateMatrixWorld(true);

  // wheels: wrap each wheel node in a steer pivot (front) and a spin group, centred on the wheel
  const box = new THREE.Box3(), c = new THREE.Vector3(), spin = [], front = [];
  for (const id of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
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
    if (id.startsWith('wheel_f')) front.push(pivot);
  }

  // steering wheel: its rim and hub turn about the column axis (the column itself stays put)
  let setSteer = () => {};
  const sw = scene.getObjectByName('steering_wheel');
  if (sw) {
    const hub = new THREE.Group(), axis = new THREE.Vector3(...spec.steerAxis).applyAxisAngle(Y, spec.rotateY), q = new THREE.Quaternion();
    hub.position.set(...spec.steerCentre).applyAxisAngle(Y, spec.rotateY);
    tilt.add(hub);
    tilt.updateMatrixWorld(true);
    for (const part of [...sw.children]) if (part.name !== 'steering_column') hub.attach(part);
    setSteer = (steer) => { hub.quaternion.copy(q.setFromAxisAngle(axis, steer * spec.steerLock)); };
  }

  const eye = new THREE.Vector3(...spec.eye).applyAxisAngle(Y, spec.rotateY);
  return { root, tilt, spin, front, eye, setSteer };
}

/** Free the per-car paint (the shared template's geometry and other materials stay). */
export function disposeGltfCar(car) {
  car.root.traverse((o) => { if (o.isMesh && o.material.userData.owned) o.material.dispose(); });
}

/* ------------------------------------------------------------------ traffic cars */

const traffic = new Map();   // name -> template scene (Kenney Car Kit: sedan, SUV, taxi, van, ...)
let trafficMaterial = null;  // one material (the kit's shared colour palette) for every traffic and parked car, so they batch

export const loadedTrafficNames = () => CAR.trafficGlb.names.filter((n) => traffic.has(n));

/** Load the ordinary-car models used for traffic. Failures are reported and skipped. */
export async function loadTrafficCars(onLoaded) {
  const loader = new GLTFLoader();
  await Promise.all(CAR.trafficGlb.names.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(CAR.trafficGlb.dir + name + '.glb');
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (!trafficMaterial) {
          trafficMaterial = o.material;                       // the palette texture is sRGB; the renderer's output is linear, so colours come out rich
          trafficMaterial.metalness = 0.15;
          trafficMaterial.roughness = 0.55;
          trafficMaterial.envMapIntensity = 0.45;
        }
        o.material = trafficMaterial;
        o.castShadow = true;
        o.frustumCulled = false;
      });
      traffic.set(name, gltf.scene);
      onLoaded?.(name);
    } catch (error) {
      console.warn(`Could not load the ${name} traffic model; using the built-in cars instead.`, error);
    }
  }));
  return loadedTrafficNames();
}

/** A traffic car from the loaded models (picked by `index`, so a mix of body styles). Same shape as makeCar(), without a cockpit. */
export function buildTrafficCar(index) {
  const names = loadedTrafficNames();
  const scene = traffic.get(names[index % names.length]).clone(true);
  const root = new THREE.Group(), tilt = new THREE.Group();
  tilt.add(scene);
  root.add(tilt);
  root.scale.setScalar(CAR.trafficGlb.scale);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), c = new THREE.Vector3(), spin = [];
  for (const id of ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']) {
    const node = scene.getObjectByName(id);
    if (!node) continue;
    box.setFromObject(node).getCenter(c);
    const sp = new THREE.Group();
    sp.position.copy(tilt.worldToLocal(c.clone()));
    tilt.add(sp);
    tilt.updateMatrixWorld(true);
    sp.attach(node);
    spin.push(sp);
  }
  return { root, tilt, spin, front: [] };
}

const parkedGeo = new Map();
export const parkedMaterial = () => trafficMaterial;
export const parkedNames = () => loadedTrafficNames().filter((n) => !/delivery|police/.test(n));   // delivery trucks are too long for a bay

/**
 * One merged geometry for a parked car of the given model: body and wheels with their node transforms baked in,
 * scaled to world units, nose towards +z. Indexed, with position, normal and uv only, so it batches into a cell.
 */
export function getParkedGeometry(name, scale = 2.3) {
  const key = name + scale;
  if (parkedGeo.has(key)) return parkedGeo.get(key);
  const scene = traffic.get(name);
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
  parkedGeo.set(key, merged);
  return merged;
}
