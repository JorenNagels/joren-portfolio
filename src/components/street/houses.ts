import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { BRIDGE, type Col, DEPTH, FAR, FLOOR, type Gable, GRASLEI, GROUND, type HouseSpec, KORENLEI, MIDSTREAM, palette, QUAY, RIVER, rowLength, WATER } from './plan';

// The Leie between the Graslei and the Korenlei, as hand-built toy houses, ending at the Sint-Michielsbrug.
// Everything static is merged into one mesh with vertex colours (one draw call); posters are separate
// meshes so they can carry a texture and be clicked. The plan of the street itself is in plan.ts.

export { BRIDGE, FAR, FLOOR, GROUND, MIDSTREAM, palette, QUAY, RIVER, STOPS, WATER } from './plan';

/** A poster in world space; it faces +z (Graslei) or -z (Korenlei). */
export type Poster = { id: string; x: number; y: number; z: number; nz: 1 | -1; w: number; h: number };
export type Built = { geometry: THREE.BufferGeometry; posters: Poster[]; span: [number, number] };

// Small deterministic random, so the street looks the same on every visit.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Surface detail drawn by the shader: 0 none, 1 plaster/stone, 2 brick, 3 roof tiles, 4 wood, 5 foliage, 6 ground.
export const MAT = { none: 0, plaster: 1, brick: 2, roof: 3, wood: 4, leaves: 5, ground: 6, stone: 7 } as const;
const MAT_OF: Record<string, number> = {
  cream: 1, white: 1, sand: 1, ochre: 1, sage: 1, slate: 1, stone: 1,
  brick: 2, terracotta: 2, roof: 3, roofWarm: 3, wood: 4,
  '#4f9a63': 5, '#3f8656': 5, '#5aa86b': 5, '#6aa870': 5, '#ddd5c1': 7, '#c4bba6': 7, '#d9cfbb': 7, '#86b77a': 6, '#7fae78': 5, '#6f9f70': 5, '#8fbb82': 5,
};

const tmpColor = new THREE.Color();
export function paint(g0: THREE.BufferGeometry, col: string, glow = 0, cls?: number) {
  const g = g0.index ? g0.toNonIndexed() : g0;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  tmpColor.set(col in palette ? palette[col as Col] : col);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
  g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n).fill(cls ?? MAT_OF[col] ?? 0), 1));
  return g;
}

/** Collects painted pieces of geometry. */
function kit(parts: THREE.BufferGeometry[], rand: () => number) {
  const add = (g: THREE.BufferGeometry, col: string, glow = 0, cls?: number) => parts.push(paint(g, col, glow, cls));
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, col: string, glow = 0, rz = 0, rx = 0, cls?: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    add(g, col, glow, cls);
  };
  // A shape drawn in the facade plane (x, y), extruded backwards from z0 by `depth`.
  const prism = (pts: [number, number][], depth: number, z0: number, col: string, cls?: number, glow = 0) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, z0 - depth);
    add(g, col, glow, cls);
  };
  const shade = (col: string, k: number) => '#' + new THREE.Color(palette[col as Col] ?? col).multiplyScalar(k).getHexString();
  const window_ = (cx: number, cy: number, w: number, h: number, shutters?: string) => {
    const tilt = (rand() - 0.5) * 0.02; // nothing is perfectly straight
    box(w, h, 0.06, cx, cy, 0.03, 'glass', 0.02 + rand() * 0.98);
    const t = 0.13;
    box(w + 2 * t, t, 0.16, cx, cy + h / 2 + t / 2, 0.08, 'frame', 0, tilt);
    box(w + 2 * t, t, 0.16, cx, cy - h / 2 - t / 2, 0.08, 'frame', 0, tilt);
    box(t, h, 0.16, cx - w / 2 - t / 2, cy, 0.08, 'frame');
    box(t, h, 0.16, cx + w / 2 + t / 2, cy, 0.08, 'frame');
    box(0.07, h, 0.1, cx, cy, 0.07, 'frame');
    box(w, 0.07, 0.1, cx, cy + h * 0.2, 0.07, 'frame');
    box(w + 0.5, 0.12, 0.32, cx, cy - h / 2 - 0.2, 0.16, 'stone');
    if (shutters) {
      box(w * 0.52, h + 0.1, 0.08, cx - w * 0.78, cy, 0.06, shutters);
      box(w * 0.52, h + 0.1, 0.08, cx + w * 0.78, cy, 0.06, shutters);
    }
  };
  // The same window in two boxes, for houses that are only ever seen from far off.
  const pane = (cx: number, cy: number, w: number, h: number) => {
    box(w + 0.28, h + 0.28, 0.1, cx, cy, 0.05, 'frame');
    box(w, h, 0.08, cx, cy, 0.1, 'glass', 0.02 + rand() * 0.98);
  };
  return { add, box, prism, shade, window_, pane };
}

/**
 * How a row is built. `lite` 0 is the full house, 1 keeps the shapes but draws lighter windows, 2 is walls, gable,
 * roof and chimney only. `end` names the end of the row that stands free, so it gets a proper side wall.
 */
type RowOpts = { quay?: [number, number]; depth?: number; lite?: 0 | 1 | 2; end?: 'start' | 'end' };

