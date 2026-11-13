import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ANKLE, figure, type Hold, HIP, LEG_X, NECK, SHIN, SHOULDER, THIGH, UPPER, type Wish } from './character';
import { paint, palette } from './houses';

export { RIG } from './character';

// The people and the boats. Each one is built from small coloured pieces: a collar, a cuff, a bag strap,
// a bench, a fender. Cloth and hair also get a pattern from the shader, drawn in the piece's own surface
// coordinates, so it stays put on whoever wears it.

type G = THREE.BufferGeometry;
type V = [number, number, number];
type Opt = { rx?: number; ry?: number; rz?: number; glow?: number; sx?: number; sy?: number; sz?: number; fab?: number };

const UP = new THREE.Vector3(0, 1, 0);
const WHITE = '#f4f1e6';
const DARK = '#26262b';
const WOOD = '#8a6a4a';
const ROPE = '#cdbf9c';

// Every pattern repeats within this length, so a sleeve or a trouser leg closes without a visible seam.
const WRAP = 0.12;
const around = (r: number) => Math.max(1, Math.round((2 * Math.PI * r) / WRAP)) * WRAP;

function rng(seed: number) {
  let s = (seed * 7919 + 13) % 2147483647;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const shade = (col: string, k: number) => '#' + new THREE.Color(col).multiplyScalar(k).getHexString();

/** Paints a piece and keeps its surface coordinates, scaled to metres, for the cloth patterns. */
function dress(g0: G, col: string, glow = 0, fab = 0, su = 1, sv = 1) {
  const g = g0.index ? g0.toNonIndexed() : g0;
  const uv = g.attributes.uv;
  const n = g.attributes.position.count;
  const at = new Float32Array(n * 2);
  if (uv) for (let i = 0; i < n; i++) at.set([uv.getX(i) * su, uv.getY(i) * sv], i * 2);
  paint(g, col, glow, fab);
  g.setAttribute('aUv', new THREE.BufferAttribute(at, 2));
  return g;
}

function kit() {
  const parts: G[] = [];
  const put = (g: G, x: number, y: number, z: number, col: string, o: Opt = {}, su = 1, sv = 1) => {
    if (o.sx || o.sy || o.sz) g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y, z);
    parts.push(dress(g, col, o.glow ?? 0, o.fab ?? 0, su, sv));
  };
  return {
    put,
    box: (w: number, h: number, d: number, x: number, y: number, z: number, col: string, o?: Opt) => put(new THREE.BoxGeometry(w, h, d), x, y, z, col, o, w, h),
    // the seam of a tube is at the back
    tube: (rTop: number, rBottom: number, h: number, x: number, y: number, z: number, col: string, o?: Opt) =>
      put(new THREE.CylinderGeometry(rTop, rBottom, h, 12, 1, false, Math.PI), x, y, z, col, o, around(((rTop + rBottom) / 2) * (0.5 + 0.5 * (o?.sz ?? 1))), h),
    ball: (r: number, x: number, y: number, z: number, col: string, o?: Opt) => put(new THREE.SphereGeometry(r, 12, 9), x, y, z, col, o, around(r), Math.PI * r),
    /** A thin round bar from a to b: poles, ropes, oars. */
    rod: (a: V, b: V, r: number, col: string) => {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const g = new THREE.CylinderGeometry(r, r, d.length(), 6);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
      g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      parts.push(dress(g, col));
    },
    /** Adds a piece that is already painted. */
    // the pieces from character.ts share their corners; the boats' pieces do not, and the two have to match
    join: (g: G) => void parts.push(g.index ? g.toNonIndexed() : g),
    done: () => mergeGeometries(parts, false)!,
  };
}
type Kit = ReturnType<typeof kit>;

const moved = (g: G, x: number, y: number, z: number, o: { rx?: number; ry?: number; rz?: number } = {}) => {
  if (o.rx) g.rotateX(o.rx);
  if (o.rz) g.rotateZ(o.rz);
  if (o.ry) g.rotateY(o.ry);
  g.translate(x, y, z);
  return g;
};

