import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from './houses';

// The people, built the way the characters in Messenger are: a few smooth, closed surfaces instead of
// boxes and balls. Each surface is lofted through a row of rings (oval cross-sections). Clothes are shells
// whose openings hide the joints underneath; the face is drawn flat on a thin copy of the front of the
// head, so it stays crisp instead of turning into ink blobs.
//
// A figure comes apart at its joints (torso, head, upper arm, forearm, thigh, shin, foot), so the same
// pieces can walk (People.tsx), stand, or sit on the quay and in the boats (folk.ts).

export type G = THREE.BufferGeometry;
type V = [number, number, number];
/** A cross-section: centre, half-width (rx), half-depth (rz) and how boxy it is (e: 2 oval, higher squarer). */
type Ring = { p: V; rx: number; rz: number; e?: number };
type End = 'round' | 'flat' | 'open';
type Opt = { seg?: number; plane?: 'xz' | 'xy'; ref?: V; start?: End; end?: End; bulge?: number; smooth?: number };

/** The patterns the shader knows (see `fabric` in toon.ts). 18 and up is the face. */
const FAB = { none: 0, knit: 8, checks: 9, denim: 10, dots: 11, hair: 12, tweed: 13, cord: 14, stripes: 15 } as const;
const FACE = 18;
// Every pattern repeats within this length, so a sleeve closes without a visible seam.
const WRAP = 0.12;

const vec = (p: V) => new THREE.Vector3(p[0], p[1], p[2]);
const pow = (c: number, e: number) => Math.sign(c) * Math.abs(c) ** (2 / e);
export const shade = (col: string, k: number) => '#' + new THREE.Color(col).multiplyScalar(k).getHexString();

// Fewer segments for figures that are only ever seen from far away (the boats).
let quality = 1;

/** Extra rings between the given ones (Catmull-Rom), so the outline curves instead of kinking. */
function refine(r: Ring[], k: number): Ring[] {
  if (k <= 1 || r.length < 3) return r;
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const out: Ring[] = [];
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[Math.max(0, i - 1)], b = r[i], c = r[i + 1], d = r[Math.min(r.length - 1, i + 2)];
    for (let s = 0; s < k; s++) {
      const f = (g: (x: Ring) => number) => cr(g(a), g(b), g(c), g(d), s / k);
      out.push({
        p: [f((x) => x.p[0]), f((x) => x.p[1]), f((x) => x.p[2])],
        rx: Math.max(0.002, f((x) => x.rx)),
        rz: Math.max(0.002, f((x) => x.rz)),
        e: f((x) => x.e ?? 2),
      });
    }
  }
  out.push(r[r.length - 1]);
  return out;
}

function mesh(pos: number[], idx: number[], uv?: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const flip = (idx: number[]) => {
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
};
/** The first and last column of a ring sit on the same spot (for the pattern's sake); give them one normal. */
function weld(g: G, rows: number, cols: number) {
  const n = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < rows; i++) {
    const a = i * cols, b = a + cols - 1;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
}

/**
 * A smooth surface through the rings, with surface coordinates in metres for the cloth patterns.
 * Round ends close with a dome; flat ends come back as separate lids.
 */
function loft(rings0: Ring[], o: Opt = {}) {
  const rings = refine(rings0, Math.max(1, Math.round((o.smooth ?? 3) * Math.min(1, quality + 0.2))));
  const S = Math.max(6, Math.round((o.seg ?? 20) * quality));
  const R = rings.length;
  const C = S + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const T: THREE.Vector3[] = [];
  const first = vec(rings[0].p), last = vec(rings[R - 1].p);
  const avg = rings.reduce((s, r) => s + (r.rx + r.rz) / 2, 0) / R;
  const U = Math.max(1, Math.round((2 * Math.PI * avg) / WRAP)) * WRAP;
  let along = 0;
  const alongs: number[] = [];
  for (let i = 0; i < R; i++) {
    const r = rings[i];
    if (i) along += vec(r.p).distanceTo(vec(rings[i - 1].p));
    alongs.push(along);
    let t: THREE.Vector3, n1: THREE.Vector3, n2: THREE.Vector3;
    if (o.plane) {
      const axis = o.plane === 'xz' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      t = axis.multiplyScalar(Math.sign(last.clone().sub(first).dot(axis)) || 1);
      n1 = new THREE.Vector3(1, 0, 0);
      n2 = o.plane === 'xz' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    } else {
      t = vec(rings[Math.min(R - 1, i + 1)].p).sub(vec(rings[Math.max(0, i - 1)].p)).normalize();
      let ref = vec(o.ref ?? [1, 0, 0]);
      if (Math.abs(ref.dot(t)) > 0.95) ref = new THREE.Vector3(0, 0, 1);
      n1 = ref.sub(t.clone().multiplyScalar(ref.dot(t))).normalize();
      n2 = new THREE.Vector3().crossVectors(t, n1);
    }
    T.push(t);
    for (let j = 0; j <= S; j++) {
      const a = ((j % S) / S) * Math.PI * 2;
      const cx = r.rx * pow(Math.cos(a), r.e ?? 2), cz = r.rz * pow(Math.sin(a), r.e ?? 2);
      pos.push(r.p[0] + n1.x * cx + n2.x * cz, r.p[1] + n1.y * cx + n2.y * cz, r.p[2] + n1.z * cx + n2.z * cz);
      uv.push((j / S) * U, along);
    }
  }
  for (let i = 0; i < R - 1; i++)
    for (let j = 0; j < S; j++) {
      const a = i * C + j, b = a + 1, c = a + C, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const lids: { pos: number[]; idx: number[] }[] = [];
  const cap = (i: number, sign: number, kind: End) => {
    if (kind === 'open') return;
    const r = rings[i];
    const b = o.bulge ?? 0.5 * Math.min(r.rx, r.rz);
    const ring = (k: number) => i * C + k;
    if (kind === 'round') {
      const P = pos.length / 3;
      const t = T[i];
      pos.push(r.p[0] + t.x * b * sign, r.p[1] + t.y * b * sign, r.p[2] + t.z * b * sign);
      uv.push(U / 2, alongs[i] + b * sign);
      for (let j = 0; j < S; j++) {
        if (sign < 0) idx.push(P, ring(j), ring(j + 1));
        else idx.push(ring(j), P, ring(j + 1));
      }
    } else {
      const lp: number[] = [r.p[0], r.p[1], r.p[2]];
      const li: number[] = [];
      for (let j = 0; j < S; j++) lp.push(pos[ring(j) * 3], pos[ring(j) * 3 + 1], pos[ring(j) * 3 + 2]);
      for (let j = 0; j < S; j++) {
        const j1 = (j + 1) % S;
        if (sign < 0) li.push(0, 1 + j, 1 + j1);
        else li.push(1 + j, 0, 1 + j1);
      }
      lids.push({ pos: lp, idx: li });
    }
  };
  cap(0, -1, o.start ?? 'round');
  cap(R - 1, 1, o.end ?? 'round');
  // make the faces point outwards
  let g = mesh(pos, idx, uv);
  const m = Math.floor(R / 2) * C;
  const n = g.attributes.normal;
  const out = vec([pos[m * 3], pos[m * 3 + 1], pos[m * 3 + 2]]).sub(vec(rings[Math.floor(R / 2)].p));
  const inward = out.dot(new THREE.Vector3(n.getX(m), n.getY(m), n.getZ(m))) < 0;
  if (inward) {
    flip(idx);
    g = mesh(pos, idx, uv);
  }
  weld(g, R, C);
  return {
    body: g,
    lids: lids.map((l) => {
      if (inward) flip(l.idx);
      return mesh(l.pos, l.idx);
    }),
    ends: [vec(rings[0].p), vec(rings[R - 1].p)],
    dirs: [T[0], T[R - 1]],
  };
}

/**
 * Colour and the toon shader's attributes. Keeps the normals, so the surface stays smooth, and keeps shared
 * corners shared: a person is animated on the graphics card, corner by corner, so every copy costs.
 */
function coat(g0: G, col: string, mat = 0, uvAt?: (x: number, y: number, z: number) => [number, number]) {
  const g = g0.clone();
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  const p = g.attributes.position;
  const n = p.count;
  const c = new THREE.Color(col in palette ? palette[col as keyof typeof palette] : col);
  const colors = new Float32Array(n * 3);
  const at = new Float32Array(n * 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < n; i++) {
    colors.set([c.r, c.g, c.b], i * 3);
    if (uvAt) at.set(uvAt(p.getX(i), p.getY(i), p.getZ(i)), i * 2);
    else if (uv) at.set([uv.getX(i), uv.getY(i)], i * 2);
  }
  if (uv) g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n).fill(mat), 1));
  g.setAttribute('aUv', new THREE.BufferAttribute(at, 2));
  return g;
}

