/**
 * Game manager: builds the systems, owns the loop, and decides what a crash means.
 *
 *   input -> PlayerCar (driving) -> Collisions -> TrafficManager -> ChunkManager (world streaming)
 *         -> ChaseCamera -> Environment (sun/sky follow) -> HUD -> render
 *
 * update(dt) advances the simulation without drawing, which is what the tests call.
 */
import * as THREE from 'three';
import { CAR, COLLISION, KEYMAP, RENDER, START, TRAFFIC } from './config.js';
import { createRenderer } from './renderer.js';
import { createEnvironment } from './environment.js';
import { InputManager } from './input.js';
import { ChaseCamera } from './camera.js';
import { Collisions } from './collisions.js';
import { TrafficSignals } from './world/signals.js';
import { ChunkManager } from './world/chunkManager.js';
import { PlayerCar } from './vehicles/playerCar.js';
import { TrafficManager } from './traffic/trafficManager.js';
import { PedestrianManager } from './traffic/pedestrianManager.js';
import { ParkedManager } from './traffic/parkedManager.js';
import { Hud } from './ui/hud.js';
import { SettingsPanel } from './ui/settingsPanel.js';
import { AudioManager } from './audio.js';
import { CarSelector, GarageView } from './ui/carSelector.js';

export class Game {
  /**
   * Everything is created for you; pass `deps` to substitute parts (tests do this):
   * { parent, renderer, input, hud, settings, audio, makeReflection, garageView }
   * The car library (vehicles/carLibrary.js) must already be loaded: main.js awaits loadCarLibrary() first.
   */
  constructor(deps = {}) {
    this.renderer = deps.renderer || createRenderer(deps.parent || document.body);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(RENDER.fov, window.innerWidth / window.innerHeight, RENDER.near, RENDER.far);

    this.signals = new TrafficSignals();
    this.environment = createEnvironment(this.scene, this.renderer, deps.makeReflection);
    this.chunks = new ChunkManager(this.scene, { signals: this.signals });
    this.player = new PlayerCar(this.scene);
    this.traffic = new TrafficManager(this.scene, { signals: this.signals });
    this.parkedCars = new ParkedManager(this.scene, this.chunks);
    this.people = new PedestrianManager(this.scene);
    this.collisions = new Collisions(this.chunks);
    this.chase = new ChaseCamera(this.camera);

    this.input = deps.input || new InputManager(window);
    this.hud = deps.hud || new Hud(document);
    this.audio = deps.audio || new AudioManager();
    this.settings = deps.settings || new SettingsPanel({
      onTraffic: (n) => this.traffic.setCount(n, this.player),
      onSound: (on) => this.audio.setEnabled(on),
      onVolume: (v) => this.audio.setVolume(v),
      doc: document,
    });
    this.settings.setTraffic?.(TRAFFIC.defaultCount);
    this.settings.setCar?.(CAR.library.cars[CAR.defaultModel].label);
    this.audio.setVoice?.(CAR.library.cars[this.player.model].sound);
    this.settings.setSound?.(this.audio.enabled, this.audio.volume);

    this.selector = new CarSelector({
      names: Object.keys(CAR.library.cars),
      labelOf: (name) => CAR.library.cars[name].label,
      makeView: () => deps.garageView || new GarageView({ doc: document, sky: this.environment.sky, onMove: (d) => this.selector.move(d) }),
      onSelect: (name) => this.chooseCar(name),
      onOpen: () => this.audio.setPaused?.(true),
      onClose: () => this.audio.setPaused?.(false),
    });

    this.frameCount = 0;
    this.idleFrames = 0;
    this.crashes = 0;
    this.running = false;
    this.lastTime = 0;
    this.frame = this.frame.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onGesture = () => this.audio.unlock();   // browsers only allow sound after a key press or click
    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onGesture);
    window.addEventListener('pointerdown', this.onGesture);