/** One row of houses in local space: facades at z = 0 facing +z, starting at x = 0, quay in front. */
function buildRow(specs: HouseSpec[], seed: number, opts: RowOpts = {}) {
  const { quay, depth: D = DEPTH, lite = 0, end } = opts;
  const parts: THREE.BufferGeometry[] = [];
  const rand = rng(seed);
  const { add, box, prism, shade, window_, pane } = kit(parts, rand);
  const win = lite === 0 ? window_ : lite === 1 ? pane : () => {};
  const leans: number[] = [];
  const posters: { id: string; x: number; y: number; w: number; h: number; dz: number }[] = [];
  let x0 = 0;

  for (const [index, h] of specs.entries()) {
    const first = parts.length;
    const W = h.w;
    const x = x0 + W / 2;
    const H = GROUND + h.floors * FLOOR;
    const wall = h.wall;

    const body = new THREE.BoxGeometry(W, H, D);
    body.translate(0, H / 2, -D / 2);
    const lean = (rand() - 0.5) * 0.015;
    leans.push(lean);
    body.rotateZ(lean);
    body.translate(x, 0, 0);
    add(body, wall);
    if (lite < 2) box(W - 0.02, 0.55, 0.16, x, 0.27, 0.06, shade(wall, 0.8));
    for (let k = lite ? h.floors : 0; k <= h.floors && lite < 2; k++) box(W - 0.02, 0.16, 0.2, x, GROUND + k * FLOOR - 0.08, 0.08, k === h.floors ? 'stone' : shade(wall, 0.9));

    // Poster over the first and second floor, with two little lamps
    let poster: (typeof posters)[number] | null = null;
    if (h.id) {
      const pw = Math.min(W * 0.74, 6.4);
      const ph = pw / 1.6;
      poster = { id: h.id, x, y: GROUND + 0.45 + ph / 2, w: pw, h: ph, dz: index % 2 ? 0.04 : 0 };
      posters.push(poster);
      box(pw + 0.34, ph + 0.34, 0.2, x, poster.y, 0.2, 'iron');
      for (const k of [-1, 1]) {
        box(0.08, 0.08, 0.7, x + (k * pw) / 3, poster.y + ph / 2 + 0.45, 0.35, 'iron');
        box(0.36, 0.18, 0.26, x + (k * pw) / 3, poster.y + ph / 2 + 0.35, 0.7, 'iron', 2);
      }
    }

    // Upper windows
    const cols = Math.max(1, Math.round((W - 1.2) / 2.3));
    const step = W / cols;
    for (let f = 0; f < h.floors; f++) {
      for (let i = 0; i < cols; i++) {
        const cx = x - W / 2 + step * (i + 0.5);
        const cy = GROUND + f * FLOOR + 1.5;
        if (poster && Math.abs(cx - x) < poster.w / 2 + 0.7 && Math.abs(cy - poster.y) < poster.h / 2 + 1) continue;
        win(cx, cy, Math.min(1.05, step * 0.45), 1.75, h.shutters);
      }
    }

    // Ground floor: a door and a shop window, sometimes an awning
    const doorX = x + W / 2 - 1.3;
    if (lite < 2) box(1.25, 2.55, 0.1, doorX, 1.28, 0.03, 'wood');
    if (!lite) {
      box(1.55, 0.18, 0.2, doorX, 2.65, 0.08, 'stone');
      box(0.1, 0.1, 0.1, doorX + 0.4, 1.3, 0.12, 'gold');
    }
    const shopW = Math.max(1.4, W - 3.6);
    const shopX = x - W / 2 + 0.6 + shopW / 2;
    win(shopX, 1.85, shopW, 2.2);
    if (h.awning) {
      box(shopW + 0.6, 0.08, 1.5, shopX, 3.35, 0.72, h.awning, 0, 0, 0.38);
      for (let k = 0; k < 5; k++) box((shopW + 0.6) / 10, 0.1, 1.52, shopX - (shopW + 0.6) / 2 + ((k * 2 + 0.5) * (shopW + 0.6)) / 10, 3.37, 0.73, h.awning === 'terracotta' ? 'cream' : 'terracotta', 0, 0, 0.38);
    }

    // Hanging shop sign on an iron bracket
    if (h.id) {
      const sx = x - W / 2 + 0.55;
      box(0.08, 0.08, 1.5, sx, GROUND - 0.25, 0.75, 'iron');
      box(0.07, 0.95, 1.15, sx, GROUND - 0.85, 0.95, 'gold');
      box(0.09, 0.75, 0.95, sx, GROUND - 0.85, 0.95, wall === 'terracotta' || wall === 'brick' ? 'cream' : 'terracotta');
    }

    // Gable and roof
    const roof = h.roof ?? 'roof';
    if (h.gable === 'stepped') {
      const n = h.steps ?? 5;
      const G = W * 0.62;
      const sh = G / n;
      for (let k = 0; k < n; k++) {
        const sw = W * (1 - k / n);
        box(sw, sh, 0.6, x, H + sh * (k + 0.5), -0.3, wall);
        if (lite < 2) for (const s of [-1, 1]) box(0.42, 0.14, 0.72, x + (s * (sw - 0.2)) / 2, H + sh * (k + 1) + 0.07, -0.28, 'stone');
      }
      box(0.42, 1.1, 0.42, x, H + G + 0.55, -0.3, 'stone');
      prism([[x - W / 2 + 0.25, H], [x + W / 2 - 0.25, H], [x, H + G * 0.9]], D - 0.6, -0.6, roof, MAT.roof);
      win(x, H + G * 0.3, 0.8, 1.2);
    } else if (h.gable === 'pointed') {
      const G = W * 0.7;
      prism([[x - W / 2, H], [x + W / 2, H], [x, H + G]], 0.5, 0, wall);
      const slope = Math.atan2(G, W / 2);
      const len = Math.hypot(G, W / 2);
      box(len + 0.3, 0.22, 0.62, x - W / 4, H + G / 2 + 0.08, -0.22, 'frame', 0, slope);
      box(len + 0.3, 0.22, 0.62, x + W / 4, H + G / 2 + 0.08, -0.22, 'frame', 0, -slope);
      prism([[x - W / 2 + 0.1, H], [x + W / 2 - 0.1, H], [x, H + G * 0.97]], D - 0.5, -0.5, roof, MAT.roof);
      win(x, H + G * 0.32, 0.75, 1.15);
    } else {
      box(W + 0.5, 0.55, 0.9, x, H + 0.27, 0.1, 'stone');
      box(W + 0.7, 0.18, 1.1, x, H + 0.6, 0.15, shade('stone', 0.85));
      prism([[x - W / 2, H + 0.5], [x + W / 2, H + 0.5], [x, H + 0.5 + W * 0.42]], D - 1.2, -1.2, roof, MAT.roof);
      box(1.7, 1.6, 1.4, x, H + 1.55, -1.7, wall);
      prism([[x - 1.05, H + 2.3], [x + 1.05, H + 2.3], [x, H + 3.2]], 1.6, -1.0, roof, MAT.roof);
      win(x, H + 1.5, 0.75, 1.0);
    }

    // Chimney: a brick stack through the roof, a stone cap, two pots
    {
      const rise = h.gable === 'stepped' ? W * 0.62 * 0.9 : h.gable === 'pointed' ? W * 0.7 * 0.97 : W * 0.42;
      const base = h.gable === 'cornice' ? H + 0.5 : H;
      const cx = x + (rand() < 0.5 ? -1 : 1) * W * 0.24;
      const cz = -D * (0.32 + rand() * 0.45);
      const top = base + rise * 0.52 + 1.4;
      box(0.95, top - base, 0.8, cx, (top + base) / 2, cz, wall === 'brick' ? 'terracotta' : 'brick');
      box(1.15, 0.16, 1.0, cx, top + 0.08, cz, 'stone');
      if (lite < 2) for (const k of [-0.22, 0.22]) box(0.26, 0.42, 0.26, cx + k, top + 0.37, cz, 'terracotta', 0, 0, 0, MAT.none);
    }
    if (index % 2) for (let i = first; i < parts.length; i++) parts[i].translate(0, 0, 0.04);
    x0 += W;
  }

  // The end of the row that stands free is a wall like any other: windows, bands, a drainpipe.
  if (end && lite < 2) {
    const i = end === 'start' ? 0 : specs.length - 1;
    const h = specs[i];
    const H = GROUND + h.floors * FLOOR;
    const sub: THREE.BufferGeometry[] = [];
    const k = kit(sub, rand);
    const n = Math.max(2, Math.round(D / 3.3));
    k.box(D - 0.02, 0.55, 0.16, D / 2, 0.27, 0.06, shade(h.wall, 0.8));
    k.box(D - 0.02, 0.16, 0.2, D / 2, H - 0.08, 0.08, 'stone');
    if (!lite) for (let f = 1; f < h.floors; f++) k.box(D - 0.02, 0.16, 0.2, D / 2, GROUND + f * FLOOR - 0.08, 0.08, shade(h.wall, 0.9));
    for (let f = -1; f < h.floors; f++)
      for (let c = 0; c < n; c++) {
        if (rand() < 0.18) continue; // a blind bay here and there
        const cx = (D * (c + 0.5)) / n;
        if (f < 0) (lite ? k.pane : k.window_)(cx, 2.0, 0.95, 1.6);
        else (lite ? k.pane : k.window_)(cx, GROUND + f * FLOOR + 1.5, 0.95, 1.7, lite ? undefined : h.shutters);
      }
    k.box(0.16, H - 0.3, 0.16, 0.45, H / 2, 0.1, 'iron');
    const xc = end === 'start' ? h.w / 2 : x0 - h.w / 2;
    const m = new THREE.Matrix4()
      .makeTranslation(xc, 0, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(leans[i]))
      .multiply(new THREE.Matrix4().makeTranslation(end === 'start' ? -xc : x0 - xc, 0, end === 'start' ? -D : 0))
      .multiply(new THREE.Matrix4().makeRotationY(end === 'start' ? -Math.PI / 2 : Math.PI / 2));
    for (const g of sub) parts.push(g.applyMatrix4(m));
  }
  if (!quay) return { geometry: mergeGeometries(parts, false)!, posters, length: x0 };

  // Quay: pavement, the wall down to the water, white coping stones, bollards, lamp posts, a few trees
  const [from, to] = quay;
  const len = to - from;
  const mid = (from + to) / 2;
  box(len, 0.3, QUAY + 0.2, mid, -0.15, QUAY / 2 - 0.1, 'stone');
  box(len, 0.06, 1.2, mid, 0.02, 0.6, shade('stone', 0.9));
  box(len, 2.6, 0.7, mid, WATER - 0.1, QUAY + 0.15, shade('stone', 0.82), 0, 0, 0, MAT.stone);
  box(len, 0.28, 1.0, mid, -0.05, QUAY + 0.1, palette.white);
  for (let x = from + 4; x < to; x += 6.5) box(0.35, 0.5, 0.35, x, 0.25, QUAY - 0.25, 'iron');
  for (let at = from + 17; at < to - 22; at += 13) {
    // never in front of a poster: step aside to just past its edge
    const hidden = posters.find((p) => Math.abs(p.x - at) < p.w / 2 + 1);
    const lx = hidden ? hidden.x + (at < hidden.x ? -1 : 1) * (hidden.w / 2 + 1.3) : at;
    const lz = QUAY - 0.8;
    box(0.42, 0.3, 0.42, lx, 0.15, lz, 'iron');
    box(0.14, 4.4, 0.14, lx, 2.3, lz, 'iron');
    box(0.5, 0.12, 0.5, lx, 4.5, lz, 'iron');
    box(0.38, 0.6, 0.38, lx, 4.85, lz, palette.cream, 2);
    const cap = new THREE.ConeGeometry(0.42, 0.45, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(lx, 5.35, lz);
    add(cap, 'iron');
  }
  // trees at the far ends of the row
  for (const tx of [from + 5, to - 9]) {
    box(0.4, 3.2, 0.4, tx, 1.6, QUAY - 2.2, 'wood');
    for (const [dx, dy, r] of [[0, 4.4, 1.9], [-1.1, 3.7, 1.3], [1.2, 3.8, 1.4]] as const) {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate(tx + dx, dy, QUAY - 2.2);
      add(g, rand() > 0.5 ? '#4f9a63' : '#3f8656');
    }
  }
  return { geometry: mergeGeometries(parts, false)!, posters, length: x0 };
}

/** The Sint-Michielsbrug: a stone arch over the river, with a balustrade and lamps. */
function buildBridge(parts: THREE.BufferGeometry[]) {
  const { box } = kit(parts, rng(5));
  const width = 11; // along the river
  const deck = 3.4;
  // Side view (z, y): a slab from quay to quay with an arch cut out.
  const s = new THREE.Shape();
  s.moveTo(-3, WATER - 1);
  s.lineTo(FAR + 3, WATER - 1);
  s.lineTo(FAR + 3, 0);
  s.lineTo(FAR - QUAY + 1, deck);
  s.lineTo(QUAY - 1, deck);
  s.lineTo(-3, 0);
  s.lineTo(-3, WATER - 1);
  const arch = new THREE.Path();
  // a low, wide arch: the deck stays solid above it
  const r = RIVER / 2 - 0.6;
  arch.moveTo(MIDSTREAM - r, WATER - 1);
  arch.absellipse(MIDSTREAM, WATER - 0.6, r, deck - WATER - 0.4, Math.PI, 0, true, 0);
  arch.lineTo(MIDSTREAM + r, WATER - 1);
  s.holes.push(arch);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 24 });
  // shape x → world z, extrusion → world x
  g.rotateY(-Math.PI / 2);
  g.translate(BRIDGE + width / 2, 0, 0);
  parts.push(paint(g, '#d9cfbb'));
  // balustrade and lamps on both edges of the deck
  for (const ex of [BRIDGE - width / 2 + 0.3, BRIDGE + width / 2 - 0.3]) {
    box(0.4, 0.2, FAR - 2 * QUAY + 2, ex, deck + 1.1, MIDSTREAM, palette.white);
    for (let z = QUAY; z <= FAR - QUAY + 0.01; z += RIVER / 12) box(0.36, 1.0, 0.36, ex, deck + 0.5, z, palette.stone);
    for (const z of [QUAY + 2, MIDSTREAM, FAR - QUAY - 2]) {
      box(0.16, 3.6, 0.16, ex, deck + 1.8, z, 'iron');
      box(0.42, 0.55, 0.42, ex, deck + 3.8, z, palette.cream, 2);
    }
  }
}

