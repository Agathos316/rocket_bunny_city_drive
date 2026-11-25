// Stand-ins for the glTF car library, so the game can run under Node (no files, no GPU, no image decoding).
// They have the same node names the real models do, which is all the car code looks at.
// Call registerFakeCars() after installDom() and before creating a Game.
import * as THREE from 'three';

function box(w, h, d, x, y, z, name, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.name = name;
  m.position.set(x, y, z);
  return m;
}

/** A pipeline-style car: nodes LOD0..LOD2 (one box each), with a paint material named like the real model's. */
export function fakePipelineCar(paintName) {
  const scene = new THREE.Group(), plain = new THREE.MeshStandardMaterial({ color: 0xcccccc, name: 'trim' });
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, name: paintName || 'trim' });
  for (const [i, n] of [0, 1, 2].entries()) {
    const lod = new THREE.Group();
    lod.name = 'LOD' + i;
    lod.add(box(1.8, 0.8, 4.7, 0, 0.7, 0, 'body', paint), box(1.6, 0.5, 2.4, 0, 1.3, -0.3, 'cabin', plain));
    scene.add(lod);
  }
  return scene;
}

/** A Ferrari-style car: nose towards -z, four wheel nodes and a steering wheel made of several parts. */
export function fakeFerrari() {
  const scene = new THREE.Group(), body = new THREE.MeshPhysicalMaterial({ color: 0x990000 });
  body.userData.isPaint = true;
  const plain = new THREE.MeshStandardMaterial({ color: 0x333333 });
  scene.add(box(2, 0.9, 4.5, 0, 0.7, 0, 'body', body));
  for (const [id, x, z] of [['wheel_fl', -0.84, -1.16], ['wheel_fr', 0.83, -1.15], ['wheel_rl', -0.82, 1.49], ['wheel_rr', 0.82, 1.5]]) {
    const wheel = new THREE.Group();
    wheel.name = id;
    wheel.position.set(x, 0.36, z);
    wheel.add(box(0.28, 0.72, 0.72, 0, 0, 0, 'tire', plain));
    scene.add(wheel);
  }
  const sw = new THREE.Group();
  sw.name = 'steering_wheel';
  sw.position.set(-0.35, 0.8, -0.35);
  sw.add(box(0.37, 0.3, 0.05, 0, 0, 0, 'steering_leather', plain), box(0.04, 0.04, 0.3, 0, 0, 0.1, 'steering_column', plain));
  scene.add(sw);
  return scene;
}

export async function registerFakeCars() {
  const { registerCar, setShowroomLoading } = await import('../../src/vehicles/carLibrary.js');
  setShowroomLoading(false);          // there are no files to fetch under Node
  const { CAR } = await import('../../src/config.js');
  for (const [name, spec] of Object.entries(CAR.library.cars)) {
    registerCar(name, spec.kind === 'ferrari' ? fakeFerrari() : spec.kind === 'procedural' ? fakePipelineCar(spec.paint) : spec.raw ? fakeRaw() : fakePipelineCar(spec.paint));
  }
}

/** A raw (un-pipelined) car such as the Mustang: no LOD nodes, any size, any position. */
export function fakeRaw() {
  const scene = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  scene.add(box(2, 1, 9, 3, 5, 3, 'body', mat));
  return scene;
}
