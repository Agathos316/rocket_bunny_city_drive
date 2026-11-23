/**
 * The car selector: press Space and the game blurs out, leaving a 3D model of a car slowly turning on a podium in the
 * middle of the screen. Left / Right (or the on-screen arrows) move through the cars like a carousel, Space picks the
 * one on show, Esc backs out. The game is paused while it is open.
 *
 *   CarSelector  the logic: which car is on show, opening, moving, confirming. It owns no graphics, so it can be tested
 *                with a stand-in view.
 *   GarageView   the pictures: its own small three.js scene (podium, lights, the car) drawn on a second canvas above a
 *                blurred copy of the game. It is built the first time the selector opens.
 */
import * as THREE from 'three';
import { reflectionFromSky } from '../environment.js';
import { disposeCar, hasCockpit, hasShowroom, loadShowroom, makeShowroomCar } from '../vehicles/carLibrary.js';

export class CarSelector {
  /**
   * @param {object} o
   * @param {string[]} o.names                   the cars, in carousel order
   * @param {(name:string)=>string} o.labelOf    display name
   * @param {()=>object} o.makeView              creates the view on first use: { show, showCar, hide, update }
   * @param {(name:string)=>void} o.onSelect     a car was chosen
   * @param {()=>void} [o.onOpen] @param {()=>void} [o.onClose]
   */
  constructor({ names, labelOf, makeView, onSelect, onOpen, onClose }) {
    Object.assign(this, { names, labelOf, makeView, onSelect, onOpen, onClose });
    this.view = null;
    this.index = 0;
    this.isOpen = false;
  }

  get current() { return this.names[this.index]; }

  open(currentName) {
    if (this.isOpen) return;
    this.index = Math.max(0, this.names.indexOf(currentName));
    this.view = this.view || this.makeView();
    this.isOpen = true;
    this.onOpen?.();
    this.view.show(this.current, this.labelOf(this.current), this.index, this.names.length);
  }

  /** dir = +1 for the next car, -1 for the previous one (wraps round). */
  move(dir) {
    if (!this.isOpen) return;
    const n = this.names.length;
    this.index = (this.index + (dir < 0 ? -1 : 1) + n) % n;
    this.view.showCar(this.current, this.labelOf(this.current), this.index, n, dir);
  }

  confirm() {
    if (!this.isOpen) return;
    const name = this.current;
    this._close();
    this.onSelect(name);
  }

  cancel() {
    if (this.isOpen) this._close();
  }

  _close() {
    this.isOpen = false;
    this.view.hide();
    this.onClose?.();
  }

  update(dt) {
    if (this.isOpen) this.view.update(dt);
  }
}

const PIP_FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);   // cars face +z, cameras look down -z

export class GarageView {
  /** @param {{doc?:Document, sky:THREE.Mesh, onMove:(dir:number)=>void}} o  `sky` is the game's sky mesh (for reflections) */
  constructor({ doc = document, sky, onMove }) {
    this.doc = doc;
    this.root = doc.getElementById('garage');
    this.nameEl = doc.getElementById('garage-name');
    this.countEl = doc.getElementById('garage-count');
    doc.getElementById('garage-prev').addEventListener('click', () => onMove(-1));
    doc.getElementById('garage-next').addEventListener('click', () => onMove(1));

    const canvas = doc.getElementById('garage-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.environment = reflectionFromSky(this.renderer, sky.geometry, sky.material);
    this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x353a44, 0.9));
    const key = new THREE.SpotLight(0xfff1dc, 2.6, 0, 0.7, 0.6);
    key.position.set(5, 14, 9);
    key.target.position.set(0, 0.8, 0);
    const rim = new THREE.DirectionalLight(0x9ec3ff, 1.1);
    rim.position.set(-7, 5, -8);
    this.scene.add(key, key.target, rim);

