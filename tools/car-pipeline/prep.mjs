// stage 1: decode, flatten the scene graph, join meshes per material, drop unsupported extensions, shrink textures
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, prune, dedup, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
const [,, inp, out, tex] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(inp);
const keep = new Set(['KHR_materials_clearcoat', 'KHR_texture_transform']);
await doc.transform(flatten(), join(), dedup(), prune());
for (const ext of doc.getRoot().listExtensionsUsed()) if (!keep.has(ext.extensionName)) ext.dispose();
await doc.transform(textureCompress({ encoder: sharp, resize: [Number(tex || 512), Number(tex || 512)] }), prune());
await io.write(out, doc);
let t = 0, m = 0; for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { t += (p.getIndices()?.getCount() ?? 0) / 3; m++; }
console.log(out, 'prims', m, 'tris', t, 'mats', doc.getRoot().listMaterials().length, 'textures', doc.getRoot().listTextures().length);
