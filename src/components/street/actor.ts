import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ANKLE, CHIN, figure, FORE, HIP, LEG_X, type Made, NECK, SHOULDER, THIGH, UPPER, type Wish } from './character';
import moves from './moves.json';

// A person that moves like a person: our own body and clothes (character.ts) on the skeleton of
// Quaternius' Universal Animation Library (CC0), with its hand-made animations: walking, standing about,
// talking, sitting. Only the bones that matter are kept (no fingers: our people wear mittens), and the
// skeleton is stretched to our proportions: shorter legs, narrow shoulders, a big head.
// The clips only turn the joints, so they work on any lengths; the hips' own up-and-down is scaled along.

type Moves = {
  fps: number;
  bones: { name: string; parent: number; t: number[]; r: number[] }[];
  clips: Record<string, { dur: number; frames: number; rot: Record<string, string>; pelvis: number[] }>;
};
const M = moves as unknown as Moves;
type V = [number, number, number];

export type Move = 'Walk_Loop' | 'Walk_Formal_Loop' | 'Idle_Loop' | 'Idle_Talking_Loop' | 'Sitting_Idle_Loop' | 'Sitting_Talking_Loop' | 'Driving_Loop';

/** Where each joint goes, standing in a T: arms straight out, as the library's skeleton rests. */
function targets(armX: number): Record<string, V> {
  const t: Record<string, V> = {
    pelvis: [0, HIP - 0.015, -0.035],
    spine_01: [0, 0.96, -0.02],
    spine_02: [0, 1.06, -0.012],
    spine_03: [0, 1.14, -0.006],
    neck_01: [0, NECK, -0.012],
    Head: [0, CHIN + 0.035, -0.005],
  };
  for (const [c, s] of [['l', 1], ['r', -1]] as const) {
    t[`clavicle_${c}`] = [s * 0.02, 1.2, 0.03];
    t[`upperarm_${c}`] = [s * armX, SHOULDER, -0.01];
    t[`lowerarm_${c}`] = [s * (armX + UPPER), SHOULDER, -0.01];
    t[`hand_${c}`] = [s * (armX + UPPER + FORE), SHOULDER, -0.01];
    t[`thigh_${c}`] = [s * LEG_X, HIP, 0];
    t[`calf_${c}`] = [s * LEG_X, HIP - THIGH, 0];
    t[`foot_${c}`] = [s * LEG_X, ANKLE, -0.01];
    t[`ball_${c}`] = [s * LEG_X, 0.02, 0.1];
  }
  return t;
}

function skeleton(armX: number) {
  const list = M.bones.map((b) => {
    const o = new THREE.Bone();
    o.name = b.name;
    o.position.fromArray(b.t);
    o.quaternion.fromArray(b.r);
    return o;
  });
  M.bones.forEach((b, i) => b.parent >= 0 && list[b.parent].add(list[i]));
  const by: Record<string, THREE.Bone> = Object.fromEntries(list.map((b) => [b.name, b]));
  list[0].updateMatrixWorld(true);
  // keep every joint's turn, move it to our proportions (parents come before their children in the list)
  const T = targets(armX);
  const inv = new THREE.Matrix4();
  for (const b of list.slice(1)) {
    const p = T[b.name];
    if (!p) continue;
    inv.copy(b.parent!.matrixWorld).invert();
    b.position.fromArray(p).applyMatrix4(inv);
    b.updateMatrixWorld(true);
  }
  return { list, by };
}

/** The body is bound with the arms halfway down, not straight out: that is where they spend their time. */
function aPose(by: Record<string, THREE.Bone>) {
  const pw = new THREE.Quaternion(), bw = new THREE.Quaternion(), turn = new THREE.Quaternion();
  for (const [c, s] of [['l', 1], ['r', -1]] as const) {
    const b = by[`upperarm_${c}`];
    b.parent!.getWorldQuaternion(pw);
    b.getWorldQuaternion(bw);
    turn.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -s * THREE.MathUtils.degToRad(55));
    b.quaternion.copy(pw.invert().multiply(bw.premultiply(turn)));
    b.updateMatrixWorld(true);
  }
}

/* ---------------- Feet on the ground ---------------- */