export function buildStreet(): Built {
  const parts: THREE.BufferGeometry[] = [];
  const posters: Poster[] = [];

  const left = buildRow(GRASLEI, 11, { quay: [-14, BRIDGE + 14] });
  parts.push(left.geometry);
  for (const p of left.posters) posters.push({ ...p, z: 0.32 + p.dz, nz: 1 });

  // The Korenlei: the same kind of row, turned around to face the Graslei across the water.
  const L = rowLength(KORENLEI);
  const right = buildRow([...KORENLEI].reverse(), 23, { quay: [L - BRIDGE - 14, L + 14] });
  const m = new THREE.Matrix4().makeTranslation(L, 0, FAR).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  right.geometry.applyMatrix4(m);
  parts.push(right.geometry);
  for (const p of right.posters) posters.push({ ...p, x: L - p.x, z: FAR - 0.32 - p.dz, nz: -1 });

  // Upstream of the first house the quays carry on as well: the opening shot looks down on this stretch.
  const before: HouseSpec[] = [
    { w: 5.6, floors: 3, gable: 'pointed', wall: 'sand' },
    { w: 6.4, floors: 3, gable: 'stepped', wall: 'terracotta', steps: 5 },
    { w: 5, floors: 2, gable: 'cornice', wall: 'white', shutters: 'shutterGreen' },
    { w: 6.8, floors: 4, gable: 'stepped', wall: 'cream', steps: 6 },
    { w: 5.4, floors: 3, gable: 'pointed', wall: 'sage', roof: 'roofWarm' },
    { w: 6, floors: 3, gable: 'stepped', wall: 'ochre', steps: 4 },
    { w: 7, floors: 2, gable: 'cornice', wall: 'brick', awning: 'cream' },
    { w: 5.2, floors: 3, gable: 'pointed', wall: 'stone', shutters: 'shutterBlue' },
    { w: 6.2, floors: 3, gable: 'stepped', wall: 'slate', steps: 5 },
    { w: 5.8, floors: 2, gable: 'pointed', wall: 'cream', roof: 'roofWarm' },
  ];
  const PL = rowLength(before);
  const pre1 = buildRow(before, 41, { quay: [-12, PL - 14] });
  pre1.geometry.translate(-PL, 0, 0);
  parts.push(pre1.geometry);
  const pre2 = buildRow([...before].reverse(), 43, { quay: [14, PL + 12] });
  pre2.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, FAR).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
  parts.push(pre2.geometry);

  buildBridge(parts);

  // Beyond the bridge the quays carry on, on both sides.
  const beyond: HouseSpec[] = [
    { w: 6, floors: 3, gable: 'stepped', wall: 'cream', steps: 5 },
    { w: 5, floors: 2, gable: 'pointed', wall: 'terracotta' },
    { w: 7, floors: 3, gable: 'cornice', wall: 'sage' },
    { w: 5.4, floors: 3, gable: 'stepped', wall: 'ochre', steps: 4 },
    { w: 6, floors: 2, gable: 'pointed', wall: 'white', roof: 'roofWarm' },
    { w: 6.6, floors: 3, gable: 'stepped', wall: 'brick', steps: 5 },
    { w: 5, floors: 2, gable: 'cornice', wall: 'stone' },
    { w: 6, floors: 3, gable: 'pointed', wall: 'sand' },
  ];
  const BL = rowLength(beyond);
  const far1 = buildRow(beyond, 31, { quay: [-8, BL + 30], end: 'start' });
  far1.geometry.translate(BRIDGE + 8, 0, 0);
  parts.push(far1.geometry);
  const far2 = buildRow([...beyond].reverse(), 37, { quay: [-30, BL + 8], end: 'end' });
  far2.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(BRIDGE + 8 + BL, 0, FAR).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
  parts.push(far2.geometry);

  const geometry = mergeGeometries(parts, false)!;
  geometry.computeBoundingSphere();
  return { geometry, posters, span: [0, BRIDGE] };
}

