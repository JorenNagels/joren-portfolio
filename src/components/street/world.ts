import * as THREE from 'three';
import type { Flat, FlatWorld } from './flat';
import type { Poster } from './houses';

/**
 * The town: the two quays, the big buildings down the river and the back streets. Building it is the slowest part
 * of opening the page (a phone stood still for a second or two), so it is built off to the side, in a worker, and
 * handed over as plain arrays. Same seeds, same town, to the vertex.
 */
export type World = { street: { geometry: THREE.BufferGeometry; posters: Poster[] }; towers: THREE.BufferGeometry; background: THREE.BufferGeometry };

function unflatten(f: Flat) {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(f.attributes)) g.setAttribute(k, new THREE.BufferAttribute(a.array, a.itemSize));
  if (f.index) g.setIndex(new THREE.BufferAttribute(f.index, 1));
  g.computeBoundingSphere();
  return g;
}

const fromFlat = (w: FlatWorld): World => ({
  street: { geometry: unflatten(w.street.geometry), posters: w.street.posters },
  towers: unflatten(w.towers),
  background: unflatten(w.background),
});

/** Builds it here instead, if a worker cannot be started. */
async function here(): Promise<World> {
  const { buildStreet, buildTowers, buildBackground } = await import('./houses');
  const s = buildStreet();
  return { street: { geometry: s.geometry, posters: s.posters }, towers: buildTowers(), background: buildBackground() };
}

let made: Promise<World> | null = null;
/** Starts building on the first call; every call gets the same town. */
export function world(): Promise<World> {
  made ??= new Promise<World>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      here().then(resolve);
      return;
    }
    worker.onmessage = (e: MessageEvent<FlatWorld>) => {
      resolve(fromFlat(e.data));
      worker.terminate();
    };
    worker.onerror = () => {
      worker.terminate();
      here().then(resolve);
    };
  });
  return made;
}
