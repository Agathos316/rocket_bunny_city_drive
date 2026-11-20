// Module resolution hook mirroring the import map in index.html:
//   "three"          -> vendor/three/build/three.module.js
//   "three/addons/"  -> vendor/three/examples/jsm/
const ROOT = new URL('../', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: new URL('vendor/three/build/three.module.js', ROOT).href, shortCircuit: true };
  }
  if (specifier.startsWith('three/addons/')) {
    return { url: new URL('vendor/three/examples/jsm/' + specifier.slice('three/addons/'.length), ROOT).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