// Where the big buildings stand: [x, z]. The back streets leave room for them.
const NIKLAAS = [BRIDGE + 80, MIDSTREAM - 30] as const;
const BELFORT = [BRIDGE + 150, MIDSTREAM - 95] as const;
const BAAFS = [BRIDGE + 230, MIDSTREAM - 170] as const;
const MICHIEL = [BRIDGE + 36, FAR + 36] as const;
const PARISH: [number, number][] = [[-60, -95], [40, FAR + 110], [150, -140], [250, FAR + 80], [-20, FAR + 150], [330, -60]];
// Ground kept free of houses: [x0, x1, z0, z1]
const RESERVED: [number, number, number, number][] = [
  [NIKLAAS[0] - 26, NIKLAAS[0] + 32, NIKLAAS[1] - 15, NIKLAAS[1] + 15],
  [BELFORT[0] - 9, BELFORT[0] + 44, BELFORT[1] - 10, BELFORT[1] + 10],
  [BAAFS[0] - 12, BAAFS[0] + 80, BAAFS[1] - 17, BAAFS[1] + 17],
  [MICHIEL[0] - 30, MICHIEL[0] + 26, MICHIEL[1] - 13, MICHIEL[1] + 13],
  ...PARISH.map(([x, z]): [number, number, number, number] => [x - 7, x + 30, z - 8, z + 8]),
];

