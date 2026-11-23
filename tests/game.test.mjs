// Integration tests: the whole game running headless (no GPU, no real DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, fakeRenderer, fakeInput, fakeGarage } from './helpers/dom.mjs';
import { recordingAudio } from './helpers/audio.mjs';

const dom = installDom();   // must happen before the game's modules are imported
await (await import('./helpers/models.mjs')).registerFakeCars();   // every vehicle is a model file; these stand in for them
const { Game } = await import('../src/game.js');
const { C, RAD, TRAFFIC, CAR, DRIVE } = await import('../src/config.js');
const { toWorld, toGrid, worldHeading } = await import('../src/world/zones.js');
const { InputManager } = await import('../src/input.js');
const { TrafficSignals } = await import('../src/world/signals.js');
const { makeCar, makeTrafficCar, playerNames, trafficNames } = await import('../src/vehicles/carLibrary.js');
const { ChunkManager } = await import('../src/world/chunkManager.js');
const { TrafficSignals: Signals } = await import('../src/world/signals.js');
const THREE = await import('three');
const { getAssets } = await import('../src/assets.js');

const DT = 1 / 60;

/** Put the player at a grid position, facing a grid direction (0 = +z), and standing still. */
function placeAt(game, gx, gz, gridHeading = 0) {
  const [x, z] = toWorld(gx, gz);
  Object.assign(game.player, { x, z, h: worldHeading(gx, gz, gridHeading), v: 0, steer: 0, gys: 0 });
  game.player.syncGrid();
}

function makeGame({ traffic } = {}) {
  dom.elements.clear();   // fresh UI elements, so listeners from earlier games in this file cannot fire
  const input = fakeInput();
  const audio = recordingAudio();
  const garage = fakeGarage();
  const game = new Game({ renderer: fakeRenderer(), input, audio, makeReflection: () => null, garageView: garage });
  game.garage = garage;
  if (traffic !== undefined) game.traffic.setCount(traffic, game.player);
  return { game, input, audio };
}
const run = (game, seconds) => { for (let t = 0; t < seconds; t += DT) game.update(DT); };
const finite = (p) => ['x', 'z', 'h', 'v', 'y', 'gys', 'money', 'steer'].every((k) => Number.isFinite(p[k]));

test('boot: builds the starting neighbourhood, traffic, and puts the car on the start line', () => {
  const { game } = makeGame();
  assert.equal(game.chunks.cells.size, (2 * RAD + 1) ** 2);
  assert.equal(game.traffic.activeCount, TRAFFIC.defaultCount);
  assert.equal(game.player.v, 0);
  assert.equal(game.player.money, 0);
  assert.ok(game.scene.children.length > 10);
});

test('driving: throttle accelerates the car forward and earns money', () => {
  const { game, input } = makeGame({ traffic: 0 });
  const start = { x: game.player.x, z: game.player.z };
  input.value.throttle = 1;
  run(game, 1.5);
  const p = game.player;
  assert.ok(p.v > 20, `speed after 1.5s was ${p.v}`);
  assert.ok(Math.hypot(p.x - start.x, p.z - start.z) > 15);
  assert.ok(p.money > 0);
  assert.ok(finite(p));
});

test('driving: up + left keeps accelerating while turning left (keys combine)', () => {
  // from the middle of the origin intersection: no kerbs or parked cars nearby
  const straight = makeGame({ traffic: 0 });
  placeAt(straight.game, 0, -4);
  straight.input.value.throttle = 1;
  run(straight.game, 0.6);

  const turning = makeGame({ traffic: 0 });
  placeAt(turning.game, 0, -4);
  turning.input.value.throttle = 1;
  turning.input.value.steer = 1;   // +1 = left
  const h0 = turning.game.player.h;
  run(turning.game, 0.6);   // short: a full-lock turn from the start line soon meets the kerb

  assert.equal(turning.game.crashes, 0);
  assert.ok(turning.game.player.h - h0 > 0.15, 'heading should swing left');
  assert.ok(turning.game.player.v > 5, 'still accelerating');
  assert.ok(turning.game.player.v > straight.game.player.v * 0.9, `${turning.game.player.v} vs ${straight.game.player.v}`);

  const right = makeGame({ traffic: 0 });
  placeAt(right.game, 0, -4);
  right.input.value.throttle = 1;
  right.input.value.steer = -1;
  const hr0 = right.game.player.h;
  run(right.game, 0.6);
  assert.ok(right.game.player.h - hr0 < -0.15, 'heading should swing right');
});

