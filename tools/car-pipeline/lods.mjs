// stage 2: normalise (centre, ground, rotate so the nose is +z, scale to a real length) and build three LOD meshes
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [,, inp, out, lenS, rotS, t0S, t1S, t2S] = process.argv;
const LEN = Number(lenS), ROT = Number(rotS) * Math.PI / 180, T = [Number(t0S || 22000), Number(t1S || 7000), Number(t2S || 1800)];
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot(), scene = root.listScenes()[0];
// bake any node transforms (e.g. a Blender z-up root rotation) into the vertices first
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  if (M.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9)) continue;
  const sx = Math.hypot(M[0], M[1], M[2]);
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), pa = pos.getArray().slice(), na = nor ? nor.getArray().slice() : null;
    for (let i = 0; i < pa.length; i += 3) {
      const x = pa[i], y = pa[i + 1], z = pa[i + 2];
      pa[i] = M[0] * x + M[4] * y + M[8] * z + M[12]; pa[i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13]; pa[i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
      if (na) { const nx = na[i], ny = na[i + 1], nz = na[i + 2]; na[i] = (M[0] * nx + M[4] * ny + M[8] * nz) / sx; na[i + 1] = (M[1] * nx + M[5] * ny + M[9] * nz) / sx; na[i + 2] = (M[2] * nx + M[6] * ny + M[10] * nz) / sx; }
    }
    pos.setArray(pa); if (na) nor.setArray(na);
  }
  node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
const prims = [];
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) prims.push(p);

// bounds across all primitives (nodes are identity after join)
let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
for (const p of prims) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a[i + k]); max[k] = Math.max(max[k], a[i + k]); } }
const size = max.map((v, k) => v - min[k]);
// the car's length is its longest horizontal extent before rotation; ROT then points the nose at +z
const lenAxis = size[0] > size[2] ? 0 : 2;
const scale = LEN / size[lenAxis];
const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, cosR = Math.cos(ROT), sinR = Math.sin(ROT);
// if the car's length lies along x, turn it to z first (+90 deg), then apply ROT
const base = lenAxis === 0 ? Math.PI / 2 : 0;
const c0 = Math.cos(base + ROT), s0 = Math.sin(base + ROT);
for (const p of prims) {
  const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL');
  const pa = pos.getArray().slice(), na = nor ? nor.getArray().slice() : null;
  for (let i = 0; i < pa.length; i += 3) {
    const x = (pa[i] - cx) * scale, y = (pa[i + 1] - min[1]) * scale, z = (pa[i + 2] - cz) * scale;
    pa[i] = x * c0 + z * s0; pa[i + 1] = y; pa[i + 2] = -x * s0 + z * c0;
    if (na) { const nx = na[i], nz = na[i + 2]; na[i] = nx * c0 + nz * s0; na[i + 2] = -nx * s0 + nz * c0; }
  }
  pos.setArray(pa); if (na) nor.setArray(na);
}

