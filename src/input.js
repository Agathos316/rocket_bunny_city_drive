/**
 * Input. Keys are tracked independently, so any combination can be held at once
 * (for example Up + Left accelerates while turning left).
 *
 * The rest of the game only ever sees read() -> { throttle, brake, steer }:
 *   throttle, brake: 0..1       steer: -1 (right) .. +1 (left)
 * A game controller can be added later with addSource() and no changes to the driving code.
 */
import { KEYMAP } from './config.js';

export class InputManager {
  constructor(target = window, keymap = KEYMAP) {
    this.keymap = keymap;
    this.down = new Set();
    this.sources = [];
    this.out = { throttle: 0, brake: 0, steer: 0 };
    this.watched = new Set(Object.values(keymap).flat());

    this.onKeyDown = (e) => { if (this.watched.has(e.code)) { this.down.add(e.code); e.preventDefault(); } };
    this.onKeyUp = (e) => { if (this.watched.has(e.code)) { this.down.delete(e.code); e.preventDefault(); } };
    this.onBlur = () => this.down.clear();   // releasing focus must not leave a key stuck down

    this.target = target;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  /** Register an extra input source: a function returning { throttle?, brake?, steer? } each frame. */
  addSource(read) {
    this.sources.push(read);
  }

  read() {
    const k = this.keymap, held = (codes) => (codes.some((c) => this.down.has(c)) ? 1 : 0);
    const out = this.out;
    out.throttle = held(k.throttle);
    out.brake = held(k.brake);
    out.steer = held(k.left) - held(k.right);
    for (const source of this.sources) {
      const s = source() || {};
      if (s.throttle > out.throttle) out.throttle = s.throttle;
      if (s.brake > out.brake) out.brake = s.brake;
      if (s.steer !== undefined && Math.abs(s.steer) > Math.abs(out.steer)) out.steer = s.steer;
    }
    return out;
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}