/**
 * Points on the sole that must stay above the ground: the back of the heel (moves with the foot) and the tip
 * of the shoe (moves with the toes). Taken in the pose the body was built in, before the person is scaled.
 */
function soles(by: Record<string, THREE.Bone>) {
  const q = new THREE.Quaternion();
  /** A point fixed to the bone, and the axis (fixed to the bone too) that lifts it: the foot's own across. */
  const point = (bone: THREE.Bone, at: THREE.Vector3, side: number) => ({
    bone,
    pt: bone.worldToLocal(at),
    side: new THREE.Vector3(side, 0, 0).applyQuaternion(bone.getWorldQuaternion(q).invert()),
  });
  return (['l', 'r'] as const).map((c) => {
    const foot = by[`foot_${c}`], ball = by[`ball_${c}`];
    const x = foot.getWorldPosition(new THREE.Vector3()).x;
    return { heel: point(foot, new THREE.Vector3(x, 0.004, -0.078), 1), toe: point(ball, new THREE.Vector3(x, 0.004, 0.185), -1) };
  });
}
type Sole = ReturnType<typeof soles>[number]['heel'];

const UP = new THREE.Vector3(0, 1, 0);
const tmp = { p: new THREE.Vector3(), o: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Quaternion(), w: new THREE.Quaternion() };

/**
 * How far the bone must turn about its joint, around a level axis (put in `axis`), to bring the point up to
 * `floor` in `space`, the person's own frame. Zero when it is already above. The axis is the foot's own
 * across, laid level: it turns smoothly with the foot, also when the toes point straight down.
 */
function needed(space: THREE.Object3D, { bone, pt, side }: Sole, axis: THREE.Vector3, floor = 0) {
  const { p, o, d, q, m } = tmp;
  axis.copy(side).applyQuaternion(bone.getWorldQuaternion(q)).applyQuaternion(space.getWorldQuaternion(m).invert());
  axis.y = 0;
  if (axis.lengthSq() < 1e-8) axis.set(side.x, 0, 0);
  axis.normalize();
  space.worldToLocal(bone.localToWorld(p.copy(pt)));
  space.worldToLocal(bone.getWorldPosition(o));
  if (p.y >= floor) return 0;
  p.sub(o);
  // turning about the axis carries `d` (level, square to it) up: the point's height is r·sin(its angle from d)
  const along = p.dot(d.crossVectors(UP, axis));
  const r = Math.hypot(along, p.y);
  if (r < 1e-4) return 0;
  return Math.max(0, Math.asin(THREE.MathUtils.clamp((floor - o.y) / r, -1, 1)) - Math.atan2(p.y, along));
}

/** Turns `bone` by `angle` about `axis`, an axis in `space`. */
function turnBy(space: THREE.Object3D, bone: THREE.Bone, axis: THREE.Vector3, angle: number) {
  const { q, m, w } = tmp;
  // the turn in the person's own space, then in the world, then relative to the bone's parent
  space.getWorldQuaternion(m);
  q.setFromAxisAngle(axis, angle).premultiply(m).multiply(m.invert());
  bone.getWorldQuaternion(w).premultiply(q);
  bone.parent!.getWorldQuaternion(m);
  bone.quaternion.copy(m.invert().multiply(w));
  bone.updateMatrixWorld(true);
}

/**
 * The clips were made for other feet, and two things go wrong with ours. They point the foot far further down
 * than our stiff shoes were made for, so the top of the shoe twists out of the trouser leg. And ours are
 * longer, so at every step the heel and the tip of the shoe dip into the floor; fixed frame by frame (as
 * ground() does) that fix can only react, and the foot snaps into place. But a clip is a known loop, so both
 * are put right here, once, in the clip itself:
 * - the foot points down no further than a little past how the shoe was made (easing into that limit);
 * - a foot that would dip into the floor is brought up whole, turned just as the clip has it, by bending the
 *   knee a little, and by no more than it would dip. How far it dips grows from nothing and shrinks back to
 *   nothing, so the lift does too: no snap, and a foot that is on the ground stays on it.
 * ground() is then left with next to nothing to do.
 */