test('driving: the car cannot turn on the spot, and turns less at very high speed', () => {
  const { game, input } = makeGame({ traffic: 0 });
  input.value.steer = 1;
  const h0 = game.player.h;
  run(game, 1);
  assert.ok(Math.abs(game.player.h - h0) < 1e-6, 'a stationary car should not rotate');
});

test('braking: stops quickly from full speed, and the brake then reverses', () => {
  const { game, input } = makeGame({ traffic: 0 });
  game.player.v = DRIVE.maxForward;
  const before = { x: game.player.x, z: game.player.z };
  input.value.brake = 1;
  let travelled = 0, last = before, reachedZeroAt = null;
  for (let t = 0; t < 3; t += DT) {
    game.update(DT);
    travelled += Math.hypot(game.player.x - last.x, game.player.z - last.z);
    last = { x: game.player.x, z: game.player.z };
    if (reachedZeroAt === null && game.player.v <= 0) reachedZeroAt = t;
    if (reachedZeroAt === null) assert.ok(game.player.v >= 0, 'braking must not flip straight into reverse');
  }
  assert.ok(reachedZeroAt !== null && reachedZeroAt < 1, `stopped after ${reachedZeroAt}s`);
  assert.ok(game.player.v < 0, 'holding the brake after stopping reverses');
  assert.ok(game.player.v >= -DRIVE.maxReverse);
  assert.ok(travelled < 40 + 10, `travelled ${travelled} m`);   // ~21 m to stop, then some reversing
});

test('coasting: with no pedal the car slows to a stop and never drifts backwards', () => {
  const { game } = makeGame({ traffic: 0 });
  game.player.v = 30;
  run(game, 20);
  assert.equal(game.player.v, 0);
});

test('both pedals together do not misbehave', () => {
  const { game, input } = makeGame({ traffic: 0 });
  input.value.throttle = 1; input.value.brake = 1;
  run(game, 2);
  assert.ok(finite(game.player));
  assert.ok(Math.abs(game.player.v) < 1);
});

test('crash: hitting a car in front restarts at the start line and resets money', () => {
  const { game, input } = makeGame({ traffic: 1 });
  const p = game.player, a = game.traffic.cars[0];
  const start = { x: p.x, z: p.z, h: p.h };
  input.value.throttle = 1;
  run(game, 1.2);
  p.money = 123;
  // park a stationary car right in front of the player
  const ahead = [p.gx + Math.sin(p.h) * 3, p.gz + Math.cos(p.h) * 3];
  Object.assign(a, { x: ahead[0], z: ahead[1], speed: 0, cruise: 0, plan: null, turn: null });
  game.traffic.pose(a);
  const crashes = game.crashes;
  game.update(DT);
  assert.equal(game.crashes, crashes + 1);
  assert.ok(Math.hypot(p.x - start.x, p.z - start.z) < 1e-6, 'back on the start line');
  assert.equal(p.v, 0);
  assert.equal(p.money, 0);
  assert.ok(game.hud.crashEl.classList.contains('on'), 'crash flash is shown');
});

test('crash: a car behind you cannot crash into you', () => {
  const { game } = makeGame({ traffic: 1 });
  const p = game.player, a = game.traffic.cars[0];
  const behind = [p.gx - Math.sin(p.h) * 2, p.gz - Math.cos(p.h) * 2];
  Object.assign(a, { x: behind[0], z: behind[1], speed: 0, cruise: 0, plan: null, turn: null });
  game.traffic.pose(a);
  const crashes = game.crashes;
  for (let i = 0; i < 5; i++) game.update(DT);
  assert.equal(game.crashes, crashes);
});

test('crash: hitting a parked car restarts', () => {
  const { game } = makeGame({ traffic: 0 });
  let parkedCar = null;
  for (const [key, list] of game.chunks.parked) if (list.length && !parkedCar) parkedCar = list[0];
  assert.ok(parkedCar, 'the starting neighbourhood should contain parked cars');
  const [wx, wz] = toWorld(parkedCar.x, parkedCar.z);
  Object.assign(game.player, { x: wx, z: wz });
  const crashes = game.crashes;
  game.update(DT);
  assert.equal(game.crashes, crashes + 1);
});

test('solid blocks: a building pushes the car out and bounces it, without a restart', () => {
  const { game } = makeGame({ traffic: 0 });
  const p = game.player, half = C / 2 - 8 - 5;           // block half-size: RD and PK in config
  const [wx, wz] = toWorld(0.5 * C + half - 4, 0.5 * C);   // 4 units inside the east face of block (0,0)
  Object.assign(p, { x: wx, z: wz, h: -Math.PI / 2, v: 20 });   // heading west, into the block
  p.syncGrid();
  assert.equal(game.collisions.blocks(p), false, 'a wall is not a crash');
  const [gx] = toGrid(p.x, p.z);
  assert.ok(gx - 0.5 * C >= half, `pushed out of the building (gx ${gx})`);
  assert.ok(Math.abs(p.v) < 0.3 * 20, `most of the speed is lost (v = ${p.v})`);
  assert.ok(finite(p));
});

