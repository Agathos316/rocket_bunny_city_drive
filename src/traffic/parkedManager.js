/**
 * Parked cars. The city cells only record where cars are parked (ChunkManager.parked: grid position and facing);
 * the cars are drawn here, from a small pool that follows the player, because the Camry model is detailed
 * (about 21k triangles) and a whole city of them would be far too heavy. Cars appear and disappear well inside the
 * fog, so nobody sees it happen. Colours are fixed per slot, so a car looks the same each time you come back.
 */
import { CAR, PARKED } from '../config.js';
import { toWorld, worldHeading } from '../world/zones.js';
import { makeTrafficCar } from '../vehicles/carLibrary.js';

export class ParkedManager {
  constructor(scene, chunks) {
    this.scene = scene;
    this.chunks = chunks;
    this.pool = [];                 // { car, slot }
    this.clock = 0;
  }

  /** Re-pick which parked slots have a car; cheap enough to run a few times a second. */
  update(dt, player) {
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = PARKED.refreshSeconds;
    this.refresh(player.gx, player.gz);
  }

  refresh(gx, gz) {
    const near = [], r2 = PARKED.radius * PARKED.radius;
    for (const [cell, list] of this.chunks.parked) {
      list.forEach((s, n) => {
        const d = (s.x - gx) ** 2 + (s.z - gz) ** 2;
        if (d < r2) near.push({ key: cell + ':' + n, d, s });
      });
    }
    near.sort((a, b) => a.d - b.d);
    const want = new Map(near.slice(0, PARKED.count).map((e) => [e.key, e.s]));
    const taken = new Set();
    for (const p of this.pool) {                         // keep cars whose slot is still wanted, free the rest
      if (p.slot && want.has(p.slot)) taken.add(p.slot);
      else if (p.slot) { p.slot = null; p.car.root.visible = false; }
    }
    for (const [key, s] of want) {
      if (taken.has(key)) continue;
      let p = this.pool.find((q) => !q.slot);
      if (!p) {
        if (this.pool.length >= PARKED.count) break;
        p = { car: makeTrafficCar(0xffffff), slot: null };
        this.scene.add(p.car.root);
        this.pool.push(p);
      }
      this.place(p, key, s);
    }
  }

  place(p, key, s) {
    p.slot = key;
    const [wx, wz] = toWorld(s.x, s.z);
    p.car.root.position.set(wx, 0.02, wz);
    p.car.root.rotation.y = worldHeading(s.x, s.z, Math.atan2(s.hx, s.hz));
    p.car.root.visible = true;
    let h = 2166136261;                                  // colour from the slot's position: stable, but varied
    for (const v of [Math.round(s.x * 10), Math.round(s.z * 10)]) h = Math.imul(h ^ v, 16777619);
    p.car.paint(CAR.library.trafficColors[(h >>> 0) % CAR.library.trafficColors.length]);
  }

  get active() {
    return this.pool.filter((p) => p.slot).length;
  }
}
