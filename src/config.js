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
   * Every vehicle in the game is a glTF model from this library (nothing is built in code); see assets/models/README.md.
   * Each entry is a car you can drive. `traffic: true` also puts it in traffic and at the kerb. `paint` names the body-paint
   * material, which can be recoloured (traffic cars come in several colours). `cockpit` cars have a modelled interior,
   * so the C key switches to the driver's view; for the others C does nothing. Models built by tools/car-pipeline have
   * three detail levels (nodes LOD0..LOD2), nose towards +z, in metres. `showroom` is a much more detailed version
   * (100-170k triangles), loaded only when the car selector shows the car, and swapped in when it arrives.
   */
  library: {
    dracoPath: './vendor/three/examples/jsm/libs/draco/gltf/',
    lodDistances: [28, 75],      // world units from the camera: level 1 beyond the first, level 2 beyond the second
    cullDistance: 235,           // cars further than this are not drawn at all (it is all fog out there)
    cars: {
      ferrari: {
        sound: 'ferrari',
        label: 'Ferrari 458 Italia', kind: 'ferrari', url: './assets/models/ferrari.glb', cockpit: true,
        rotateY: Math.PI,        // the model's nose is -z; the game's cars face +z
        steerCentre: [-0.35, 0.8, -0.35],   // steering wheel hub and column axis, in the file's own coordinates
        steerAxis: [0, 0.327, 0.945],
        eye: [-0.35, 1.0, 0.1],  // the driver's eye
      },
      nissan: { sound: 'nissan', label: 'Nissan GT-R R35 (Liberty Walk)', url: './assets/models/cars/nissan.glb', showroom: './assets/models/cars/hi/nissan.glb', paint: 'r35_paint' },
      mustang: { sound: 'mustang', label: 'Ford Mustang Fastback (1965)', url: './assets/models/cars/mustang.glb', raw: true, rotateY: Math.PI, scale: 0.82 },   // not from the pipeline: skinned, already in metres, nose towards -z,
      camry: { sound: 'camry', label: 'Toyota Camry', url: './assets/models/cars/camry.glb', showroom: './assets/models/cars/hi/camry.glb', paint: 'Paint_Color', traffic: true },
      audi: { sound: 'audi', label: 'Audi RS6 Avant', url: './assets/models/cars/audi.glb', showroom: './assets/models/cars/hi/audi.glb', paint: 'CarPrimaryColor', traffic: true },
      bmw: { sound: 'bmw', label: 'BMW M4', url: './assets/models/cars/bmw.glb', showroom: './assets/models/cars/hi/bmw.glb', traffic: true },
      golf: { sound: 'golf', label: 'Volkswagen Golf', url: './assets/models/cars/golf.glb', showroom: './assets/models/cars/hi/golf.glb', traffic: true },
    },
    trafficColors: [0xe6e6e2, 0x15161a, 0x5a5d63, 0x62081a, 0x123c8f, 0x0b2f6b, 0x6e7076, 0x1f3a2c, 0x4a1212, 0xb0aa98, 0x2a2d33, 0x8a4a1a],   // deep colours: the bright sun and tone mapping wash paint out
  },
};

/** Parked cars are drawn for the slots nearest the player only (see traffic/parkedManager.js). */
export const PARKED = {
  count: 48,                     // cars in the pool (far ones are drawn with very few triangles)
  radius: 200,                   // only slots within this many units of the player (grid units)
  refreshSeconds: 0.25,
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
  select: ['Space'],            // open the car selector; Space again chooses the car on show (arrows move, Esc cancels)
};

/**
 * Engine voices, one per car (CAR.library.cars[x].sound). Each shapes the synthesised engine:
 *   wave1/wave2/waveSub  oscillator shapes (sawtooth is buzzy, triangle soft, square hollow)   mix  their levels
 *   idleHz, rangeHz      engine pitch at idle and added at the redline    gearSpeeds  where the gearbox shifts (m/s)
 *   detune               second oscillator's offset (a bigger value is a lumpier, more V8-like rumble)
 *   cutoffBase/Range     brightness of the note at idle and added at the redline    resonance  how throaty (filter Q)
 *   gain                 loudness relative to the default    road  tyre-noise multiplier
 *   whine                optional extra tone { base, perSpeed, gain, throttleOnly }  (an EV's motor, a turbo's whistle)
 *   ev                   true: silent when stopped, no gear shifts, a whine instead of an engine note
 * Anything left out takes the value in DEFAULT_VOICE (audio.js), which is the original engine sound.
 */
export const SOUNDS = {
  ferrari: { idleHz: 56, rangeHz: 215, gearSpeeds: [0, 12, 24, 36, 48, 58], detune: 1.003, mix: [0.5, 0.4, 0.25], cutoffBase: 520, cutoffRange: 2700, resonance: 1.9, gain: 1.05 },
  nissan: { idleHz: 38, rangeHz: 150, gearSpeeds: [0, 11, 22, 34, 46, 58], detune: 1.008, mix: [0.5, 0.45, 0.75], cutoffBase: 380, cutoffRange: 2100, resonance: 1.7, gain: 1.15, whine: { base: 900, perSpeed: 16, gain: 0.012, throttleOnly: true } },
  mustang: { wave2: 'square', idleHz: 30, rangeHz: 100, gearSpeeds: [0, 14, 28, 43, 58], detune: 1.015, mix: [0.5, 0.3, 1.0], cutoffBase: 300, cutoffRange: 1500, resonance: 2.3, gain: 1.3 },
  camry: { wave2: 'triangle', idleHz: 44, rangeHz: 108, gearSpeeds: [0, 10, 20, 31, 43, 58], detune: 1.004, mix: [0.32, 0.4, 0.4], cutoffBase: 260, cutoffRange: 1000, resonance: 0.8, gain: 0.72 },
  golf: { wave2: 'square', idleHz: 50, rangeHz: 125, gearSpeeds: [0, 9, 19, 30, 43, 58], detune: 1.005, mix: [0.34, 0.14, 0.4], cutoffBase: 320, cutoffRange: 1400, resonance: 1.0, gain: 0.8 },
  audi: { idleHz: 40, rangeHz: 125, gearSpeeds: [0, 11, 22, 34, 46, 58], detune: 1.007, mix: [0.45, 0.35, 0.5], cutoffBase: 340, cutoffRange: 1700, resonance: 1.3, gain: 0.95 },
  bmw: { wave2: 'triangle', idleHz: 46, rangeHz: 145, gearSpeeds: [0, 11, 22, 34, 46, 58], detune: 1.004, mix: [0.45, 0.3, 0.4], cutoffBase: 420, cutoffRange: 1900, resonance: 1.2, gain: 0.9 },
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