type Kit = ReturnType<typeof kit> & { lancet: (x: number, y0: number, w: number, h: number) => void };

/** Pieces for churches and towers, in the same hand as the houses: stone, string courses, pointed windows, slate. */
function gothic(parts: THREE.BufferGeometry[], rand: () => number) {
  const stone = '#ddd5c1';
  const trim = '#c4bba6';
  const slate = '#5d6a72';
  const { add, box } = kit(parts, rand);
  const V = (x: number, y: number) => new THREE.Vector2(x, y);

  const round = (r: number, h: number, x: number, y: number, z: number, col = stone, seg = 8) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    g.rotateY(Math.PI / seg);
    g.translate(x, y + h / 2, z);
    add(g, col);
  };
  const cone = (r: number, h: number, x: number, y: number, z: number, col = slate, seg = 4) => {
    const g = new THREE.ConeGeometry(r, h, seg);
    g.rotateY(Math.PI / seg);
    g.translate(x, y + h / 2, z);
    add(g, col);
  };
  // Saddle roofs, the ridge along x or along z.
  const roofX = (x0: number, x1: number, zc: number, half: number, y: number, rise: number) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([V(-half, 0), V(half, 0), V(0, rise)]), { depth: x1 - x0, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(x0, y, zc);
    add(g, slate, 0, MAT.roof);
  };
  const roofZ = (z0: number, z1: number, xc: number, half: number, y: number, rise: number) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([V(-half, 0), V(half, 0), V(0, rise)]), { depth: z1 - z0, bevelEnabled: false });
    g.translate(xc, y, z0);
    add(g, slate, 0, MAT.roof);
  };

  /** Draw on a wall: x across, y up, z out of it. The wall's middle stands at (cx, cz) and faces `angle` (0 is +z, π/2 is +x). */
  const on = (angle: number, cx: number, cz: number, draw: (k: Kit) => void) => {
    const sub: THREE.BufferGeometry[] = [];
    const k = kit(sub, rand);
    const arch = (x: number, y0: number, hw: number, h: number): [number, number][] => [
      [x - hw, y0], [x + hw, y0], [x + hw, y0 + h - hw * 1.9], [x + hw * 0.62, y0 + h - hw * 0.8],
      [x, y0 + h], [x - hw * 0.62, y0 + h - hw * 0.8], [x - hw, y0 + h - hw * 1.9],
    ];
    const lancet = (x: number, y0: number, w: number, h: number) => {
      k.prism(arch(x, y0 - 0.2, w / 2 + 0.32, h + 0.6), 0.5, 0.16, trim);
      k.prism(arch(x, y0, w / 2, h), 0.3, 0.26, 'glass', MAT.none, 0.5 + rand() * 0.9);
      if (w > 1.1) k.box(0.18, h - w * 0.8, 0.12, x, y0 + (h - w * 0.8) / 2, 0.3, trim);
    };
    draw({ ...k, lancet });
    const m = new THREE.Matrix4().makeTranslation(cx, 0, cz).multiply(new THREE.Matrix4().makeRotationY(angle));
    for (const g of sub) parts.push(g.applyMatrix4(m));
  };

  /** A church hall along x: a high nave, a lower aisle on either side, a buttress and a pointed window in every bay. */
  const hall = (x0: number, x1: number, zc: number, half: number, wallH: number, rise: number, aisle = 0, aisleH = 0) => {
    const len = x1 - x0;
    const xm = (x0 + x1) / 2;
    box(len, wallH, half * 2, xm, wallH / 2, zc, stone);
    box(len + 0.3, 0.5, half * 2 + 0.7, xm, wallH - 0.15, zc, trim);
    roofX(x0, x1, zc, half + 0.25, wallH + 0.1, rise);
    const bays = Math.max(2, Math.round(len / 5.5));
    const step = len / bays;
    const pitch = 0.45;
    const low = aisle ? aisleH : wallH;
    for (const s of [1, -1]) {
      if (aisle) {
        box(len, aisleH, aisle, xm, aisleH / 2, zc + s * (half + aisle / 2), stone);
        box(len + 0.3, 0.35, aisle / Math.cos(pitch) + 0.6, xm, aisleH + (Math.tan(pitch) * aisle) / 2 + 0.1, zc + s * (half + aisle / 2), slate, 0, 0, s * pitch, MAT.roof);
        on(s > 0 ? 0 : Math.PI, xm, zc + s * half, (k) => {
          const y0 = aisleH + Math.tan(pitch) * aisle + 1;
          for (let b = 0; b < bays; b++) k.lancet(-len / 2 + (b + 0.5) * step, y0, 1.5, wallH - y0 - 1.6);
        });
      }
      on(s > 0 ? 0 : Math.PI, xm, zc + s * (half + aisle), (k) => {
        for (let b = 0; b <= bays; b++) {
          k.box(0.9, low * 0.9, 1.3, -len / 2 + b * step, low * 0.45, 0.6, stone);
          k.box(1.0, 0.3, 1.5, -len / 2 + b * step, low * 0.9 + 0.15, 0.6, trim);
        }
        for (let b = 0; b < bays; b++) k.lancet(-len / 2 + (b + 0.5) * step, low * 0.22, 1.6, low * 0.6);
        k.box(len, 0.7, 0.3, 0, 0.35, 0.12, trim);
      });
    }
  };

  /** The end wall of a hall: a gable, one tall window, a buttress on each corner, and a door if it is the front. */
  const gableEnd = (angle: number, cx: number, cz: number, half: number, wallH: number, rise: number, door = false) =>
    on(angle, cx, cz, (k) => {
      k.prism([[-half - 0.3, wallH - 0.2], [half + 0.3, wallH - 0.2], [0, wallH + rise + 1]], 0.7, 0.12, stone);
      k.box(0.6, 2.2, 0.6, 0, wallH + rise + 1.6, -0.2, trim);
      k.lancet(0, door ? wallH * 0.36 : wallH * 0.22, half * 0.75, wallH * (door ? 0.6 : 0.72));
      for (const s of [-1, 1]) {
        k.box(1.3, wallH, 1.5, s * half, wallH / 2, 0.6, stone);
        k.box(1.4, 0.35, 1.7, s * half, wallH + 0.17, 0.6, trim);
      }
      if (door) {
        const w = half * 0.55;
        k.prism([[-w - 0.5, 0], [w + 0.5, 0], [w + 0.5, w * 1.5], [0, w * 3 + 0.6], [-w - 0.5, w * 1.5]], 0.5, 0.2, trim);
        k.prism([[-w, 0], [w, 0], [w, w * 1.5], [0, w * 3], [-w, w * 1.5]], 0.3, 0.3, 'wood');
      }
    });

  /** A square tower: string courses, stages of pointed windows on all four faces. `stages` are [sill height, window height]. */
  const tower = (x: number, z: number, half: number, h: number, stages: [number, number][], perFace = 2) => {
    box(half * 2, h, half * 2, x, h / 2, z, stone);
    for (const [y] of stages) box(half * 2 + 0.5, 0.45, half * 2 + 0.5, x, y - 1, z, trim);
    box(half * 2 + 0.8, 0.7, half * 2 + 0.8, x, h - 0.35, z, trim);
    const w = (half * 2) / (perFace * 2.3);
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      on(a, x + Math.sin(a) * half, z + Math.cos(a) * half, (k) => {
        for (const [y0, wh] of stages) for (let i = 0; i < perFace; i++) k.lancet((i - (perFace - 1) / 2) * w * 2.1, y0, w, wh);
      });
    }
  };

  /** A plain parish church for the back streets: tower with a spire, a short nave. */
  const parish = (x: number, z: number) => {
    tower(x, z, 3.4, 25, [[15, 6.5]], 1);
    cone(4.4, 15, x, 25, z);
    hall(x + 3.4, x + 27, z, 4.6, 12, 6);
    gableEnd(Math.PI / 2, x + 27, z, 4.6, 12, 6);
  };
  return { stone, trim, slate, add, box, round, cone, roofX, roofZ, on, hall, gableEnd, tower, parish };
}