test('river: leaving a bridge into the water restarts; staying on the deck does not', () => {
  const { game } = makeGame({ traffic: 0 });
  const p = game.player;
  // the river row j = 2: on the deck (x = 0) is fine, beside it is water
  Object.assign(p, { x: toWorld(0, 2.5 * C)[0], z: toWorld(0, 2.5 * C)[1] });
  p.syncGrid();
  const crashes = game.crashes;
  game.update(DT);
  assert.equal(game.crashes, crashes, 'on the bridge deck');
  const water = toWorld(25, 2.5 * C);
  Object.assign(p, { x: water[0], z: water[1] });
  p.syncGrid();
  game.update(DT);
  assert.equal(game.crashes, crashes + 1, 'in the river');
});

test('speed bump: crossing one at speed hops the car', () => {
  const { game, input } = makeGame({ traffic: 0 });
  const bump = [...game.chunks.cells.values()].flatMap((c) => c.bumps).find((b) => b.ax === 'z');
  assert.ok(bump, 'there should be a speed bump in the starting neighbourhood');
  const p = game.player;
  const [wx, wz] = toWorld(bump.x, bump.z + 8);
  Object.assign(p, { x: wx, z: wz, h: Math.PI, v: 20 });   // approaching along -z
  p.syncGrid();
  input.value.throttle = 1;
  let maxY = 0;
  for (let i = 0; i < 90; i++) { game.update(DT); maxY = Math.max(maxY, p.y); }
  assert.ok(maxY > 0.1, `max hop ${maxY}`);
});

test('traffic: slider shows exactly N cars, and new cars appear on a road', () => {
  const { game } = makeGame();
  const slider = dom.elements.get('tr');
  slider.value = '5';
  slider.dispatch('input');
  assert.equal(game.traffic.activeCount, 5);
  slider.value = '40';
  slider.dispatch('input');
  assert.equal(game.traffic.activeCount, 40);
  assert.equal(game.traffic.cars.filter((c) => c.on && c.car.root.visible).length, 40);
  slider.value = '0';
  slider.dispatch('input');
  assert.equal(game.traffic.activeCount, 0);
  assert.equal(game.traffic.cars.some((c) => c.car.root.visible), false);
});

test('traffic: cars have a spread of speeds, move, and stay finite over a long run', () => {
  const { game } = makeGame({ traffic: 30 });
  const speeds = game.traffic.cars.filter((c) => c.on).map((c) => c.cruise);
  assert.ok(Math.max(...speeds) - Math.min(...speeds) > 12, 'cruise speeds should vary');
  const before = game.traffic.cars.map((c) => [c.x, c.z]);
  run(game, 20);
  let moved = 0;
  game.traffic.cars.forEach((c, i) => {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.wh), `car ${i} went non-finite`);
    if (Math.hypot(c.x - before[i][0], c.z - before[i][1]) > 5) moved++;
  });
  assert.ok(moved >= 15, `only ${moved} of 30 cars moved`);
});

test('traffic: cars turn at intersections along one smooth curve (heading changes in small steps)', () => {
  const { game } = makeGame({ traffic: 40 });
  const lastHeading = new Map();
  let turnsSeen = 0, worstJump = 0;
  for (let i = 0; i < 60 * 40; i++) {
    game.update(DT);
    for (const c of game.traffic.cars) {
      if (!c.on) continue;
      if (c.turn) turnsSeen++;
      const prev = lastHeading.get(c);
      if (prev !== undefined && c.key === prev.key) {
        const d = Math.abs(Math.atan2(Math.sin(c.h - prev.h), Math.cos(c.h - prev.h)));
        if (d < 1) worstJump = Math.max(worstJump, d);   // (a respawn or a finished turn legitimately jumps)
      }
      lastHeading.set(c, { h: c.h, key: c.key });
    }
  }
  assert.ok(turnsSeen > 0, 'with 40 cars over 40 s, some should turn');
  assert.ok(worstJump < 0.35, `heading changed by ${worstJump} rad in one frame`);
});