function plant(clip: THREE.AnimationClip, frames: number) {
  const { list, by } = skeleton(0.18);
  aPose(by);
  const space = new THREE.Group();
  space.add(list[0]);
  space.updateMatrixWorld(true);
  const feet = soles(by);
  const n = frames - 1; // the last frame is the first again
  const tracks = clip.tracks.map((t) => {
    const [bone, prop] = t.name.split('.') as [string, 'quaternion' | 'position'];
    return { t, target: by[bone][prop], size: prop === 'position' ? 3 : 4 };
  });
  const pose = (i: number) => {
    for (const { t, target, size } of tracks) target.fromArray(t.values, i * size);
    space.updateMatrixWorld(true);
  };
  const floor = 0.002; // a little room, for the frames in between
  const v = new THREE.Vector3();
  // `space` stands still at the origin: world and person coincide
  const height = (s: Sole) => s.bone.localToWorld(v.copy(s.pt)).y;
  const legs = (['l', 'r'] as const).map((c, s) => {
    const leg = { thigh: by[`thigh_${c}`], calf: by[`calf_${c}`], foot: by[`foot_${c}`], ball: by[`ball_${c}`], sole: feet[s], hinge: new THREE.Vector3(), made: 0 };
    leg.made = ankleAngle(leg); // still in the pose the body was built in
    return leg;
  });
  for (const leg of legs) {
    // the knee's hinge, in the thigh's own frame: taken where the clip bends the knee most
    let most = 0;
    for (let i = 0; i < n; i++) {
      pose(i);
      const [hip, knee, ankle] = [leg.thigh, leg.calf, leg.foot].map((b) => b.getWorldPosition(new THREE.Vector3()));
      const across = knee.clone().sub(hip).cross(ankle.sub(knee));
      if (across.length() > most) {
        most = across.length();
        leg.hinge.copy(across.normalize().applyQuaternion(leg.thigh.getWorldQuaternion(new THREE.Quaternion()).invert()));
      }
    }
  }
  /** The clip's frame `i`, the feet pointing no further down than the shoes allow. */
  const shape = (i: number) => {
    pose(i);
    for (const l of legs) stiffen(space, l);
  };
  // how far each foot must come up: just what it would dip, so a planted foot never hovers
  const lift = legs.map((l) =>
    Array.from({ length: n }, (_, i) => {
      shape(i);
      return Math.max(0, floor - Math.min(height(l.sole.heel), height(l.sole.toe)));
    }),
  );
  const out = legs.map(() => ({ thigh: new Float32Array(frames * 4), calf: new Float32Array(frames * 4), foot: new Float32Array(frames * 4) }));
  for (let i = 0; i < frames; i++) {
    shape(i % n);
    legs.forEach((l, s) => {
      raiseFoot(space, l, lift[s][i % n]);
      l.thigh.quaternion.toArray(out[s].thigh, i * 4);
      l.calf.quaternion.toArray(out[s].calf, i * 4);
      l.foot.quaternion.toArray(out[s].foot, i * 4);
    });
  }
  legs.forEach((l, s) => {
    for (const { t } of tracks)
      for (const part of ['thigh', 'calf', 'foot'] as const) if (t.name === `${l[part].name}.quaternion`) t.values = out[s][part];
  });
}

type Leg = { thigh: THREE.Bone; calf: THREE.Bone; foot: THREE.Bone; ball: THREE.Bone; hinge: THREE.Vector3; made: number };

const at = (b: THREE.Bone) => b.getWorldPosition(new THREE.Vector3());
/** The angle between shin and foot (the ankle to the ball): smaller is pointed further down. */
const ankleAngle = (l: Leg) => at(l.foot).sub(at(l.calf)).angleTo(at(l.ball).sub(at(l.foot)));

/**
 * Turns the foot up where the clip points it further down than the shoe can follow: at most 15° past the
 * pose the shoe was made in, with a soft limit (well above it nothing changes; towards it the foot eases in).
 */
function stiffen(space: THREE.Object3D, l: Leg) {
  const low = l.made - THREE.MathUtils.degToRad(15), soft = THREE.MathUtils.degToRad(5);
  const now = ankleAngle(l);
  const want = low + soft * Math.log1p(Math.exp((now - low) / soft));
  if (want - now < 1e-4) return;
  // turning about shin × foot opens the angle between them
  const axis = at(l.foot).sub(at(l.calf)).cross(at(l.ball).sub(at(l.foot))).normalize();
  turnBy(space, l.foot, axis, want - now);
}