/* ---------------- People ---------------- */

type Figure = ReturnType<typeof figure>;

/** A whole arm in one piece, hanging from the shoulder at the origin. `fwd` swings it forward, `bend` folds the elbow. */
function armOf(f: Figure, fwd: number, bend: number) {
  const k = kit();
  k.join(moved(f.upperArm(), 0, 0, 0, { rx: -fwd }));
  k.join(moved(f.foreArm(), 0, -UPPER * Math.cos(fwd), UPPER * Math.sin(fwd), { rx: -(fwd + bend) }));
  return k.done();
}

/** A walker in loose pieces, one per bone, so the joints can move. The torso is measured from the hip. */
export function walker(seed: number) {
  const f = figure(seed, { lod: 0.8 });
  return {
    torso: moved(f.torso(), 0, -HIP, 0),
    head: f.head(),
    upper: f.upperArm(),
    fore: f.foreArm(),
    foreHold: f.hold === 'none' ? null : f.foreArm(f.hold),
    thigh: f.thigh(),
    shin: f.shin(),
    foot: f.foot(),
    armX: f.armX,
    size: f.size,
    hold: f.hold,
    long: f.long,
  };
}

/** Someone standing still, in one piece. */
export function standing(seed: number, wish?: Wish) {
  const f = figure(seed, wish);
  const k = kit();
  k.join(f.torso());
  k.join(moved(f.head(), 0, NECK, 0));
  for (const s of [-1, 1]) {
    const x = s * LEG_X;
    k.join(moved(f.thigh(), x, HIP, 0));
    k.join(moved(f.shin(), x, HIP - THIGH, 0));
    k.join(moved(f.foot(), x, ANKLE, 0, { ry: -s * 0.12 }));
    k.join(moved(armOf(f, 0.08, 0.3), s * f.armX, SHOULDER, 0, { rz: s * 0.07 }));
  }
  return k.done();
}

/**
 * Someone sitting: the seat is at y = 0, the hips at z = 0, knees towards +z. The head and the lower legs
 * come separately, so they can move. `reach` is how far the arms come forward (radians), otherwise the
 * hands rest on the knees; without legs it is someone in a kayak.
 */
function sitting(seed: number, o: { legs?: boolean; reach?: number; lod?: number } = {}) {
  const f = figure(seed, { kinds: ['tee', 'tee', 'stripes', 'jacket', 'hoodie'], lod: o.lod });
  const k = kit();
  const lower = kit();
  const drop = 0.1 - HIP;
  k.join(moved(f.torso(), 0, drop, 0));
  const [fwd, bend] = o.reach ? [o.reach - 0.15, 0.3] : [0.15, 0.95];
  for (const s of [-1, 1]) {
    k.join(moved(armOf(f, fwd, bend), s * f.armX, SHOULDER + drop, 0, { rz: s * 0.07 }));
    if (o.legs === false) continue;
    const x = s * LEG_X;
    k.join(moved(f.thigh(), x, 0.1, 0, { rx: -Math.PI / 2 }));
    lower.join(moved(f.shin(), x, 0, 0));
    lower.join(moved(f.foot(), x, -SHIN, 0));
  }
  return { body: k.done(), head: f.head(), neck: NECK + drop, lower: o.legs === false ? null : lower.done() };
}

/**
 * Someone in a boat, in pieces that move: the head, both arms and (for a paddler) the chest and the paddle.
 * Everything else is `still`. `at` and `turn` place them in the boat; inside, they face +z, with the seat
 * (or the deck) at y = 0 and the hip `hip` above it.
 */
export type Rider = {
  at: V;
  turn: number;
  pose: 'sit' | 'stand' | 'paddle';
  seed: number;
  /** What to dress them in (the same for an animated actor, see actor.ts). */
  wish: Wish;
  /** Only for a paddler, who is still built from pieces: there is no paddling clip. */
  pieces: Pieces | null;
};
export type Pieces = {
  hold: Hold;
  hip: number;
  armX: number;
  still: G | null;
  torso: G | null;
  head: G;
  upper: G;
  fore: G;
  foreHold: G | null;
  paddle: G | null;
};