    const podium = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 0.5, 72), new THREE.MeshStandardMaterial({ color: 0x15181f, metalness: 0.55, roughness: 0.32, envMapIntensity: 0.8 }));
    podium.position.y = -0.25;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.045, 10, 120), new THREE.MeshBasicMaterial({ color: 0xff6a00 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.012;
    this.scene.add(podium, ring);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.podiumParts = [podium, ring];
    this.pipEl = doc.getElementById('garage-pip');
    this.pipCamera = new THREE.PerspectiveCamera(78, 1.6, 0.05, 60);   // the driver's eye, for the cockpit inset
    this.entries = [];          // cars on show: { car, x, targetX }
    this.onResize = () => this.resize();
    this.visible = false;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const back = 13 / Math.min(1, aspect / 1.25);           // pull back on narrow (portrait) screens
    this.camera.position.set(0, 3.6 + back * 0.12, back);
    this.camera.lookAt(0, 1.0, 0);
    this.camera.updateProjectionMatrix();
  }

  show(name, label, index, count) {
    this.root.hidden = false;
    this.visible = true;
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.clear();
    this.setLabel(label, index, count, name);
    this.add(name, 0, 0);
  }

  /** Slide the next car in from the side `dir` and the old one out the other side. */
  showCar(name, label, index, count, dir) {
    this.setLabel(label, index, count, name);
    for (const e of this.entries) e.targetX = -dir * 15;
    this.add(name, dir * 15, 0);
  }

  hide() {
    this.root.hidden = true;
    this.visible = false;
    window.removeEventListener('resize', this.onResize);
    this.clear();
  }

  update(dt) {
    if (!this.visible) return;
    const k = Math.min(1, dt * 8);
    for (const e of this.entries) {
      e.x += (e.targetX - e.x) * k;
      e.car.root.position.x = e.x;
      e.car.root.rotation.y += dt * 0.55;                    // the slow turn
    }
    for (const e of this.entries.filter((q) => q.targetX !== 0 && Math.abs(q.x) > 13.5)) this.remove(e);
    this.renderer.render(this.scene, this.camera);
    this.renderPip();
  }

  /**
   * Picture-in-picture: just the cockpit, as the driver sees it, to show this car has a driver's view. The car is
   * drawn square-on (not turning) and alone, in a box over the corner of the screen; cars without a cockpit show nothing.
   */
  renderPip() {
    const e = this.entries.find((q) => q.name === this.currentName && q.targetX === 0 && Math.abs(q.x) < 0.3);
    const eye = e && hasCockpit(e.name) && e.car.eye;
    this.pipEl.hidden = !eye;
    if (!eye) return;
    const r = this.pipEl.getBoundingClientRect();
    const canvas = this.renderer.domElement, cr = canvas.getBoundingClientRect();
    const x = r.left - cr.left, w = r.width, h = r.height, y = cr.bottom - r.bottom;   // CSS pixels: three scales them itself
    const { root, tilt } = e.car, spin = root.rotation.y, others = this.entries.filter((q) => q !== e);
    root.rotation.y = 0;
    root.updateMatrixWorld(true);
    tilt.localToWorld(this.pipCamera.position.copy(eye));
    tilt.getWorldQuaternion(this.pipCamera.quaternion).multiply(PIP_FLIP);
    this.pipCamera.aspect = w / h;
    this.pipCamera.updateProjectionMatrix();
    for (const p of this.podiumParts) p.visible = false;
    for (const q of others) q.car.root.visible = false;
    const oldClear = this.renderer.getClearColor(new THREE.Color()), oldAlpha = this.renderer.getClearAlpha();
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(x, y, w, h);
    this.renderer.setScissor(x, y, w, h);
    this.renderer.setClearColor(0x9fb8d0, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.pipCamera);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, cr.width, cr.height);
    this.renderer.setClearColor(oldClear, oldAlpha);
    root.rotation.y = spin;
    for (const p of this.podiumParts) p.visible = true;
    for (const q of others) q.car.root.visible = true;
  }

  /** Put a car on the stage. It appears at once in its normal model; the detailed showroom model replaces it when it arrives. */
  add(name, x, targetX) {
    const entry = { name, car: makeShowroomCar(name), x, targetX };
    entry.car.root.rotation.y = 0.6;
    entry.car.root.position.x = x;
    this.scene.add(entry.car.root);
    this.entries.push(entry);
    if (!hasShowroom(name)) {
      loadShowroom(name).then((ok) => {
        if (!ok || !this.entries.includes(entry)) return;      // none to load, or the car has left the stage meanwhile
        const old = entry.car, fresh = makeShowroomCar(name);
        fresh.root.position.copy(old.root.position);
        fresh.root.rotation.copy(old.root.rotation);
        this.scene.remove(old.root);
        disposeCar(old);
        this.scene.add(fresh.root);
        entry.car = fresh;
      });
    }
  }

  remove(e) {
    this.scene.remove(e.car.root);
    disposeCar(e.car);
    this.entries.splice(this.entries.indexOf(e), 1);
  }

  clear() {
    for (const e of [...this.entries]) this.remove(e);
  }

  setLabel(label, index, count, name) {
    if (name) this.currentName = name;
    this.nameEl.textContent = label;
    this.countEl.textContent = `${index + 1} / ${count}`;
  }
}