/** The big buildings down the river: Sint-Niklaaskerk, the Belfort with the Cloth Hall, Sint-Baafs, and Sint-Michielskerk by the bridge. */
export function buildTowers(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const { stone, trim, slate, add, box, round, cone, roofZ, on, hall, gableEnd, tower } = gothic(parts, rng(3));
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

  // Sint-Niklaaskerk: nave and choir along the river, a transept across, the tower over the crossing.
  {
    const [x, z] = NIKLAAS;
    hall(x - 23, x - 5, z, 5.5, 22, 8, 4.5, 10);
    hall(x + 5, x + 24, z, 5.5, 22, 8, 4.5, 10);
    round(5.9, 22, x + 24, 0, z);
    cone(6.3, 9, x + 24, 22, z, slate, 8);
    box(10, 22, 24, x, 11, z, stone);
    roofZ(z - 12, z + 12, x, 5.25, 22.1, 8);
    for (const s of [1, -1]) gableEnd(s > 0 ? 0 : Math.PI, x, z + s * 12, 5, 22, 8);
    // the west front, towards the bridge, between two round stair turrets
    gableEnd(-Math.PI / 2, x - 23, z, 5.5, 22, 8, true);
    for (const s of [1, -1]) {
      round(1.5, 31, x - 23, 0, z + s * 5.6);
      cone(1.9, 7, x - 23, 31, z + s * 5.6, slate, 8);
    }
    tower(x, z, 5.5, 47, [[26, 8], [36.5, 8]], 2);
    for (const [a, b] of corners) {
      round(1.6, 30, x + a * 5.5, 22, z + b * 5.5);
      cone(2, 8, x + a * 5.5, 52, z + b * 5.5, slate, 8);
    }
    cone(7, 16, x, 47, z);
    box(0.4, 2.4, 0.4, x, 63.5, z, palette.gold);
  }

  // The Belfort: a tall shaft, a gallery with four corner turrets, the clock, a lantern and the spire with its dragon.
  {
    const [x, z] = BELFORT;
    tower(x, z, 5, 52, [[13, 9], [27, 9], [40, 8]], 2);
    for (const [a, b] of corners) box(1.6, 52, 1.6, x + a * 5, 26, z + b * 5, stone);
    box(12, 1.2, 12, x, 52.6, z, trim);
    for (const [a, b] of corners) {
      round(1.4, 9, x + a * 5.2, 53, z + b * 5.2);
      cone(1.8, 6, x + a * 5.2, 62, z + b * 5.2, slate, 8);
    }
    box(8, 11, 8, x, 58.5, z, stone);
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      on(a, x + Math.sin(a) * 4, z + Math.cos(a) * 4, (k) => {
        for (const [r, d, col] of [[2.9, 0.3, palette.gold], [2.5, 0.42, palette.cream]] as const) {
          const g = new THREE.CylinderGeometry(r, r, d, 20);
          g.rotateX(Math.PI / 2);
          g.translate(0, 59, d / 2);
          k.add(g, col);
        }
        k.box(0.22, 2, 0.1, 0, 60, 0.46, 'iron');
        k.box(1.5, 0.22, 0.1, 0.75, 59, 0.46, 'iron');
      });
    }
    box(8.8, 0.7, 8.8, x, 64.3, z, trim);
    round(3.6, 7, x, 64.6, z);
    box(7.6, 0.5, 7.6, x, 71.8, z, trim);
    cone(4.4, 17, x, 72, z, slate, 8);
    box(0.4, 2.2, 0.4, x, 89, z, palette.gold);
    box(3, 0.6, 0.5, x + 0.3, 90.4, z, palette.gold);
    box(0.5, 1.1, 0.5, x + 1.5, 91, z, palette.gold);
    // the Cloth Hall against its foot
    hall(x + 5, x + 40, z, 6, 14, 9);
    gableEnd(Math.PI / 2, x + 40, z, 6, 14, 9);
  }

  // Sint-Baafs: one heavy west tower with an eight-sided top between four pinnacles, the long nave behind it.
  {
    const [x, z] = BAAFS;
    tower(x, z, 7, 58, [[15, 12], [31, 11], [45, 10]], 2);
    for (const [a, b] of corners) {
      box(2.6, 58, 2.6, x + a * 7, 29, z + b * 7, stone);
      round(1.3, 15, x + a * 7, 58, z + b * 7);
      cone(1.7, 6, x + a * 7, 73, z + b * 7, slate, 8);
    }
    round(6.4, 14, x, 58, z);
    box(12.6, 0.6, 12.6, x, 72.2, z, trim);
    cone(6.8, 6, x, 72.4, z, slate, 8);
    hall(x + 7, x + 76, z, 7, 30, 10, 6, 14);
    round(7.4, 30, x + 76, 0, z);
    cone(7.8, 10, x + 76, 30, z, slate, 8);
  }

  // Sint-Michielskerk, on the Korenlei side by the bridge: a broad church with a tower that was never finished.
  {
    const [x, z] = MICHIEL;
    hall(x - 16, x + 22, z, 6, 20, 8, 4.5, 10);
    gableEnd(Math.PI / 2, x + 22, z, 6, 20, 8);
    tower(x - 22, z, 6, 27, [[13, 10]], 2);
    for (const [a, b] of corners) {
      box(2, 27, 2, x - 22 + a * 6, 13.5, z + b * 6, stone);
      cone(1.5, 4, x - 22 + a * 6, 27, z + b * 6, slate, 4);
    }
    cone(7.2, 3.5, x - 22, 27.6, z);
  }

  const towers = mergeGeometries(parts, false)!;
  // floodlit at night; the windows keep their own light
  const glow = towers.getAttribute('aGlow').array as Float32Array;
  for (let i = 0; i < glow.length; i++) if (!glow[i]) glow[i] = 3;
  return towers;
}