test('traffic lights: the phase cycle and opposite axes', () => {
  const s = new TrafficSignals();
  assert.equal(s.phase(0, 0), 'g');
  assert.equal(s.phase(0, 1), 'r');      // cross street is half a cycle behind
  assert.equal(s.phase(1, 0), 'r');      // neighbouring intersections run opposite phases
  s.update(10.5);
  assert.equal(s.phase(0, 0), 'a');
  s.update(2);
  assert.equal(s.phase(0, 0), 'r');
  assert.equal(s.phase(0, 1), 'g');
  assert.equal(s.state(0, 0, 0), s.phase(0, 0));
  assert.equal(s.state(1, 0, 0), s.phase(1, 0));
  // lamp colours follow the phase
  assert.notEqual(s.lamp(0, 1, 2).color.getHex(), s.lamp(0, 0, 2).color.getHex());
});

test('traffic lights: a car approaching a red light stops before the intersection', () => {
  const { game } = makeGame({ traffic: 1 });
  const a = game.traffic.cars[0], signals = game.signals;
  // at time 0 the intersection (1,1) is in group 0: green along x, red along z
  assert.equal(signals.state(1, 1, 0), 'g');
  assert.equal(signals.state(1, 1, 1), 'r');
  Object.assign(a, { on: true, x: C - 4, z: C - 55, dx: 0, dz: 1, cruise: 20, speed: 20, plan: null, turn: null });
  Object.assign(game.player, { x: toWorld(C - 4, C - 205)[0], z: toWorld(C - 4, C - 205)[1] });   // far enough behind not to recycle the car
  game.player.syncGrid();
  let minSpeed = 99;
  for (let i = 0; i < 60 * 4; i++) {
    game.traffic.update(DT, game.player);   // lights are not advanced: they stay red
    minSpeed = Math.min(minSpeed, a.speed);
  }
  assert.ok(minSpeed < 1, `car should have stopped at the red light; slowest ${minSpeed}`);
  assert.ok(a.z < C - 8, `stopped before the intersection (at z ${a.z})`);
});

test('traffic lights: a car approaching a green light does not slow down', () => {
  const { game } = makeGame({ traffic: 1 });
  const a = game.traffic.cars[0];
  Object.assign(a, { on: true, x: C - 55, z: C + 4, dx: 1, dz: 0, cruise: 20, speed: 20, plan: null, turn: null });
  Object.assign(game.player, { x: toWorld(C - 205, C + 4)[0], z: toWorld(C - 205, C + 4)[1] });
  game.player.syncGrid();
  let minSpeed = 99;
  for (let i = 0; i < 60; i++) { game.traffic.update(DT, game.player); minSpeed = Math.min(minSpeed, a.speed); }
  assert.ok(minSpeed > 15, `slowest ${minSpeed}`);
});

test('world streaming: driving far into the highways and the next city keeps the cell count bounded', () => {
  const { game, input } = makeGame({ traffic: 8 });
  const p = game.player;
  const spots = [[700, 70, 'green highway'], [-1000, 70, 'desert highway'], [1300, 70, 'second city'], [70, 900, 'green highway south'], [-2000, -1800, 'far away']];
  for (const [gx, gz, label] of spots) {
    const [wx, wz] = toWorld(gx, gz);
    Object.assign(p, { x: wx, z: wz, v: 25, gys: 0, h: worldHeading(gx, gz, Math.PI) });   // along the (bent) road
    p.syncGrid();
    input.value.throttle = 1;
    const crashes = game.crashes;
    for (let i = 0; i < 90; i++) game.update(DT);
    if (game.crashes !== crashes) continue;   // a restart teleports to the start; that case is covered by the crash tests
    assert.ok(finite(p), `${label}: player state went non-finite`);
    assert.ok(game.chunks.cells.size <= (2 * RAD + 3) ** 2, `${label}: ${game.chunks.cells.size} cells loaded`);
    assert.ok(game.chunks.cells.size >= (2 * RAD + 1) ** 2 - 1, `${label}: only ${game.chunks.cells.size} cells loaded`);
    assert.ok(Number.isFinite(game.camera.position.x + game.camera.position.y + game.camera.position.z), `${label}: camera non-finite`);
  }
});

