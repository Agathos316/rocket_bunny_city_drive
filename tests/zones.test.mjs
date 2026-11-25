// Pure world-shape functions: no rendering involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, RD } from '../src/config.js';
import {
  isHwy, roadAt, isRiver, isStn, isDesert, hwAt, Hr, Gt, surf, cityBridgeY, bridgeY,
  toWorld, toGrid, worldHeading, roadStyle,
} from '../src/world/zones.js';

test('zones: six city rings, six highway rings, repeating', () => {
  assert.equal(isHwy(0, 0), false);
  assert.equal(isHwy(5, -5), false);
  assert.equal(isHwy(6, 0), true);
  assert.equal(isHwy(0, -11), true);
  assert.equal(isHwy(12, 0), false);   // the next city
  assert.equal(isHwy(18, 3), true);
});

test('roads: every road exists in a city; highways run on every third line', () => {
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    assert.equal(roadAt(i, j, 'x'), true);
    assert.equal(roadAt(i, j, 'z'), true);
  }
  assert.equal(roadAt(6, 6, 'z'), true);    // 6 % 3 === 0
  assert.equal(roadAt(7, 6, 'z'), false);
  assert.equal(roadAt(6, 7, 'x'), false);
  assert.equal(roadAt(6, 9, 'x'), true);
});

test('rivers: every fifth row of city blocks, never on highways', () => {
  assert.equal(isRiver(0, 2), true);
  assert.equal(isRiver(4, -3), true);
  assert.equal(isRiver(0, -3), true);
  assert.equal(isRiver(0, 0), false);
  assert.equal(isRiver(7, 2), false);   // highway cell
});

test('petrol stations: never the start block, a river or a highway; roughly 9% of blocks', () => {
  assert.equal(isStn(0, 0), false);
  let stations = 0, blocks = 0;
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    if (isRiver(i, j)) assert.equal(isStn(i, j), false);
    blocks++;
    if (isStn(i, j)) stations++;
  }
  assert.ok(stations > 0 && stations / blocks < 0.2, `got ${stations} of ${blocks}`);
});

test('desert alternates with green country between highway rings', () => {
  const kinds = new Set([isDesert(8, 0), isDesert(-8, 0), isDesert(0, 8), isDesert(0, -8)]);
  assert.equal(kinds.size, 2, 'both desert and green highways should exist in the first ring');
});

test('road styles: four, and constant along a road', () => {
  const seen = new Set();
  for (let k = -20; k <= 20; k++) { seen.add(roadStyle(0, k)); seen.add(roadStyle(1, k)); }
  assert.ok([...seen].every((s) => s >= 0 && s <= 3));
  assert.ok(seen.size >= 3, 'roads should not all look the same');
});

test('warp: toGrid inverts toWorld everywhere, city and highway', () => {
  let worst = 0;
  for (let x = -1500; x <= 1500; x += 137) for (let z = -1500; z <= 1500; z += 151) {
    const [wx, wz] = toWorld(x, z), [gx, gz] = toGrid(wx, wz);
    worst = Math.max(worst, Math.hypot(gx - x, gz - z));
  }
  assert.ok(worst < 0.01, `round-trip error ${worst}`);
});

test('warp: roads actually bend (not a straight line)', () => {
  const xs = [];
  for (let z = 0; z <= 600; z += 50) xs.push(toWorld(0, z)[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 10, 'a grid line should wander sideways');
});

test('warp: world heading matches the direction of travel along a bent road', () => {
  const [x0, z0] = toWorld(0, 200), [x1, z1] = toWorld(0, 201);
  const measured = Math.atan2(x1 - x0, z1 - z0), h = worldHeading(0, 200.5, 0);
  assert.ok(Math.abs(measured - h) < 0.01, `${measured} vs ${h}`);
});

test('heights: flat in the city, rolling on highways, bridge decks on rivers', () => {
  assert.equal(surf(40, 40), 0);
  assert.equal(Hr(50, 50), 0);
  assert.ok(hwAt(9 * C + 50, 50) > 0.99, 'deep in a highway ring the terrain blend is complete');
  assert.equal(hwAt(50, 50), 0, 'and zero in the city');
  let max = 0;
  for (let x = 6 * C; x < 9 * C; x += 25) max = Math.max(max, Hr(x, 6 * C + 50));
  assert.ok(max > 3, 'highway road grade should rise and fall');

  const riverMidZ = 2 * C + C / 2;
  assert.ok(cityBridgeY(0, riverMidZ) > 2, 'bridge deck is raised in the middle of a river cell');
  assert.equal(cityBridgeY(50, riverMidZ), 0, 'off the bridge there is no deck');
  assert.equal(cityBridgeY(0, 2 * C + RD - 1), 0, 'outside the river span');
  assert.ok(bridgeY(RD + 1) < bridgeY(C / 2), 'the deck ramps up from both ends');
});

test('terrain: road corridors are carved out below the road, so no grass pokes through', () => {
  // along a highway road (grid line z = 6*C), sample just beside the road
  let checked = 0;
  for (let x = 6 * C; x < 11.5 * C; x += 20) {
    const roadY = Hr(x, 6 * C);
    for (const dz of [-6, 0, 6]) {
      const g = Gt(x, 6 * C + dz);
      if (g > roadY + 8) continue;   // a tunnel roof, deliberately well above the road
      assert.ok(g <= roadY + 0.03, `terrain ${g} above road ${roadY} at x=${x}`);   // 0.02 is the global floor
      checked++;
    }
  }
  assert.ok(checked > 10);
});

test('towns: the last two rings of a green highway, never desert, city or the inner highway', async () => {
  const { isTown } = await import('../src/world/zones.js');
  let green = 0;
  for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
    if (isTown(i, j)) {
      green++;
      assert.equal(isHwy(i, j), true);
      assert.equal(isDesert(i, j), false);
      assert.ok(Math.max(Math.abs(i), Math.abs(j)) % 12 >= 10);
    }
  }
  assert.ok(green > 0, 'there should be towns');
  assert.equal(isTown(0, 0), false);
  assert.equal(isTown(8, 0), false);
});

test('towns: houses are one or two storeys, solid boxes that stay clear of every road', async () => {
  const { isTown } = await import('../src/world/zones.js');
  const { townHouses } = await import('../src/world/town.js');
  let houses = 0;
  const storeys = new Set();
  for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
    const list = townHouses(i, j);
    if (!isTown(i, j)) { assert.equal(list.length, 0); continue; }
    for (const h of list) {
      houses++;
      storeys.add(h.storeys);
      assert.ok([1, 2].includes(h.storeys));
      for (const [lineX, lineZ] of [[Math.round(h.x / 100) * 100, Math.round(h.z / 100) * 100]]) {
        if (roadAt(Math.round(h.x / 100), Math.floor(h.z / 100), 'z')) assert.ok(Math.abs(h.x - lineX) - h.hw > 17, `house ${h.x},${h.z} too close to a north-south road`);
        if (roadAt(Math.floor(h.x / 100), Math.round(h.z / 100), 'x')) assert.ok(Math.abs(h.z - lineZ) - h.hd > 17, `house ${h.x},${h.z} too close to an east-west road`);
      }
    }
    assert.deepEqual(townHouses(i, j).map((h) => h.x), list.map((h) => h.x), 'deterministic');
  }
  assert.ok(houses > 100 && storeys.size === 2, `got ${houses} houses, storeys ${[...storeys]}`);
});