    this.chunks.update(this.player.gx, this.player.gz, Infinity);   // build the whole starting neighbourhood before the first frame
    this.parkedCars.refresh(this.player.gx, this.player.gz);
    this.traffic.setCount(TRAFFIC.defaultCount, this.player);
    this.chase.snapTo(this.player);
  }

  /** Keys the game itself handles (driving keys go through InputManager): car selector, camera. */
  handleKey(e) {
    const open = this.selector.isOpen;
    if (KEYMAP.select.includes(e.code)) {
      e.preventDefault?.();                                   // Space must not scroll the page or press a focused button
      if (!e.repeat) { if (open) this.selector.confirm(); else this.selector.open(this.player.model); }
    } else if (open) {
      if (KEYMAP.left.includes(e.code)) this.selector.move(-1);
      else if (KEYMAP.right.includes(e.code)) this.selector.move(1);
      else if (e.code === 'Escape') this.selector.cancel();
      e.preventDefault?.();
    } else if (!e.repeat && KEYMAP.camera.includes(e.code)) this.toggleCamera();
  }

  /** The car chosen in the selector becomes the player's car; its engine voice and camera follow. */
  chooseCar(name) {
    if (name !== this.player.model) {
      this.player.setModel(name);
      this.audio.setVoice?.(CAR.library.cars[name].sound);
      this.settings.setCar?.(CAR.library.cars[name].label);
      if (this.chase.mode === 'cockpit' && !this.player.hasCockpit) this.toggleCamera();   // no interior to sit in: back to the chase view
    }
  }

  /** Chase view <-> cockpit view. */
  toggleCamera() {
    const mode = this.chase.toggle(this.player);
    return mode;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('keydown', this.onKey);
    this.selector.view?.hide?.();
    window.removeEventListener('pointerdown', this.onGesture);
    this.audio.dispose?.();
    this.input.dispose?.();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);   // clamp so a long pause never launches the car
    this.lastTime = now;
    this.update(dt);
    // behind the blurred car selector the game is frozen, so it only needs redrawing now and then
    if (!this.selector.isOpen || this.idleFrames++ % 8 === 0) this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Advance the simulation by dt seconds. */
  update(dt) {
    if (this.selector.isOpen) { this.selector.update(dt); return; }   // the game is paused behind the car selector
    const input = this.input.read();
    this.signals.update(dt);
    this.stepPlayer(dt, input);
    this.traffic.update(dt, this.player);
    this.chunks.update(this.player.gx, this.player.gz, RENDER.chunksPerFrame);
    this.parkedCars.update(dt, this.player);
    this.people.update(dt, this.player);

    const p = this.player;
    p.followGround(dt);
    p.syncMesh(dt);
    this.chase.update(dt, p);
    this.environment.update(p, this.camera, this.frameCount++);
    this.audio.update(dt, {
      speed: p.v, throttle: input.throttle, brake: input.brake, steer: p.steer,
      airborne: p.y > 0.05, gx: p.gx, gz: p.gz,
    });
    this.hud.setSpeed(p.v);
    this.hud.setMoney(p.money);
    this.hud.update(dt);
  }

  /** Drive, then test collisions in order. Any crash restarts the run and ends the step. */
  stepPlayer(dt, input) {
    const p = this.player;
    p.drive(dt, input);
    const vIn = p.v;
    if (this.collisions.blocks(p)) return this.crash();      // off the bridge and into the river
    this.collisions.houses(p);
    if (Math.abs(vIn) > 3 && Math.abs(vIn) - Math.abs(p.v) > 2) this.audio.thud(vIn);   // hit a building
    const vyBefore = p.vy;
    this.collisions.bumps(p);
    if (p.vy > vyBefore + 0.5) this.audio.bump(p.v);
    const wasAirborne = p.y > 0.01, fallSpeed = p.vy;
    p.fall(dt);
    if (wasAirborne && p.y === 0) this.audio.landing(fallSpeed);
    if (this.collisions.parkedCars(p) || this.people.hits(p)) return this.crash();
    if (this.collisions.traffic(p, this.traffic.cars)) return this.crash();
    p.syncGrid();
  }

  /** Restart at the start line, clearing money, and move traffic out of the way. */
  crash() {
    this.crashes++;
    this.audio.crash();
    const p = this.player;
    p.reset();
    this.chase.resetHeading(p.h);
    this.traffic.respawnNear(START.gx, START.gz, 70, p);
    this.hud.flashCrash(COLLISION.crashFlashSeconds);
  }
}
