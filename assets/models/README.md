# Car models

| File | Model | Source | Notes |
| --- | --- | --- | --- |
| `ferrari.glb` | Ferrari 458 Italia (Spider) | the three.js examples (`examples/models/gltf/ferrari.glb`, three.js r128), credited there to [vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6) on Sketchfab | Draco-compressed, with a modelled cockpit and a separate steering wheel. **Check the licence on the Sketchfab page before shipping this commercially**; the model is a Ferrari-trademarked design. |

The game loads these in the background (`src/vehicles/gltfCar.js`). If a file cannot be loaded, the built-in procedural
cars are used. The Draco decoder it needs is in `vendor/three/examples/jsm/libs/draco/gltf/`.