/**
 * Everything behind the two quays: back streets of simpler houses, gardens and trees, a few church
 * spires, and green hills closing off the horizon. Built once, merged, never casts shadows.
 */
export function buildBackground(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rand = rng(77);
  const { add, box } = kit(parts, rand);
  const walls: Col[] = ['cream', 'white', 'sand', 'ochre', 'terracotta', 'brick', 'sage', 'slate', 'stone'];
  const roofs: Col[] = ['roof', 'roofWarm', 'roof', 'roofWarm', 'slate'];
  const greens = ['#4f9a63', '#3f8656', '#5aa86b', '#6aa870'];
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

  const tree = (x: number, z: number, s = 1) => {
    box(0.35 * s, 2.6 * s, 0.35 * s, x, 1.3 * s, z, 'wood');
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const g = new THREE.IcosahedronGeometry((1.3 + rand() * 0.9) * s, 1);
      g.translate(x + (rand() - 0.5) * 1.6 * s, (3 + rand() * 1.4) * s, z + (rand() - 0.5) * 1.6 * s);
      add(g, pick(greens));
    }
  };

  // The back streets are rows of the same houses as on the quays, drawn lighter the further back they stand.
  const gables: Gable[] = ['stepped', 'pointed', 'pointed', 'cornice', 'stepped'];
  const spec = (): HouseSpec => ({
    w: 5 + rand() * 4.5,
    floors: 2 + Math.floor(rand() * 3),
    gable: pick(gables),
    wall: pick(walls),
    roof: pick(roofs),
    steps: 4 + Math.floor(rand() * 2),
  });
  const D = 9;
  let seed = 100;

  const x0 = -140;
  const x1 = BRIDGE + 330;
  for (const side of [-1, 1] as const) {
    const facing: 1 | -1 = side < 0 ? 1 : -1; // fronts look towards the river
    for (let row = 0; row < 9; row++) {
      // back streets every 15 m, with a little wobble
      const zFront = side < 0 ? -(17 + row * 15) : FAR + 17 + row * 15;
      let x = x0 + rand() * 8;
      let run: HouseSpec[] = [];
      let runX = x;
      const flush = () => {
        if (run.length) {
          const r = buildRow(run, seed++, { depth: D, lite: row < 3 ? 1 : 2, end: side < 0 ? 'start' : 'end' });
          const m = new THREE.Matrix4().makeTranslation(side < 0 ? runX : runX + r.length, 0, zFront);
          if (side > 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
          parts.push(r.geometry.applyMatrix4(m));
        }
        run = [];
      };
      const zA = Math.min(zFront, zFront - facing * D) - 2;
      const zB = Math.max(zFront, zFront - facing * D) + 2;
      while (x < x1) {
        const r = rand();
        const busy = RESERVED.find(([a, b, c, d]) => x + 10 > a && x < b && zB > c && zA < d);
        if (busy) {
          // a church stands here
          flush();
          x = busy[1] + 2;
          continue;
        }
        if (r < 0.08) {
          // a cross street
          flush();
          x += 7 + rand() * 4;
          continue;
        }
        if (r < 0.16) {
          // a garden or a little square with trees
          flush();
          const w = 10 + rand() * 12;
          box(w, 0.1, 11, x + w / 2, 0.02, zFront - (facing * 11) / 2, '#86b77a');
          for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) tree(x + 2 + rand() * (w - 4), zFront - facing * (2 + rand() * 7), 0.8 + rand() * 0.6);
          x += w;
          continue;
        }
        const h = spec();
        if (!run.length) runX = x;
        run.push(h);
        x += h.w;
      }
      flush();
    }
  }

  // Parish churches among the roofs
  const { parish } = gothic(parts, rand);
  for (const [x, z] of PARISH) parish(x, z);

  // Green hills all around the horizon, so the world ends softly instead of in nothing.
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.1;
    const r = 430 + rand() * 60;
    const g = new THREE.IcosahedronGeometry(70 + rand() * 50, 2);
    g.scale(1.6, 0.32 + rand() * 0.18, 1);
    g.translate(cx + Math.cos(a) * r * 1.25, -6, MIDSTREAM + Math.sin(a) * r);
    add(g, pick(['#7fae78', '#6f9f70', '#8fbb82']));
  }
  return mergeGeometries(parts, false)!;
}