function rider(seed: number, pose: Rider['pose'], at: V, turn: number, lod: number): Rider {
  const wish: Wish = pose === 'stand' ? { kinds: ['jacket'], captain: true, lod } : { kinds: ['tee', 'tee', 'stripes', 'jacket', 'hoodie'], lod };
  return { at, turn, pose, seed, wish, pieces: pose === 'paddle' ? pieces(seed, pose, wish) : null };
}

function pieces(seed: number, pose: Rider['pose'], wish: Wish): Pieces {
  const f = figure(seed, wish);
  const still = kit();
  let n = 0;
  const hip = pose === 'stand' ? HIP : 0.1;
  for (const s of pose === 'paddle' ? [] : [-1, 1]) {
    const x = s * LEG_X;
    if (pose === 'stand') {
      still.join(moved(f.thigh(), x, HIP, 0));
      still.join(moved(f.shin(), x, HIP - THIGH, 0));
      still.join(moved(f.foot(), x, ANKLE, 0, { ry: -s * 0.12 }));
    } else {
      still.join(moved(f.thigh(), x, hip, 0, { rx: -Math.PI / 2 }));
      still.join(moved(f.shin(), x, hip, THIGH));
      still.join(moved(f.foot(), x, hip - SHIN, THIGH));
    }
    n += 3;
  }
  const torso = moved(f.torso(), 0, -HIP, 0);
  // only a paddler turns at the waist; everyone else's torso can go in with the rest
  if (pose !== 'paddle') {
    still.join(moved(torso, 0, hip, 0));
    n++;
  }
  let paddle: G | null = null;
  if (pose === 'paddle') {
    const k = kit();
    k.rod([-1.05, 0, 0], [1.05, 0, 0], 0.018, DARK);
    for (const s of [-1, 1]) k.box(0.36, 0.17, 0.03, s * 1.15, 0, 0, WHITE);
    paddle = k.done();
  }
  return {
    hold: f.hold,
    hip,
    armX: f.armX,
    still: n ? still.done() : null,
    torso: pose === 'paddle' ? torso : null,
    head: f.head(),
    upper: f.upperArm(),
    fore: f.foreArm(),
    foreHold: f.hold === 'none' ? null : f.foreArm(f.hold),
    paddle,
  };
}

/** A piece that moves on its own: where its hinge is, and which way the person faces. */
export type Loose = { g: G; at: V; turn: number };

/**
 * Where people sit on the edge of the quay with their legs over the water, as they do on the Graslei.
 * `edge` is the z of the water side of the left quay; `far` mirrors it for the right bank.
 */
export function sitterSpots(length: number, edge: number, far: number) {
  const spots: [number, 1 | -1, number][] = [
    [0.07, 1, 2], [0.16, -1, 1], [0.24, 1, 1], [0.31, -1, 2], [0.4, 1, 3], [0.49, -1, 1],
    [0.57, 1, 2], [0.66, -1, 2], [0.74, 1, 1], [0.82, -1, 3], [0.9, 1, 1],
  ];
  const out: { seed: number; x: number; z: number; turn: number; bank: 1 | -1 }[] = [];
  let seed = 400;
  for (const [at, bank, n] of spots)
    for (let i = 0; i < n; i++) out.push({ seed: seed++, x: at * length + i * 0.62, z: bank > 0 ? edge : far - edge, turn: bank > 0 ? 0 : Math.PI, bank });
  return out;
}

/* ---------------- Boats ---------------- */