/** Collects coloured pieces into one geometry. */
function pieces() {
  const parts: G[] = [];
  const add = (g: G, col: string, mat = 0) => void parts.push(coat(g, col, mat));
  const part = (rings: Ring[], col: string, o: Opt = {}, mat = 0, lid?: string) => {
    const l = loft(rings, o);
    add(l.body, col, mat);
    for (const g of l.lids) add(g, lid ?? shade(col, 0.55));
    return l;
  };
  return { parts, add, part, done: () => mergeGeometries(parts, false)! };
}

/** A thin ring, lying across `dir` at `at`: the trim on a collar or a sleeve, the band round a bun. */
function trim(at: THREE.Vector3, dir: THREE.Vector3, r: number, tube: number, sx = 1, sy = 1) {
  const g = new THREE.TorusGeometry(r, tube, 6, Math.max(12, Math.round(28 * quality)));
  g.scale(sx, sy, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
  g.translate(at.x, at.y, at.z);
  return g;
}

/** A flat band around the body from one shoulder to the opposite hip: the strap of a bag. */
function strap(c: V, along: V, a: number, b: number) {
  const U = vec(along).normalize(), W = new THREE.Vector3(0, 0, 1);
  const N = new THREE.Vector3().crossVectors(U, W);
  const S = Math.max(24, Math.round(64 * quality)), K = 8;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < S; i++) {
    const t = (i / S) * Math.PI * 2;
    const out = U.clone().multiplyScalar(Math.cos(t) / a).add(W.clone().multiplyScalar(Math.sin(t) / b)).normalize();
    const p = vec(c).add(U.clone().multiplyScalar(a * Math.cos(t))).add(W.clone().multiplyScalar(b * Math.sin(t)));
    for (let k = 0; k < K; k++) {
      const q = (k / K) * Math.PI * 2;
      const o = out.clone().multiplyScalar(0.005 * pow(Math.cos(q), 6)).add(N.clone().multiplyScalar(0.018 * pow(Math.sin(q), 6)));
      pos.push(p.x + o.x, p.y + o.y, p.z + o.z);
    }
  }
  for (let i = 0; i < S; i++)
    for (let k = 0; k < K; k++) {
      const A = i * K + k, B = i * K + ((k + 1) % K), C = ((i + 1) % S) * K + k, D = ((i + 1) % S) * K + ((k + 1) % K);
      idx.push(A, C, B, B, C, D);
    }
  let g = mesh(pos, idx);
  const n = g.attributes.normal;
  const p0 = vec([pos[0], pos[1], pos[2]]).sub(vec(c).add(U.clone().multiplyScalar(a)));
  if (p0.dot(new THREE.Vector3(n.getX(0), n.getY(0), n.getZ(0))) < 0) {
    flip(idx);
    g = mesh(pos, idx);
  }
  return g;
}

/* ---------------- The skeleton ---------------- */

// Heights of the joints of someone standing, and the lengths between them.
export const HIP = 0.84;
export const SHOULDER = 1.22;
export const NECK = 1.31;
export const THIGH = 0.37; // hip to knee
export const SHIN = 0.375; // knee to ankle
export const ANKLE = 0.095; // ankle to the ground
export const UPPER = 0.22; // shoulder to elbow
export const FORE = 0.2; // elbow to wrist
export const LEG_X = 0.088;
export const CHIN = NECK + 0.04;

/** What the animation needs to know about the skeleton. Heights of shoulder and neck are measured from the hip. */
export const RIG = { hip: HIP, legX: LEG_X, thigh: THIGH, shin: SHIN, ankle: ANKLE, heel: 0.08, toe: 0.18, upper: UPPER, shoulder: SHOULDER - HIP, neck: NECK - HIP };

/* ---------------- The head ---------------- */

// Height above the chin, half-width, half-depth, and how far the section sits forward. The face is flat-ish
// and forward, the skull rounds off behind it.
const SKULL: [number, number, number, number][] = [
  [0.0, 0.032, 0.02, 0.05],
  [0.012, 0.056, 0.042, 0.042],
  [0.035, 0.079, 0.08, 0.018],
  [0.07, 0.093, 0.102, 0.004],
  [0.11, 0.098, 0.112, 0.0],
  [0.15, 0.101, 0.118, -0.006],
  [0.19, 0.099, 0.117, -0.01],
  [0.225, 0.09, 0.106, -0.012],
  [0.25, 0.072, 0.085, -0.012],
  [0.266, 0.045, 0.054, -0.011],
  [0.274, 0.02, 0.024, -0.01],
];
function skullAt(y: number) {
  const k = SKULL.findIndex((r) => r[0] >= y);
  if (k <= 0) {
    const r = SKULL[k < 0 ? SKULL.length - 1 : 0];
    return { rx: r[1], rz: r[2], cz: r[3] };
  }
  const a = SKULL[k - 1], b = SKULL[k];
  const t = (y - a[0]) / (b[0] - a[0]);
  return { rx: a[1] + (b[1] - a[1]) * t, rz: a[2] + (b[2] - a[2]) * t, cz: a[3] + (b[3] - a[3]) * t };
}