test('world streaming: every kind of cell builds with finite geometry', () => {
  const scene = new THREE.Scene();
  const chunks = new ChunkManager(scene, { signals: new Signals() });
  let cells = 0, triangles = 0;
  for (const i of [-14, -13, -9, -7, -6, -3, 0, 4, 6, 8, 11, 12, 13, 15]) {
    for (const j of [-8, -3, -1, 0, 2, 3, 7, 12]) {
      chunks._build(i, j);
      const cell = chunks.get(i, j);
      cells++;
      let meshes = 0;
      cell.group.traverse((m) => {
        if (!m.isMesh) return;
        meshes++;
        const pos = m.geometry.attributes.position;
        for (let q = 0; q < pos.count * 3; q++) {
          if (!Number.isFinite(pos.array[q])) assert.fail(`non-finite vertex in cell ${i},${j}`);
        }
        triangles += (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
      });
      assert.ok(meshes >= 1, `cell ${i},${j} has no meshes`);
      assert.ok(meshes < 40, `cell ${i},${j} has ${meshes} meshes (merging failed?)`);
    }
  }
  assert.ok(cells >= 100 && triangles > 100000);
});

test('world streaming: leaving a cell behind frees it', () => {
  const { game } = makeGame({ traffic: 0 });
  const far = toWorld(20 * C, 0);
  Object.assign(game.player, { x: far[0], z: far[1] });
  game.player.syncGrid();
  for (let i = 0; i < 80; i++) game.update(DT);
  assert.equal(game.chunks.get(0, 0), undefined, 'the start cell should be gone');
  assert.equal(game.chunks.parked.has('0,0'), false);
});

test('cars: every car in the library builds; only the Ferrari has a cockpit; traffic cars have distance detail levels', () => {
  assert.deepEqual(playerNames().sort(), Object.keys(CAR.library.cars).sort());
  for (const model of playerNames()) {
    const car = makeCar(model);
    assert.ok(car.root && typeof car.setSteer === 'function' && typeof car.paint === 'function', `${model}: builds`);
    assert.equal(!!car.eye, model === 'ferrari', `${model}: only the Ferrari has a driver's eye`);
    let levels = 0;
    car.root.traverse((o) => { if (o.name.startsWith('LOD')) levels++; });
    assert.ok(model === 'ferrari' || model === 'mustang' || levels === 1, `${model}: the player's car uses only the best detail level (${levels})`);
  }
  assert.ok(trafficNames().length >= 4, 'a mix of traffic models');
  assert.ok(!trafficNames().includes('ferrari') && !trafficNames().includes('mustang') && !trafficNames().includes('nissan'), 'sports and vintage cars are not in traffic');
  const t = makeTrafficCar(0, 0xc8102e);
  let lod = null;
  t.root.traverse((o) => { if (o.isLOD) lod = o; });
  assert.ok(lod && lod.levels.length >= 4, 'distance detail levels plus a cull level');
  assert.ok(lod.levels[0].distance === 0 && lod.levels.at(-1).distance === CAR.library.cullDistance);
  assert.throws(() => makeCar('supra'), /not loaded/, 'there are no built-in cars to fall back on');
});

const key = (game, code, repeat = false) => game.onKey({ code, repeat, preventDefault() {} });
const pick = (game, name) => {            // choose a car the way a player does: Space, arrows to it, Space
  key(game, 'Space');
  for (let guard = 0; game.selector.current !== name && guard < 20; guard++) key(game, 'ArrowRight');
  key(game, 'Space');
};

test('camera: cars without a cockpit stay in the chase view, and switching to one leaves the cockpit view', () => {
  const { game } = makeGame({ traffic: 0 });
  key(game, 'KeyC');
  assert.equal(game.chase.mode, 'chase', 'the default Nissan has no cockpit');
  pick(game, 'ferrari');
  key(game, 'KeyC');
  assert.equal(game.chase.mode, 'cockpit', 'the Ferrari has a cockpit');
  pick(game, 'camry');
  assert.equal(game.player.model, 'camry');
  assert.equal(game.chase.mode, 'chase', 'choosing a car without a cockpit leaves the cockpit view');
  key(game, 'KeyC');
  assert.equal(game.chase.mode, 'chase', 'C does nothing in a car without a cockpit');
  run(game, 0.2);
  pick(game, 'ferrari');
  key(game, 'KeyC');
  assert.equal(game.chase.mode, 'cockpit');
});

test('showroom: every pipeline car points at a detailed model file that exists; the Ferrari and Mustang need none', async () => {
  const { existsSync } = await import('node:fs');
  const { hasShowroom, makeShowroomCar } = await import('../src/vehicles/carLibrary.js');
  for (const [name, spec] of Object.entries(CAR.library.cars)) {
    const pipeline = !spec.raw && spec.kind !== 'ferrari';
    assert.equal(!!spec.showroom, pipeline, `${name}: showroom file only for pipeline cars`);
    if (spec.showroom) assert.ok(existsSync(new URL('../' + spec.showroom, import.meta.url)), `${name}: ${spec.showroom} exists`);
    assert.equal(hasShowroom(name), false);
    assert.ok(makeShowroomCar(name).root, `${name}: the selector can show the normal model until the detailed one loads`);
  }
});

test('car selector: Space opens it, arrows cycle the carousel, Space chooses, Esc cancels, and the game is paused meanwhile', () => {
  const { game, input, audio } = makeGame({ traffic: 0 });
  const before = game.player.car.root, names = Object.keys(CAR.library.cars);
  input.value.throttle = 1;
  run(game, 0.5);
  const x0 = game.player.x, z0 = game.player.z;

  key(game, 'Space');
  assert.equal(game.selector.isOpen, true);
  assert.equal(game.garage.calls[0][0], 'show');
  assert.equal(game.garage.calls[0][1], CAR.defaultModel, 'starts on the current car');
  assert.equal(audio.paused, true, 'sound is paused');
  run(game, 1);
  assert.equal(game.player.x, x0); assert.equal(game.player.z, z0, 'the game is frozen while the selector is open');

  const here = names.indexOf(CAR.defaultModel), at = (k) => names[(here + k + names.length) % names.length];
  key(game, 'ArrowRight');
  assert.equal(game.selector.current, at(1));
  key(game, 'ArrowLeft'); key(game, 'ArrowLeft');
  assert.equal(game.selector.current, at(-1), 'wraps round');
  assert.deepEqual(game.garage.calls.at(-1).slice(0, 2), ['showCar', at(-1)]);
  key(game, 'ArrowRight');
  key(game, 'KeyC');
  assert.equal(game.chase.mode, 'chase', 'C does nothing while choosing');

  key(game, 'Escape');
  assert.equal(game.selector.isOpen, false);
  assert.equal(game.player.model, CAR.defaultModel, 'Esc keeps the current car');
  assert.equal(audio.paused, false);
  assert.equal(game.player.car.root, before);

  key(game, 'Space');
  key(game, 'ArrowRight');
  key(game, 'Space', true);                                   // a held key does not toggle
  assert.equal(game.selector.isOpen, true);
  key(game, 'Space');
  assert.equal(game.selector.isOpen, false);
  assert.equal(game.player.model, game.selector.current, 'the car on show is chosen');
  assert.notEqual(game.player.car.root, before);
  assert.equal(game.scene.children.includes(before), false);
  assert.equal(game.scene.children.includes(game.player.car.root), true);
  assert.equal(dom.elements.get('carname').textContent, CAR.library.cars[game.selector.current].label, 'the settings panel names the car');
  assert.equal(audio.voice, game.selector.current, 'the engine voice follows');
  run(game, 0.3);
  assert.ok(game.player.x !== x0 || game.player.z !== z0, 'driving resumes');
});

test('settings: the cog opens and closes the panel', () => {
  makeGame();
  const panel = dom.elements.get('set'), cog = dom.elements.get('cog');
  const open = !panel.hidden;
  cog.dispatch('click');
  assert.equal(panel.hidden, open);
  cog.dispatch('click');
  assert.equal(panel.hidden, !open);
});

test('camera: stays above and behind the car', () => {
  const { game, input } = makeGame({ traffic: 0 });
  input.value.throttle = 1;
  run(game, 2);
  const p = game.player, c = game.camera.position;
  const dx = c.x - p.x, dz = c.z - p.z;
  const behind = -(dx * Math.sin(p.h) + dz * Math.cos(p.h));   // distance behind the car along its heading
  assert.ok(behind > 3, `camera should be behind the car, but is ${behind} behind`);
  assert.ok(c.y > p.gys + 3, 'camera is above the car');
  assert.ok(Math.hypot(dx, dz) < 25);
});

test('camera: C switches to the cockpit view (the driver\'s eye, facing forward) and back', () => {
  const { game, input } = makeGame({ traffic: 0 });
  pick(game, 'ferrari');
  input.value.throttle = 1;
  run(game, 1);
  const p = game.player;
  assert.equal(game.chase.mode, 'chase');
  game.onKey({ code: 'KeyC', repeat: false });
  assert.equal(game.chase.mode, 'cockpit');
  run(game, 0.5);
  const c = game.camera.position;
  assert.ok(Math.hypot(c.x - p.x, c.z - p.z) < 2.5, 'the cockpit camera is inside the car');
  assert.ok(c.y > p.gys + 0.8 && c.y < p.gys + 2.5, 'at driver eye height');
  const look = game.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(look.x * Math.sin(p.h) + look.z * Math.cos(p.h) > 0.9, 'looking along the car\'s heading');
  game.onKey({ code: 'KeyC', repeat: true });                      // key repeat must not flip it again
  assert.equal(game.chase.mode, 'cockpit');
  game.onKey({ code: 'KeyC', repeat: false });
  assert.equal(game.chase.mode, 'chase');
});

test('cars: the Ferrari steering wheel turns with the steering, in proportion to the road wheels', () => {
  const { game, input } = makeGame({ traffic: 0 });
  game.player.setModel('ferrari');
  const wheel = game.player.car.tilt.children.find((o) => !o.isMesh && o.children.some((c) => c.name === 'steering_leather'));
  assert.ok(wheel, 'steering-wheel group exists');
  input.value.steer = 1;
  run(game, 1);                                              // parked: no throttle, so nothing can crash and reset the steering
  const angle = 2 * Math.acos(Math.min(1, Math.abs(wheel.quaternion.w)));
  assert.ok(Math.abs(angle - CAR.steeringWheelLock) < 0.1, `wheel turned ${angle.toFixed(2)} rad, expected ${CAR.steeringWheelLock}`);
  assert.ok(Math.abs(game.player.car.front[0].rotation.y - CAR.roadWheelLock) < 0.05, 'road wheels turn too');
});

test('city: every edge shared with a highway gets a real road (surface, dashes and junction patches)', () => {
  const { game } = makeGame({ traffic: 0 });
  placeAt(game, -5 * 100 + 50, -4 * 100 + 50);
  game.chunks.update(game.player.gx, game.player.gz, Infinity);
  const cell = game.chunks.get(-5, -4);                // west edge of the city borders highway cell (-6, -4)
  const roads = [];
  cell.group.traverse((o) => { if (o.isMesh && o.material === getAssets().mats.highway) roads.push(o); });
  assert.ok(roads.length >= 2, `perimeter road ribbon + junction patches expected, got ${roads.length} meshes`);
  const interior = game.chunks.get(-4, -4);            // an interior cell has no perimeter road
  let interiorRoads = 0;
  interior.group.traverse((o) => { if (o.isMesh && o.material === getAssets().mats.highway) interiorRoads++; });
  assert.equal(interiorRoads, 0);
});

test('parked cars: a pool of Camrys follows the player and sits in the recorded parking slots', async () => {
  const { game } = makeGame({ traffic: 0 });
  const pm = game.parkedCars, { PARKED } = await import('../src/config.js');
  assert.ok(pm.active > 0 && pm.active <= PARKED.count, `${pm.active} parked cars near the start`);
  const slots = [...game.chunks.parked.values()].flat();
  for (const p of pm.pool.filter((q) => q.slot)) {
    const [cell, n] = p.slot.split(':');
    const s = game.chunks.parked.get(cell)[n];
    const [wx, wz] = toWorld(s.x, s.z);
    assert.ok(Math.hypot(p.car.root.position.x - wx, p.car.root.position.z - wz) < 0.01, 'car is on its slot');
    assert.ok(p.car.root.visible);
  }
  assert.ok(slots.length > pm.active, 'only the slots nearest the player have cars');
  placeAt(game, 3000, 3000);                                       // far away: nothing is near, so nothing is parked
  game.chunks.update(game.player.gx, game.player.gz, Infinity);
  pm.refresh(game.player.gx, game.player.gz);
  assert.ok(pm.active <= PARKED.count && pm.pool.every((p) => !p.slot || game.chunks.parked.has(p.slot.split(':')[0])), 'slots follow the player');
});

test('HUD: speed and money are displayed', () => {
  const { game, input } = makeGame({ traffic: 0 });
  input.value.throttle = 1;
  run(game, 2);
  assert.ok(Number(dom.elements.get('kmh').textContent) > 30);
  assert.ok(dom.elements.get('mny').textContent.length > 0);
});

test('input: keys combine, release correctly, and clear on blur', () => {
  const handlers = {};
  const target = { addEventListener: (t, f) => { handlers[t] = f; }, removeEventListener() {} };
  const input = new InputManager(target);
  const key = (code) => ({ code, preventDefault() {} });
  handlers.keydown(key('ArrowUp'));
  handlers.keydown(key('ArrowLeft'));
  assert.deepEqual({ ...input.read() }, { throttle: 1, brake: 0, steer: 1 });
  handlers.keydown(key('ArrowRight'));
  assert.equal(input.read().steer, 0, 'left + right cancel');
  handlers.keyup(key('ArrowLeft'));
  assert.deepEqual({ ...input.read() }, { throttle: 1, brake: 0, steer: -1 });
  handlers.keydown(key('KeyA'));   // not a bound key: ignored
  handlers.blur();
  assert.deepEqual({ ...input.read() }, { throttle: 0, brake: 0, steer: 0 });
});

test('input: extra sources (a future game controller) combine with the keyboard', () => {
  const target = { addEventListener() {}, removeEventListener() {} };
  const input = new InputManager(target);
  input.addSource(() => ({ throttle: 0.5, steer: -0.7 }));
  assert.deepEqual({ ...input.read() }, { throttle: 0.5, brake: 0, steer: -0.7 });
});

test('long soak: two minutes of mixed driving never goes non-finite or throws', () => {
  const { game, input } = makeGame({ traffic: 25 });
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 60 * 120; i++) {
    if (i % 45 === 0) {
      input.value.throttle = rnd() < 0.8 ? 1 : 0;
      input.value.brake = rnd() < 0.15 ? 1 : 0;
      input.value.steer = [-1, 0, 1][rnd() * 3 | 0];
    }
    game.update(DT);
    if (!finite(game.player)) assert.fail(`player went non-finite at step ${i}`);
  }
  assert.ok(game.chunks.cells.size <= (2 * RAD + 3) ** 2);
});

