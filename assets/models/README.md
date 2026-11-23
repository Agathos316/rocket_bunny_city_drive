# Car models

| File | Model | Source | Notes |
| --- | --- | --- | --- |
| `ferrari.glb` | Ferrari 458 Italia (Spider) | the three.js examples (`examples/models/gltf/ferrari.glb`, three.js r128), credited there to [vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6) on Sketchfab | Draco-compressed, with a modelled cockpit and a separate steering wheel. **Check the licence on the Sketchfab page before shipping this commercially**; the model is a Ferrari-trademarked design. |

The game loads these before it starts (`src/vehicles/carLibrary.js`); there are no built-in cars to fall back on, so a missing file shows the start-up error message. The Draco decoder it needs is in `vendor/three/examples/jsm/libs/draco/gltf/`.

## Toyota Camry (`camry.glb`): traffic and parked cars

"Toyota Camry 2020" by [ItsDiyor](https://sketchfab.com/ItsDiyor) on Sketchfab
([source](https://sketchfab.com/3d-models/toyota-camry-2020-236a5a6e2fa6420fbdf641f4800cd544)),
licensed **CC BY 4.0** (http://creativecommons.org/licenses/by/4.0/). **Changes made:** the mesh was reduced (about
177k to 21k triangles; `gltf-transform` weld and simplify) and the textures were resized to 512 px, to make it light
enough for a game. The car's paint is recoloured in code. The number plate in the texture still carries the author's name.
The copy was found in a public GitHub repository that vendors it; its Sketchfab licence is recorded in the original
file's metadata. The Camry is a Toyota-trademarked design.

## Kenney Car Kit (`kenney/`)

`sedan-sports`, `hatchback-sports`, `race` and `race-future` (the cars you can drive), plus the shared
`Textures/colormap.png`, are from the **Kenney Car Kit** by [Kenney](https://kenney.nl), released under **CC0**
(public domain). The copies here came from public GitHub repositories that vendor the kit, since kenney.nl itself was
not reachable from the build environment.
