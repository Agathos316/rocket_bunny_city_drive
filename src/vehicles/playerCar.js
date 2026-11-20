/**
 * The player's car: driving dynamics, vertical motion (speed-bump hops), ground following and its mesh.
 *
 * Position is in WORLD space (x, z); the grid position (gx, gz) is kept in sync for anything that thinks in
 * grid cells (chunk loading, collisions against blocks, traffic spawning).
 */
import { CAR, DRIVE, START } from '../config.js';
import { clamp } from '../util/math.js';
import { sgrid, toGrid, toWorld, worldHeading } from '../world/zones.js';
import { disposeCar, makeCar } from './carFactory.js';

/** Start pose in world space: the grid start point, bent by the world warp. */
export function startPose() {
  const [x, z] = toWorld(START.gx, START.gz);
  return { x, z, h: worldHeading(START.gx, START.gz, START.heading) };
}

export class PlayerCar {
  constructor(scene) {
    this.scene = scene;
    this.start = startPose();
    this.model = CAR.defaultModel;
    this.reset();
    this.car = makeCar(CAR.playerColor, true, this.model);
    scene.add(this.car.root);
  }

  /** Back to the start line, standing still, with no money. */
  reset() {
    Object.assign(this, {
      x: this.start.x, z: this.start.z, h: this.start.h,
      v: 0,            // speed along the heading (negative = reversing)
      steer: 0,        // smoothed steering, -1 (right) .. +1 (left)
      y: 0, vy: 0,     // hop above the ground, and its vertical speed
      acc: 0,          // smoothed acceleration, drives the body pitch
      gys: 0,          // ground height under the car (smoothed)
      sl: 0,           // road slope along the car (smoothed)
      money: 0,
    });
    this.syncGrid();
  }

  syncGrid() {
    [this.gx, this.gz] = toGrid(this.x, this.z);
  }

  /** Swap the car model. */
  setModel(name) {
    this.scene.remove(this.car.root);
    disposeCar(this.car);
    this.model = name;
    this.car = makeCar(CAR.playerColor, true, name);
    this.scene.add(this.car.root);
  }

  /** Throttle, brake and steering for one step. `input` is { throttle, brake, steer } from the input manager. */
  drive(dt, input) {
    const D = DRIVE, thr = input.throttle > 0, brk = input.brake > 0, v = this.v;
    let a = 0;
    if (thr) a = v < 0 ? D.reverseAccel : D.accel * (1 - v / D.maxForward);
    if (brk) a = v > 0.1 ? -D.brake : -D.reverseThrust * (1 + v / D.reverseRamp);
    if (!thr && !brk) a = -Math.sign(v) * Math.min(Math.abs(v) / dt, D.coastBase + Math.abs(v) * D.coastPerSpeed);
    if (thr && brk) a = -D.accel * Math.sign(v || 1) * Math.min(1, Math.abs(v));

    let nv = v + a * dt;
    if (!thr && !brk && Math.sign(nv) !== Math.sign(v)) nv = 0;   // coasting stops at zero, never reverses
    if (brk && v > 0 && nv < 0) nv = 0;                           // braking stops at zero; release and press again to reverse
    this.v = clamp(nv, -D.maxReverse, D.maxForward);
    this.acc += (a - this.acc) * Math.min(1, dt * D.accelSmoothing);

    this.steer += (input.steer - this.steer) * Math.min(1, dt * D.steerSmoothing);
    const speed = Math.abs(this.v);
    const grip = clamp(speed / D.steerSpeedFloor, 0, 1) / (1 + Math.pow(speed / D.steerSpeedFalloff, 2));   // low at a crawl and at top speed
    this.h += this.steer * D.steerRate * grip * dt * (this.v >= 0 ? 1 : -1);

    this.x += Math.sin(this.h) * this.v * dt;
    this.z += Math.cos(this.h) * this.v * dt;
    if (this.v > 0) this.money += this.v * dt * D.moneyPerMetre;
  }

  /** Kick the car into the air (speed bump). */
  hop(speed) {
    this.vy = Math.min(1.2 + Math.abs(speed) * 0.09, 6);
  }

  /** Gravity for the hop. */
  fall(dt) {
    this.vy -= DRIVE.gravity * dt;
    this.y += this.vy * dt;
    if (this.y < 0) { this.y = 0; this.vy = 0; }
  }

  /** Follow the road/terrain height and slope under the car. */
  followGround(dt) {
    this.gys += (sgrid(this.x, this.z) - this.gys) * Math.min(1, dt * 12);
    const hx = Math.sin(this.h), hz = Math.cos(this.h);
    const slope = (sgrid(this.x + hx * 2.5, this.z + hz * 2.5) - sgrid(this.x - hx * 2.5, this.z - hz * 2.5)) / 5;
    this.sl += (slope - this.sl) * Math.min(1, dt * 8);
  }

  /** Pose the mesh: position, heading, body roll and pitch, wheel spin and front-wheel steer. */
  syncMesh(dt) {
    const { root, tilt, spin, front } = this.car;
    root.position.set(this.x, this.gys + this.y, this.z);
    root.rotation.y = this.h;
    tilt.rotation.z = this.steer * clamp(Math.abs(this.v) / 35, 0, 1) * 0.06;
    tilt.rotation.x = -this.acc * 0.0013 + clamp(this.vy, -4, 4) * -0.01 - Math.atan(this.sl);
    const spinStep = this.v * dt / (CAR.wheelRadius * CAR.scale);
    for (const w of spin) w.rotation.x += spinStep;
    for (const f of front) f.rotation.y = this.steer * 0.45;
  }
}