// A boat seen from above: a slightly narrower stern, the widest point a little forward of the middle, a pointed bow at +x.
// `tail` is a straight stretch let in at the widest point, for a longer boat with the same bow and stern.
function trace<T extends THREE.Path>(p: T, L: number, b: number, tail = 0): T {
  p.moveTo(-L - tail, -b * 0.82);
  p.quadraticCurveTo(-L * 0.6 - tail, -b, 0.25 * L - tail, -b);
  p.lineTo(0.25 * L, -b);
  p.quadraticCurveTo(0.8 * L, -b, L, 0);
  p.quadraticCurveTo(0.8 * L, b, 0.25 * L, b);
  p.lineTo(0.25 * L - tail, b);
  p.quadraticCurveTo(-L * 0.6 - tail, b, -L - tail, b * 0.82);
  p.lineTo(-L - tail, -b * 0.82);
  return p;
}
/** Half the width of that outline at x. */
function half(L: number, b: number, at: number, tail = 0) {
  if (tail && at < 0.25 * L && at > 0.25 * L - tail) return b;
  const x = tail && at < 0.25 * L ? at + tail : at;
  const q = (a: number, c: number, d: number, t: number) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * c + t * t * d;
  const [x0, xc, x1, z0, zc, z1] = x < 0.25 * L ? [-L, -0.6 * L, 0.25 * L, 0.82 * b, b, b] : [0.25 * L, 0.8 * L, L, b, b, 0];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (q(x0, xc, x1, mid) < x) lo = mid;
    else hi = mid;
  }
  return q(z0, zc, z1, (lo + hi) / 2);
}
const laid = (s: THREE.Shape, depth: number, y: number) => {
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
};
/** A flat piece in the shape of the boat. */
const slab = (k: Kit, L: number, b: number, depth: number, y: number, col: string, tail = 0) => k.join(dress(laid(trace(new THREE.Shape(), L, b, tail), depth, y), col));
/** The same with the middle cut out: hull sides, rails, painted stripes. */
const ring = (k: Kit, Lo: number, bo: number, Li: number, bi: number, depth: number, y: number, col: string, tail = 0) => {
  const s = trace(new THREE.Shape(), Lo, bo, tail);
  s.holes.push(trace(new THREE.Path(), Li, bi, tail));
  k.join(dress(laid(s, depth, y), col));
};

type HullSpec = { L: number; b: number; h: number; hull: string; trim: string; wall?: number };
/** An open boat you can look into. The water line sits at y = 0.3. */
function openHull(k: Kit, { L, b, h, hull, trim, wall = 0.12 }: HullSpec, floor = 0.42) {
  ring(k, L, b, L - wall, b - wall, h, 0, hull);
  slab(k, L - wall, b - wall, 0.1, floor - 0.1, shade(WOOD, 0.85));
  ring(k, L + 0.04, b + 0.04, L - wall - 0.02, b - wall - 0.02, 0.07, h, trim);
  ring(k, L + 0.025, b + 0.025, L - 0.05, b - 0.05, 0.1, h * 0.52, trim);
}
/** A boat with a deck. */
function deckedHull(k: Kit, { L, b, h, hull, trim }: HullSpec, deck: string) {
  slab(k, L, b, h, 0, hull);
  slab(k, L - 0.1, b - 0.1, 0.05, h, deck);
  ring(k, L + 0.04, b + 0.04, L - 0.14, b - 0.14, 0.09, h, trim);
  ring(k, L + 0.025, b + 0.025, L - 0.05, b - 0.05, 0.1, h * 0.52, trim);
}

