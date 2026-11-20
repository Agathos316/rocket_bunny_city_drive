/**
 * A petrol station: forecourt, canopy over pump islands, shop and a tall price sign.
 * `batch` is a Batcher; (cx, cz) is the block centre in grid coordinates.
 */
import { getAssets } from '../assets.js';
import { getGeoms } from './geometries.js';

export function buildStation(batch, cx, cz) {
  const { mats } = getAssets();
  const G = getGeoms();
  const put = batch.put.bind(batch);

  put(G.footpath, mats.forecourt, cx, 0.3, cz, 0.97, 0.1, 0.97);
  put(G.box, mats.canopy, cx, 7, cz - 4, 30, 0.9, 16);
  put(G.box, mats.pump, cx, 6.5, cz - 4, 30.4, 0.3, 16.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(G.box, mats.pump, cx + sx * 13, 3.4, cz - 4 + sz * 6, 0.9, 6.4, 0.9);   // canopy posts
  for (const sz of [-1, 1]) {
    put(G.box, mats.pump, cx, 0.45, cz - 4 + sz * 3.2, 22, 0.3, 1.6);                                                            // pump islands
    for (const sx of [-1, 1]) put(G.box, mats.canopy, cx + sx * 6, 1.6, cz - 4 + sz * 3.2, 1, 2.4, 0.9);                          // pumps
  }
  put(G.box, mats.buildings[4], cx, 3.2, cz + 27, 28, 6, 10);                                                                     // shop
  put(G.box, mats.roof, cx, 6.3, cz + 27, 29, 0.5, 11);
  put(G.box, mats.pump, cx + 31, 8, cz - 30, 0.7, 16, 0.7);                                                                       // price sign
  put(G.box, mats.priceSign, cx + 31, 15, cz - 30, 4.5, 4.5, 0.6);
  put(G.box, mats.canopy, cx + 31, 12, cz - 30, 4.5, 1.4, 0.7);
}
