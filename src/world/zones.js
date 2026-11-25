/**
 * The shape of the world, as pure functions (no rendering, no state).
 *
 * The world is described on a straight "grid" (cells of size C, cell (i, j) covers
 * x in [i*C, (i+1)*C), z in [j*C, (j+1)*C)). Everything the player sees and drives on is
 * then bent by a smooth "warp" so roads curve. Logic (roads, zones, traffic) works in grid
 * space; rendering and driving work in world space. toWorld/toGrid convert between them.
 *
 * Zones are square rings around the origin: CITY_RINGS rings of city, then highway rings,
 * repeating every ZONE_PERIOD rings. Highway rings alternate between green country and desert.
 */
import { C, RD, CITY_RINGS, ZONE_PERIOD, INTERCHANGE_SPACING } from '../config.js';
import { smoothstep as ss, mod3, mod } from '../util/math.js';

/* ------------------------------------------------------------------ zones */

export const isHwy = (i, j) => Math.max(Math.abs(i), Math.abs(j)) % ZONE_PERIOD >= CITY_RINGS;

/** Is there a road along axis ax ('x' or 'z') through cell (i, j)? Every road exists in a city; highways run every third line. */
export const roadAt = (i, j, ax) => !isHwy(i, j) || (ax === 'z' ? mod3(i) : mod3(j)) === 0;

/** 0 in the city, 1 deep in a highway ring, smooth in between (used to blend terrain in). */
export const hwAt = (x, z) => {
  const u = Math.max(Math.abs(x / C - 0.5), Math.abs(z / C - 0.5)) % ZONE_PERIOD;
  return ss(5.5, 8, u) * (1 - ss(9.5, 11.5, u));
};

export const isDesert = (i, j) => {
  const a = Math.abs(i), b = Math.abs(j);
  const dom = a >= b ? (i >= 0 ? 0 : 1) : (j >= 0 ? 2 : 3);
  return ((dom + Math.floor(Math.max(a, b) / ZONE_PERIOD)) & 1) === 1;
};

/**
 * Towns: the last two highway rings of a green (not desert) stretch, so you drive out of the grassland into a town
 * of one and two storey houses before the next city begins.
 */
export const isTown = (i, j) => isHwy(i, j) && !isDesert(i, j) && Math.max(Math.abs(i), Math.abs(j)) % ZONE_PERIOD >= ZONE_PERIOD - 2;

/** Every fifth row of city blocks is a river. */
export const isRiver = (i, j) => !isHwy(i, j) && mod(j, 5) === 2;

/** Roughly one block in eleven is a petrol station (never the start block or a river). */
export const isStn = (i, j) =>
  !isHwy(i, j) && (i !== 0 || j !== 0) && mod(j, 5) !== 2 &&
  ((Math.imul(i * 73856093 ^ j * 19349663, 2654435761) >>> 0) % 100) < 9;

/** One of four road looks, constant along a whole road line. */
export const roadStyle = (axis, index) => (Math.imul(index + axis * 31, 2654435761) >>> 0) % 4;

/* ------------------------------------------------------------ heights */

/** Road grade: height of the road surface on highways. */
export const Hr = (x, z) => {
  const w = hwAt(x, z);
  return w ? w * 11 * (1 + 0.9 * (0.6 * Math.sin(x * 0.011 + 1) * Math.cos(z * 0.009) + 0.4 * Math.sin((x + z) * 0.006 + 2))) : 0;
};

/** Terrain offset relative to the road: positive = hill over the road (tunnel), negative = valley (bridge). */
export const Fe = (x, z) =>
  hwAt(x, z) * 30 * Math.sin(x * 0.021 + 0.5) * Math.sin(z * 0.017 + 1.3) *
  ss(45, 80, Math.hypot(x - Math.round(x / INTERCHANGE_SPACING) * INTERCHANGE_SPACING, z - Math.round(z / INTERCHANGE_SPACING) * INTERCHANGE_SPACING));

/** Terrain offset beyond +-8: inside +-8 the road simply stays at grade. */
export const dzf = (f) => (f > 8 ? f - 8 : f < -8 ? f + 8 : 0);

/** Raw terrain height (hills and valleys), before road corridors are carved out. */
export const Gh = (x, z) => Math.max(0.02, Hr(x, z) + dzf(Fe(x, z)));

/**
 * Terrain height with road corridors carved out: no grass on roads, shoulders or interchanges,
 * and tunnel roofs sit well above the arch.
 */
export function Gt(x, z) {
  let y = Gh(x, z);
  for (const X of [0, 1]) {
    const lc = Math.round((X ? x : z) / C) * C, lat = Math.abs((X ? x : z) - lc);
    if (lat > 16) continue;
    const i = X ? lc / C : Math.floor(x / C), j = X ? Math.floor(z / C) : lc / C;
    if (!roadAt(i, j, X ? 'z' : 'x')) continue;
    const px = X ? lc : x, pz = X ? z : lc, R = Hr(px, pz);
    const tgt = dzf(Fe(px, pz)) > 0.05 ? Math.max(y, R + 13.5) : Math.min(y, R - 0.3);
    y += (tgt - y) * (1 - ss(10, 16, lat));
  }
  const nx = Math.round(x / INTERCHANGE_SPACING) * INTERCHANGE_SPACING, nz = Math.round(z / INTERCHANGE_SPACING) * INTERCHANGE_SPACING;
  if (isHwy(nx / C, nz / C) && roadAt(nx / C, nz / C, 'x') && roadAt(nx / C, nz / C, 'z')) {
    const d = Math.max(Math.abs(x - nx), Math.abs(z - nz));
    y += (Math.min(y, Hr(x, z) - 0.4) - y) * (1 - ss(36, 46, d));
  }
  return Math.max(0.02, y);
}

