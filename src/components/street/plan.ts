// The street's plan: the houses on both quays, the river's measures and where the posters hang.
// No three.js in here, so the page can read it without loading the 3D code.

export const palette = {
  cream: '#efe8d6',
  white: '#f4f3ea',
  sand: '#e3cfa4',
  ochre: '#dcae62',
  terracotta: '#c45a3d',
  brick: '#a8553f',
  sage: '#a9b8a3',
  slate: '#7f8c94',
  stone: '#cfc7b4',
  roof: '#4f5a63',
  roofWarm: '#8a4a3a',
  wood: '#5a3b2e',
  glass: '#33505a',
  frame: '#f6f4ec',
  iron: '#2f3236',
  shutterGreen: '#3f7f5f',
  shutterBlue: '#4f7f9f',
  awning: '#e9e1cc',
  gold: '#d8a74a',
};
export type Col = keyof typeof palette;

export type Gable = 'stepped' | 'pointed' | 'cornice';
export type HouseSpec = { id?: string; w: number; floors: number; gable: Gable; wall: Col; roof?: Col; shutters?: Col; awning?: Col; steps?: number };

/** The Graslei, on your left as the boat goes downstream. Houses with an id carry a poster. */
export const GRASLEI: HouseSpec[] = [
  { w: 5, floors: 2, gable: 'pointed', wall: 'sage', roof: 'roofWarm' },
  { id: 'about', w: 8.4, floors: 3, gable: 'stepped', wall: 'cream', shutters: 'shutterGreen', steps: 5 },
  { w: 5.2, floors: 3, gable: 'pointed', wall: 'terracotta' },
  { w: 6, floors: 2, gable: 'cornice', wall: 'stone' },
  { id: 'realo', w: 8, floors: 3, gable: 'stepped', wall: 'sand', steps: 6 },
  { w: 4.4, floors: 2, gable: 'pointed', wall: 'white', roof: 'roofWarm', shutters: 'shutterBlue' },
  { w: 7, floors: 3, gable: 'stepped', wall: 'brick', steps: 5 },
  { id: 'beatcut', w: 7.4, floors: 3, gable: 'pointed', wall: 'cream', shutters: 'shutterBlue' },
  { w: 5, floors: 2, gable: 'cornice', wall: 'stone' },
  { w: 6, floors: 3, gable: 'pointed', wall: 'terracotta' },
  { id: 'flowsha', w: 7.6, floors: 3, gable: 'pointed', wall: 'sage', roof: 'roofWarm' },
  { w: 5.4, floors: 3, gable: 'stepped', wall: 'ochre', steps: 4 },
  { w: 6, floors: 2, gable: 'cornice', wall: 'slate' },
  { id: 'small', w: 7.2, floors: 3, gable: 'cornice', wall: 'cream', shutters: 'shutterGreen', awning: 'awning' },
  { w: 6, floors: 3, gable: 'stepped', wall: 'brick', steps: 5 },
  { w: 5, floors: 2, gable: 'pointed', wall: 'white', roof: 'roof' },
];

/** The Korenlei, on your right, listed in the direction of travel. */
export const KORENLEI: HouseSpec[] = [
  { w: 7, floors: 3, gable: 'stepped', wall: 'ochre', steps: 5 },
  { w: 7.4, floors: 2, gable: 'pointed', wall: 'white', shutters: 'shutterGreen' },
  { id: 'immoweb', w: 9.2, floors: 4, gable: 'cornice', wall: 'slate', awning: 'awning' },
  { w: 5, floors: 3, gable: 'pointed', wall: 'sage', roof: 'roofWarm' },
  { w: 5.6, floors: 2, gable: 'stepped', wall: 'cream', steps: 4 },
  { id: 'guestnote', w: 8, floors: 3, gable: 'stepped', wall: 'terracotta', steps: 5 },
  { w: 5.2, floors: 3, gable: 'cornice', wall: 'stone' },
  { w: 5.3, floors: 2, gable: 'pointed', wall: 'sand', roof: 'roofWarm' },
  { id: 'se-parti', w: 8.6, floors: 4, gable: 'stepped', wall: 'ochre', steps: 6, awning: 'terracotta' },
  { w: 4.6, floors: 2, gable: 'pointed', wall: 'white', roof: 'roofWarm' },
  { w: 6, floors: 3, gable: 'stepped', wall: 'sand', steps: 5 },
  { id: 'dream-team', w: 8.4, floors: 3, gable: 'stepped', wall: 'brick', steps: 5 },
  { w: 5.4, floors: 2, gable: 'cornice', wall: 'sage' },
  { w: 5, floors: 3, gable: 'pointed', wall: 'terracotta', shutters: 'shutterBlue' },
  { id: 'contact', w: 9.4, floors: 4, gable: 'stepped', wall: 'terracotta', steps: 6 },
  { w: 6, floors: 2, gable: 'pointed', wall: 'cream' },
];

export const GROUND = 3.9; // ground floor height
export const FLOOR = 3.1;
export const DEPTH = 12;
export const QUAY = 7.6; // quay width in front of the facades
export const RIVER = 22; // water between the two quays
export const WATER = -1.5; // water level (street is 0)
export const FAR = 2 * QUAY + RIVER; // z of the Korenlei facades
export const MIDSTREAM = QUAY + RIVER / 2; // where the boat goes
export const rowLength = (row: HouseSpec[]) => row.reduce((a, h) => a + h.w, 0);
const LEN = Math.max(rowLength(GRASLEI), rowLength(KORENLEI));
export const BRIDGE = LEN + 7; // x of the Sint-Michielsbrug

/** Every poster: centre x along the river, and which bank (+1 faces the boat from the left, -1 from the right). */
export const STOPS: { id: string; x: number; side: 1 | -1 }[] = (() => {
  const out: { id: string; x: number; side: 1 | -1 }[] = [];
  let x = 0;
  for (const h of GRASLEI) {
    if (h.id) out.push({ id: h.id, x: x + h.w / 2, side: 1 });
    x += h.w;
  }
  x = 0;
  for (const h of KORENLEI) {
    if (h.id) out.push({ id: h.id, x: x + h.w / 2, side: -1 });
    x += h.w;
  }
  return out.sort((a, b) => a.x - b.x);
})();