/**
 * Brings the foot `h` straight up, turned exactly as it was: the knee bends a little more and the thigh
 * swings to match. The shoe keeps its angle to the leg, so nothing pokes through anything.
 */
function raiseFoot(space: THREE.Object3D, l: Leg, h: number) {
  if (h <= 0) return;
  const hip = l.thigh.getWorldPosition(new THREE.Vector3());
  const knee = l.calf.getWorldPosition(new THREE.Vector3());
  const ankle = l.foot.getWorldPosition(new THREE.Vector3());
  const footTurn = l.foot.getWorldQuaternion(new THREE.Quaternion());
  const target = ankle.clone().setY(ankle.y + h);
  // the knee: bent until hip and ankle are as far apart as hip and target
  const a = hip.distanceTo(knee), b = knee.distanceTo(ankle);
  const c = Math.min(hip.distanceTo(target), a + b - 1e-5);
  const angle = (x: number) => Math.acos(THREE.MathUtils.clamp(x, -1, 1));
  const now = angle(hip.clone().sub(knee).dot(ankle.clone().sub(knee)) / (a * b));
  const want = angle((a * a + b * b - c * c) / (2 * a * b));
  const hinge = l.hinge.clone().applyQuaternion(l.thigh.getWorldQuaternion(new THREE.Quaternion())).normalize();
  turnBy(space, l.calf, hinge, now - want);
  // the thigh: swung so the ankle lands on the target
  const swing = new THREE.Quaternion().setFromUnitVectors(
    l.foot.getWorldPosition(new THREE.Vector3()).sub(hip).normalize(),
    target.sub(hip).normalize(),
  );
  const w = l.thigh.getWorldQuaternion(new THREE.Quaternion()).premultiply(swing);
  l.thigh.quaternion.copy(l.thigh.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(w));
  l.thigh.updateMatrixWorld(true);
  // the foot: turned back to how the clip had it
  l.foot.quaternion.copy(l.calf.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footTurn));
  l.foot.updateMatrixWorld(true);
}

/**
 * The clips come at 30 frames a second, and three.js goes from one to the next in a straight line: every joint
 * keeps one speed for a thirtieth of a second, then changes it at once. Thirty little jolts a second, and a
 * walk that feels jerky. So each clip is resampled four times as finely along a smooth curve through its own
 * frames (Catmull-Rom, round the loop): it passes through every frame the clip has, and in between the speed
 * changes gradually.
 */
function smoothen(clip: THREE.AnimationClip, frames: number, k = 4) {
  const n = frames - 1; // the last frame is the first again
  const times = new Float32Array(n * k + 1).map((_, i) => (i / (n * k)) * clip.duration);
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  clip.tracks = clip.tracks.map((track) => {
    const size = track.getValueSize(), v = track.values;
    const at = (i: number) => Array.from(v.subarray((((i % n) + n) % n) * size, (((i % n) + n) % n) * size + size));
    const out = new Float32Array(times.length * size);
    for (let i = 0; i < n; i++) {
      const p = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      // quaternions q and -q are the same turn: take the four on the same side, or the curve takes the long way
      if (size === 4) for (const q of [p[0], p[2], p[3]]) if (q[0] * p[1][0] + q[1] * p[1][1] + q[2] * p[1][2] + q[3] * p[1][3] < 0) for (let c = 0; c < 4; c++) q[c] = -q[c];
      for (let j = 0; j < k; j++) {
        const t = j / k, o = (i * k + j) * size;
        for (let c = 0; c < size; c++) out[o + c] = cr(p[0][c], p[1][c], p[2][c], p[3][c], t);
        if (size === 4) {
          const len = Math.hypot(out[o], out[o + 1], out[o + 2], out[o + 3]);
          for (let c = 0; c < 4; c++) out[o + c] /= len;
        }
      }
    }
    out.set(out.subarray(0, size), n * k * size);
    const Track = size === 4 ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new Track(track.name, times, out);
  });
}

