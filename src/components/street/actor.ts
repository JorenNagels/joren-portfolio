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
    clipCache.set(name as Move, new THREE.AnimationClip(name, c.dur, tracks));
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
  mesh.scale.setScalar(f.size);
  // Points on the sole that must stay above the ground: the back of the heel (moves with the foot) and the
  // tip of the shoe (moves with the toes). Taken now, in the pose the body was built in.
  const sole = (['l', 'r'] as const).map((c) => {
    const x = by[`foot_${c}`].getWorldPosition(new THREE.Vector3()).x;
    return {
      foot: by[`foot_${c}`],
      ball: by[`ball_${c}`],
      heel: by[`foot_${c}`].worldToLocal(new THREE.Vector3(x, 0.004, -0.078)),
      toe: by[`ball_${c}`].worldToLocal(new THREE.Vector3(x, 0.004, 0.185)),
    };
  });
  const mixer = new THREE.AnimationMixer(mesh);
  const all = clips(pelvisRest);
  const tmp = { p: new THREE.Vector3(), o: new THREE.Vector3(), k: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Quaternion(), w: new THREE.Quaternion() };
  // What the ground check changed, to be put back before the next frame. The mixer only writes a bone when the
  // clip's value changes, so a correction left in place would stick (a toe stayed bent all through a stride).
  const touched = new Map<THREE.Bone, THREE.Quaternion>();
  // How far each correction is turned now. It comes on at once (nothing may go through the floor) but lets go
  // over a fifth of a second, or the toes flick back the moment the foot leaves the ground.
  const held = new Map<THREE.Bone, number>();
  /** Turns `bone` about its joint, around a level axis, enough to bring `pt` (fixed to the bone) up to the ground. */
  const lift = (bone: THREE.Bone, pt: THREE.Vector3, dt: number) => {
    const { p, o, k, q, m, w } = tmp;
    mesh.worldToLocal(bone.localToWorld(p.copy(pt)));
    mesh.worldToLocal(bone.getWorldPosition(o));
    p.sub(o);
    const len = p.length();
    const flat = Math.hypot(p.x, p.z);
    if (len < 1e-4 || flat < 1e-4) return;
    const need = Math.max(0, Math.asin(THREE.MathUtils.clamp(-o.y / len, -1, 1)) - Math.atan2(p.y, flat));
    const turn = Math.max(need, (held.get(bone) ?? 0) - 4.5 * dt);
    held.set(bone, turn);
    if (turn <= 0) return;
    if (!touched.has(bone)) touched.set(bone, bone.quaternion.clone());
    k.set(p.x / flat, 0, p.z / flat).cross(new THREE.Vector3(0, 1, 0)).normalize();
    // the turn in the person's own space, then in the world, then relative to the bone's parent
    mesh.getWorldQuaternion(m);
    q.setFromAxisAngle(k, turn).premultiply(m).multiply(m.clone().invert());
    bone.getWorldQuaternion(w).premultiply(q);
    bone.parent!.getWorldQuaternion(m);
    bone.quaternion.copy(m.invert().multiply(w));
    bone.updateMatrixWorld(true);
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
    /**
     * After the animation has moved the bones: no heel or shoe tip below the ground (the person's own origin).
     * The clip was made for other feet; ours are longer and would dip into the floor and pop back out.
     */
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
    ground(dt = 0) {
      mesh.updateMatrixWorld(true);
      for (const f of sole) {
        lift(f.foot, f.heel, dt);
        lift(f.ball, f.toe, dt);
      }
    },
    dispose() {
      mixer.stopAllAction();
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
