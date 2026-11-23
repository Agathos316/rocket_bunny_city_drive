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

/** A Kenney-style car: a body plus four wheels, nose towards +z. */
export function fakeKenney(length = 2.6) {
  const scene = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  scene.add(box(1.4, 0.7, length, 0, 0.7, 0, 'body', mat));
  for (const [id, x, z] of [['wheel-front-left', 0.43, length * 0.27], ['wheel-front-right', -0.43, length * 0.27], ['wheel-back-left', 0.43, -length * 0.27], ['wheel-back-right', -0.43, -length * 0.27]]) {
    scene.add(box(0.2, 0.6, 0.6, x, 0.3, z, id, mat));
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
  const { registerCar } = await import('../../src/vehicles/carLibrary.js');
  const { CAR } = await import('../../src/config.js');
  for (const [name, spec] of Object.entries(CAR.library.player)) registerCar(name, spec.kind === 'ferrari' ? fakeFerrari() : fakeKenney());
  for (const name of CAR.library.traffic) registerCar(name, fakeKenney());
}
