# Car model pipeline

Offline scripts used to turn big car models into game-ready files. **They are not part of the game and are not
needed to run it**; the results are in `assets/models/cars/`. They need Node and these packages installed somewhere
(they are not project dependencies): `@gltf-transform/core @gltf-transform/extensions @gltf-transform/functions
@gltf-transform/cli meshoptimizer draco3dgltf sharp`.

```
node prep.mjs      in.glb stage1.glb [textureSize]   # decode Draco, flatten and join meshes, drop unsupported extensions, shrink textures
node lods.mjs      stage1.glb out.glb length rotateYdeg lod0Tris lod1Tris lod2Tris
                                                     # centre, ground, rotate the nose to +z, scale to `length` metres, build LOD0..LOD2
node lods_t.mjs    ...same arguments...              # stricter reduction (locks mesh borders); used for the Tesla, whose textures tore otherwise
node draco.mjs     out.glb final.glb                 # Draco-compress the geometry
node texonly.mjs   in.glb out.glb 1024               # just resize textures (the skinned Mustang)
```

Settings used: LOD0 about 20-50k triangles, LOD1 about 7-12k, LOD2 about 2k (the farthest level uses a blunt
reduction, which is noisy up close but invisible at distance). The Tesla needed `lods_t.mjs` and a 180 degree turn.
The Camry, Audi, BMW and Golf were 4.7 m long, the Nissan 4.7 m; see `assets/models/README.md` for sources.
