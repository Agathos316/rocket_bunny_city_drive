// The audio manager against a fake Web Audio context: lifecycle, the engine/zone logic and one-shots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.mjs';
import { fakeAudioContext } from './helpers/audio.mjs';

installDom();
const { AudioManager, engineModel, zoneAt } = await import('../src/audio.js');
const { AUDIO, C } = await import('../src/config.js');

const doc = { hidden: false, handlers: {}, addEventListener(t, f) { this.handlers[t] = f; }, removeEventListener() {} };
function make() {
  const ctx = fakeAudioContext();
  const audio = new AudioManager({ contextFactory: () => ctx, doc });
  return { ctx, audio };
}
const state = (over = {}) => ({ speed: 0, throttle: 0, brake: 0, steer: 0, airborne: false, gx: 50, gz: 50, ...over });

test('engine model: pitch rises through a gear, drops at the shift, and never leaves the configured range', () => {
  const g = AUDIO.gearSpeeds;
  const justBefore = engineModel(g[1] - 0.01, 1), justAfter = engineModel(g[1] + 0.01, 1);
  assert.equal(justBefore.gear, 1);
  assert.equal(justAfter.gear, 2);
  assert.ok(justAfter.freq < justBefore.freq - 10, 'the note drops after an upshift');
  let last = 0;
  for (let v = g[1] + 0.1; v < g[2] - 0.1; v += 0.5) {   // rising inside gear 2
    const f = engineModel(v, 1).freq;
    assert.ok(f > last, `pitch should rise with speed in a gear (${v})`);
    last = f;
  }
  for (let v = 0; v <= 70; v += 1) {
    const m = engineModel(v, 1);
    assert.ok(m.freq >= AUDIO.engineIdleHz && m.freq <= AUDIO.engineIdleHz + AUDIO.engineRangeHz + 1e-9);
    assert.ok(m.gear >= 1 && m.gear <= 5);
  }
});

test('engine model: lifting off the throttle is quieter and duller; reversing sounds like driving', () => {
  const on = engineModel(25, 1), off = engineModel(25, 0);
  assert.ok(off.gain < on.gain && off.cutoff < on.cutoff);
  assert.equal(engineModel(-25, 1).freq, on.freq);
});

test('zones: city, countryside and desert map to the matching ambience', () => {
  assert.equal(zoneAt(50, 50), 'city');
  const kinds = new Set();
  for (let g = 650; g < 1150; g += 100) { kinds.add(zoneAt(g, 50)); kinds.add(zoneAt(50, g)); kinds.add(zoneAt(-g, 50)); kinds.add(zoneAt(50, -g)); }
  assert.ok(kinds.has('country') && kinds.has('desert'), `saw ${[...kinds]}`);
  assert.equal(zoneAt(13 * C + 50, 50), 'city', 'the next city');
});

test('lifecycle: silent until unlocked, then builds the graph once and resumes', () => {
  const { ctx, audio } = make();
  audio.update(0.016, state());
  audio.crash();
  assert.equal(ctx.nodes.length, 0, 'nothing is created before a user gesture');
  audio.unlock();
  assert.equal(ctx.state, 'running');
  const n = ctx.nodes.length;
  assert.ok(n > 20);
  audio.unlock();
  assert.equal(ctx.nodes.length, n, 'unlock twice does not build twice');
  assert.ok(ctx.nodes.filter((x) => x.kind === 'osc').every((o) => o.started), 'every oscillator is started');
});

test('lifecycle: without Web Audio, or if the context throws, every call is a harmless no-op', () => {
  const none = new AudioManager({ contextFactory: null, doc });
  none.supported = false;
  none.unlock(); none.update(0.1, state()); none.crash(); none.thud(20); none.bump(10); none.landing(3);
  none.setEnabled(false); none.setVolume(0.2); none.dispose();

  const warn = console.warn; console.warn = () => {};
  const broken = new AudioManager({ contextFactory: () => { throw new Error('no audio device'); }, doc });
  broken.unlock();
  console.warn = warn;
  assert.equal(broken.supported, false);
  broken.update(0.1, state()); broken.crash();
});

test('update: engine pitch follows speed, and the road and wind noise grow with it', () => {
  const { audio } = make(); audio.unlock();
  audio.update(0.016, state({ speed: 0 }));
  const idle = { f: audio._engine.saw1.frequency.value, road: audio._road.gain.gain.value, wind: audio._wind.gain.gain.value };
  audio.update(0.016, state({ speed: 50, throttle: 1 }));
  assert.ok(audio._engine.saw1.frequency.value > idle.f, 'higher revs at speed');
  assert.ok(audio._road.gain.gain.value > idle.road);
  assert.ok(audio._wind.gain.gain.value > idle.wind);
  assert.equal(idle.road, 0);
});