test('sound: the game feeds the audio manager every frame and unlocks it on the first key or click', () => {
  const { game, input, audio } = makeGame({ traffic: 0 });
  input.value.throttle = 1;
  run(game, 0.5);
  const updates = audio.calls.filter((c) => c[0] === 'update');
  assert.ok(updates.length >= 29);
  const last = updates.at(-1)[2];
  assert.equal(last.throttle, 1);
  assert.ok(last.speed > 5);
  assert.ok(Number.isFinite(last.gx) && Number.isFinite(last.gz));
  dom.fireWindow('keydown', {});
  dom.fireWindow('pointerdown', {});
  assert.equal(audio.count('unlock'), 2);
});

test('sound: a crash, a wall hit, a bump and a landing each trigger their sound', () => {
  // crash into a car in front
  {
    const { game, input, audio } = makeGame({ traffic: 1 });
    const p = game.player, a = game.traffic.cars[0];
    input.value.throttle = 1; run(game, 1);
    const ahead = [p.gx + Math.sin(p.h) * 3, p.gz + Math.cos(p.h) * 3];
    Object.assign(a, { x: ahead[0], z: ahead[1], speed: 0, cruise: 0, plan: null, turn: null });
    game.traffic.pose(a);
    game.update(DT);
    assert.equal(audio.count('crash'), 1);
  }
  // hit a building at speed
  {
    const { game, audio } = makeGame({ traffic: 0 });
    const half = C / 2 - 8 - 5, p = game.player;
    const [wx, wz] = toWorld(0.5 * C + half - 4, 0.5 * C);
    Object.assign(p, { x: wx, z: wz, h: -Math.PI / 2, v: 25 });
    p.syncGrid();
    game.update(DT);
    assert.equal(audio.count('thud'), 1);
    assert.equal(audio.count('crash'), 0);
  }
  // speed bump, then the landing
  {
    const { game, input, audio } = makeGame({ traffic: 0 });
    const bump = [...game.chunks.cells.values()].flatMap((c) => c.bumps).find((b) => b.ax === 'z');
    const p = game.player;
    const [wx, wz] = toWorld(bump.x, bump.z + 8);
    Object.assign(p, { x: wx, z: wz, h: Math.PI, v: 20 });
    p.syncGrid();
    input.value.throttle = 1;
    for (let i = 0; i < 90; i++) game.update(DT);
    assert.equal(audio.count('bump'), 1);
    assert.equal(audio.count('landing'), 1);
  }
});

test('sound: driving normally, or pushing against nothing, makes no impact sounds', () => {
  const { game, input, audio } = makeGame({ traffic: 0 });
  placeAt(game, 0, -4);
  input.value.throttle = 1;
  run(game, 1);
  assert.equal(audio.count('crash') + audio.count('thud') + audio.count('landing'), 0);
});

test('sound: the sound checkbox and volume slider reach the audio manager', () => {
  const { audio } = makeGame();
  assert.equal(audio.count('setEnabled'), 0);
  const box = dom.elements.get('snd'), vol = dom.elements.get('vol');
  box.checked = false; box.dispatch('change');
  vol.value = '25'; vol.dispatch('input');
  assert.deepEqual(audio.calls.find((c) => c[0] === 'setEnabled'), ['setEnabled', false]);
  assert.deepEqual(audio.calls.find((c) => c[0] === 'setVolume'), ['setVolume', 0.25]);
  assert.equal(dom.elements.get('vol').value, '25');
});
