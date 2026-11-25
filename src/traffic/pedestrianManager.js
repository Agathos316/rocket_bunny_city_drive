/**
 * People. Walker paths come from world/people.js; this draws the nearest ones with a few instanced meshes
 * (torso, head, two arms, two legs, each part one InstancedMesh with per-instance colour) and swings arms and legs as they walk.
 */
import * as THREE from 'three';
import { C, PEOPLE } from '../config.js';
import { capsulePoints } from '../util/math.js';
import { toWorld, worldHeading } from '../world/zones.js';
import { walkerAt, walkersFor } from '../world/people.js';

const _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), _q = new THREE.Matrix4(), _s = new THREE.Matrix4(), _c = new THREE.Color();

export class PedestrianManager {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.cache = new Map();          // "i,j" -> walkers
    this.near = [];                  // [{ w, wx, wz }] drawn this frame
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mk = (geo) => {
      const mesh = new THREE.InstancedMesh(geo, mat, PEOPLE.max * 2);
      mesh.setColorAt(0, _c.set(0xffffff));            // (first: this sizes the colour buffer from mesh.count)
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    };
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.torso = mk(box); this.head = mk(new THREE.SphereGeometry(1, 10, 8)); this.arms = mk(box); this.legs = mk(box);
    this.parts = [this.torso, this.head, this.arms, this.legs];
  }

  walkers(i, j) {
    const key = i + ',' + j;
    let list = this.cache.get(key);
    if (!list) {
      if (this.cache.size > 80) this.cache.clear();
      this.cache.set(key, list = walkersFor(i, j));
    }
    return list;
  }

  /** Put part `mesh[n]` at person-local `at`, hinged at its top and swung by `swing` about x, scaled to size. */
  _part(mesh, n, person, color, ax, ay, az, swing, w, h, d, pivotTop) {
    _p.makeTranslation(ax, ay, az);
    _q.makeRotationX(swing);
    _s.makeScale(w, h, d);
    _m.copy(person).multiply(_p).multiply(_q);
    if (pivotTop) _m.multiply(_p.makeTranslation(0, -h / 2, 0));
    _m.multiply(_s);
    mesh.setMatrixAt(n, _m);
    mesh.setColorAt(n, _c.set(color));
  }

  update(dt, player) {
    this.time += dt;
    const ci = Math.floor(player.gx / C), cj = Math.floor(player.gz / C), r2 = PEOPLE.radius ** 2, found = [];
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        for (const w of this.walkers(ci + a, cj + b)) {
          const pos = walkerAt(w, this.time), d = (pos.x - player.gx) ** 2 + (pos.z - player.gz) ** 2;
          if (d < r2) found.push({ w, pos, d });
        }
      }
    }
    if (found.length > PEOPLE.max) { found.sort((p, q) => p.d - q.d); found.length = PEOPLE.max; }
    this.near.length = 0;
    const person = new THREE.Matrix4();
    found.forEach(({ w, pos }, n) => {
      const [wx, wz] = toWorld(pos.x, pos.z), yaw = worldHeading(pos.x, pos.z, Math.atan2(pos.hx, pos.hz)), k = w.height;
      person.makeRotationY(yaw).setPosition(wx, pos.y, wz).multiply(_p.makeScale(k, k, k));
      const sw = Math.sin(pos.step) * 0.7;
      this._part(this.torso, n, person, w.shirt, 0, 1.15, 0, 0, 0.46, 0.66, 0.26, false);
      this._part(this.head, n, person, w.skin, 0, 1.64, 0, 0, 0.14, 0.15, 0.14, false);
      this._part(this.arms, 2 * n, person, w.shirt, -0.3, 1.45, 0, sw, 0.12, 0.6, 0.14, true);
      this._part(this.arms, 2 * n + 1, person, w.shirt, 0.3, 1.45, 0, -sw, 0.12, 0.6, 0.14, true);
      this._part(this.legs, 2 * n, person, w.pants, -0.11, 0.84, 0, -sw, 0.19, 0.84, 0.22, true);
      this._part(this.legs, 2 * n + 1, person, w.pants, 0.11, 0.84, 0, sw, 0.19, 0.84, 0.22, true);
      if (w.solid) this.near.push({ wx, wz });
    });
    this.torso.count = this.head.count = found.length;
    this.arms.count = this.legs.count = found.length * 2;
    for (const m of this.parts) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.active = found.length;
  }

  /** True if the car runs over someone standing about in a town garden. */
  hits(p) {
    if (!this.near.length) return false;
    for (const [x, z] of capsulePoints(p.x, p.z, p.h, 1.6)) {
      for (const q of this.near) if (Math.hypot(q.wx - x, q.wz - z) < PEOPLE.hitDistance) return true;
    }
    return false;
  }
}
