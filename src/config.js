/**
 * Central tuning values. Change numbers here rather than inside the systems.
 * Units: world units are metres, speeds are m/s, angles are radians.
 */

/* ---------- world grid ---------- */
export const C = 100;            // grid cell size: distance between neighbouring road centre-lines
export const RD = 8;             // road half-width
export const PK = 5;             // parking-lane depth between the road edge and the footpath
export const RAD = 3;            // cells kept loaded around the player, in each direction
export const CITY_RINGS = 6;     // square rings of city around the origin, then...
export const ZONE_PERIOD = 12;   // ...highway rings, repeating every this many rings
export const INTERCHANGE_SPACING = 3 * C;   // highways run every third grid line; interchanges sit where they cross

/* ---------- rendering ---------- */
export const RENDER = {
  fogColor: 0xd6e6f4,
  fogNear: 80,
  fogFar: 245,
  fov: 62,
  near: 0.5,
  far: 420,
  maxPixelRatio: 1.25,
  exposure: 1.25,
  shadowMapSize: 2048,
  shadowHalfExtent: 90,
  shadowEveryNFrames: 2,         // shadows refresh every Nth frame to save GPU time
  sunDir: [0.553, 0.755, 0.352],
  sunColor: 0xfff0d2,
  sunIntensity: 1.9,
  hemiSky: 0xcfe4ff,
  hemiGround: 0x8c8573,
  hemiIntensity: 0.55,
  groundSize: 1200,
  groundSnap: 16,                // ground plane moves in steps of this size so the asphalt texture never swims
  chunksPerFrame: 1,             // new cells generated per frame while driving
};

/* ---------- vehicles ---------- */
export const CAR = {
  scale: 1.5,                    // model units -> world units
  wheelRadius: 0.37,             // before scale
  playerColor: 0xff6a00,
  defaultModel: 'supra',
  models: ['supra', 'mustang', 'porsche', 'gtr', 'civic'],
  trafficColors: [0x1e5fd6, 0xc8102e, 0x0b4ea2, 0xf4f4f2, 0x7d8087, 0xf7c600, 0x6cc4e8, 0xb30f1d, 0x1a1b1e, 0x2f7a48, 0xff7a00],
  parkedColors: [0x1e88ff, 0xe5173f, 0x7ad100, 0xf2f2f2, 0x8e3bff, 0xffd000, 0x00c2b0, 0xff4fa0, 0x2a2a2a, 0xff6a00],
  blackRoofChance: 0.4,          // share of traffic cars with a black roof
};

export const DRIVE = {
  maxForward: 58,
  maxReverse: 14,
  accel: 30,                     // throttle acceleration at zero speed (fades to 0 at maxForward)
  reverseAccel: 42,              // throttle while rolling backwards
  brake: 80,                     // brake deceleration while rolling forwards
  reverseThrust: 14,             // brake pedal while stopped = reverse
  reverseRamp: 12,
  coastBase: 2.5,                // engine braking when no pedal is pressed
  coastPerSpeed: 0.2,
  steerSmoothing: 7,             // how quickly the wheel follows the key
  steerRate: 2.6,                // yaw rate at full lock
  steerSpeedFloor: 5,            // below this speed the car barely turns
  steerSpeedFalloff: 20,         // above this speed steering is progressively reduced
  accelSmoothing: 6,             // pitch response
  gravity: 30,
  moneyPerMetre: 0.2,
};

export const COLLISION = {
  capsuleOffset: 1.6,            // the car is three circles, this far apart along its length
  blockRadius: 1.6,              // radius used against building blocks
  carHitDistance: 3.1,           // circle-to-circle distance that counts as a crash
  blockBounce: 0.25,             // fraction of speed returned (reversed) when hitting a block hard
  bumpSlowdown: 0.8,
  bumpFastSpeed: 12,
  waterHalfWidth: 9.4,           // bridge half-width: leave it and you're in the river
  crashFlashSeconds: 0.9,
};

export const CAMERA = {
  distance: 14,
  height: 7.6,
  lookAhead: 5,
  lookHeight: 1.4,
  followHeading: 4.5,            // how quickly the camera swings round behind the car
  followPosition: 12,
  minAboveGround: 2.5,
  fovSpeedGain: 0.28,
};

/* ---------- traffic ---------- */
export const TRAFFIC = {
  defaultCount: 16,
  maxCount: 40,
  cruiseMin: 8,
  cruiseSpread: 32,              // cruise speed = min + random * spread (m/s)
  highwayMultiplier: 1.7,
  spawnMin: 90,                  // new cars appear between these distances from the player
  spawnMax: 200,
  despawn: 215,
  laneOffset: 4,
  cityTurnRadius: 8,
  highwayTurnRadius: 30,
  turnChanceCity: 0.4,
  turnChanceHighway: 0.25,
  cornerSpeedCity: 10,
  cornerSpeedHighway: 26,
  followGap: 9,
  followDecel: 28,
  lookAhead: 80,
  laneWidthCheck: 3.4,
};

export const SIGNALS = {
  cycle: 24,                     // seconds for a full cycle
  green: 10,
  amber: 2,
  phaseOffset: 12,               // cross street runs half a cycle later
  stopDecel: 14,
};

/* ---------- player start (grid coordinates, before the world bend is applied) ---------- */
export const START = { gx: -4, gz: 70, heading: Math.PI };

/* ---------- controls ---------- */
export const KEYMAP = {
  throttle: ['ArrowUp'],
  brake: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
};

/** Procedurally synthesised sound (Web Audio). No audio files are used. */
export const AUDIO = {
  volume: 0.6,                   // default master volume, 0..1
  gearSpeeds: [0, 11, 22, 34, 46, 58],   // speed (m/s) at each gear boundary; the engine note drops at each shift
  engineIdleHz: 40,              // engine fundamental at the lowest revs
  engineRangeHz: 125,            // added at the redline
  engineGain: 0.32,
  roadGain: 0.12,
  windGain: 0.14,
  squealGain: 0.07,
  ambienceGain: 0.5,
  ambienceFadeSeconds: 1.5,      // crossfade time when you drive into a different environment
  minEventGap: 0.15,             // seconds between repeats of the same impact sound
};
