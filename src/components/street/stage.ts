// What the background sounds need to know about the boat trip, written by the 3D scene every frame and read by
// the sound (src/components/ambience.ts). No three.js in here, so the sound doesn't pull in the 3D code.

export type Mover = { x: number; z: number; sound: 'engine' | 'paddle' };

export const stage = {
  /** Where you are: x along the river, y up, z across it (the Graslei side is low z, the Korenlei high). */
  cam: { x: 0, y: 2.5, z: 0 },
  intro: 0, // 0 = high over the river, 1 = in the boat
  outro: 0, // 0 = in the boat, 1 = up on the bridge
  night: 0, // 0 = afternoon, 1 = dark
  /** The boats that are on the move. The scene moves these same objects, so x is always current. */
  movers: [] as Mover[],
};