/** The front of the head again, a hair's breadth further out, with the face drawn on it in metres from between the eyes. */
function faceDecal(head: G, eyeY: number, skin: string, look: number) {
  const p = head.attributes.position, n = head.attributes.normal, ix = head.index!;
  const pos: number[] = [];
  const nrm: number[] = [];
  for (let i = 0; i < ix.count; i += 3) {
    const v = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    if (!v.every((k) => n.getZ(k) > 0.3 && p.getY(k) > eyeY - 0.115 && p.getY(k) < eyeY + 0.08)) continue;
    for (const k of v) {
      pos.push(p.getX(k) + n.getX(k) * 0.0012, p.getY(k) + n.getY(k) * 0.0012, p.getZ(k) + n.getZ(k) * 0.0012);
      nrm.push(n.getX(k), n.getY(k), n.getZ(k));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return coat(g, skin, FACE + look, (x, y) => [x, y - eyeY]);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const tri = (u: number) => 1 - 2 * Math.abs((((u % 1) + 1) % 1) - 0.5);

/* ---------------- Skinning ---------------- */

/** For a point of the body: two bones and how much of it goes to the second. */
type Weigh = (p: THREE.Vector3) => [number, number, number];

/**
 * Weights along a chain of joints (a limb, the spine). Bone k owns the stretch from joint k to joint k + 1;
 * around each joint the two neighbours share over `r` metres, so the joint bends instead of breaking.
 * Before the first joint the body belongs to `lead` (the parent: the pelvis for a leg, the collarbone for an arm).
 */
function chain(pts: THREE.Vector3[], bones: number[], r: number, lead = -1): Weigh {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const seg = new THREE.Vector3(), q = new THREE.Vector3();
  return (p) => {
    let best = Infinity, u = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      seg.subVectors(pts[i + 1], pts[i]);
      const L = seg.length();
      seg.divideScalar(L);
      const s = q.subVectors(p, pts[i]).dot(seg);
      const sc = Math.min(i === pts.length - 2 ? Infinity : L, Math.max(i === 0 ? -Infinity : 0, s));
      const dist = q.subVectors(p, pts[i]).addScaledVector(seg, -sc).length();
      if (dist < best) {
        best = dist;
        u = d[i] + sc;
      }
    }
    for (let k = 0; k < pts.length; k++) {
      const before = k === 0 ? lead : bones[k - 1];
      if (before >= 0 && Math.abs(u - d[k]) < r) return [before, bones[k], smoothstep(d[k] - r, d[k] + r, u)];
    }
    if (u < d[0]) return lead >= 0 ? [lead, lead, 0] : [bones[0], bones[0], 0];
    let k = 0;
    while (k < pts.length - 1 && u >= d[k + 1]) k++;
    return [bones[k], bones[k], 0];
  };
}

/** Up to four bones and their shares, for the few places two bones are not enough (a skirt over both legs). */
type WeighN = (p: THREE.Vector3) => [number, number][];

function weigh(g: G, w: Weigh | WeighN, many = false) {
  const p = g.attributes.position;
  const n = p.count;
  const idx = new Uint16Array(n * 4);
  const wt = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    if (many) {
      (w as WeighN)(v).slice(0, 4).forEach(([b, k], j) => {
        idx[i * 4 + j] = b;
        wt[i * 4 + j] = k;
      });
      continue;
    }
    const [a, b, t] = (w as Weigh)(v);
    idx[i * 4] = a;
    idx[i * 4 + 1] = b;
    wt[i * 4] = 1 - t;
    wt[i * 4 + 1] = t;
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
  return g;
}

/**
 * A shell over the skull, from the crown down to `line(a)` (height above the chin at angle a; a = π/2 is the
 * front). `th` is how far it stands off the skin; the last row tucks back in. With `hang`, below the ears
 * it falls straight down instead of following the jaw: a bob, long hair.
 */
function shell(line: (a: number) => number, th: (a: number, u: number) => number, hang = false) {
  const S = Math.max(24, Math.round(64 * quality)), T = Math.max(8, Math.round(16 * quality)), top = 0.274;
  const mid = 0.13;
  const out = (x: number, y: number, z: number, d: number) => {
    const o = new THREE.Vector3(0, Math.min(y, CHIN + mid), -0.01);
    const v = new THREE.Vector3(x, y, z).sub(o);
    return v.multiplyScalar(1 + d / v.length()).add(o);
  };
  const crown = out(0, CHIN + 0.284, -0.01, th(Math.PI / 2, 0));
  const pos: number[] = [crown.x, crown.y, crown.z];
  const idx: number[] = [];
  for (let i = 1; i <= T; i++) {
    const u = i / T;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const y = top + (line(a) - top) * u ** 0.9;
      const k = skullAt(hang ? Math.max(y, 0.115) : y);
      const q = out(k.rx * Math.cos(a), CHIN + y, k.cz + k.rz * Math.sin(a), i === T ? -0.004 : th(a, u));
      pos.push(q.x, q.y, q.z);
    }
  }
  const at = (i: number, j: number) => 1 + (i - 1) * S + (j % S);
  for (let j = 0; j < S; j++) idx.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < T; i++)
    for (let j = 0; j < S; j++) idx.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
  let g = mesh(pos, idx);
  const m = at(Math.floor(T / 2), 0), n = g.attributes.normal;
  if (n.getX(m) < 0) {
    flip(idx);
    g = mesh(pos, idx);
  }
  return g;
}

type Hairdo = 'crop' | 'bun' | 'bob' | 'long' | 'pony' | 'buzz' | 'curly' | 'beanie' | 'cap' | 'captain';

/** Where the hair starts: low at the nape, above the ears at the sides, the forehead in front. */
const hairline = (front: number, side: number, nape: number) => (a: number) => {
  const s = Math.sin(a);
  return s >= 0 ? side + (front - side) * s : side + (side - nape) * s;
};
/** A few heavy locks over the forehead, parted a little off-centre. */
const locks = (depth: number, n = 2.3, part = 0.18) => (a: number) => depth * tri(Math.cos(a) * n + part) ** 1.4 * smoothstep(0.3, 0.75, Math.sin(a));

/** Hinged at the neck, which sits at the origin. */
function head(o: { skin: string; hair: string; hairdo: Hairdo; hat: string; look: number; wide: number }) {
  const k = pieces();
  const EYE = CHIN + 0.125;
  const skull = loft(
    SKULL.map(([y, rx, rz, cz]) => ({ p: [0, CHIN + y, cz] as V, rx: rx * o.wide, rz, e: 2.25 })),
    { plane: 'xz', seg: 28, smooth: 3, bulge: 0.016 },
  );
  k.add(skull.body, o.skin);
  k.parts.push(faceDecal(skull.body, EYE, o.skin, o.look));
  k.part([{ p: [0, NECK - 0.08, -0.012], rx: 0.041, rz: 0.043 }, { p: [0, NECK + 0.02, -0.014], rx: 0.041, rz: 0.043 }, { p: [0, CHIN + 0.07, -0.02], rx: 0.043, rz: 0.045 }], o.skin, { seg: 14 });

  const hanging = o.hairdo === 'bob' || o.hairdo === 'long';
  if (!hanging)
    for (const s of [-1, 1]) {
      const ear = new THREE.SphereGeometry(1, 10, 8);
      ear.scale(0.011, 0.025, 0.018);
      ear.rotateZ(s * -0.12);
      const e = skullAt(0.115);
      ear.translate(s * (e.rx * o.wide + 0.002), CHIN + 0.115, -0.012);
      k.add(ear, o.skin);
    }

  const hair = (line: (a: number) => number, th: (a: number, u: number) => number, hang = false) => {
    const g = shell(line, th, hang);
    g.scale(o.wide, 1, 1);
    k.add(g, o.hair);
  };
  const plain = (d: number) => (a: number, u: number) => d + 0.006 * (1 - u) + 0.005 * Math.max(0, Math.sin(a));
  const short = hairline(0.205, 0.15, 0.075);
  const cropped = (a: number) => short(a) - locks(0.032, 3.1, 0.3)(a);

  switch (o.hairdo) {
    case 'crop':
      hair(cropped, plain(0.02));
      break;
    case 'buzz':
      hair(hairline(0.215, 0.15, 0.07), (a, u) => 0.008 + 0.004 * (1 - u));
      break;
    case 'curly': {
      // a mass of curls: thick, with lumps all round
      const lump = (a: number, u: number) => 0.03 + 0.012 * Math.sin(a * 9) * Math.sin(u * 9 + a * 3);
      hair((a) => hairline(0.2, 0.13, 0.06)(a) - locks(0.012, 4.2, 0.1)(a), lump);
      break;
    }
    case 'bun':
    case 'pony': {
      const line = (a: number) => hairline(0.213, 0.145, 0.055)(a) - locks(0.042)(a);
      hair(line, plain(0.017));
      const e = skullAt(o.hairdo === 'bun' ? 0.235 : 0.19);
      const base = new THREE.Vector3(0, CHIN + (o.hairdo === 'bun' ? 0.235 : 0.19), e.cz - e.rz - 0.018);
      if (o.hairdo === 'bun') {
        const d = new THREE.Vector3(0, 0.55, -1).normalize();
        const bun = new THREE.SphereGeometry(0.046, Math.max(8, Math.round(16 * quality)), Math.max(6, Math.round(12 * quality)));
        bun.scale(1, 0.95, 0.9);
        const c = base.clone().addScaledVector(d, 0.034);
        bun.translate(c.x, c.y, c.z);
        k.add(bun, o.hair);
        k.add(trim(base.clone().addScaledVector(d, 0.006), d, 0.028, 0.008), o.hat);
      } else {
        const z = base.z;
        k.part(
          [
            { p: [0, base.y + 0.01, z + 0.01], rx: 0.03, rz: 0.03 },
            { p: [0, base.y - 0.03, z - 0.035], rx: 0.036, rz: 0.034 },
            { p: [0, base.y - 0.12, z - 0.05], rx: 0.03, rz: 0.028 },
            { p: [0, base.y - 0.21, z - 0.03], rx: 0.016, rz: 0.016 },
          ],
          o.hair,
          { seg: 12, bulge: 0.012 },
        );
        k.add(trim(new THREE.Vector3(0, base.y - 0.012, z - 0.022), new THREE.Vector3(0, 0.7, -0.7), 0.03, 0.008), o.hat);
      }
      break;
    }
    case 'bob':
    case 'long': {
      // a blunt fringe in front, falling straight at the sides and the back
      const fall = o.hairdo === 'bob' ? 0.03 : -0.13;
      const front = (a: number) => 0.2 - (o.hairdo === 'bob' ? 0.035 * smoothstep(0.3, 0.6, Math.sin(a)) : locks(0.04, 1.6, 0.25)(a));
      hair((a) => fall + (front(a) - fall) * smoothstep(0.26, 0.44, Math.sin(a)), plain(0.02), true);
      break;
    }
    case 'beanie':
    case 'cap':
    case 'captain': {
      // under a hat the hair stays well inside it, or the two fight over the same spot at the crown
      hair(short, (a, u) => 0.007 + 0.004 * Math.max(0, Math.sin(a)) * u);
      const knit = o.hairdo === 'beanie';
      const lift = knit ? 0.16 : 0.19;
      const hat = shell(hairline(lift + 0.005, lift, lift - 0.03), () => (knit ? 0.032 : 0.024));
      hat.scale(o.wide, 1, 1);
      k.add(hat, o.hairdo === 'captain' ? '#f1efe6' : o.hat, knit ? FAB.knit : 0);
      if (knit) {
        // the turned-up brim
        const e = skullAt(lift + 0.02);
        k.part(
          [
            { p: [0, CHIN + lift - 0.005, e.cz - 0.002], rx: (e.rx + 0.04) * o.wide, rz: e.rz + 0.04 },
            { p: [0, CHIN + lift + 0.045, e.cz - 0.002], rx: (e.rx + 0.036) * o.wide, rz: e.rz + 0.036 },
          ],
          shade(o.hat, 0.85),
          { plane: 'xz', seg: 32, smooth: 1, start: 'open', end: 'open' },
          FAB.knit,
        );
        if (o.look % 2) {
          const pom = new THREE.SphereGeometry(0.04, 10, 8);
          pom.translate(0, CHIN + 0.32, -0.015);
          k.add(pom, '#f1efe6');
        }
      } else {
        // the peak
        const e = skullAt(0.2);
        const peak = loft(
          [
            { p: [0, CHIN + 0.203, e.cz + e.rz + 0.02], rx: 0.085 * o.wide, rz: 0.055, e: 2.4 },
            { p: [0, CHIN + 0.211, e.cz + e.rz + 0.02], rx: 0.085 * o.wide, rz: 0.055, e: 2.4 },
          ],
          { plane: 'xz', seg: 24, smooth: 1, bulge: 0.003 },
        );
        k.add(peak.body, o.hairdo === 'captain' ? '#26262b' : shade(o.hat, 0.8));
        if (o.hairdo === 'captain') {
          const b = skullAt(0.21);
          k.part(
            [
              { p: [0, CHIN + 0.2, b.cz], rx: (b.rx + 0.026) * o.wide, rz: b.rz + 0.026 },
              { p: [0, CHIN + 0.218, b.cz], rx: (b.rx + 0.025) * o.wide, rz: b.rz + 0.025 },
            ],
            '#26262b',
            { plane: 'xz', seg: 32, smooth: 1, start: 'open', end: 'open' },
          );
        }
      }
      break;
    }
  }
  const g = k.done();
  g.translate(0, -NECK, 0);
  return g;
}

