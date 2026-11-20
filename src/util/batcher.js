/**
 * Collects many small transformed geometries per material, then merges each material's pieces into
 * a single mesh. A whole city block becomes about a dozen draw calls instead of hundreds.
 */
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class Batcher {
  constructor() {
    this.groups = new Map();   // material -> geometry[]
  }

  /** Add a transformed copy of `geo`: position (x, y, z), scale (sx, sy, sz), rotation ry about the Y axis. */
  put(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
    const g = geo.clone();
    _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, ry), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    this.add(mat, g);
  }

  /** Add geometries that are already in place (ownership passes to the batcher). */
  add(mat, ...geos) {
    let list = this.groups.get(mat);
    if (!list) this.groups.set(mat, list = []);
    list.push(...geos);
  }

  /**
   * Merge and attach to `group`. Every created geometry is pushed onto `owned` so the caller can dispose it.
   * `shadowMats` is the set of materials whose meshes cast shadows. `adjust(mat, geometry)` may edit a merged geometry.
   */
  build(group, owned, shadowMats, adjust) {
    for (const [mat, list] of this.groups) {
      const merged = list.length > 1 ? BufferGeometryUtils.mergeBufferGeometries(list) : list[0];
      // If pieces turn out to be incompatible, keep them as separate meshes instead of losing them.
      const parts = merged ? [merged] : list;
      if (merged && list.length > 1) list.forEach((g) => g.dispose());
      for (const geo of parts) {
        if (adjust) adjust(mat, geo);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = shadowMats.has(mat);
        mesh.receiveShadow = true;
        group.add(mesh);
        owned.push(geo);
      }
    }
    this.groups.clear();
  }
}
