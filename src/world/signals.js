/**
 * Traffic lights. Two groups of intersections run opposite phases (checkerboard); at each intersection
 * the cross street runs half a cycle behind. One shared set of lamp materials is recoloured as the
 * signals change, so every intersection in the same group switches together at no per-light cost.
 */
import * as THREE from 'three';
import { SIGNALS } from '../config.js';

const ON = [0xff2a1f, 0xffb800, 0x2dff6a];    // red, amber, green lit
const OFF = [0x3a0f0c, 0x3a2a00, 0x0a3a1a];   // and unlit

export class TrafficSignals {
  constructor() {
    this.time = 0;
    // lamps[group][axis][0 = red, 1 = amber, 2 = green]
    this.lamps = [0, 1].map(() => [0, 1].map(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0 }))));
    this._shown = [[null, null], [null, null]];
    this._paint();
  }

  /** Lamp material for a given group (0/1), axis (0/1) and lamp (0 red, 1 amber, 2 green). */
  lamp(group, axis, k) {
    return this.lamps[group][axis][k];
  }

  /** 'g', 'a' or 'r' for a group and axis. */
  phase(group, axis) {
    const { cycle, green, amber, phaseOffset } = SIGNALS;
    const t = (this.time + group * phaseOffset + (axis ? phaseOffset : 0)) % cycle;
    return t < green ? 'g' : t < green + amber ? 'a' : 'r';
  }

  /** State of the lights facing traffic travelling along `axis` at intersection (i, j). */
  state(i, j, axis) {
    return this.phase((i + j) & 1, axis);
  }

  update(dt) {
    this.time += dt;
    this._paint();
  }

  _paint() {
    for (let g = 0; g < 2; g++) {
      for (let ax = 0; ax < 2; ax++) {
        const s = this.phase(g, ax);
        if (this._shown[g][ax] === s) continue;
        this._shown[g][ax] = s;
        for (let k = 0; k < 3; k++) {
          const lit = (k === 0 && s === 'r') || (k === 1 && s === 'a') || (k === 2 && s === 'g');
          this.lamps[g][ax][k].color.setHex(lit ? ON[k] : OFF[k]);
        }
      }
    }
  }
}