function lifeRing(k: Kit, x: number, y: number, z: number, o: Opt = {}) {
  for (let i = 0; i < 8; i++) {
    const g = new THREE.TorusGeometry(0.2, 0.065, 6, 4, Math.PI / 4);
    g.rotateZ((i * Math.PI) / 4);
    k.put(g, x, y, z, i % 2 ? WHITE : '#e2622b', o);
  }
}
function fenders(k: Kit, xs: number[], y: number, b: number) {
  for (const x of xs) {
    for (const s of [-1, 1]) {
      k.tube(0.085, 0.085, 0.34, x, y, s * (b + 0.11), WHITE);
      k.tube(0.03, 0.03, 0.14, x, y + 0.22, s * (b + 0.11), shade(palette.shutterBlue, 0.8));
    }
  }
}
function lantern(k: Kit, x: number, y: number, z: number, post = 0.35) {
  k.tube(0.025, 0.025, post, x, y + post / 2, z, DARK);
  k.box(0.15, 0.17, 0.15, x, y + post + 0.085, z, palette.cream, { glow: 2 });
  k.box(0.2, 0.035, 0.2, x, y + post + 0.19, z, DARK);
}
/** The Belgian flag on a pole at the stern, flying backwards. */
function flag(k: Kit, x: number, y: number, z: number) {
  k.rod([x + 0.12, y, z], [x, y + 1.25, z], 0.02, DARK);
  ['#26262b', '#f2c230', '#d43a2f'].forEach((c, i) => k.box(0.17, 0.32, 0.016, x - 0.11 - i * 0.17, y + 1.06, z, c));
}
function outboard(k: Kit, L: number, h: number) {
  k.box(0.34, 0.5, 0.4, -L - 0.1, h + 0.1, 0, DARK);
  k.box(0.36, 0.08, 0.42, -L - 0.1, h + 0.37, 0, WHITE);
  k.box(0.1, 0.8, 0.1, -L - 0.14, h - 0.45, 0, DARK);
}
/** Ropes from bow and stern up to the quay. `side` is which way the quay lies. */
function moor(k: Kit, L: number, b: number, h: number, side: number, reach: number) {
  for (const [x, dx] of [[0.6 * L, 0.5], [-0.8 * L, -0.5]]) {
    k.rod([x, h + 0.08, side * (b - 0.15)], [x + dx, 1.93, side * reach], 0.02, ROPE);
    k.box(0.14, 0.12, 0.14, x + dx, 1.95, side * reach, palette.iron);
    k.box(0.16, 0.05, 0.05, x, h + 0.12, side * (b - 0.15), palette.iron);
  }
}

/** A tour boat: rows of benches, passengers, a skipper at the back. Some have a striped awning. */
export function tourBoat(seed: number, o: { len: number; hull: string; trim: string; awning?: [string, string] }) {
  const k = kit();
  const crew: Rider[] = [];
  const r = rng(seed);
  const L = o.len / 2;
  const b = 1.25;
  const h = 0.95;
  openHull(k, { L, b, h, hull: o.hull, trim: o.trim });
  let who = seed * 31;
  for (let x = -L + 2.1; x < 0.5 * L; x += 1.15) {
    const w = half(L - 0.12, b - 0.12, x + 0.2);
    k.box(0.38, 0.06, 2 * w - 0.04, x, 0.74, 0, WOOD);
    k.box(0.06, 0.3, 2 * w - 0.3, x, 0.57, 0, shade(WOOD, 0.75));
    for (const s of [-1, 1]) if (r() < 0.78) crew.push(rider(who++, 'sit', [x - 0.04, 0.77, s * w * 0.5], Math.PI / 2, 0.6));
  }
  crew.push(rider(who++, 'stand', [-L + 1.0, 0.42, 0.15], Math.PI / 2, 0.6));
  outboard(k, L, h);
  flag(k, -L + 0.2, h, -(b * 0.82 - 0.3));
  lantern(k, L - 0.55, h - 0.05, 0);
  fenders(k, [-0.45 * L, 0.05 * L], h - 0.3, b);
  lifeRing(k, -L + 1.2, h - 0.33, b * 0.9 + 0.09);
  lifeRing(k, -L + 1.2, h - 0.33, -(b * 0.9 + 0.09));
  if (o.awning) {
    const xa = -L + 1.7;
    const xb = 0.42 * L;
    const top = h + 1.62;
    for (const x of [xa, xb]) for (const s of [-1, 1]) k.rod([x, h, s * (b - 0.2)], [x, top, s * (b - 0.2)], 0.03, WHITE);
    const n = 7;
    const w = (2 * b + 0.3) / n;
    for (let i = 0; i < n; i++) k.box(xb - xa + 0.6, 0.05, w, (xa + xb) / 2, top + 0.02, -b - 0.15 + w * (i + 0.5), o.awning[i % 2]);
    for (const x of [xa - 0.3, xb + 0.3]) k.box(0.03, 0.15, 2 * b + 0.3, x, top - 0.05, 0, o.awning[0]);
  }
  return { g: k.done(), crew };
}

