import * as THREE from 'three';
import { RENDER } from './config.js';

/** Create the WebGL renderer and attach its canvas to `parent`. Throws if WebGL is unavailable. */
export function createRenderer(parent) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDER.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the game refreshes shadows every few frames (see environment.js)
  renderer.shadowMap.needsUpdate = true;
  renderer.setSize(window.innerWidth, window.innerHeight);
  parent.appendChild(renderer.domElement);
  return renderer;
}
