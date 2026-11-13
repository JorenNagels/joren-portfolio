// Builds the town off the main thread; see world.ts.
import { buildBackground, buildStreet, buildTowers } from './houses';
import { buffers, flatten, type FlatWorld } from './flat';

const s = buildStreet();
const w: FlatWorld = {
  street: { geometry: flatten(s.geometry), posters: s.posters },
  towers: flatten(buildTowers()),
  background: flatten(buildBackground()),
};
postMessage(w, { transfer: [...new Set([...buffers(w.street.geometry), ...buffers(w.towers), ...buffers(w.background)])] });
