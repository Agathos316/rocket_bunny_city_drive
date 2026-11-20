/**
 * Shared materials and procedurally drawn textures.
 * Built once, lazily, the first time getAssets() is called (so importing this file has no side effects).
 */
import * as THREE from 'three';
import { C, RD } from './config.js';

let cache = null;
export function getAssets() {
  return cache || (cache = buildAssets());
}

export const lambert = (color, opts) => new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function repeatTexture(c, { repeat, anisotropy, wrapT = true }) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  if (wrapT) t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  if (anisotropy) t.anisotropy = anisotropy;
  return t;
}

/** A building facade: wall colour with a grid of windows, some of them lit. */
function windowTexture(wall, lit) {
  const c = canvas(64, 64, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 2; r++) {
      for (let q = 0; q < 3; q++) {
        g.fillStyle = Math.random() < 0.22 ? lit : '#3d6286';
        g.fillRect(q * 21 + 4, r * 32 + 7, 14, 18);
      }
    }
  });
  return repeatTexture(c, { anisotropy: 4 });
}

const BUILDING_STYLES = [
  ['#8d96a3', '#cfe6fb'], ['#b9a58c', '#e8f2fb'], ['#59616e', '#a9d0f2'],
  ['#a0584a', '#d6e9fa'], ['#7e9aa8', '#ffffff'], ['#444b57', '#8fbfe8'],
];

function buildAssets() {
  /* ---- textures ---- */
  const asphalt = repeatTexture(canvas(128, 128, (g) => {
    g.fillStyle = '#16171a'; g.fillRect(0, 0, 128, 128);
    for (let n = 0; n < 2600; n++) {
      const v = 14 + Math.random() * 20 | 0;
      g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',.55)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
    }
  }), { repeat: [75, 75], anisotropy: 8 });

  const crosswalk = repeatTexture(canvas(8, 64, (g) => {
    g.fillStyle = '#f4f4f0';
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 3, 8, 9);
  }), { repeat: [1, 1.75] });

  const dashes = repeatTexture(canvas(64, 4, (g) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, 32, 4);
  }), { repeat: [(C - 2 * RD) / 4, 1] });

  const bumpStripes = repeatTexture(canvas(64, 8, (g) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#151515' : '#f4c20d'; g.fillRect(i * 8, 0, 8, 8); }
  }), { repeat: [4, 1], wrapT: false });

  /* ---- city ---- */
  const buildings = BUILDING_STYLES.map(([wall, lit]) => new THREE.MeshStandardMaterial({
    map: windowTexture(wall, lit), roughness: 0.4, metalness: 0.15, envMapIntensity: 0.8,
  }));
  const roof = lambert(0x7a7e84);
  const trunk = lambert(0x5a4030);
  const leaves = [0x3f7a35, 0x4e8f3a, 0x2f6a30].map((c) => lambert(c));
  const concrete = lambert(0xa5a7aa, { side: THREE.DoubleSide, emissive: 0x34363a });
  const canopy = lambert(0xd0242b);
  const parkedPaint = new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, metalness: 0.4, roughness: 0.35, envMapIntensity: 0.6, side: THREE.DoubleSide,
  });

  const mats = {
    buildings, roof, trunk, leaves, concrete, canopy, parkedPaint,
    footpath: lambert(0xc2beb4),
    ground: lambert(0xffffff, { map: asphalt }),
    highway: lambert(0x111214),
    interchange: lambert(0x111214),   // a separate instance: the highway builder lifts it onto the road grade
    desertRoad: lambert(0x151517),
    terrain: lambert(0xffffff, { vertexColors: true }),
    crosswalk: lambert(0xffffff, { map: crosswalk, transparent: true }),
    dashLine: lambert(0xffffff, { map: dashes, transparent: true }),
    speedBump: lambert(0xffffff, { map: bumpStripes }),
    roadOverlay: [null, lambert(0x101113), lambert(0x17181a), lambert(0x131416)],
    yellowLine: lambert(0xf2c230),
    whiteLine: lambert(0xf4f4f0),
    signalPole: lambert(0x25282c),
    forecourt: lambert(0x3b3d42),
    pump: lambert(0xe8e8e8),
    priceSign: new THREE.MeshBasicMaterial({ color: 0xffd21f }),
    cactus: lambert(0x4f7a3a),
    rock: lambert(0x8a7b66),
    water: new THREE.MeshStandardMaterial({ color: 0x2b6f8e, metalness: 0.6, roughness: 0.15, envMapIntensity: 1 }),
  };

  /* ---- cars ---- */
  const car = {
    dark: lambert(0x16181c),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e1a28, metalness: 0.9, roughness: 0.06 }),
    tire: lambert(0x101010),
    rim: new THREE.MeshStandardMaterial({ color: 0xdde1e8, metalness: 1, roughness: 0.25 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    plate: mats.whiteLine,
    blackRoof: () => lambert(0x16181c),
    /** Glossy clear-coat paint. */
    paint: (color) => new THREE.MeshPhysicalMaterial({
      color, metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9,
    }),
  };

  /* Materials whose meshes cast shadows (flat ground detail does not). */
  const castsShadow = new Set([roof, trunk, ...leaves, ...buildings, concrete, canopy, parkedPaint]);

  return { mats, car, castsShadow, textures: { asphalt } };
}