/** +1 over a tunnel, -1 over an open road cutting, 0 elsewhere (used to cut the hillside open at tunnel mouths). */
export function tunnelFlag(x, z) {
  for (const X of [0, 1]) {
    const lc = Math.round((X ? x : z) / C) * C, lat = Math.abs((X ? x : z) - lc);
    if (lat >= 14) continue;
    const i = X ? lc / C : Math.floor(x / C), j = X ? Math.floor(z / C) : lc / C;
    if (!roadAt(i, j, X ? 'z' : 'x')) continue;
    const px = X ? lc : x, pz = X ? z : lc;
    return dzf(Fe(px, pz)) > 0.05 ? 1 : -1;
  }
  return 0;
}

/** How close (0..1) a point is to a tunnel: used to tint the hillside grey rock. */
export function tunnelWeight(x, z) {
  let w = 0;
  for (const X of [0, 1]) {
    const lc = Math.round((X ? x : z) / C) * C, lat = Math.abs((X ? x : z) - lc);
    if (lat > 24) continue;
    const i = X ? lc / C : Math.floor(x / C), j = X ? Math.floor(z / C) : lc / C;
    if (!roadAt(i, j, X ? 'z' : 'x')) continue;
    const px = X ? lc : x, pz = X ? z : lc;
    if ([-6, 0, 6].some((o) => dzf(Fe(X ? px : px + o, X ? pz + o : pz)) > 0.05)) w = Math.max(w, 1 - ss(14, 24, lat));
  }
  return w;
}

/** Height of the bridge deck along a city river, by distance zr from the cell edge (ramps up and down). */
export const bridgeY = (zr) => {
  const t = zr - RD, L = C - 2 * RD, u = Math.min(1, t / 24, (L - t) / 24);
  return u <= 0 ? 0 : 2.4 * ss(0, 1, u);
};

export function cityBridgeY(x, z) {
  const i = Math.floor(x / C), j = Math.floor(z / C);
  if (!isRiver(i, j)) return 0;
  const zr = z - j * C;
  if (zr < RD || zr > C - RD) return 0;
  return Math.abs(x - Math.round(x / C) * C) <= 9.3 ? bridgeY(zr) : 0;
}

/** Height of whatever the car drives on at grid point (x, z): road, bridge deck or terrain. */
export function surf(x, z) {
  const R = Hr(x, z);
  if (R <= 0.001) return cityBridgeY(x, z);
  const lx = Math.round(z / C) * C, lz = Math.round(x / C) * C;
  if (Math.abs(z - lx) < RD + 2 && roadAt(Math.floor(x / C), lx / C, 'x')) return R;
  if (Math.abs(x - lz) < RD + 2 && roadAt(lz / C, Math.floor(z / C), 'z')) return R;
  return Gt(x, z);
}

/* ------------------------------------------------------------ world warp */

/** Smooth displacement that bends the straight grid into curving roads (stronger on highways). */
export const warpX = (x, z) => (1 + 0.6 * hwAt(x, z)) * (16 * Math.sin(z * 0.012 + 1.1) + 6 * Math.sin(z * 0.031 + 0.2) + 26 * Math.sin(z * 0.0055 + 2.2));
export const warpZ = (x, z) => (1 + 0.6 * hwAt(x, z)) * (16 * Math.sin(x * 0.011 + 0.4) + 6 * Math.sin(x * 0.028 + 2.1) + 26 * Math.sin(x * 0.0052 + 0.9));

/** Grid -> world. */
export const toWorld = (x, z) => [x + warpX(x, z), z + warpZ(x, z)];

/**
 * World -> grid: the inverse of toWorld. A plain fixed-point iteration is only good to a few units on this warp,
 * which would put collision shapes visibly away from the buildings and parked cars they belong to, so this uses
 * Newton's method (a numerical Jacobian), which converges to well under a centimetre in three steps.
 */
export const toGrid = (wx, wz) => {
  let x = wx - warpX(wx, wz), z = wz - warpZ(wx, wz);
  const e = 0.5;
  for (let k = 0; k < 3; k++) {
    const rx = x + warpX(x, z) - wx, rz = z + warpZ(x, z) - wz;                  // how far toWorld(x, z) is from the target
    const a = 1 + (warpX(x + e, z) - warpX(x - e, z)) / (2 * e), b = (warpX(x, z + e) - warpX(x, z - e)) / (2 * e);
    const c = (warpZ(x + e, z) - warpZ(x - e, z)) / (2 * e), d = 1 + (warpZ(x, z + e) - warpZ(x, z - e)) / (2 * e);
    const det = a * d - b * c;
    x -= (d * rx - b * rz) / det;
    z -= (a * rz - c * rx) / det;
  }
  return [x, z];
};

/** Surface height at a world position. */
export const sgrid = (wx, wz) => {
  const g = toGrid(wx, wz);
  return surf(g[0], g[1]);
};

/** Heading of something pointing along `h` in grid space, expressed in world space. */
export function worldHeading(x, z, h) {
  const fx = Math.sin(h), fz = Math.cos(h);
  const dX = (warpX(x, z + 1) - warpX(x, z - 1)) / 2, dZ = (warpZ(x + 1, z) - warpZ(x - 1, z)) / 2;
  return Math.atan2(fx + dX * fz, fz + dZ * fx);
}
