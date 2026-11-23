/**
 * Two views, switched with the camera key (C):
 *   chase   - above and behind the car, swinging round behind it a little late, which feels like weight;
 *   cockpit - the driver's eye, looking out through the windscreen, rolling and pitching with the body.
 * The field of view widens with speed in both.
 */
import * as THREE from 'three';
import { CAMERA, RENDER, DRIVE } from './config.js';
import { angDiff, clamp } from './util/math.js';
import { sgrid } from './world/zones.js';

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);   // cars face +z, cameras look down -z

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.heading = 0;
    this.want = new THREE.Vector3();
    this.q = new THREE.Quaternion();
  }

  /** Put the camera directly behind the player straight away (used at the start). */
  snapTo(player) {
    this.heading = player.h;
    this.camera.position.set(player.x - Math.sin(player.h) * CAMERA.distance, 3.6, player.z - Math.cos(player.h) * CAMERA.distance);
  }

  resetHeading(h) {
    this.heading = h;
  }

  /** Switch between chase and cockpit. Returns the new mode. */
  toggle(player) {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.heading = player.h;
    this.camera.near = this.mode === 'cockpit' ? CAMERA.cockpitNear : RENDER.near;
    this.camera.updateProjectionMatrix();
    if (this.mode === 'chase') this.snapTo(player);
    return this.mode;
  }

  update(dt, player) {
    if (this.mode === 'cockpit' && player.car.eye) this.cockpit(player);
    else this.chase(dt, player);
    const base = this.mode === 'cockpit' ? CAMERA.cockpitFov : RENDER.fov;
    const fov = base + clamp(player.v, 0, DRIVE.maxForward) * CAMERA.fovSpeedGain;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * 0.1;
      this.camera.updateProjectionMatrix();
    }
  }

  chase(dt, player) {
    const c = CAMERA;
    this.heading += angDiff(player.h, this.heading) * Math.min(1, dt * c.followHeading);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.want.set(player.x - fx * c.distance, player.gys + c.height + player.y * 0.5, player.z - fz * c.distance);
    this.want.y = Math.max(this.want.y, sgrid(this.want.x, this.want.z) + c.minAboveGround);   // never dip below the ground
    this.camera.position.lerp(this.want, Math.min(1, dt * c.followPosition));
    this.camera.lookAt(player.x + fx * c.lookAhead, player.gys + c.lookHeight, player.z + fz * c.lookAhead);
  }

  cockpit(player) {
    const { root, tilt, eye } = player.car;
    root.updateMatrixWorld(true);
    tilt.localToWorld(this.camera.position.copy(eye));   // the eye moves with the body's roll and pitch
    tilt.getWorldQuaternion(this.q);
    this.camera.quaternion.copy(this.q).multiply(FLIP);
  }
}
