# Car models

Every vehicle in the game is one of these glTF files (nothing is built in code). They are loaded before the game
starts by `src/vehicles/carLibrary.js`; the list is `CAR.library.cars` in `src/config.js`.

Models marked "pipeline" were prepared with `tools/car-pipeline` (mesh reduced into three detail levels, textures
resized to 512 px, nose pointed along +z, scaled to the car's real length, Draco-compressed). Those changes are
modifications of the originals.

| File | Car | Source and licence |
| --- | --- | --- |
| `ferrari.glb` | Ferrari 458 Italia (Spider), modelled cockpit | From the three.js examples, credited there to [vicent091036](https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6) on Sketchfab. **Licence not checked**; look at the Sketchfab page before a public release. |
| `cars/camry.glb` | Toyota Camry 2020 (pipeline) | [ItsDiyor](https://sketchfab.com/ItsDiyor), [source](https://sketchfab.com/3d-models/toyota-camry-2020-236a5a6e2fa6420fbdf641f4800cd544), **CC BY 4.0** (stated in the file's metadata). The number plate texture carries the author's name. |
| `cars/mustang.glb` | Ford Mustang Fastback 1965 (textures resized to 1024 px only; skinned, not pipelined) | [Godspeed](https://sketchfab.com/godspeedx14), [source](https://sketchfab.com/3d-models/rigged-car-mustang-1965-with-engine-3d-model-c2d4f0a6170d43f4a5a8303373ebb81a), **CC BY 4.0** (stated in the file's metadata). |
| `cars/tesla.glb` | Tesla Model S, Prior widebody kit (pipeline) | Found in the public GitHub repository `RoeeSivan/theblock-unity` (`Assets/Models/Vehicles/Lot/tesla.glb`). **The file states no author or licence: unverified.** |
| `cars/audi.glb` | Audi RS6 Avant (pipeline) | Same repository (`.../Lot/audi.glb`). **No author or licence stated: unverified.** |
| `cars/bmw.glb` | BMW M4 2024 (pipeline) | Public repository `senol41tr/Customizer3D` (`examples/models/BMW/BMW.glb`). **No author or licence stated: unverified.** |
| `cars/golf.glb` | Volkswagen Golf (pipeline; the source was 2.6M triangles and some small parts, such as the tail lights, suffered in the reduction) | Public repository `dong123123123/model` (`vw_golf.glb`). **No author or licence stated: unverified.** |
| `cars/nissan.glb` | Nissan GT-R R35 with a Liberty Walk kit (pipeline) | Public repository `dvrch/Svelte-threlte-Onglet-multiprojets` (`static/models/nissan.glb`). **No author or licence stated: unverified.** |

**Before releasing this game publicly:** the four "unverified" cars (and the Ferrari) must have their licences
confirmed, or be replaced. The files were found in other people's repositories, and the manufacturers' names and
designs are also trademarks. Removing a car is just deleting its entry in `CAR.library.cars`, its option in
`index.html`, and its file.

Also found but **not used**: a Toyota Corolla by [Blender Boy](https://sketchfab.com/Blender_Boy1) (CC BY-SA 4.0:
share-alike, and the file came out with its parts scattered when processed) and a Honda file that is a dealership
building.