/** Where every joint is in the pose bodies are bound in (for building a body elsewhere, as in Blender). */
export function bindPose(armX = 0.18) {
  const { list, by } = skeleton(armX);
  aPose(by);
  return list.map((b) => ({ name: b.name, parent: b.parent instanceof THREE.Bone ? b.parent.name : null, at: b.getWorldPosition(new THREE.Vector3()).toArray() }));
}

/* ---------------- The clips ---------------- */

const decode = (b64: string) => {
  const s = atob(b64);
  const out = new Float32Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = (((s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8)) << 16) >> 16) / 32767;
  return out;
};

let clipCache: Map<Move, THREE.AnimationClip> | null = null;
/** The clips, with the hips' movement scaled to our shorter legs and put on our hip joint. */
function clips(pelvisRest: THREE.Vector3) {
  if (clipCache) return clipCache;
  clipCache = new Map();
  const src = M.bones.find((b) => b.name === 'pelvis')!.t;
  const k = HIP / 0.932;
  for (const [name, c] of Object.entries(M.clips)) {
    const times = new Float32Array(c.frames).map((_, i) => i / M.fps);
    const tracks: THREE.KeyframeTrack[] = Object.entries(c.rot).map(([bone, b64]) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, decode(b64)));
    const pos = new Float32Array(c.pelvis.length);
    for (let i = 0; i < pos.length; i++) pos[i] = pelvisRest.getComponent(i % 3) + (c.pelvis[i] - src[i % 3]) * k;
    tracks.push(new THREE.VectorKeyframeTrack('pelvis.position', times, pos));
    const clip = new THREE.AnimationClip(name, c.dur, tracks);
    // sitters' feet hang where they hang: they are not on the ground they are measured from
    if (!/^(Sitting|Driving)/.test(name)) plant(clip, c.frames);
    smoothen(clip, c.frames);
    clipCache.set(name as Move, clip);
  }
  return clipCache;
}

/* ---------------- An actor ---------------- */

export type Actor = ReturnType<typeof actor>;

/* ---------------- The body from Blender ---------------- */

let made: Promise<Made> | null = null;
/** Loads public/people/person.glb (made by blender/person.py) once, its bone numbers turned into the actor's. */
export function loadBody() {
  made ??= new GLTFLoader().loadAsync('/people/person.glb').then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const ours = M.bones.map((b) => b.name);
    const parts: Record<string, THREE.BufferGeometry> = {};
    gltf.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const g = m.geometry.clone();
      const names = m.skeleton.bones.map((b) => b.name);
      const src = g.attributes.skinIndex, w = g.attributes.skinWeight;
      const idx = new Uint16Array(src.count * 4), wt = new Float32Array(src.count * 4);
      for (let i = 0; i < src.count; i++)
        for (let k = 0; k < 4; k++) {
          idx[i * 4 + k] = Math.max(0, ours.indexOf(names[src.getComponent(i, k)]));
          wt[i * 4 + k] = w.getComponent(i, k);
        }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      parts[m.name] = g;
    });
    return parts;
  });
  return made;
}

