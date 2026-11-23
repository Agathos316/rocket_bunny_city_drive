# Car models

| File | Model | Source | Notes |
| --- | --- | --- | --- |
| `ferrari.glb` | Ferrari 458 Italia (Spider) | the three.js examples (`examples/models/gltf/ferrari.glb`, three.js r128), credited there to [vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6) on Sketchfab | Draco-compressed, with a modelled cockpit and a separate steering wheel. **Check the licence on the Sketchfab page before shipping this commercially**; the model is a Ferrari-trademarked design. |

The game loads these before it starts (`src/vehicles/carLibrary.js`); there are no built-in cars to fall back on, so a missing file shows the start-up error message. The Draco decoder it needs is in `vendor/three/examples/jsm/libs/draco/gltf/`.

## Kenney Car Kit (`kenney/`)

`sedan`, `suv`, `suv-luxury`, `taxi`, `van`, `delivery`, `police` (traffic and parked cars) and `sedan-sports`, `hatchback-sports`, `race`, `race-future` (cars you can drive), plus the shared `Textures/colormap.png`, are from
the **Kenney Car Kit** by [Kenney](https://kenney.nl), released under **CC0** (public domain). They are generic,
unbranded, ordinary modern-style cars. The copies here came from public GitHub repositories that vendor the kit,
since kenney.nl itself was not reachable from the build environment. 