/** Reduce a primitive's triangle count; returns new arrays { indices, attrs } (vertices compacted). */
function reduce(p, target, sloppy) {
  const idx = p.getIndices().getArray(), pos = p.getAttribute('POSITION').getArray();
  const names = p.listSemantics();
  let res;
  const want = Math.max(36, Math.floor(target / 3) * 3 * 1);
  if (sloppy) res = MeshoptSimplifier.simplifySloppy(new Uint32Array(idx), new Float32Array(pos), 3, null, want, 1)[0];
  else {
    const nrm = p.getAttribute('NORMAL')?.getArray(), uv = p.getAttribute('TEXCOORD_0')?.getArray();
    const n = pos.length / 3, aw = 6 + (uv ? 2 : 0), attrs = new Float32Array(n * aw);
    for (let v = 0; v < n; v++) { for (let k = 0; k < 3; k++) attrs[v * aw + k] = nrm ? nrm[v * 3 + k] : 0; if (uv) { attrs[v * aw + 6] = uv[v * 2]; attrs[v * aw + 7] = uv[v * 2 + 1]; } }
    const weights = new Array(aw).fill(0).map((_, k) => (k < 3 ? 0.5 : k < 6 ? 0 : 1.5));
    res = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx), new Float32Array(pos), 3, attrs, aw, weights, null, want, 0.08, [])[0];
  }
  const used = new Map(), newIdx = new Uint32Array(res.length);
  let nv = 0; for (let i = 0; i < res.length; i++) { let m = used.get(res[i]); if (m === undefined) { m = nv++; used.set(res[i], m); } newIdx[i] = m; }
  const attrs = {};
  for (const sem of names) {
    const acc = p.getAttribute(sem), arr = acc.getArray(), es = acc.getElementSize(), a = new arr.constructor(nv * es);
    for (const [old, nw] of used) for (let k = 0; k < es; k++) a[nw * es + k] = arr[old * es + k];
    attrs[sem] = { array: a, type: acc.getType(), normalized: acc.getNormalized() };
  }
  return { indices: newIdx, attrs };
}

const tri = (list) => list.reduce((s, r) => s + r.indices.length / 3, 0);
const total = prims.reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
const levels = [];
let source = prims.map((p) => ({ prim: p, indices: new Uint32Array(p.getIndices().getArray()), attrs: Object.fromEntries(p.listSemantics().map((s) => [s, { array: p.getAttribute(s).getArray(), type: p.getAttribute(s).getType(), normalized: p.getAttribute(s).getNormalized() }])) }));
// per-primitive share of the budget
function build(target, sloppy, from) {
  const cur = from.reduce((s, r) => s + r.indices.length / 3, 0);
  return from.map((r, i) => {
    const share = Math.max(30, Math.round(target * (r.indices.length / 3) / cur));
    const fake = { getIndices: () => ({ getArray: () => r.indices }), getAttribute: (s) => r.attrs[s] ? { getArray: () => r.attrs[s].array, getElementSize: () => ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[r.attrs[s].type]), getType: () => r.attrs[s].type, getNormalized: () => r.attrs[s].normalized } : undefined, listSemantics: () => Object.keys(r.attrs) };
    const res = r.indices.length / 3 <= share ? { indices: r.indices, attrs: r.attrs } : reduce(fake, share * 3, sloppy);
    return { prim: r.prim, indices: res.indices, attrs: res.attrs };
  });
}
// careful (topology- and attribute-preserving) reduction for the near levels; the blunt one only for the farthest
let l0 = build(T[0], false, source);
if (tri(l0) > T[0] * 2.2) l0 = build(T[0] * 1.6, true, l0);
let l1 = build(T[1], false, l0);
if (tri(l1) > T[1] * 2.2) l1 = build(T[1] * 1.4, true, l1);
const l2 = build(T[2], true, l1);
console.log(out, 'LOD tris', tri(l0), tri(l1), tri(l2), 'scale', scale.toFixed(4), 'size', size.map((v) => (v * scale).toFixed(2)).join(' x '));

// replace meshes with LOD0/1/2 nodes
const origMeshes = root.listMeshes(), origNodes = root.listNodes();
const make = (name, lvl) => {
  const mesh = doc.createMesh(name);
  for (const r of lvl) {
    const prim = doc.createPrimitive().setMaterial(r.prim.getMaterial());
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(r.indices));
    for (const [sem, a] of Object.entries(r.attrs)) prim.setAttribute(sem, doc.createAccessor().setType(a.type).setArray(a.array).setNormalized(a.normalized));
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh);
  scene.addChild(node);
};
make('LOD0', l0); make('LOD1', l1); make('LOD2', l2);
for (const n of origNodes) if (!['LOD0', 'LOD1', 'LOD2'].includes(n.getName())) { scene.removeChild(n); n.dispose(); }
for (const m of origMeshes) m.dispose();
await doc.transform(prune());
await io.write(out, doc);
