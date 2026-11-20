# Rocket Bunny City Drive

A browser driving game. Drive a Rocket Bunny widebody sports car through an endless, self-generating world:
a city of towers, traffic lights and parked cars; rivers with ramped bridges; then highways with hills,
tunnels, bridges and sweeping interchanges; a desert; and the next city. Hit another car and you restart at the
start line with your money reset to zero.

![City](docs/screenshot-city.png)
![Highway](docs/screenshot-highway.png)

## Play

The game is plain ES modules with no build step, but browsers refuse to load modules from `file://`, so it needs
to be served over http:

```
npm start            # serves the repo at http://localhost:8080/ (Node 22 was used for development and CI; no installs needed)
```

or turn on **GitHub Pages** for this repo (Settings → Pages → Deploy from branch → `main` / root) and open the
Pages URL. Any static file server works too.

### Controls

| Key | Action |
| --- | --- |
| ↑ | Accelerate |
| ↓ | Brake, then reverse |
| ← → | Steer (combine freely with ↑ / ↓) |
| ⚙ (bottom left) | Settings: choose your car, set the amount of traffic |

Cars: Toyota Supra, Ford Mustang, Porsche 911, Nissan GT-R, Honda Civic Type R — all with the Rocket Bunny kit.

## What is in the world

- Cities: bent (not ruler-straight) roads, four road styles, traffic lights, kerbside parking, speed bumps,
  petrol stations, rounded footpaths, rivers crossed by ramped bridges.
- Highways: rolling hills, tunnels, bridges, interchanges, faster traffic. Highway rings alternate between green
  country and desert.
- The world repeats a 12-ring pattern outwards (6 city rings, 6 highway rings), so the next city appears after a
  stretch of highway. Every cell is generated deterministically from its grid position, so it looks the same
  each time you return.

## Project layout

```
index.html              page shell + import map (three -> vendor/three)
styles/game.css
src/
  main.js               entry point: builds the Game, shows a fatal-error overlay if something throws
  game.js               Game: owns the systems below, runs the loop, decides what a crash means
  config.js             every tunable number (physics, traffic, camera, world size, car list, key map)
  input.js              InputManager: keyboard -> { throttle, brake, steer }; extra sources can be added
  camera.js             ChaseCamera (above and behind the car)
  renderer.js           WebGL renderer setup
  environment.js        sky, sun + shadows, fog, ground
  assets.js             materials and procedural textures
  collisions.js         blocks, bumps, parked cars, traffic
  vehicles/             car models (lofted shells), car factory, player car + physics, parked cars
  traffic/              TrafficManager: lanes, turns, following, traffic lights, recycling
  world/                zones (pure world-shape functions), cell generators, chunk streaming, signals
  ui/                   HUD and settings panel
  util/                 seeded RNG, maths, geometry Batcher
tests/                  Node tests (zones, whole-game integration) + browser smoke test
tools/serve.mjs         tiny static server used by `npm start` and the browser test
vendor/three/           three.js r128 (ES module build + BufferGeometryUtils), MIT licensed
```

## How it works

- **Independent systems.** The `Game` object wires together the player car, camera, environment, collisions,
  traffic, chunk streaming, signals, input, HUD and settings panel. Each can be constructed on its own, and
  `Game` accepts injected dependencies (renderer, input, HUD, settings) — that is how the tests run the whole game
  with no GPU.
- **Grid space and world space.** Roads, zones and traffic logic run on a straight grid of 100-unit cells. What
  you see and drive on is that grid *warped* by smooth functions (`toWorld` / `toGrid` in `world/zones.js`), which
  gives curved roads without changing the logic. The player lives in world space and keeps its grid position in
  sync for anything that thinks in cells.
- **Streaming.** `ChunkManager` keeps the 7×7 cells around the player, builds one per frame, and disposes cells
  that fall behind. Static geometry in a cell is merged per material (`util/batcher.js`) to keep draw calls low.
- **Physics.** Arcade-style and deliberately simple: speed, a steering rate that falls off at a crawl and at top
  speed, three collision circles for the car, rounded-rectangle tests for buildings. There is no physics
  engine: the ground is an analytic height function and the game needs no rigid-body dynamics, so an engine would
  add weight without adding anything you can see.
- **Input.** `InputManager.read()` returns `{ throttle, brake, steer }`. A game controller can be added later
  with `input.addSource(() => ({ throttle, brake, steer }))` without touching the car or the game loop.

## Configuration

Everything tunable is in `src/config.js`: top speed, acceleration, braking, steering, camera distance, traffic
density and speeds, signal timing, world size and the zone pattern, the car list and the key map.

## Tests

```
npm test             # Node's built-in runner, no dependencies, ~15 s
npm run test:browser # Playwright + headless Chromium smoke test (see below)
```

`npm test` runs 41 tests:

- the pure world functions (zones, rivers, stations, heights, the warp and its inverse, terrain carved below roads);
- the whole `Game` headless against a stub DOM and a fake renderer: boot, acceleration and money, up+left combining,
  braking distance and reverse, coasting, crashing into a car / a parked car / the river, a car behind you not
  crashing you, building collisions, speed-bump hops, the traffic slider, traffic speed spread and smooth turns,
  traffic lights and cars stopping at red, streaming through highways, desert and the next city, geometry free of
  NaNs across every kind of cell, all five car models, the settings panel, HUD, camera position, input handling
  and a two-minute random-driving soak.

`npm run test:browser` starts the server, opens the game in headless Chromium, checks that the world streams in,
the canvas is not blank, ↑ and ↑+← work, the settings panel and car selection work, the highway and second city
stream in, and there are no console errors. It saves screenshots to `tests/browser/out/`. Playwright is not a
project dependency (the game has none); install it with `npm i -D playwright && npx playwright install chromium`.

### What the tests do not show

- Rendering is verified only by software WebGL (SwiftShader) in headless Chromium, which runs at a few frames per
  second. **Real-GPU frame rate has not been measured.** The performance work (merged geometry, 49-cell streaming,
  shadow map refreshed every second frame, shared lamp materials) is by design, not by benchmark.
- Visual quality was checked by looking at screenshots, not by automated image comparison.
- Only Chromium has been tried. Firefox and Safari are untested.
- There is no automated test for how the car *feels* to drive; that needs a person.

## Differences from the single-file version

This is a port, not a redesign: the look, world and controls are meant to be the same. Deliberate changes:

- `toGrid` (world to grid) now uses Newton's method. The original's three fixed-point iterations were off by up to
  ~3 units in cities and ~10 on highways; it is now accurate to about 0.003.
- Chunk loading, speed-bump lookup and traffic spawning consistently use grid coordinates (the original mixed
  world and grid coordinates, which was only roughly right where the warp is strong).
- Fewer per-frame allocations, HUD writes only when a value changes, geometry merging falls back to separate
  meshes instead of failing, and replaced car models are disposed.

## Known limitations

- No sound, no minimap, no touch controls yet.
- Any crash (traffic, parked car, river) simply restarts you; there is no damage model.
- Traffic only drives on straight grid lines and Bezier turns; there is no overtaking.

## Upgrading three.js

`vendor/three/README.md` explains the vendoring. The one API change to expect: `mergeBufferGeometries` became
`mergeGeometries` in r151 (used in `src/util/batcher.js`).