/** A small cabin boat that someone lives on: windows that light up at night, plants on the roof. */
export function cabinBoat(seed: number, o: { len: number; hull: string; trim: string; cabin: string; quay: number }) {
  const k = kit();
  const r = rng(seed);
  const L = o.len / 2;
  const b = 1.15;
  const h = 0.85;
  const deck = '#b8956a';
  deckedHull(k, { L, b, h, hull: o.hull, trim: o.trim }, deck);
  for (const z of [-0.6, -0.3, 0, 0.3, 0.6]) k.box(L * 1.15, 0.006, 0.025, -0.3 * L, h + 0.053, z, shade(deck, 0.7));

  const cx = -0.18 * L;
  const cl = o.len * 0.4;
  const cw = 2 * b - 0.7;
  const ch = 0.95;
  const base = h + 0.05;
  k.box(cl, ch, cw, cx, base + ch / 2, 0, o.cabin);
  k.box(cl + 0.35, 0.08, cw + 0.3, cx, base + ch + 0.04, 0, o.trim);
  k.box(cl + 0.02, 0.1, cw + 0.02, cx, base + 0.05, 0, shade(o.cabin, 0.8));
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const x = cx + i * cl * 0.3;
      k.box(cl * 0.2, 0.36, 0.03, x, base + ch * 0.62, s * (cw / 2 + 0.005), palette.glass, { glow: 0.3 + r() * 0.7 });
      k.box(cl * 0.2 + 0.08, 0.045, 0.06, x, base + ch * 0.62 - 0.2, s * (cw / 2 + 0.01), WHITE);
    }
  }
  for (const s of [-1, 1]) k.box(0.03, 0.4, cw * 0.36, cx + cl / 2 + 0.005, base + ch * 0.6, s * cw * 0.22, palette.glass, { glow: 0.3 + r() * 0.7 });
  k.box(0.03, 0.78, 0.5, cx - cl / 2 - 0.005, base + 0.39, -cw * 0.12, palette.wood);
  k.ball(0.03, cx - cl / 2 - 0.03, base + 0.4, -cw * 0.12 + 0.18, palette.gold);
  lifeRing(k, cx - cl / 2 - 0.07, base + 0.55, cw * 0.3, { ry: Math.PI / 2 });

  // on the roof: a stove pipe and plants
  const roof = base + ch + 0.08;
  k.tube(0.06, 0.06, 0.42, cx - cl * 0.32, roof + 0.21, cw * 0.22, DARK);
  k.tube(0.1, 0.1, 0.05, cx - cl * 0.32, roof + 0.44, cw * 0.22, DARK);
  for (const [dx, dz, s] of [[0.22, -0.2, 1], [0.34, 0.18, 0.8], [-0.05, -0.25, 0.7]] as const) {
    k.tube(0.11 * s, 0.085 * s, 0.17 * s, cx + cl * dx, roof + 0.085 * s, cw * dz, palette.terracotta);
    k.ball(0.17 * s, cx + cl * dx, roof + 0.25 * s, cw * dz, i_green(r()));
  }

  // foredeck: a cleat, a coil of rope, a lamp at the bow
  k.box(0.26, 0.05, 0.06, 0.55 * L, h + 0.13, 0, palette.iron);
  k.box(0.05, 0.1, 0.05, 0.55 * L, h + 0.09, 0, palette.iron);
  for (const [rad, y] of [[0.17, 0.07], [0.13, 0.11]]) k.put(new THREE.TorusGeometry(rad, 0.03, 6, 14), 0.42 * L, h + y, 0.3, ROPE, { rx: Math.PI / 2 });
  lantern(k, L - 0.45, h + 0.05, 0, 0.3);
  flag(k, -L + 0.2, h + 0.05, 0);
  fenders(k, [-0.5 * L, 0.1 * L], h - 0.28, b);
  moor(k, L, b, h, o.quay, 2.35);
  return k.done();
}
const i_green = (t: number) => (t < 0.5 ? '#4f9a63' : '#3f8656');

