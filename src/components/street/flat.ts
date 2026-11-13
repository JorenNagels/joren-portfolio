import type * as THREE from 'three';
import type { Poster } from './houses';

// Geometry as plain arrays, which can be passed between threads without copying. Shared by world.ts and the worker
// that builds the town (kept apart from world.ts, which starts that worker).

export type Flat = { attributes: Record<string, { array: Float32Array; itemSize: number }>; index: Uint32Array | Uint16Array | null };
export type FlatWorld = { street: { geometry: Flat; posters: Poster[] }; towers: Flat; background: Flat };

export function flatten(g: THREE.BufferGeometry): Flat {
  const attributes: Flat['attributes'] = {};
  for (const [k, a] of Object.entries(g.attributes)) attributes[k] = { array: a.array as Float32Array, itemSize: a.itemSize };
  return { attributes, index: (g.index?.array as Uint32Array | Uint16Array | undefined) ?? null };
}

export function buffers(f: Flat): ArrayBuffer[] {
  const out = Object.values(f.attributes).map((a) => a.array.buffer as ArrayBuffer);
  if (f.index) out.push(f.index.buffer as ArrayBuffer);
  return out;
}
