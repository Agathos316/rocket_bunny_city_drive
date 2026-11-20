/** Chase camera: sits above and behind the car so the car stays front and centre; widens the view with speed. */
import * as THREE from 'three';
import { CAMERA, RENDER, DRIVE } from './config.js';
import { angDiff, clamp } from './util/math.js';
import { sgrid } from './world/zones.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.heading = 0;                  // the camera swings round behind the car a little late, which feels like weight
    this.want = new THREE.Vector3();
  }

  /** Put the camera directly behind the player straight away (used at the start). */
  snapTo(player) {
    this.heading = player.h;
    this.camera.position.set(player.x, 5.2, player.z + 10.5);
  }

  resetHeading(h) {
    this.heading = h;
  }

  update(dt, player) {
    const c = CAMERA;
    this.heading += angDiff(player.h, this.heading) * Math.min(1, dt * c.followHeading);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.want.set(player.x - fx * c.distance, player.gys + c.height + player.y * 0.5, player.z - fz * c.distance);
    this.want.y = Math.max(this.want.y, sgrid(this.want.x, this.want.z) + c.minAboveGround);   // never dip below the ground
    this.camera.position.lerp(this.want, Math.min(1, dt * c.followPosition));
    this.camera.lookAt(player.x + fx * c.lookAhead, player.gys + c.lookHeight, player.z + fz * c.lookAhead);

    const fov = RENDER.fov + clamp(player.v, 0, DRIVE.maxForward) * c.fovSpeedGain;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * 0.1;
      this.camera.updateProjectionMatrix();
    }
  }
}
