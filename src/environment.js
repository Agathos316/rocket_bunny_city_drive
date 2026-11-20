/**
 * Sky, sunlight, fog and the ground plane. Everything here follows the player so the world feels endless.
 */
import * as THREE from 'three';
import { RENDER } from './config.js';
import { getAssets } from './assets.js';

/** Default reflection source: the sky dome, prefiltered. Tests pass a different function so no GPU is needed. */
export function reflectionFromSky(renderer, skyGeometry, skyMaterial) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(skyGeometry, skyMaterial));
  return new THREE.PMREMGenerator(renderer).fromScene(scene, 0, 1, 1000).texture;
}

function drawSky(sunDir) {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gradient = g.createLinearGradient(0, 0, 0, H / 2);
  gradient.addColorStop(0, '#2f7fd8'); gradient.addColorStop(0.6, '#7fb6ec'); gradient.addColorStop(1, '#d6e6f4');
  g.fillStyle = gradient; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = '#d6e6f4'; g.fillRect(0, H / 2, W, H / 2);
  for (let n = 0; n < 46; n++) {                       // soft clouds
    const x = Math.random() * W, y = 60 + Math.random() * 330, s = 40 + Math.random() * 70;
    for (let k = 0; k < 9; k++) {
      const px = x + (Math.random() - 0.5) * s * 2.4, py = y + (Math.random() - 0.5) * s * 0.5, q = s * (0.5 + Math.random() * 0.6);
      const rg = g.createRadialGradient(px, py, 0, px, py, q);
      rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(px, py, q, 0, 7); g.fill();
    }
  }
  const sx = (Math.atan2(sunDir.z, -sunDir.x) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * W;   // sun disc at the light direction
  const sy = Math.acos(sunDir.y) / Math.PI * H;
  const sun = g.createRadialGradient(sx, sy, 0, sx, sy, 170);
  sun.addColorStop(0, 'rgba(255,255,240,1)'); sun.addColorStop(0.1, 'rgba(255,248,214,.95)');
  sun.addColorStop(0.3, 'rgba(255,236,170,.35)'); sun.addColorStop(1, 'rgba(255,236,170,0)');
  g.fillStyle = sun; g.fillRect(sx - 200, sy - 200, 400, 400);
  return c;
}

export function createEnvironment(scene, renderer, makeReflection = reflectionFromSky) {
  const { mats } = getAssets();
  scene.background = new THREE.Color(RENDER.fogColor);
  scene.fog = new THREE.Fog(RENDER.fogColor, RENDER.fogNear, RENDER.fogFar);
  scene.add(new THREE.HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity));

  const sunDir = new THREE.Vector3(...RENDER.sunDir);
  const sun = new THREE.DirectionalLight(RENDER.sunColor, RENDER.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  const sc = sun.shadow.camera, e = RENDER.shadowHalfExtent;
  sc.left = sc.bottom = -e; sc.right = sc.top = e; sc.near = 10; sc.far = 500;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);

  const skyGeometry = new THREE.SphereGeometry(350, 48, 24);
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(drawSky(sunDir)), side: THREE.BackSide, fog: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  scene.add(sky);
  scene.environment = makeReflection(renderer, skyGeometry, skyMaterial);   // paint and glass reflect the sky

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(RENDER.groundSize, RENDER.groundSize).rotateX(-Math.PI / 2), mats.ground);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    sun, sky, ground,
    /** Move the ground, sun and sky with the player; refresh shadows every few frames. */
    update(player, camera, frame) {
      const snap = RENDER.groundSnap;
      ground.position.set(Math.round(player.x / snap) * snap, 0, Math.round(player.z / snap) * snap);
      const lx = Math.round(player.x / 3) * 3, lz = Math.round(player.z / 3) * 3;   // snapped so shadows don't shimmer
      sun.target.position.set(lx, player.gys, lz);
      sun.position.set(lx + sunDir.x * 220, player.gys + sunDir.y * 220, lz + sunDir.z * 220);
      sky.position.copy(camera.position);
      if (frame % RENDER.shadowEveryNFrames === 0) renderer.shadowMap.needsUpdate = true;
    },
  };
}