/* ---------------- Everyone ---------------- */

const TOPS = ['#b8473f', palette.terracotta, palette.shutterBlue, palette.ochre, palette.shutterGreen, '#e8e0cf', '#3c4a6b', '#d98b8b', '#6b5b8a', '#e6c15a', palette.slate, '#3f6f8f', '#26262b'];
const BOTTOMS = ['#3a3a3f', '#6b5a48', '#7d8468', '#d9d2c0', '#cbb68c', '#5a4a3a'];
const JEANS = ['#2f3b52', '#40566b', '#56708a'];
const HAIR = ['#2b2320', '#2e2624', '#4a3426', '#7a4b2a', '#c9a15a', '#b5532e', '#1c1c22', '#e0c590'];
const GREY = ['#c9c6bd', '#9a9a96', '#e4e0d6'];
const SKIN = ['#f0c9a5', '#e6b994', '#d9a47e', '#a8714f', '#f3d6bd', '#7d5238', '#c48a62'];
const WHITE = '#f4f1e6';
const DARK = '#26262b';

export type Kind = 'tee' | 'stripes' | 'jacket' | 'hoodie' | 'coat' | 'dress';
export type Hold = 'none' | 'phone' | 'cup';
export type Wish = { kinds?: Kind[]; captain?: boolean; lod?: number };

/** A body and clothes made in Blender, skinned to the actor's skeleton (bone indices already the actor's). */
export type Made = Record<string, G>;

