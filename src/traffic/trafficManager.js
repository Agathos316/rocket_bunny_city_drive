/**
 * Traffic. Cars drive on grid lines in grid space and are bent into world space for display.
 *
 * Each car: cruises at its own speed (faster on highways), slows for the car ahead and for the player,
 * stops at red/amber lights in the city, and at intersections may turn. A turn is planned about 30 units
 * ahead, the car slows, then follows one smooth quadratic Bezier from its lane into the new lane.
 * On highways there are only roads on some lines, so cars pick among the exits that exist and U-turn at dead ends.
 * Cars that drift too far from the player are recycled to a fresh spot ahead of them.
 */
import { C, RD, CAR, TRAFFIC, SIGNALS } from '../config.js';
import { angDiff } from '../util/math.js';
import { makeCar } from '../vehicles/carFactory.js';
import { buildTrafficCar, loadedTrafficNames } from '../vehicles/gltfCar.js';
import { disposeCar } from '../vehicles/carFactory.js';
import { Hr, cityBridgeY, isHwy, roadAt, toWorld, worldHeading } from '../world/zones.js';

/** Is there a road leaving intersection (ci, cj) in direction (dx, dz)? */
const exitExists = (ci, cj, dx, dz) =>
  dz > 0 ? roadAt(ci, cj, 'z') : dz < 0 ? roadAt(ci, cj - 1, 'z') : dx > 0 ? roadAt(ci, cj, 'x') : roadAt(ci - 1, cj, 'x');

