// Browser smoke test: serves the repo, opens it in headless Chromium (software WebGL), drives with the arrow
// keys and checks the page really renders. Screenshots go to tests/browser/out/.
//
//   npm run test:browser
//
// Needs Playwright with a Chromium build available. It is NOT a project dependency (the game has none);
// install it yourself (`npm i -D playwright && npx playwright install chromium`) or run where it is global.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('playwright is not installed; see the header of this file.'); process.exit(2); }

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const PORT = 8137;
await mkdir(OUT, { recursive: true });

const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const failures = [];
const check = (ok, message) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`); if (!ok) failures.push(message); };

try {
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.rocketBunny && window.rocketBunny.game.frameCount > 5, null, { timeout: 60000 });
  await page.screenshot({ path: OUT + '1-start.png' });

  const stats = () => page.evaluate(() => {
    const g = window.rocketBunny.game, p = g.player;
    return { v: p.v, money: p.money, x: p.x, z: p.z, crashes: g.crashes, cells: g.chunks.cells.size, frames: g.frameCount };
  });
  const s0 = await stats();
  check(s0.cells >= 49, `world streamed in around the start (${s0.cells} cells)`);

  // canvas is not blank: sample pixels from a screenshot-sized readback
  const distinct = await page.evaluate(() => {
    const g = window.rocketBunny.game;
    g.renderer.render(g.scene, g.camera);   // read back in the same task as the draw (the drawing buffer is not preserved)
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const ctx = c.getContext('2d'); ctx.drawImage(document.querySelector('canvas'), 0, 0, 64, 36);
    const d = ctx.getImageData(0, 0, 64, 36).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
    return seen.size;
  }).catch(() => -1);
  check(distinct > 10, `canvas is not blank (${distinct} distinct colours sampled)`);

  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '2-driving.png' });
  const s1 = await stats();
  check(s1.v > 5, `ArrowUp accelerates (speed ${s1.v.toFixed(1)} m/s)`);
  check(s1.money > s0.money, `money counter increases (${s1.money.toFixed(1)})`);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  const s2 = await stats();
  check(s2.crashes === s1.crashes ? s2.v > 5 : true, 'ArrowUp + ArrowLeft together keep the car moving');
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');

  await page.click('#cog');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '3-settings.png' });
  check(await page.isVisible('#set'), 'settings panel opens from the cog');
  await page.selectOption('#car', 'supra');
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.rocketBunny.game.player.model)) === 'supra', 'car selection changes the model');

  // ---- sound: measure what the Web Audio graph actually outputs (headless Chromium has a silent sink, but the
  // graph still runs, so an analyser on the master output sees the real signal). This proves the synthesis
  // responds to the game; it cannot judge whether it sounds good.
  const ctxState = await page.evaluate(() => window.rocketBunny.game.audio.ctx?.state);
  check(ctxState === 'running', `audio context is running after the first key press (${ctxState})`);
  // The software-GL game loop hogs the main thread (setTimeout drifts by seconds), so stop it for the measurements
  // and feed the audio manager the same kind of state the game does.
  await page.evaluate(() => window.rocketBunny.game.stop());
  const drive = (s) => page.evaluate((s) => {
    const a = window.rocketBunny.game.audio;
    for (let i = 0; i < 20; i++) a.update(0.016, { speed: 0, throttle: 0, brake: 0, steer: 0, airborne: false, gx: 50, gz: 50, ...s });
  }, s);
  const measure = (wait = 900) => page.evaluate(async (ms) => {
    const a = window.rocketBunny.game.audio, an = a.tap();
    await new Promise((r) => setTimeout(r, ms));
    const td = new Float32Array(an.fftSize); an.getFloatTimeDomainData(td);
    let sum = 0; for (const x of td) sum += x * x;
    const fr = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(fr);
    const hz = a.ctx.sampleRate / an.fftSize;
    let best = -Infinity, bi = 0;   // strongest component between 30 and 400 Hz: the engine note
    for (let i = Math.ceil(30 / hz); i < 400 / hz; i++) if (fr[i] > best) { best = fr[i]; bi = i; }
    return { rms: Math.sqrt(sum / td.length), enginePeakHz: bi * hz };
  }, wait);
  await drive({ speed: 0, throttle: 0 });
  const idle = await measure(1200);
  await drive({ speed: 45, throttle: 1 });
  const fast = await measure(1200);
  console.log(`info idle: rms ${idle.rms.toFixed(4)}, engine peak ${idle.enginePeakHz.toFixed(0)} Hz | 45 m/s: rms ${fast.rms.toFixed(4)}, engine peak ${fast.enginePeakHz.toFixed(0)} Hz`);
  check(idle.rms > 0.0005, `idle is audible, not silent (rms ${idle.rms.toFixed(4)})`);
  check(fast.rms > idle.rms * 1.1, `driving fast is louder than idling (${fast.rms.toFixed(4)} vs ${idle.rms.toFixed(4)})`);
  check(fast.enginePeakHz > idle.enginePeakHz * 2, `engine note is higher at speed (${fast.enginePeakHz.toFixed(0)} vs ${idle.enginePeakHz.toFixed(0)} Hz)`);
  await page.evaluate(() => window.rocketBunny.game.audio.setEnabled(false));
  await page.waitForTimeout(500);
  const muted = await measure(300);
  check(muted.rms < idle.rms * 0.1, `muting silences the output (rms ${muted.rms.toFixed(5)})`);
  await page.evaluate(() => window.rocketBunny.game.audio.setEnabled(true));
  await drive({ speed: 0, throttle: 0 });
  await page.waitForTimeout(800);
  const quiet = await measure(100);
  await page.evaluate(() => window.rocketBunny.game.audio.crash());
  const crash = await measure(80);
  check(crash.rms > quiet.rms * 2, `a crash is a loud event (rms ${crash.rms.toFixed(3)} vs ${quiet.rms.toFixed(3)} before)`);
  await page.evaluate(() => window.rocketBunny.game.start());

  // far-away streaming in a real renderer: the highway and the second city
  for (const [gx, gz, name] of [[800, 70, 'highway'], [1300, 70, 'second-city']]) {
    await page.evaluate(([x, z]) => {
      const g = window.rocketBunny.game;
      // teleport in grid space through the same functions the game uses
      return import('/src/world/zones.js').then((zn) => {
        const [wx, wz] = zn.toWorld(x, z);
        Object.assign(g.player, { x: wx, z: wz, v: 0, h: zn.worldHeading(x, z, Math.PI) });
        g.player.syncGrid();
      });
    }, [gx, gz]);
    // software GL is slow and the world streams one cell per frame, so wait for it rather than for a fixed time
    await page.waitForFunction(() => {   // every cell within the streaming radius (3) of the player is present
      const g = window.rocketBunny.game, i0 = Math.floor(g.player.gx / 100), j0 = Math.floor(g.player.gz / 100);
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (!g.chunks.get(i0 + i, j0 + j)) return false;
      return true;
    }, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: OUT + `4-${name}.png` });
    const s = await stats();
    check(s.cells >= 49 && s.crashes === 0, `${name}: ${s.cells} cells streamed in, ${s.crashes} crashes`);
    const zone = await page.evaluate(() => window.rocketBunny.game.audio.zone);
    check(name === 'second-city' ? zone === 'city' : zone !== 'city', `${name}: ambience zone is '${zone}'`);
  }
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  console.log(`info software-GL frame rate: ${fps.toFixed(1)} fps (not representative of a real GPU)`);

  check(errors.length === 0, `no console or page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
} catch (e) {
  failures.push(String(e));
  console.error(e);
} finally {
  server.kill();
}
console.log(failures.length ? `\n${failures.length} FAILED` : '\nbrowser smoke test passed');
process.exit(failures.length ? 1 : 0);
