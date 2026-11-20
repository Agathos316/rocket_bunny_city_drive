# Vendored three.js

three.js **r128** (MIT licence, see `LICENSE`), copied unmodified from the `three@0.128.0` npm package:

- `build/three.module.js`
- `examples/jsm/utils/BufferGeometryUtils.js` (it imports the bare specifier `'three'`, which the import map in `index.html` and the Node test hook in `tests/` both resolve to `build/three.module.js`)

The game is vendored rather than loaded from a CDN so it works offline and cannot break if a CDN changes.
To upgrade three.js, replace these two files with the same files from a newer release and re-run `npm test`.
The `mergeBufferGeometries` API used by `src/util/batcher.js` was renamed `mergeGeometries` in r151.