export class TrafficManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{ signals: import('../world/signals.js').TrafficSignals }} deps
   */
  constructor(scene, { signals }) {
    this.scene = scene;
    this.signals = signals;
    this.cars = [];
    this.playerProxy = { x: 0, z: 0, fx: 0, fz: 1 };   // the player as the cars see them: grid position and heading
  }

  get activeCount() {
    return this.cars.filter((c) => c.on).length;
  }

  /** An ordinary car (sedan, SUV, taxi, van...) once those models have loaded; the built-in car shapes until then. */
  makeTrafficCar(i) {
    if (loadedTrafficNames().length) return { ...buildTrafficCar(i), ordinary: true };
    return makeCar(CAR.trafficColors[i % CAR.trafficColors.length], false, CAR.models[i % CAR.models.length]);
  }

  /** The ordinary-car models have just loaded: swap them in for the built-in shapes already driving around. */
  upgradeCars() {
    this.cars.forEach((a, i) => {
      if (a.car.ordinary) return;
      const fresh = this.makeTrafficCar(i);
      this.scene.remove(a.car.root);
      disposeCar(a.car);
      fresh.root.position.copy(a.car.root.position);
      fresh.root.rotation.y = a.car.root.rotation.y;
      fresh.root.visible = a.car.root.visible;
      this.scene.add(fresh.root);
      a.car = fresh;
    });
  }

  /** Show exactly `n` cars; newly shown cars appear on nearby roads. `player` provides the reference position. */
  setCount(n, player) {
    while (this.cars.length < n) {
      const i = this.cars.length;
      const car = this.makeTrafficCar(i);
      this.scene.add(car.root);
      this.cars.push({ car, on: false });
    }
    this.cars.forEach((a, i) => {
      const on = i < n;
      if (on && !a.on) this.spawn(a, player.gx, player.gz);
      a.on = on;
      a.car.root.visible = on;
    });
  }

  /** Put a car on a road 90-200 units from (gx, gz), travelling along it with a fresh personality. */
  spawn(a, gx, gz) {
    const T = TRAFFIC, ci = Math.floor(gx / C), cj = Math.floor(gz / C);
    let i, j, dir, alongZ, u, x, z, tries = 0;
    do {
      i = ci + ((Math.random() * 7 | 0) - 3);
      j = cj + ((Math.random() * 7 | 0) - 3);
      dir = Math.random() < 0.5 ? 1 : -1;
      alongZ = Math.random() < 0.5;
      u = RD + 4 + Math.random() * (C - 2 * RD - 8);
      x = alongZ ? i * C + T.laneOffset * dir : i * C + u;
      z = alongZ ? j * C + u : j * C - T.laneOffset * dir;
      const d = Math.hypot(x - gx, z - gz);
      if (d >= T.spawnMin && d <= T.spawnMax && roadAt(i, j, alongZ ? 'z' : 'x')) break;
    } while (++tries < 30);
    a.x = x; a.z = z;
    a.dx = alongZ ? 0 : dir;
    a.dz = alongZ ? dir : 0;
    a.cruise = T.cruiseMin + Math.random() * T.cruiseSpread;
    a.speed = a.cruise;
    a.turn = null;
    a.plan = null;
    a.key = '';
    a.h = Math.atan2(a.dx, a.dz);
    this.pose(a);
  }

  /** Re-spawn any car within `radius` of grid point (gx, gz), e.g. around the start after a crash. */
  respawnNear(gx, gz, radius, player) {
    for (const a of this.cars) {
      if (a.on && Math.hypot(a.x - gx, a.z - gz) < radius) this.spawn(a, player.gx, player.gz);
    }
  }

  /** Advance every car by dt. `player` is a PlayerCar (needs gx, gz, h, v). */
  update(dt, player) {
    const pp = this.playerProxy;
    pp.x = player.gx; pp.z = player.gz; pp.fx = Math.sin(player.h); pp.fz = Math.cos(player.h);

    for (const a of this.cars) {
      if (!a.on) continue;
      const highway = isHwy(Math.floor(a.x / C), Math.floor(a.z / C));
      const mult = highway ? TRAFFIC.highwayMultiplier : 1;
      let target = (a.plan || a.turn)
        ? Math.min(a.cruise * mult, highway ? TRAFFIC.cornerSpeedHighway : TRAFFIC.cornerSpeedCity)
        : a.cruise * mult;

      // follow the traffic ahead, and the player, at a speed that lets us stop in the gap
      for (const o of this.cars) {
        if (o === a || !o.on) continue;
        target = this.limitByLeader(a, o.x, o.z, o.speed, target);
      }
      const playerSpeed = Math.max(0, player.v * (pp.fx * a.dx + pp.fz * a.dz));
      target = this.limitByLeader(a, pp.x, pp.z, playerSpeed, target);

      target = Math.min(target, this.lightLimit(a));
      a.speed += (target - a.speed) * Math.min(1, dt * (target < a.speed ? 7 : 3.5));

      this.move(a, dt);

      // ease back into the lane and onto the lane heading (not while turning: the curve does that)
      if (!a.turn) {
        const k = Math.min(1, dt * 5), L = TRAFFIC.laneOffset;
        if (a.dx) a.z += (Math.round(a.z / C) * C - L * a.dx - a.z) * k;
        else a.x += (Math.round(a.x / C) * C + L * a.dz - a.x) * k;
        a.h += angDiff(Math.atan2(a.dx, a.dz), a.h) * k;
      }

      this.pose(a);
      const wheelStep = a.speed * dt / (CAR.wheelRadius * CAR.scale);
      for (const w of a.car.spin) w.rotation.x += wheelStep;
      if (Math.hypot(a.x - pp.x, a.z - pp.z) > TRAFFIC.despawn) this.spawn(a, pp.x, pp.z);
    }
  }

  /** Lower `target` so that car `a` can stop behind something at (ox, oz) moving at `os`, if it is ahead in the lane. */
  limitByLeader(a, ox, oz, os, target) {
    const rx = ox - a.x, rz = oz - a.z;
    const ahead = rx * a.dx + rz * a.dz, side = Math.abs(rx * a.dz - rz * a.dx);
    if (ahead > 0 && ahead < TRAFFIC.lookAhead && side < TRAFFIC.laneWidthCheck) {
      return Math.min(target, os + Math.sqrt(2 * TRAFFIC.followDecel * Math.max(0, ahead - TRAFFIC.followGap)));
    }
    return target;
  }

  /** Speed limit imposed by the traffic light ahead (city intersections only). 99 = no limit. */
  lightLimit(a) {
    const cx = Math.round(a.x / C) * C, cz = Math.round(a.z / C) * C;
    const rel = (cx - a.x) * a.dx + (cz - a.z) * a.dz, ci = cx / C, cj = cz / C;
    if (a.turn || rel <= 9.5 || rel > 70 || isHwy(ci, cj)) return 99;
    const state = this.signals.state(ci, cj, a.dx ? 0 : 1);
    if (state === 'g' || (state === 'a' && rel < 18)) return 99;
    return Math.sqrt(2 * SIGNALS.stopDecel * Math.max(0, rel - 12)) + 0.5;   // brake to stop at the line
  }

  /** Straight-line motion plus turn planning and the Bezier turn itself. */
  move(a, dt) {
    const T = a.turn;
    if (T) {
      T.t += a.speed * dt / T.len;
      if (T.t >= 1) {                                   // turn finished: snap to the exit and carry on straight
        a.x = T.X[0]; a.z = T.X[1];
        a.dx = T.nd[0]; a.dz = T.nd[1];
        a.h = Math.atan2(a.dx, a.dz);
        a.turn = null;
        return;
      }
      const t = T.t, u = 1 - t;
      a.x = u * u * T.E[0] + 2 * u * t * T.K[0] + t * t * T.X[0];
      a.z = u * u * T.E[1] + 2 * u * t * T.K[1] + t * t * T.X[1];
      a.h = Math.atan2(
        2 * u * (T.K[0] - T.E[0]) + 2 * t * (T.X[0] - T.K[0]),
        2 * u * (T.K[1] - T.E[1]) + 2 * t * (T.X[1] - T.K[1]));
      return;
    }

    a.x += a.dx * a.speed * dt;
    a.z += a.dz * a.speed * dt;
    const cx = Math.round(a.x / C) * C, cz = Math.round(a.z / C) * C;
    const rel = (cx - a.x) * a.dx + (cz - a.z) * a.dz;           // distance to the intersection ahead
    const key = cx + ',' + cz, ci = cx / C, cj = cz / C;
    const highway = isHwy(ci, cj), radius = highway ? TRAFFIC.highwayTurnRadius : TRAFFIC.cityTurnRadius;

    if (rel > 0 && rel < radius + 26 && key !== a.key) {          // decide once per intersection
      a.key = key;
      const left = [a.dz, -a.dx], right = [-a.dz, a.dx];
      const straight = exitExists(ci, cj, a.dx, a.dz);
      const turns = [left, right].filter((v) => exitExists(ci, cj, v[0], v[1]));
      const turnChance = highway ? TRAFFIC.turnChanceHighway : TRAFFIC.turnChanceCity;
      a.plan = straight && (!turns.length || Math.random() > turnChance)
        ? null
        : turns.length ? turns[Math.random() * turns.length | 0] : [-a.dx, -a.dz];   // dead end: U-turn
    }
    if (a.plan && rel > 0 && rel <= radius) {                     // begin the turn
      const nd = a.plan, L = TRAFFIC.laneOffset;
      const lane = (v) => [v[1] * L, -v[0] * L];
      const ld = lane([a.dx, a.dz]), ln = lane(nd);
      const E = [a.x, a.z];                                       // entry
      const K = [cx + ld[0] + ln[0], cz + ld[1] + ln[1]];         // control point at the lane crossing
      const X = [cx + nd[0] * radius + ln[0], cz + nd[1] * radius + ln[1]];   // exit
      const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
      a.turn = { E, K, X, nd, t: 0, len: (2 * dist(E, X) + dist(E, K) + dist(K, X)) / 3 };
      a.plan = null;
    }
  }

  /** Update the car's world-space pose from its grid position (also used by collisions as wx, wz, wh). */
  pose(a) {
    const [wx, wz] = toWorld(a.x, a.z);
    a.wx = wx; a.wz = wz;
    a.wh = worldHeading(a.x, a.z, a.h);
    a.car.root.position.set(wx, Math.max(Hr(a.x, a.z), cityBridgeY(a.x, a.z)) + 0.06, wz);
    a.car.root.rotation.y = a.wh;
  }
}
