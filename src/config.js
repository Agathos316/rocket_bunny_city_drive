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
  scale: 1.5,                    // Ferrari: model units (metres) -> world units
  playerColor: 0xff6a00,         // paint of the Ferrari
  defaultModel: 'ferrari',
  steeringWheelLock: 1.2,        // steering-wheel rotation (rad) at full lock; the road wheels turn roadWheelLock
  roadWheelLock: 0.5,
  /**
   * Every vehicle in the game is a glTF model from this library (nothing is built in code). See assets/models/README.md.
   * player: the cars you can choose. `kind: 'ferrari'` has a modelled cockpit; the others get a bonnet-level camera
   * (`eye`, in model units). traffic / parked: the models used for cars driving and parked around the world.
   */
  library: {
    dracoPath: './vendor/three/examples/jsm/libs/draco/gltf/',
    kenneyDir: './assets/models/kenney/',
    kenneyScale: 2.5,            // Kenney Car Kit model units -> world units (driven and traffic cars)
    parkedScale: 2.3,            // parked cars are a little smaller so they fit the bays
    player: {
      ferrari: {
        label: 'Ferrari 458 Italia', kind: 'ferrari', url: './assets/models/ferrari.glb',
        rotateY: Math.PI,        // the model's nose is -z; the game's cars face +z
        steerCentre: [-0.35, 0.8, -0.35],   // steering wheel hub and column axis, in the file's own coordinates
        steerAxis: [0, 0.327, 0.945],
        eye: [-0.35, 1.0, 0.1],  // the driver's eye
      },
      'sedan-sports': { label: 'Sports sedan', kind: 'kenney', url: './assets/models/kenney/sedan-sports.glb', eye: [0, 0.95, 0.15] },
      'hatchback-sports': { label: 'Sports hatchback', kind: 'kenney', url: './assets/models/kenney/hatchback-sports.glb', eye: [0, 0.95, 0.15] },
      race: { label: 'Race car', kind: 'kenney', url: './assets/models/kenney/race.glb', eye: [0, 0.85, 0.2] },
      'race-future': { label: 'Future race car', kind: 'kenney', url: './assets/models/kenney/race-future.glb', eye: [0, 0.85, 0.2] },
    },
    traffic: ['sedan', 'suv', 'taxi', 'van', 'suv-luxury', 'delivery', 'police'],
    parked: ['sedan', 'suv', 'taxi', 'van', 'suv-luxury'],     // not the delivery truck (too long for a bay) or the police car
  },
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
  steerRate: 3.6,                // yaw rate at full lock
  steerSpeedFloor: 5,            // below this speed the car barely turns
  steerSpeedFalloff: 24,         // above this speed steering is progressively reduced
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
  distance: 8.5,                 // chase camera: behind and above the car
  height: 3.6,
  lookAhead: 6,
  lookHeight: 1.5,
  followHeading: 4.5,            // how quickly the camera swings round behind the car
  followPosition: 12,
  minAboveGround: 1.6,
  cockpitFov: 72,
  cockpitNear: 0.1,
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
  camera: ['KeyC'],             // switch between the chase camera and the cockpit view
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
