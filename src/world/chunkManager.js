/**
 * Streams the endless world: keeps the cells around the player built, drops the ones left behind.
 * Cells are generated one (or a few) per frame so crossing into new territory never stalls the game.
 */
import { C, RAD } from '../config.js';
import { generateCity } from './cityCell.js';
import { generateHighway } from './highwayCell.js';
import { isHwy, warpX, warpZ } from './zones.js';

export class ChunkManager {
  /** `signals` is the TrafficSignals instance whose lamp materials the city cells use. */
  constructor(scene, { signals }) {
    this.scene = scene;
    this.signals = signals;
    this.cells = new Map();    // "i,j" -> { i, j, group, owned, bumps }
    this.parked = new Map();   // "i,j" -> [{ x, z, hx, hz }] parked cars in that cell (grid coordinates)
  }

  static key(i, j) { return i + ',' + j; }

  get(i, j) { return this.cells.get(ChunkManager.key(i, j)); }

  /**
   * Make sure the cells around grid position (gx, gz) exist, building at most `budget` new ones
   * (nearest first), and remove cells that are too far away.
   */
  update(gx, gz, budget) {
    const ci = Math.floor(gx / C), cj = Math.floor(gz / C);
    for (const [key, cell] of this.cells) {
      if (Math.abs(cell.i - ci) > RAD + 1 || Math.abs(cell.j - cj) > RAD + 1) this._remove(key, cell);
    }
    const missing = [];
    for (let a = -RAD; a <= RAD; a++) {
      for (let b = -RAD; b <= RAD; b++) {
        if (!this.cells.has(ChunkManager.key(ci + a, cj + b))) missing.push([a * a + b * b, ci + a, cj + b]);
      }
    }
    missing.sort((p, q) => p[0] - q[0]);
    for (let n = 0; n < Math.min(budget, missing.length); n++) this._build(missing[n][1], missing[n][2]);
  }

  _build(i, j) {
    const built = isHwy(i, j) ? generateHighway(i, j) : generateCity(i, j, { signals: this.signals });
    warpGroup(built.group);
    this.scene.add(built.group);
    const key = ChunkManager.key(i, j);
    this.cells.set(key, { i, j, group: built.group, owned: built.owned, bumps: built.bumps, houses: built.houses || [] });
    if (built.parked) this.parked.set(key, built.parked);
  }

  _remove(key, cell) {
    cell.owned.forEach((g) => g.dispose());
    this.scene.remove(cell.group);
    this.cells.delete(key);
    this.parked.delete(key);
  }
}

/**
 * Bend a finished cell from the straight grid into world space. Merged meshes have each vertex displaced;
 * speed bumps (shared geometry) are moved and turned as a whole so they stay rectangular.
 */
function warpGroup(group) {
  group.traverse((m) => {
    if (!m.isMesh) return;
    if (m.userData.isBump) {
      const x = m.position.x, z = m.position.z;
      const dX = (warpX(x, z + 1) - warpX(x, z - 1)) / 2, dZ = (warpZ(x + 1, z) - warpZ(x - 1, z)) / 2;
      m.position.x = x + warpX(x, z);
      m.position.z = z + warpZ(x, z);
      m.rotation.y = m.scale.x > m.scale.z ? -Math.atan(dZ) : Math.atan(dX);
      return;
    }
    const p = m.geometry.attributes.position;
    for (let q = 0; q < p.count; q++) {
      const x = p.getX(q), z = p.getZ(q);
      p.setX(q, x + warpX(x, z));
      p.setZ(q, z + warpZ(x, z));
    }
    p.needsUpdate = true;
    m.geometry.computeBoundingSphere();
    m.geometry.computeBoundingBox();
  });
}
