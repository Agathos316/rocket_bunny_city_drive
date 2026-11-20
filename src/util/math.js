/** Small pure helpers shared by every system. */

/** Deterministic random generator (mulberry32). The same seed always gives the same sequence. */
export const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Shortest signed angle from b to a. */
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Smoothstep between edges a and b. */
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Positive modulo 3 (used to pick every third road). */
export const mod3 = (n) => ((n % 3) + 3) % 3;

/** Positive modulo. */
export const mod = (n, m) => ((n % m) + m) % m;

/** Three circles along the car's length, in world coordinates. Used for all collision tests. */
export function capsulePoints(x, z, heading, offset) {
  const sx = Math.sin(heading), cz = Math.cos(heading);
  return [-offset, 0, offset].map((o) => [x + sx * o, z + cz * o]);
}