/** An open motor boat under a tarpaulin. */
export function sloep(o: { len: number; hull: string; trim: string; tarp: string; quay: number }) {
  const k = kit();
  const L = o.len / 2;
  const b = 0.95;
  const h = 0.7;
  openHull(k, { L, b, h, hull: o.hull, trim: o.trim, wall: 0.1 }, 0.4);
  k.ball(1, 0.12 * L, h - 0.02, 0, o.tarp, { sx: L * 0.6, sy: 0.3, sz: b - 0.04 });
  for (const x of [-0.25 * L, 0.12 * L, 0.5 * L]) k.box(0.05, 0.02, 2 * half(L, b, x) + 0.06, x, h + 0.075, 0, ROPE);
  k.box(0.36, 0.06, 2 * half(L - 0.1, b - 0.1, -L + 0.6) - 0.04, -L + 0.6, 0.6, 0, WOOD);
  outboard(k, L, h);
  fenders(k, [-0.3 * L], h - 0.25, b);
  moor(k, L, b, h, o.quay, 2.15);
  return k.done();
}

/** A rowing boat with the oars shipped. */
export function rowBoat(o: { hull: string; trim: string; quay: number }) {
  const k = kit();
  const L = 1.8;
  const b = 0.72;
  const h = 0.58;
  openHull(k, { L, b, h, hull: o.hull, trim: o.trim, wall: 0.08 }, 0.38);
  for (const x of [-0.9, 0.1]) k.box(0.3, 0.05, 2 * half(L - 0.08, b - 0.08, x + 0.15) - 0.02, x, 0.5, 0, WOOD);
  for (const s of [-1, 1]) {
    k.rod([-L + 0.35, 0.56, s * 0.22], [L - 0.75, 0.6, s * 0.3], 0.025, WOOD);
    k.box(0.5, 0.03, 0.14, -L + 0.55, 0.56, s * 0.22, o.trim);
  }
  moor(k, L, b, h, o.quay, 1.6);
  return k.done();
}

/** A kayak with someone paddling. */
export function kayak(seed: number, col: string) {
  const k = kit();
  const crew = [rider(seed, 'paddle', [-0.2, 0.44, 0], Math.PI / 2, 0.7)];
  k.ball(1, 0, 0.38, 0, col, { sx: 2.0, sy: 0.19, sz: 0.36 });
  k.box(1.1, 0.02, 0.05, 1.05, 0.56, 0, shade(col, 0.7));
  k.put(new THREE.TorusGeometry(0.27, 0.035, 6, 14), -0.12, 0.555, 0, DARK, { rx: Math.PI / 2, sy: 0.85 });
  return { g: k.done(), crew };
}

/**
 * The boat you are in. From your place you only ever see the last few metres of the bow, so that is where the
 * small things are: planks, a rail, a cleat with a coil of rope, a life ring, and a lamp that is lit at night.
 * The rest is seen from above when the camera comes down into the boat: benches, the others on board, the skipper.
 * The tip of the bow is at x = 0, the deck at y = 0, your own place at x = -`ahead`; the water lies `draft` below the deck.
 */