test('update: tyres squeal when cornering hard or braking hard, not when gently driving or in the air', () => {
  const { audio } = make(); audio.unlock();
  const squeal = () => audio._squeal.gain.gain.value;
  audio.update(0.016, state({ speed: 40, steer: 0 }));        assert.equal(squeal(), 0);
  audio.update(0.016, state({ speed: 40, steer: 1 }));        assert.ok(squeal() > 0, 'cornering');
  audio.update(0.016, state({ speed: 40, brake: 1 }));        assert.ok(squeal() > 0, 'hard braking');
  audio.update(0.016, state({ speed: 5, steer: 1 }));         assert.equal(squeal(), 0, 'slow turn');
  audio.update(0.016, state({ speed: 40, steer: 1, airborne: true })); assert.equal(squeal(), 0, 'airborne');
});

test('update: ambience crossfades to the environment you are in', () => {
  const { audio } = make(); audio.unlock();
  const level = (z) => audio._beds[z].value;
  audio.update(0.016, state());
  assert.ok(level('city') > 0 && level('country') === 0 && level('desert') === 0);
  const green = [650, 50], desert = [];
  let foundCountry = null, foundDesert = null;
  for (let g = 650; g < 1150 && !(foundCountry && foundDesert); g += 100) {
    for (const [x, z] of [[g, 50], [50, g], [-g, 50], [50, -g]]) {
      const zn = zoneAt(x, z);
      if (zn === 'country') foundCountry ||= [x, z];
      if (zn === 'desert') foundDesert ||= [x, z];
    }
  }
  audio.update(0.016, state({ gx: foundCountry[0], gz: foundCountry[1] }));
  assert.ok(level('country') > 0 && level('city') === 0);
  audio.update(0.016, state({ gx: foundDesert[0], gz: foundDesert[1] }));
  assert.ok(level('desert') > 0 && level('country') === 0);
});

test('update: birds only chirp in the countryside', () => {
  const { ctx, audio } = make(); audio.unlock();
  const city = state();
  const before = ctx.count('osc');
  for (let i = 0; i < 60 * 12; i++) audio.update(1 / 60, city);
  assert.equal(ctx.count('osc'), before, 'no chirps in the city');
  let country;
  for (let g = 650; g < 1150 && !country; g += 100) for (const [x, z] of [[g, 50], [50, g], [-g, 50], [50, -g]]) if (!country && zoneAt(x, z) === 'country') country = [x, z];
  for (let i = 0; i < 60 * 12; i++) audio.update(1 / 60, state({ gx: country[0], gz: country[1] }));
  assert.ok(ctx.count('osc') > before, 'chirps in the countryside');
});

test('one-shots: crash, thud, bump and landing each make sound, and a rapid repeat is limited', () => {
  const { ctx, audio } = make(); audio.unlock();
  for (const [name, arg] of [['crash'], ['thud', 25], ['bump', 15], ['landing', -4]]) {
    const before = ctx.nodes.length;
    audio[name](arg);
    assert.ok(ctx.nodes.length > before, `${name} makes nodes`);
    const after = ctx.nodes.length;
    audio[name](arg);
    assert.equal(ctx.nodes.length, after, `${name} repeated within ${AUDIO.minEventGap}s is ignored`);
    ctx.currentTime += AUDIO.minEventGap + 0.01;
    audio[name](arg);
    assert.ok(ctx.nodes.length > after, `${name} plays again after the gap`);
  }
});

test('one-shots: a harder hit is louder', () => {
  const { ctx, audio } = make(); audio.unlock();
  const peak = (speed) => {
    const before = ctx.nodes.length;
    audio.thud(speed);
    ctx.currentTime += 1;
    return Math.max(...ctx.nodes.slice(before).filter((n) => n.kind === 'gain').map((g) => g.gain.history[0]?.[1] ?? 0));
  };
  assert.ok(peak(30) > peak(6));
});

test('settings: mute silences output and suspends; volume changes the master level', async () => {
  const { ctx, audio } = make(); audio.unlock();
  audio.setVolume(0.3);
  assert.equal(audio._master.gain.value, 0.3);
  audio.setEnabled(false);
  assert.equal(audio._master.gain.value, 0);
  const n = ctx.nodes.length;
  audio.crash(); audio.update(0.1, state({ speed: 30 }));
  assert.equal(ctx.nodes.length, n, 'muted: no one-shots are created');
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(ctx.state, 'suspended', 'muted audio stops costing CPU');
  audio.setEnabled(true);
  assert.equal(audio._master.gain.value, 0.3);
  assert.equal(ctx.state, 'running');
  audio.setVolume(5);
  assert.equal(audio.volume, 1, 'volume is clamped');
});

test('settings: volume set while muted is applied when sound comes back', () => {
  const { audio } = make(); audio.unlock();
  audio.setEnabled(false);
  audio.setVolume(0.8);
  assert.equal(audio._master.gain.value, 0);
  audio.setEnabled(true);
  assert.equal(audio._master.gain.value, 0.8);
});

test('visibility: audio suspends while the tab is hidden and resumes when it returns', () => {
  const { ctx, audio } = make(); audio.unlock();
  doc.hidden = true; doc.handlers.visibilitychange();
  assert.equal(ctx.state, 'suspended');
  doc.hidden = false; doc.handlers.visibilitychange();
  assert.equal(ctx.state, 'running');
  audio.dispose();
  assert.equal(ctx.closed, true);
});