export function actor(seed: number, material: THREE.Material, wish?: Wish, body?: Made) {
  const f = figure(seed, wish);
  // a body from Blender was built around the standard skeleton; ours is only stretched for code-built bodies
  const { list, by } = skeleton(body ? 0.18 : f.armX);
  const pelvisRest = by.pelvis.position.clone();
  aPose(by);
  const index = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const g = f.dressed((n) => by[n].getWorldPosition(new THREE.Vector3()), (n) => index[n], body);
  const mesh = new THREE.SkinnedMesh(g, material);
  mesh.add(list[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.castShadow = true;
  const sole = soles(by);
  mesh.scale.setScalar(f.size);
  const mixer = new THREE.AnimationMixer(mesh);
  const all = clips(pelvisRest);
  const axis = new THREE.Vector3();
  // What the ground check changed, to be put back before the next frame. The mixer only writes a bone when the
  // clip's value changes, so a correction left in place would stick (a toe stayed bent all through a stride).
  const touched = new Map<THREE.Bone, THREE.Quaternion>();
  // How far each correction is turned now. It comes on at once (nothing may go through the floor) but lets go
  // over a fifth of a second, or the toes flick back the moment the foot leaves the ground.
  const held = new Map<THREE.Bone, number>();
  /** Turns the bone about its joint, around a level axis, enough to bring the point up to the ground. */
  const lift = (s: Sole, dt: number) => {
    const { bone } = s;
    const need = needed(mesh, s, axis);
    const turn = Math.max(need, (held.get(bone) ?? 0) - 4.5 * dt);
    held.set(bone, turn);
    if (turn <= 0) return;
    if (!touched.has(bone)) touched.set(bone, bone.quaternion.clone());
    turnBy(mesh, bone, axis, turn);
  };
  let current: THREE.AnimationAction | null = null;
  return {
    mesh,
    bones: by,
    mixer,
    size: f.size,
    long: f.long,
    hold: f.hold,
    /** Starts a clip, fading over from the one before. */
    play(move: Move, fade = 0.35, offset = 0) {
      const next = mixer.clipAction(all.get(move)!);
      if (next === current) return next;
      next.reset();
      next.time = offset * next.getClip().duration;
      next.play();
      if (current) next.crossFadeFrom(current, fade, true);
      current = next;
      return next;
    },
    /** Moves the animation on by dt seconds and (unless they sit) keeps the feet out of the floor. */
    update(dt: number, feet = true) {
      for (const [b, q] of touched) b.quaternion.copy(q);
      touched.clear();
      mixer.update(dt);
      if (feet) this.ground(dt);
    },
    /** Turns the head `yaw` radians about the vertical, on top of what the clip does (after update). */
    look(yaw: number) {
      const b = by.Head;
      if (!touched.has(b)) touched.set(b, b.quaternion.clone());
      const { q, m, w } = tmp;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      b.getWorldQuaternion(w).premultiply(q);
      b.parent!.getWorldQuaternion(m);
      b.quaternion.copy(m.invert().multiply(w));
    },
    /**
     * After the animation has moved the bones: no heel or shoe tip below the ground (the person's own origin).
     * The clips already keep the feet up (see plant); this catches what is left, as in a fade between two clips.
     */
    ground(dt = 0) {
      mesh.updateMatrixWorld(true);
      for (const f of sole) {
        lift(f.heel, dt);
        lift(f.toe, dt);
      }
    },
    /**
     * Frees the body on the GPU (three.js uploads it again should it be drawn after all). The animation is left
     * running: React in development unmounts and remounts every component once, and a person stopped then
     * stood in the starting pose for good. One that is really gone takes its mixer with it.
     */
    dispose() {
      g.dispose();
    },
  };
}

const hips = new Map<Move, THREE.Vector3>();
/** Where the hip joints are at the start of a clip, for someone of size 1 standing at the origin facing +z: to put a sitter on a seat. */
export function hipsIn(move: Move, material: THREE.Material) {
  if (!hips.has(move)) {
    const a = actor(1, material);
    a.mesh.scale.setScalar(1);
    a.play(move, 0);
    a.mixer.setTime(0);
    a.mesh.updateMatrixWorld(true);
    hips.set(move, a.bones.thigh_l.getWorldPosition(new THREE.Vector3()).add(a.bones.thigh_r.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5));
    a.dispose();
  }
  return hips.get(move)!;
}

/**
 * How fast this walk carries a person of size 1, in m/s: the speed at which the foot on the ground moves
 * backwards. Walk at that speed (times their size) and the feet stay where they land.
 */
export function pace(move: Move, material: THREE.Material) {
  const a = actor(1, material);
  a.mesh.scale.setScalar(1);
  const act = a.play(move, 0);
  const clip = act.getClip();
  const n = 80;
  const v = new THREE.Vector3();
  const ys: number[] = [], zs: number[] = [];
  for (let i = 0; i <= n; i++) {
    a.mixer.setTime((clip.duration * i) / n);
    a.mesh.updateMatrixWorld(true);
    a.bones.ball_l.getWorldPosition(v);
    ys.push(v.y);
    zs.push(v.z);
  }
  const low = Math.min(...ys);
  let sum = 0, count = 0;
  for (let i = 1; i <= n; i++)
    if (ys[i] < low + 0.012 && ys[i - 1] < low + 0.012) {
      sum += zs[i - 1] - zs[i];
      count++;
    }
  a.dispose();
  return count ? sum / count / (clip.duration / n) : 1;
}