export function ownBoat(ahead: number, draft: number) {
  const k = kit();
  const crew: Rider[] = [];
  const L = 3.2;
  const b = 1.15;
  const tail = 4.2;
  const stern = -2 * L - tail;
  const deck = '#e4d6b4';
  const hull = '#7a4a35';
  const g = kit();
  slab(g, L, b, draft + 0.4, -draft - 0.4, hull, tail);
  ring(g, L + 0.02, b + 0.02, L - 0.05, b - 0.05, 0.75, -draft - 0.4, '#5a2f2a', tail); // below the water line
  ring(g, L + 0.03, b + 0.03, L - 0.05, b - 0.05, 0.1, -draft + 0.35, palette.cream, tail);
  ring(g, L + 0.03, b + 0.03, L - 0.05, b - 0.05, 0.12, -0.34, palette.cream, tail);
  slab(g, L - 0.12, b - 0.12, 0.05, -0.035, deck, tail);
  ring(g, L + 0.05, b + 0.05, L - 0.16, b - 0.16, 0.1, -0.02, '#5a3b2e', tail);
  k.join(moved(g.done(), -L, 0, 0));
  const wide = (x: number, inset = 0.16) => half(L - inset, b - inset, x + L, tail);
  // planks, each one stopping where the bow narrows
  for (let z = -0.84; z < 0.85; z += 0.21) {
    let lo = 0.25 * L;
    let hi = L;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (half(L - 0.16, b - 0.16, mid) > Math.abs(z) + 0.02) lo = mid;
      else hi = mid;
    }
    const from = stern + 0.5;
    k.box(lo - L - from, 0.006, 0.018, (lo - L + from) / 2, 0.017, z, shade(deck, 0.68));
  }
  lantern(k, -0.32, 0, 0, 0.26);
  k.box(0.07, 0.05, 0.3, -0.85, 0.11, 0, palette.gold);
  for (const z of [-0.07, 0.07]) k.box(0.05, 0.1, 0.05, -0.85, 0.05, z, palette.gold);
  for (const [rad, y] of [[0.2, 0.035], [0.15, 0.085], [0.1, 0.13]]) k.put(new THREE.TorusGeometry(rad, 0.035, 6, 16), -1.35, y, -0.38, ROPE, { rx: Math.PI / 2 });
  k.rod([-0.85, 0.07, -0.05], [-1.2, 0.04, -0.3], 0.03, ROPE);
  lifeRing(k, -1.45, 0.05, 0.42, { rx: Math.PI / 2 });

  // portholes of the cabin below deck, lit at night
  for (let x = -L + 0.4; x > stern + 1.6; x -= 1.25) {
    for (const s of [-1, 1]) {
      k.tube(0.2, 0.2, 0.05, x, -1.05, s * (b + 0.005), palette.gold, { rx: Math.PI / 2 });
      k.tube(0.15, 0.15, 0.07, x, -1.05, s * (b + 0.005), palette.glass, { rx: Math.PI / 2, glow: 1.2 });
    }
  }
  // Behind you: your own bench, then the others, and the skipper at the tiller. None of it is in view from your place.
  const bench = (x: number) => {
    const w = wide(x);
    k.box(0.4, 0.06, 2 * w - 0.1, x, 0.4, 0, WOOD);
    for (const s of [-1, 1]) k.box(0.3, 0.37, 0.06, x, 0.185, s * (w - 0.3), shade(WOOD, 0.75));
    return w;
  };
  bench(-ahead - 0.15);
  let who = 71;
  for (const [x, seats] of [[-ahead - 1.5, [-1, 1]], [-ahead - 2.7, [1]], [-ahead - 3.9, [-1, 1]]] as const) {
    const w = bench(x);
    for (const s of seats) crew.push(rider(who++, 'sit', [x - 0.04, 0.43, s * w * 0.5], Math.PI / 2, 0.6));
  }
  crew.push(rider(who++, 'stand', [stern + 1.15, 0.03, 0.25], Math.PI / 2, 0.6));
  // tiller and outboard
  k.rod([stern + 0.95, 0.95, 0.05], [stern + 0.1, 0.75, 0], 0.03, WOOD);
  k.box(0.4, 0.6, 0.46, stern - 0.12, 0.25, 0, DARK);
  k.box(0.42, 0.09, 0.48, stern - 0.12, 0.57, 0, WHITE);
  k.box(0.12, draft + 0.5, 0.12, stern - 0.16, -draft / 2 - 0.2, 0, DARK);
  flag(k, stern + 0.25, 0.03, -(b * 0.82 - 0.3));
  lantern(k, stern + 0.3, 0.03, b * 0.82 - 0.3, 0.9);
  for (const s of [-1, 1]) {
    lifeRing(k, stern + 2.2, -0.62, s * (b + 0.09));
    for (const x of [-L - 1.2, stern + 3.6]) {
      k.tube(0.1, 0.1, 0.42, x, -0.75, s * (b + 0.13), WHITE);
      k.rod([x, -0.54, s * (b + 0.13)], [x, 0.02, s * (b + 0.02)], 0.015, ROPE);
    }
  }
  return { g: k.done(), crew };
}