/** For people: neighbouring seeds give unrelated picks. */
function dice(seed: number) {
  let a = Math.imul(Math.round(seed) + 0x9e37, 0x9e3779b1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One person: clothes, hair, build and things, decided by the seed. Each piece is built around its joint:
 * torso (feet on y = 0, facing +z), head (hinged at the neck), upper arm, forearm, thigh, shin and foot.
 */
export function figure(seed: number, wish: Wish = {}) {
  const r = dice(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const kind: Kind = wish.captain ? 'jacket' : pick(wish.kinds ?? (['tee', 'tee', 'tee', 'stripes', 'jacket', 'hoodie', 'coat', 'dress'] as const));
  const top = wish.captain ? '#2f3b52' : pick(TOPS);
  const accent = pick(TOPS.filter((c) => c !== top && c !== DARK));
  const skin = pick(SKIN);
  const child = !wish.captain && r() < 0.12;
  const old = !wish.captain && !child && r() < 0.18;
  const hairCol = old ? pick(GREY) : pick(HAIR);
  const hairdo: Hairdo = wish.captain
    ? 'captain'
    : pick(old ? (['buzz', 'crop', 'bob', 'cap', 'beanie'] as const) : (['crop', 'crop', 'bun', 'bun', 'bob', 'bob', 'long', 'long', 'pony', 'curly', 'curly', 'beanie', 'cap'] as const));
  const long = kind === 'coat' || kind === 'dress';
  const legs = long ? 'none' : wish.captain ? 'trousers' : pick(['shorts', 'trousers', 'trousers', 'trousers', 'skirt'] as const);
  const jeans = legs === 'trousers' && r() < 0.55;
  const bottom = wish.captain ? '#2f3b52' : jeans ? pick(JEANS) : pick(BOTTOMS);
  const legCloth = jeans ? FAB.denim : legs === 'trousers' ? pick([FAB.none, FAB.none, FAB.cord]) : FAB.none;
  const skirtCloth = pick([FAB.none, FAB.checks, FAB.cord]);
  const shortSleeves = kind === 'tee' || (kind === 'dress' && r() < 0.6);
  const bareLegs = legs === 'shorts' || ((legs === 'skirt' || kind === 'dress') && r() < 0.6);
  const tights = !bareLegs && (legs === 'skirt' || kind === 'dress');
  const socks = pick([WHITE, WHITE, WHITE, DARK, accent]);
  const shoeKind = wish.captain ? 'shoe' : pick(['sneaker', 'sneaker', 'sneaker', 'boot', 'shoe'] as const);
  const shoe = { sneaker: pick(['#2f5e4e', '#b8473f', '#f1efe6', '#2a2a2e', '#3c4a6b', '#e6c15a']), boot: pick(['#5a3b2a', '#2a2a2e', '#7a4a35']), shoe: pick(['#2a2a2e', '#5a3b2a']) }[shoeKind];
  const sole = shoeKind === 'sneaker' ? (shoe === '#f1efe6' ? '#c9a878' : '#efe9da') : '#2a2220';
  const extra = wish.captain || child ? 'none' : pick(['bag', 'bag', 'pack', 'scarf', 'none', 'none', 'none'] as const);
  const bagCol = pick(['#8a5a3c', DARK, accent, '#cdbf9c']);
  const packCol = pick([accent, DARK, '#7d8468', '#b8473f']);
  const scarfCol = pick([accent, '#b8473f', '#e6c15a', WHITE]);
  const size = child ? 0.7 : 0.93 + r() * 0.12;
  const wide = wish.captain ? 1.04 : 0.92 + r() * 0.2; // build
  const look = (r() < 0.5 ? 1 : 0) + (r() < (old ? 0.6 : 0.18) ? 2 : 0); // smile, glasses
  // Nobody carries a phone or a cup: it looked odd. (Still drawn from the dice, so everyone else stays as they were.)
  if (!wish.captain && !child) pick(['phone', 'cup', 'none', 'none', 'none', 'none'] as const);
  const hold = (['none'] as Hold[])[0];
  const trimCol = kind === 'tee' ? pick([WHITE, accent, top, top]) : WHITE;
  const cloth = wish.captain
    ? FAB.none
    : { tee: pick([FAB.none, FAB.none, FAB.none, FAB.dots]), stripes: FAB.stripes, jacket: pick([FAB.none, FAB.none, FAB.checks, FAB.cord]), hoodie: pick([FAB.none, FAB.knit]), coat: pick([FAB.tweed, FAB.tweed, FAB.none]), dress: pick([FAB.dots, FAB.checks, FAB.none]) }[kind];
  const lod = wish.lod ?? 1;
  const at = <A extends unknown[], T>(fn: (...a: A) => T) => (...a: A) => {
    const was = quality;
    quality = lod;
    try {
      return fn(...a);
    } finally {
      quality = was;
    }
  };
  const loose = kind === 'hoodie' || kind === 'coat' ? 1.04 : 1;

  const torso = () => {
    const k = pieces();
    const w = wide, d = 0.95 + 0.05 * wide;
    const hem = { tee: 0.835, stripes: 0.83, jacket: 0.79, hoodie: 0.8, coat: 0.5, dress: 0.52 }[kind];
    const R = (y: number, rx: number, rz: number, cz = 0, e = 2.6): Ring => ({ p: [0, y, cz], rx: rx * w, rz: rz * d, e });
    const flare = kind === 'dress' ? 0.07 : 0.05;
    const low: Ring[] = hem > 0.7 ? [R(hem, 0.176, 0.118)] : [R(hem, 0.176 + flare, 0.118 + flare * 0.8, 0, 2.3), R(0.68, 0.172 + flare * 0.45, 0.115 + flare * 0.35, 0, 2.4), R(0.84, 0.168, 0.11)];
    k.part(
      [
        ...low,
        R(0.9, 0.163 * loose, 0.108 * loose),
        R(1.0, 0.157 * loose, 0.102 * loose),
        R(1.1, 0.16 * loose, 0.104 * loose, 0.004),
        R(1.19, 0.165 * loose, 0.106 * loose, 0.006),
        R(1.255, 0.158 * loose, 0.1 * loose, 0.004),
        R(1.29, 0.128, 0.085, 0, 2.4),
        R(1.31, 0.085, 0.066, -0.004, 2.2),
        R(1.318, 0.052, 0.05, -0.008, 2),
      ],
      top,
      { plane: 'xz', seg: 28, start: 'flat', end: 'flat' },
      cloth,
    );
    // collar
    const up = new THREE.Vector3(0, 1, 0);
    if (kind === 'jacket' || kind === 'coat') k.add(trim(new THREE.Vector3(0, 1.31, -0.008), up, 0.058, 0.02, w), wish.captain ? DARK : shade(top, 0.78));
    else if (kind === 'hoodie') {
      const hood = new THREE.SphereGeometry(1, 14, 10);
      hood.scale(0.12 * w, 0.075, 0.07);
      hood.translate(0, 1.29, -0.085);
      k.add(hood, shade(top, 0.85));
      // the front pocket
      k.part([{ p: [0, 0.96, 0.1 * d * loose], rx: 0.1 * w, rz: 0.012, e: 4 }, { p: [0, 1.06, 0.102 * d * loose], rx: 0.09 * w, rz: 0.012, e: 4 }], shade(top, 0.82), { plane: 'xz', seg: 16, smooth: 1, bulge: 0.003 });
    } else k.add(trim(new THREE.Vector3(0, 1.315, -0.008), up, 0.05, 0.011, w), kind === 'tee' ? trimCol : kind === 'dress' ? WHITE : top);
    if (kind === 'coat') k.add(trim(new THREE.Vector3(0, 0.96, 0), up, 0.165, 0.016, w * 1.04, 0.67 * d), shade(top, 0.6));
    if (kind === 'dress') k.add(trim(new THREE.Vector3(0, 1.0, 0), up, 0.158, 0.014, w, 0.66 * d), accent);
    if (wish.captain)
      for (const y of [0.92, 1.04, 1.16]) {
        const b = new THREE.SphereGeometry(0.012, 6, 4);
        b.translate(0, y, 0.106 * d);
        k.add(b, palette.gold);
      }

    // what is under the hem
    if (legs === 'skirt') {
      k.part(
        [
          { p: [0, 0.97, 0], rx: 0.14 * w, rz: 0.092 * d, e: 2.4 },
          { p: [0, 0.845, 0], rx: 0.158 * w, rz: 0.104 * d, e: 2.4 },
          { p: [0, 0.7, 0], rx: 0.19 * w, rz: 0.14 * d, e: 2.3 },
          { p: [0, 0.55, 0], rx: 0.215 * w, rz: 0.165 * d, e: 2.2 },
        ],
        bottom,
        { plane: 'xz', seg: 28, end: 'flat' },
        skirtCloth,
      );
    } else if (legs !== 'none') {
      k.part(
        [
          { p: [0, 0.97, 0], rx: 0.14 * w, rz: 0.092 * d, e: 2.4 },
          { p: [0, 0.9, 0], rx: 0.152 * w, rz: 0.1 * d, e: 2.4 },
          { p: [0, 0.83, 0], rx: 0.164 * w, rz: 0.106 * d, e: 2.4 },
          { p: [0, 0.775, 0], rx: 0.13 * w, rz: 0.085 * d, e: 2.4 },
        ],
        bottom,
        { plane: 'xz', seg: 28, bulge: 0.03 },
        legCloth,
      );
    }

    // what they carry
    if (extra === 'bag') {
      k.add(strap([0.012, 1.065, 0], [0.555, -0.832, 0], 0.325 * Math.max(1, w), 0.121 * d * loose), shade(bagCol, 0.55));
      const box = loft(
        [
          { p: [0, 0, -0.026], rx: 0.062, rz: 0.05, e: 5 },
          { p: [0, 0, -0.018], rx: 0.07, rz: 0.058, e: 5 },
          { p: [0, 0, 0.018], rx: 0.07, rz: 0.058, e: 5 },
          { p: [0, 0, 0.026], rx: 0.062, rz: 0.05, e: 5 },
        ],
        { plane: 'xy', seg: 24, smooth: 1, bulge: 0.004 },
      );
      const flap = loft([{ p: [0, 0.018, 0.024], rx: 0.064, rz: 0.034, e: 5 }, { p: [0, 0.018, 0.031], rx: 0.064, rz: 0.034, e: 5 }], { plane: 'xy', seg: 24, smooth: 1, bulge: 0.003 });
      const m = new THREE.Matrix4().makeRotationY(0.45).setPosition(0.19 * w + (long ? 0.03 : 0), 0.8, 0.07);
      k.add(box.body.applyMatrix4(m), bagCol);
      k.add(flap.body.applyMatrix4(m), shade(bagCol, 0.8));
    } else if (extra === 'pack') {
      const z = -0.104 * d * loose;
      k.part(
        [
          { p: [0, 1.12, z - 0.005], rx: 0.11, rz: 0.11, e: 4 },
          { p: [0, 1.12, z - 0.02], rx: 0.125, rz: 0.15, e: 4 },
          { p: [0, 1.12, z - 0.11], rx: 0.12, rz: 0.145, e: 4 },
          { p: [0, 1.12, z - 0.13], rx: 0.1, rz: 0.12, e: 4 },
        ],
        packCol,
        { plane: 'xy', seg: 24, smooth: 2, bulge: 0.01 },
      );
      k.part([{ p: [0, 1.06, z - 0.125], rx: 0.085, rz: 0.06, e: 4 }, { p: [0, 1.06, z - 0.15], rx: 0.08, rz: 0.055, e: 4 }], shade(packCol, 0.8), { plane: 'xy', seg: 16, smooth: 1, bulge: 0.008 });
      for (const s of [-1, 1])
        k.part(
          [
            { p: [s * 0.085 * w, 1.29, -0.07], rx: 0.017, rz: 0.006 },
            { p: [s * 0.088 * w, 1.29, 0.04], rx: 0.017, rz: 0.006 },
            { p: [s * 0.092 * w, 1.19, 0.11 * d * loose], rx: 0.017, rz: 0.006 },
            { p: [s * 0.1 * w, 1.03, 0.106 * d * loose], rx: 0.017, rz: 0.006 },
          ],
          shade(packCol, 0.6),
          { seg: 8, ref: [1, 0, 0] },
        );
    } else if (extra === 'scarf') {
      k.add(trim(new THREE.Vector3(0, 1.32, -0.008), new THREE.Vector3(0, 1, 0), 0.06, 0.03, w), scarfCol, FAB.knit);
      k.part(
        [
          { p: [0.05, 1.32, 0.09], rx: 0.034, rz: 0.012, e: 3 },
          { p: [0.058, 1.2, 0.125 * d * loose], rx: 0.036, rz: 0.012, e: 3 },
          { p: [0.062, 1.06, 0.12 * d * loose], rx: 0.036, rz: 0.012, e: 3 },
        ],
        scarfCol,
        { seg: 12, ref: [1, 0, 0], end: 'flat' },
        FAB.knit,
      );
    }
    return k.done();
  };

  /** Hangs from the shoulder at the origin, down to the elbow. */
  const upperArm = () => {
    const k = pieces();
    k.part([{ p: [0, 0, 0], rx: 0.036, rz: 0.036 }, { p: [0, -UPPER / 2, 0], rx: 0.034, rz: 0.034 }, { p: [0, -UPPER, 0], rx: 0.031, rz: 0.032 }], skin, { seg: 12 });
    if (shortSleeves) {
      const sl = k.part(
        [
          { p: [0, 0.0, 0], rx: 0.06, rz: 0.062 },
          { p: [0, -0.06, 0], rx: 0.068, rz: 0.068 },
          { p: [0, -0.13, 0.004], rx: 0.066, rz: 0.065 },
        ],
        top,
        { seg: 20, end: 'flat', bulge: 0.022 },
        cloth,
      );
      if (kind === 'tee' && trimCol !== top) k.add(trim(sl.ends[1], sl.dirs[1], 0.065, 0.01), trimCol);
    } else {
      const l = loose * 1.04;
      k.part([{ p: [0, 0.0, 0], rx: 0.058 * l, rz: 0.06 * l }, { p: [0, -0.1, 0], rx: 0.055 * l, rz: 0.056 * l }, { p: [0, -UPPER, 0], rx: 0.05 * l, rz: 0.05 * l }], top, { seg: 16, bulge: 0.022 }, cloth);
    }
    return k.done();
  };

  /** Hangs from the elbow at the origin; the hand ends about 0.31 below it. */
  const foreArm = (thing: Hold = 'none') => {
    const k = pieces();
    k.part([{ p: [0, 0, 0], rx: 0.031, rz: 0.031 }, { p: [0, -0.1, 0.002], rx: 0.029, rz: 0.03 }, { p: [0, -FORE, 0.004], rx: 0.024, rz: 0.025 }], skin, { seg: 12 });
    if (!shortSleeves) {
      const l = loose * 1.04;
      const sl = k.part([{ p: [0, 0.01, 0], rx: 0.05 * l, rz: 0.05 * l }, { p: [0, -0.09, 0.001], rx: 0.047 * l, rz: 0.047 * l }, { p: [0, -FORE + 0.03, 0.003], rx: 0.044 * l, rz: 0.044 * l }], top, { seg: 16, end: 'flat' }, cloth);
      if (kind === 'jacket' || kind === 'hoodie' || kind === 'stripes') k.add(trim(sl.ends[1], sl.dirs[1], 0.042 * l, 0.009), kind === 'jacket' ? (wish.captain ? palette.gold : WHITE) : shade(top, 0.8));
    }
    // a mitten hand, palm towards the body (a thumb this small only turns into an ink blot)
    const h = -FORE;
    k.part(
      [
        { p: [0, h, 0.004], rx: 0.02, rz: 0.025 },
        { p: [0, h - 0.03, 0.005], rx: 0.025, rz: 0.036 },
        { p: [0, h - 0.075, 0.006], rx: 0.026, rz: 0.04 },
        { p: [0, h - 0.105, 0.006], rx: 0.024, rz: 0.038 },
      ],
      skin,
      { seg: 14, bulge: 0.02 },
    );
    if (thing === 'phone') {
      const p = new THREE.BoxGeometry(0.07, 0.14, 0.012);
      p.rotateX(-0.5);
      p.translate(0, h - 0.07, 0.05);
      k.add(p, DARK);
      const s = new THREE.BoxGeometry(0.058, 0.12, 0.004);
      s.rotateX(-0.5);
      s.translate(0, h - 0.072, 0.0445);
      k.add(s, '#9fc4d6');
    } else if (thing === 'cup') {
      const c = new THREE.CylinderGeometry(0.04, 0.03, 0.1, 12);
      c.rotateX(-Math.PI / 2);
      c.translate(0, h - 0.06, 0.07);
      k.add(c, WHITE);
      const l = new THREE.CylinderGeometry(0.043, 0.043, 0.014, 12);
      l.rotateX(-Math.PI / 2);
      l.translate(0, h - 0.06, 0.125);
      k.add(l, '#6b4a35');
    }
    return k.done();
  };

  const legSkin = tights ? DARK : skin;
  /** Hangs from the hip at the origin, down to the knee. */
  const thigh = () => {
    const k = pieces();
    if (legs === 'trousers') {
      k.part([{ p: [0, 0.03, 0], rx: 0.08, rz: 0.08 }, { p: [0, -0.18, 0], rx: 0.072, rz: 0.072 }, { p: [0, -THIGH, 0.004], rx: 0.063, rz: 0.063 }], bottom, { seg: 16 }, legCloth);
    } else {
      k.part([{ p: [0, 0, 0], rx: 0.055, rz: 0.055 }, { p: [0, -0.22, 0], rx: 0.05, rz: 0.05 }, { p: [0, -THIGH, 0.005], rx: 0.043, rz: 0.044 }], legSkin, { seg: 14 });
      if (legs === 'shorts')
        k.part([{ p: [0, 0.03, 0], rx: 0.08, rz: 0.08, e: 2.2 }, { p: [0, -0.14, 0.003], rx: 0.084, rz: 0.083, e: 2.2 }, { p: [0, -0.3, 0.005], rx: 0.087, rz: 0.085, e: 2.2 }], bottom, { seg: 20, end: 'flat' }, legCloth);
    }
    return k.done();
  };

  /** Hangs from the knee at the origin, down to the ankle. */
  const shin = () => {
    const k = pieces();
    if (legs === 'trousers') {
      k.part([{ p: [0, 0.01, 0.004], rx: 0.063, rz: 0.063 }, { p: [0, -0.2, 0], rx: 0.058, rz: 0.058 }, { p: [0, -SHIN + 0.01, 0], rx: 0.056, rz: 0.056 }], bottom, { seg: 16, end: 'flat' }, legCloth);
      k.part([{ p: [0, -SHIN + 0.04, 0], rx: 0.034, rz: 0.035 }, { p: [0, -SHIN - 0.02, 0], rx: 0.032, rz: 0.033 }], socks, { seg: 10, smooth: 1 });
    } else {
      k.part(
        [
          { p: [0, 0, 0.005], rx: 0.043, rz: 0.044 },
          { p: [0, -0.14, -0.013], rx: 0.045, rz: 0.047 },
          { p: [0, -0.28, -0.006], rx: 0.036, rz: 0.037 },
          { p: [0, -SHIN, 0], rx: 0.031, rz: 0.032 },
        ],
        legSkin,
        { seg: 14 },
      );
      if (!tights)
        k.part([{ p: [0, -SHIN + 0.115, 0], rx: 0.042, rz: 0.043 }, { p: [0, -SHIN + 0.045, 0], rx: 0.039, rz: 0.04 }, { p: [0, -SHIN - 0.025, 0], rx: 0.039, rz: 0.04 }], socks, { seg: 14, start: 'flat' }, FAB.knit, shade(socks, 0.8));
    }
    return k.done();
  };

  /** A boot's shaft, around the ankle at the origin; `wider` to take a trouser leg tucked in. */
  const shaft = (wider = 0): Ring[] => [
    { p: [0, -ANKLE + 0.06, -0.004], rx: 0.048 + wider, rz: 0.05 + wider },
    { p: [0, -ANKLE + 0.17, -0.004], rx: 0.045 + wider, rz: 0.047 + wider },
  ];
  const shaftOpt: Opt = { seg: 16, smooth: 1, start: 'open', end: 'flat' };

  /**
   * Hinged at the ankle at the origin; the sole is ANKLE below it, heel at -0.08, toe at 0.18. Without
   * `withShaft` a boot comes without its shaft, for a body that hangs the shaft on the shin instead.
   */
  const foot = (withShaft = true) => {
    const k = pieces();
    const y = -ANKLE;
    const low = shoeKind === 'shoe' ? 0.8 : 1;
    const run = (rows: [number, number, number, number][], col: string, e: number) => {
      const l = loft(rows.map(([z, rx, ry, cy]) => ({ p: [0, y + cy, z + 0.005] as V, rx, rz: ry, e })), { plane: 'xy', seg: 20, smooth: 3, bulge: 0.01 });
      k.add(l.body, col);
    };
    run(
      [
        [-0.075, 0.03, 0.026 * low, 0.064 * low],
        [-0.06, 0.05, 0.05 * low, 0.064 * low],
        [0.0, 0.056 * (shoeKind === 'shoe' ? 0.92 : 1), 0.058 * low, 0.064 * low],
        [0.07, 0.057, 0.045 * low, 0.052 * low],
        [0.14, 0.052, 0.033 * low, 0.04 * low],
        [0.178, 0.034, 0.02 * low, 0.035 * low],
      ],
      shoe,
      2.8,
    );
    run(
      [
        [-0.082, 0.035, 0.012, 0.017],
        [-0.066, 0.057, 0.017, 0.017],
        [0.0, 0.063, 0.017, 0.017],
        [0.07, 0.064, 0.017, 0.017],
        [0.14, 0.059, 0.017, 0.017],
        [0.185, 0.04, 0.013, 0.017],
      ],
      sole,
      4,
    );
    if (shoeKind === 'boot' && withShaft) k.part(shaft(), shoe, shaftOpt);
    return k.done();
  };

  const headG = () => head({ skin, hair: hairCol, hairdo, hat: accent, look, wide: 0.96 + (wide - 1) * 0.3 });
  const armX = 0.18 * wide * loose;

  /**
   * The whole person as one skinned body around a skeleton (actor.ts): `J` is where a joint is in the pose
   * the body is bound in, `I` its index in the skeleton. Torso, head and legs are built as for the pieces;
   * the arms follow their joints, wherever the bind pose puts them.
   */
  const dressed = (J: (n: string) => THREE.Vector3, I: (n: string) => number, made?: Made) => {
    const out: G[] = [];
    const add = (g: G, col: string, w: Weigh, mat = 0) => void out.push(weigh(coat(g, col, mat), w));
    const part = (rings: Ring[], col: string, o: Opt, w: Weigh, mat = 0, lid?: string) => {
      const l = loft(rings, o);
      add(l.body, col, w, mat);
      for (const g of l.lids) add(g, lid ?? shade(col, 0.55), w);
      return l;
    };
    const spine = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01'];
    // Below the hips a coat, a dress or a skirt follows the legs partly, each side its own leg, or the legs walk through it.
    const back = chain(spine.map(J), spine.map(I), 0.05);
    const hem: WeighN = (p) => {
      if (p.y > HIP - 0.02) {
        const [a, b, t] = back(p);
        return [[a, 1 - t], [b, t]];
      }
      const t = 0.75 * smoothstep(HIP - 0.02, HIP - 0.32, p.y);
      const left = smoothstep(-0.08, 0.08, p.x);
      return [[I('pelvis'), 1 - t], [I('thigh_l'), t * left], [I('thigh_r'), t * (1 - left)]];
    };
    const headW = chain([J('neck_01'), J('Head')], [I('neck_01'), I('Head')], 0.03, I('spine_03'));
    /**
     * The weights of the nearest point of the Blender body below `top`: a part laid over it (a boot's shaft)
     * then moves exactly as the body does, and as the clothes cut from the body do (blender/person.py).
     */
    const likeBody = (body: G, top: number): WeighN => {
      const pos = body.attributes.position, idx = body.attributes.skinIndex, wt = body.attributes.skinWeight;
      const near = [...Array(pos.count).keys()].filter((i) => pos.getY(i) < top);
      const v = new THREE.Vector3();
      return (p) => {
        let best = -1, d = Infinity;
        for (const i of near) {
          const di = v.fromBufferAttribute(pos, i).distanceToSquared(p);
          if (di < d) [best, d] = [i, di];
        }
        return [0, 1, 2, 3].map((k) => [idx.getComponent(best, k), wt.getComponent(best, k)] as [number, number]);
      };
    };
    if (made) {
      // body and clothes from Blender (blender/person.py), already weighted there
      const put = (name: string, col: string, mat = 0) => made[name] && out.push(coat(made[name], col, mat));
      put('Body', skin);
      put(shortSleeves ? 'Tee' : 'LongTee', top, cloth);
      put(legs === 'shorts' ? 'Shorts' : 'Trousers', bottom, legCloth);
      add(trim(new THREE.Vector3(0, 1.312, -0.01), new THREE.Vector3(0, 1, 0), 0.056, 0.01), kind === 'tee' ? trimCol : top, back);
    } else out.push(weigh(torso(), hem, true));
    out.push(weigh(headG().translate(0, NECK, 0), headW));
    const pt = (p: THREE.Vector3, v: THREE.Vector3, k: number): V => [p.x + v.x * k, p.y + v.y * k, p.z + v.z * k];
    for (const c of ['l', 'r'] as const) {
      // arm: skin from shoulder to wrist in one piece, a sleeve over it, a mitten at the end
      const S = J(`upperarm_${c}`), E = J(`lowerarm_${c}`), W = J(`hand_${c}`);
      const u = E.clone().sub(S).normalize(), dv = W.clone().sub(E).normalize();
      const lu = S.distanceTo(E), lf = E.distanceTo(W);
      const armW = chain([S, E, W], [I(`upperarm_${c}`), I(`lowerarm_${c}`), I(`hand_${c}`)], 0.045, I(`clavicle_${c}`));
      if (!made) part(
        [
          { p: pt(S, u, 0), rx: 0.037, rz: 0.037 },
          { p: pt(S, u, lu * 0.4), rx: 0.035, rz: 0.035 },
          { p: pt(S, u, lu * 0.8), rx: 0.032, rz: 0.033 },
          { p: pt(E, dv, 0), rx: 0.03, rz: 0.031 },
          { p: pt(E, dv, lf * 0.3), rx: 0.031, rz: 0.03 },
          { p: pt(E, dv, lf * 0.7), rx: 0.028, rz: 0.026 },
          { p: pt(W, dv, 0), rx: 0.024, rz: 0.023 },
        ],
        skin,
        { seg: 12, ref: [0, 0, 1] },
        armW,
      );
      if (made) {
        // nothing: the sleeve is part of the Blender top
      } else if (shortSleeves) {
        const sl = part(
          [
            { p: pt(S, u, 0.0), rx: 0.047, rz: 0.05 },
            { p: pt(S, u, 0.06), rx: 0.056, rz: 0.057 },
            { p: pt(S, u, 0.125), rx: 0.057, rz: 0.057 },
          ],
          top,
          { seg: 20, end: 'flat', bulge: 0.018, ref: [0, 0, 1] },
          armW,
          cloth,
        );
        if (kind === 'tee' && trimCol !== top) add(trim(sl.ends[1], sl.dirs[1], 0.057, 0.009), trimCol, armW);
      } else {
        const l = loose * 1.04;
        const sl = part(
          [
            { p: pt(S, u, 0.0), rx: 0.047 * l, rz: 0.05 * l },
            { p: pt(S, u, lu * 0.5), rx: 0.053 * l, rz: 0.054 * l },
            { p: pt(E, dv, 0), rx: 0.05 * l, rz: 0.05 * l },
            { p: pt(E, dv, lf * 0.5), rx: 0.047 * l, rz: 0.047 * l },
            { p: pt(W, dv, -0.03), rx: 0.044 * l, rz: 0.044 * l },
          ],
          top,
          { seg: 16, end: 'flat', bulge: 0.025, ref: [0, 0, 1] },
          armW,
          cloth,
        );
        if (kind === 'jacket' || kind === 'hoodie' || kind === 'stripes') add(trim(sl.ends[1], sl.dirs[1], 0.042 * l, 0.009), kind === 'jacket' ? (wish.captain ? palette.gold : WHITE) : shade(top, 0.8), armW);
      }
      part(
        [
          { p: pt(W, dv, 0), rx: 0.02, rz: 0.025 },
          { p: pt(W, dv, 0.03), rx: 0.025, rz: 0.036 },
          { p: pt(W, dv, 0.075), rx: 0.026, rz: 0.04 },
          { p: pt(W, dv, 0.105), rx: 0.024, rz: 0.038 },
        ],
        skin,
        { seg: 14, bulge: 0.02, ref: [1, 0, 0] },
        armW,
      );
      if (c === 'r' && hold !== 'none') {
        const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dv);
        const at = W.clone().addScaledVector(dv, 0.065).add(new THREE.Vector3(0, 0, 0.05));
        if (hold === 'phone') {
          add(new THREE.BoxGeometry(0.07, 0.14, 0.012).applyQuaternion(turn).translate(at.x, at.y, at.z), DARK, armW);
          add(new THREE.BoxGeometry(0.058, 0.12, 0.004).applyQuaternion(turn).translate(at.x, at.y, at.z + 0.007), '#9fc4d6', armW);
        } else {
          add(new THREE.CylinderGeometry(0.04, 0.03, 0.1, 12).rotateX(Math.PI / 2).translate(at.x, at.y, at.z + 0.02), WHITE, armW);
          add(new THREE.CylinderGeometry(0.043, 0.043, 0.014, 12).rotateX(Math.PI / 2).translate(at.x, at.y, at.z + 0.075), '#6b4a35', armW);
        }
      }

      // leg: one piece from the hip to the ankle, so the knee bends instead of showing a joint
      const T = J(`thigh_${c}`), K = J(`calf_${c}`), A = J(`foot_${c}`);
      const legW = chain([T, K, A], [I(`thigh_${c}`), I(`calf_${c}`), I(`foot_${c}`)], 0.05, I('pelvis'));
      const L = (y: number, r: number, rz = r, z = 0): Ring => ({ p: [T.x, y, z], rx: r, rz });
      if (made) {
        // legs are part of the Blender body; only the socks are added, when the legs are bare
        if (legs === 'shorts') part([L(A.y + 0.12, 0.042, 0.043), L(A.y + 0.05, 0.039, 0.04), L(A.y - 0.02, 0.039, 0.04)], socks, { seg: 14, start: 'flat' }, legW, FAB.knit, shade(socks, 0.8));
      } else if (legs === 'trousers') {
        part([L(HIP + 0.03, 0.08), L(HIP - 0.15, 0.074), L(K.y + 0.02, 0.066), L(K.y - 0.15, 0.061), L(A.y + 0.012, 0.057)], bottom, { seg: 16, end: 'flat' }, legW, legCloth);
        part([L(A.y + 0.04, 0.034, 0.035), L(A.y - 0.02, 0.032, 0.033)], socks, { seg: 10, smooth: 1 }, legW);
      } else {
        part(
          [L(HIP, 0.057), L(HIP - 0.1, 0.055), L(HIP - 0.25, 0.049), L(K.y + 0.03, 0.043), L(K.y - 0.02, 0.043, 0.044, 0.003), L(K.y - 0.11, 0.046, 0.047, -0.01), L(K.y - 0.23, 0.037, 0.038, -0.005), L(A.y + 0.03, 0.031, 0.032), L(A.y - 0.005, 0.03)],
          legSkin,
          { seg: 14 },
          legW,
        );
        if (legs === 'shorts') part([L(HIP + 0.03, 0.08), L(HIP - 0.14, 0.084, 0.083, 0.003), L(HIP - 0.3, 0.087, 0.085, 0.005)], bottom, { seg: 20, end: 'flat' }, legW, legCloth);
        if (!tights) part([L(A.y + 0.12, 0.042, 0.043), L(A.y + 0.05, 0.039, 0.04), L(A.y - 0.02, 0.039, 0.04)], socks, { seg: 14, start: 'flat' }, legW, FAB.knit, shade(socks, 0.8));
      }
      // the shoe bends at the ball of the foot
      const B = J(`ball_${c}`);
      const sole = chain([new THREE.Vector3(T.x, 0.05, -0.1), new THREE.Vector3(T.x, 0.05, B.z)], [I(`foot_${c}`), I(`ball_${c}`)], 0.03);
      if (made?.Body) {
        // The shoe's upper rises round the ankle (to 0.12), where the leg and the trouser leg turn with the
        // shin. Fixed to the foot, it would have the trouser leg cut through it whenever the ankle bends; so
        // from 0.07 up it takes on the body's own weights, and its collar moves with the leg inside it.
        const leg = likeBody(made.Body, 0.35);
        const mixed: WeighN = (p) => {
          const [a, b, t] = sole(p);
          const k = smoothstep(0.07, 0.11, p.y);
          const shares = new Map<number, number>();
          const put = (bone: number, s: number) => s > 0 && shares.set(bone, (shares.get(bone) ?? 0) + s);
          put(a, (1 - t) * (1 - k));
          put(b, t * (1 - k));
          if (k > 0) for (const [bone, s] of leg(p)) put(bone, s * k);
          const top = [...shares].sort((x, y) => y[1] - x[1]).slice(0, 4);
          const sum = top.reduce((s, [, x]) => s + x, 0);
          return top.map(([bone, s]) => [bone, s / sum] as [number, number]);
        };
        out.push(weigh(foot(false).translate(T.x, ANKLE, 0), mixed, true));
      } else out.push(weigh(foot(false).translate(T.x, ANKLE, 0), sole));
      // A boot's shaft goes with the shin, as the leg inside it does, and gives at the ankle like soft leather:
      // fixed to the foot, the trouser leg would cut through it at every step. On a Blender body it takes the
      // body's own weights, as the trousers do, so the two move as one; and it is made wide enough to take
      // those trouser legs (about 0.05 round at the ankle) tucked in.
      if (shoeKind === 'boot') {
        const rings = shaft(made && legs !== 'shorts' ? 0.01 : 0).map((r) => ({ ...r, p: [r.p[0] + T.x, r.p[1] + ANKLE, r.p[2]] as V }));
        const l = loft(rings, shaftOpt);
        const w = made?.Body ? likeBody(made.Body, 0.35) : legW;
        out.push(weigh(coat(l.body, shoe, 0), w, !!made?.Body));
        for (const g of l.lids) out.push(weigh(coat(g, shade(shoe, 0.55), 0), w, !!made?.Body));
      }
    }
    return mergeGeometries(out, false)!;
  };

  return {
    dressed: at(dressed),
    torso: at(torso),
    head: at(headG),
    upperArm: at(upperArm),
    foreArm: at(foreArm),
    thigh: at(thigh),
    shin: at(shin),
    foot: at(foot),
    armX,
    size,
    hold,
    long,
  };
}

/** A low round stand to put a figure on in the preview. */
export function dais() {
  return coat(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 48).translate(0, -0.02, 0), '#d9cfb3');
}
