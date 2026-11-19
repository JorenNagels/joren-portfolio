'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Poster } from './houses';
import { MIDSTREAM } from './plan';
import type { StreetState } from './StreetScene';
import { toonMaterial } from './toon';

// A gull that shows you the first poster. The first poster hangs a little ahead of where the boat sets off, at the
// edge of the picture or just past it, so the gull flies in as you come down into the boat, across the view, and
// lands on the poster's frame. While the poster is out of the picture it now and then flies out over the water, in
// front of you, and back, so your eye follows it there. Once you look, it pecks at the paper; point at the poster
// and it hops; open a poster and it is off, over the roofs, for good.
// The camera goes with it (see Cue): it follows the gull in across the river, round to the poster, holds there while
// the poster swells and the gull pecks at it, and hands the view back. The first trip out to fetch you is followed
// the same way; after that the gull goes on its own.

const SIZE = 2.2; // a toy town's gull: twice as big as a real one, or the ink lines leave nothing of it from the boat
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const cache = new Map<string, THREE.MeshToonMaterial>();
function paint(color: string) {
  if (!cache.has(color)) {
    const m = toonMaterial();
    m.vertexColors = false;
    m.color.set(color);
    cache.set(color, m);
  }
  return cache.get(color)!;
}
const WHITE = '#f6f4ec';
const GREY = '#c3cbd0';
const TIP = '#2f3236';
const BEAK = '#e8b23a';
const LEGS = '#d9894a';

type Wing = { roll: THREE.Group; sweep: THREE.Group; outer: THREE.Group; s: number };
type Bird = { root: THREE.Group; torso: THREE.Group; neck: THREE.Group; wings: Wing[]; legs: THREE.Group; meshes: THREE.Mesh[] };

/** The gull, in metres, facing +x with its feet at the origin. */
function build(): Bird {
  const meshes: THREE.Mesh[] = [];
  const mesh = (g: THREE.BufferGeometry, color: string, parent: THREE.Object3D, at: [number, number, number], scale?: [number, number, number]) => {
    const m = new THREE.Mesh(g, paint(color));
    m.position.set(...at);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const ball = new THREE.SphereGeometry(1, 14, 10);
  const root = new THREE.Group();
  // the torso turns about the hips: forward to peck, up to land
  const torso = new THREE.Group();
  torso.position.y = 0.09;
  root.add(torso);
  mesh(ball, WHITE, torso, [0, 0.08, 0], [0.2, 0.095, 0.09]);
  // tail: grey on top, a dark tip
  const tail = new THREE.Group();
  tail.position.set(-0.17, 0.1, 0);
  tail.rotation.z = 0.12;
  torso.add(tail);
  mesh(new THREE.BoxGeometry(0.12, 0.02, 0.08), WHITE, tail, [-0.05, 0, 0]);
  mesh(new THREE.BoxGeometry(0.04, 0.022, 0.08), TIP, tail, [-0.12, 0, 0]);
  // head
  const neck = new THREE.Group();
  neck.position.set(0.13, 0.13, 0);
  torso.add(neck);
  mesh(ball, WHITE, neck, [0.04, 0.05, 0], [0.065, 0.06, 0.055]);
  const beak = mesh(new THREE.ConeGeometry(0.017, 0.075, 8), BEAK, neck, [0.135, 0.04, 0]);
  beak.rotation.z = -Math.PI / 2;
  // wings: they roll (flap) at the shoulder, sweep back to fold, and bend at the wrist
  const wings = [-1, 1].map((s) => {
    const roll = new THREE.Group();
    roll.position.set(0.05, 0.13, s * 0.06);
    torso.add(roll);
    const sweep = new THREE.Group();
    roll.add(sweep);
    mesh(new THREE.BoxGeometry(0.15, 0.02, 0.27), GREY, sweep, [-0.02, 0, s * 0.135]);
    const outer = new THREE.Group();
    outer.position.set(0, 0, s * 0.27);
    sweep.add(outer);
    mesh(new THREE.BoxGeometry(0.11, 0.016, 0.2), GREY, outer, [-0.03, 0, s * 0.1]);
    mesh(new THREE.BoxGeometry(0.08, 0.018, 0.1), TIP, outer, [-0.045, 0, s * 0.25]);
    return { roll, sweep, outer, s };
  });
  // legs
  const legs = new THREE.Group();
  root.add(legs);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 6), LEGS, legs, [0, 0.05, s * 0.03]);
    mesh(new THREE.BoxGeometry(0.05, 0.008, 0.03), LEGS, legs, [0.015, 0.004, s * 0.03]);
  }
  root.scale.setScalar(SIZE);
  return { root, torso, neck, wings, legs, meshes };
}

/** Spreads the wings (open 1) or folds them along the back (open 0), flapping by `flap` radians up. */
function wingPose(b: Bird, open: number, flap: number, bend: number) {
  for (const w of b.wings) {
    w.sweep.rotation.y = -w.s * (1.5 * (1 - open) + 0.12 * open);
    w.roll.rotation.x = w.s * 0.9 * (1 - open) - w.s * flap * open;
    w.outer.rotation.x = -w.s * bend * open;
  }
}

/**
 * Where the camera should look, written here every frame and read by the camera (StreetScene.tsx): at the gull
 * while it flies in, then at the poster for a while. `want` 1 = look, 0 = let go. `pulse` swells the poster.
 */
export type Cue = { want: number; x: number; y: number; z: number; push: number; pulse: number; id: string | null };
const HOLD = 2.4; // seconds the camera stays on the poster once the gull is down
const FOLLOWED = 2; // flights the camera goes along with: the one in, and the first trip out to fetch you
/** Two swells of the poster while the camera holds on it: 0 to 1 and back, twice. */
const swell = (h: number) => {
  const bump = (c: number) => (Math.abs(h - c) < 0.25 ? Math.sin(((h - c + 0.25) / 0.5) * Math.PI) : 0);
  return bump(0.7) + bump(1.4);
};

type Flight = { curve: THREE.CatmullRomCurve3; dur: number; t: number; land: boolean; ease: (u: number) => number; after: 'perch' | 'gone' };
type Act = { kind: 'peck' | 'look' | 'shuffle' | 'call' | 'stretch'; t: number; dur: number; a: number };

export function Gull({ poster, state, hovered, onOpen, cue }: { poster: Poster; state: RefObject<StreetState>; hovered: RefObject<string | null>; onOpen: (id: string) => void; cue: RefObject<Cue> }) {
  const bird = useMemo(build, []);
  // On a touch screen the boat sails itself, so there is no scrolling to wait for.
  const coarse = useMemo(() => matchMedia('(pointer: coarse)').matches, []);
  const v = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), ndc: new THREE.Vector3(), m: new THREE.Matrix4(), up: new THREE.Vector3(), side: new THREE.Vector3(), fw: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  // Where it stands: on top of the iron frame, towards the boat's end of it.
  const frame = useMemo(() => {
    const y = poster.y + poster.h / 2 + 0.17;
    const z = poster.z - poster.nz * 0.08;
    // between the two lamps, which hang a third of the way in from either side
    return { y, z, x0: poster.x - poster.w / 3 + 0.75, x1: poster.x + poster.w / 3 - 0.75 };
  }, [poster]);
  const g = useRef({
    mode: 'away' as 'away' | 'fly' | 'perch' | 'gone',
    fly: null as Flight | null,
    act: null as Act | null,
    x: poster.x - 0.3, // where along the frame
    heading: Math.PI,
    yaw: 0, // head, relative to the body
    pitch: 0,
    clock: 0,
    next: 1.5, // seconds to the next thing it does on the frame
    beckon: 12, // seconds the poster may stay out of the picture before it flies out to fetch you
    beckons: 0,
    away: 0,
    hop: 0, // a startled hop, 1 to 0
    bank: 0,
    learned: false,
    follow: false, // the camera is going along with this flight
    follows: 0,
    hold: 0, // seconds left of the camera's look at the poster
    lastP: -1,
    still: 0, // when the scroll last moved
  });

  const perch = (out: THREE.Vector3) => out.set(g.current.x, frame.y, frame.z);
  const fly = (points: THREE.Vector3[], dur: number, land: boolean, ease: (u: number) => number, after: Flight['after'], follow = false) => {
    const G = g.current;
    G.fly = { curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'), dur, t: 0, land, ease, after };
    G.mode = 'fly';
    G.act = null;
    G.follow = follow && !state.current.reduced && G.follows < FOLLOWED;
    if (G.follow) G.follows++;
  };

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const G = g.current;
    const s = state.current;
    const t = (G.clock += dt);
    // the boat, rather than the camera: that may still be up in the opening shot, or at a poster
    const cam = { x: s.x, z: MIDSTREAM };
    const { root, torso, neck, legs } = bird;
    v.ndc.set(poster.x, poster.y, poster.z).project(camera);
    const seen = v.ndc.z < 1 && Math.abs(v.ndc.x) < 0.85 && Math.abs(v.ndc.y) < 0.95;
    // still ahead of the boat, or beside it: once you have sailed past, there is nothing to fetch you for
    const ahead = poster.x > cam.x - 3;

    if (s.p !== G.lastP) {
      G.lastP = s.p;
      G.still = t;
    }
    const settled = coarse || t - G.still > 0.6;

    // Opening a poster sends it off, and the camera is yours again.
    if (s.focus && !G.learned) {
      G.learned = true;
      G.follow = false;
      G.hold = 0;
      if (G.mode === 'perch' || G.mode === 'fly') {
        const from = G.mode === 'fly' && G.fly ? G.fly.curve.getPointAt(G.fly.ease(clamp01(G.fly.t / G.fly.dur))) : perch(new THREE.Vector3());
        fly(
          [from, from.clone().add(new THREE.Vector3(-2, 2.5, poster.nz * 3)), new THREE.Vector3(poster.x - 14, frame.y + 12, poster.z + poster.nz * 18), new THREE.Vector3(poster.x - 40, frame.y + 30, MIDSTREAM + poster.nz * 60)],
          4,
          false,
          (u) => u * u * 0.6 + u * 0.4,
          'gone',
        );
      } else G.mode = 'gone';
    }

    // Decided once you are coming down into the boat (before that, the camera is all over the place). It waits until
    // you are in and have stopped scrolling, as the camera will follow it.
    if (G.mode === 'away' && !G.learned && s.intro > 0.85 && !s.arrival) {
      if (s.reduced || !ahead) {
        G.mode = 'perch';
      } else if (s.intro >= 1 && settled) {
        // In from ahead and high on the far side, across the view in front of the boat, and round to the frame.
        const P = perch(new THREE.Vector3());
        fly(
          [
            // low enough that the camera following it never tips up to the name hanging in the sky
            new THREE.Vector3(cam.x + 72, 9, MIDSTREAM + poster.nz * 14),
            new THREE.Vector3(cam.x + 46, 7, MIDSTREAM + poster.nz * 10),
            new THREE.Vector3(cam.x + 18, 4.6, MIDSTREAM + poster.nz * 2),
            new THREE.Vector3(cam.x + 13, 4.2, MIDSTREAM - poster.nz * 3),
            new THREE.Vector3(P.x - 3.5, P.y + 1.4, P.z + poster.nz * 4),
            new THREE.Vector3(P.x - 0.5, P.y + 0.35, P.z + poster.nz * 0.6),
            P,
          ],
          6.2,
          true,
          (u) => 1 - Math.pow(1 - u, 1.7),
          'perch',
          true,
        );
      }
    }

    let open = 0;
    let flap = 0;
    let bend = 0;
    let tuck = 0;
    let pitch = 0;
    let headYaw = 0;
    let headPitch = 0;

    if (G.mode === 'fly' && G.fly) {
      const F = G.fly;
      F.t += dt;
      const u = clamp01(F.t / F.dur);
      const k = F.ease(u);
      F.curve.getPointAt(k, v.p);
      F.curve.getTangentAt(k, v.t);
      root.position.copy(v.p);
      // Heading along the path, banked into the turn, nose following the climb (levelled out, it looks calmer).
      const want = Math.atan2(-v.t.z, v.t.x);
      const turn = wrap(want - G.heading);
      G.heading = want;
      G.bank += (THREE.MathUtils.clamp(-turn / Math.max(dt, 1e-3) * 0.35, -0.75, 0.75) - G.bank) * (1 - Math.exp(-dt * 5));
      const climb = Math.asin(THREE.MathUtils.clamp(v.t.y, -1, 1)) * 0.6;
      // the landing: flare, nose up, wings beating hard, legs out
      const flare = F.land ? clamp01((u - 0.84) / 0.16) : 0;
      const takeoff = clamp01(1 - F.t / 0.5);
      root.rotation.set(G.bank * (1 - flare), want, climb * (1 - flare) + flare * 0.55, 'YXZ');
      // flap when climbing, taking off or landing; glide in between, with a beat now and then
      const beating = takeoff > 0 || flare > 0 || v.t.y > 0.12 || Math.sin(t * 0.9) > 0.55;
      const rate = beating ? 15 : 0;
      open = 1;
      flap = beating ? 0.25 + 0.7 * Math.sin(t * rate) * (0.7 + 0.3 * flare) : 0.12 + 0.03 * Math.sin(t * 2);
      bend = beating ? 0.45 * Math.sin(t * rate - 0.9) : 0.05;
      tuck = 1 - flare;
      if (u >= 1) {
        G.fly = null;
        G.mode = F.after;
        G.next = 0.8;
        G.heading = Math.PI;
        G.bank = 0;
        if (F.after === 'perch') G.hop = 0.6; // a little bounce as it lands
        if (G.follow && F.after === 'perch') {
          G.hold = HOLD;
          G.act = { kind: 'peck', t: -0.5, dur: 0.9, a: 0 }; // pecks at the paper while it swells
          G.next = 1.2;
        }
        G.follow = false;
      }
    } else if (G.mode === 'perch') {
      // Out of the picture for a while, and you have not opened it: go and fetch them.
      if (!s.reduced && !G.learned && ahead && !seen && !s.focus) G.away += dt;
      else G.away = 0;
      if (G.away > G.beckon && G.beckons < 6) {
        G.away = 0;
        G.beckons++;
        G.beckon = Math.min(20, G.beckon * 1.6);
        const P = perch(new THREE.Vector3());
        // out over the water to a point well inside the view from the boat, a turn there, and back
        const fx = cam.x + 13;
        fly(
          [
            P.clone(),
            new THREE.Vector3(P.x - 1.5, P.y + 1.2, P.z + poster.nz * 3),
            new THREE.Vector3(fx, 4.4, MIDSTREAM - poster.nz * 2.5),
            new THREE.Vector3(fx + 3, 4.0, MIDSTREAM + poster.nz * 2.5),
            new THREE.Vector3(fx + 1, 4.8, MIDSTREAM - poster.nz * 5.5),
            new THREE.Vector3(P.x - 2.5, P.y + 1.1, P.z + poster.nz * 3.2),
            new THREE.Vector3(P.x - 0.4, P.y + 0.3, P.z + poster.nz * 0.5),
            P,
          ],
          5.5,
          true,
          easeInOut,
          'perch',
          true,
        );
      } else {
        // Stands sideways on the frame, turned a little towards the boat; pecks, looks about, shuffles, calls.
        if (!G.act) {
          G.next -= dt;
          if (G.next < 0) {
            const r = Math.random();
            const kind: Act['kind'] = r < 0.42 ? 'peck' : r < 0.64 ? 'look' : r < 0.8 ? 'shuffle' : r < 0.9 ? 'call' : 'stretch';
            const dur = { peck: 0.9, look: 1.6, shuffle: 0.7, call: 1.1, stretch: 1.3 }[kind];
            let a = Math.random() * 2 - 1;
            if (kind === 'shuffle') a = THREE.MathUtils.clamp(G.x + (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.4), frame.x0, frame.x1);
            G.act = { kind, t: 0, dur, a };
            G.next = 0.6 + Math.random() * 1.8;
          }
        }
        // its heading on the frame: towards the boat, but never so far round that its tail goes into the wall
        v.fw.set(cam.x - G.x, 0, cam.z - frame.z).normalize();
        if (v.fw.z * poster.nz < 0.35) {
          v.fw.z = 0.35 * poster.nz;
          v.fw.x = -Math.sqrt(1 - 0.35 * 0.35);
        }
        let face = Math.atan2(-v.fw.z, v.fw.x);
        const A = G.act;
        if (A) {
          A.t += dt;
          const u = clamp01(A.t / A.dur);
          const bump = Math.sin(u * Math.PI);
          if (A.kind === 'peck') {
            // turn to the water and dab at the top of the paper, twice
            face = Math.atan2(-poster.nz, 0);
            pitch = -0.75 * Math.abs(Math.sin(u * Math.PI * 2)) * (u < 0.15 ? u / 0.15 : 1);
            headPitch = pitch * 0.9;
          } else if (A.kind === 'look') headYaw = A.a * 1.1 * bump;
          else if (A.kind === 'shuffle') {
            G.x += (A.a - G.x) * clamp01(dt * 5);
            G.hop = Math.max(G.hop, 0.35 * bump);
          } else if (A.kind === 'call') {
            // head thrown back, twice
            headPitch = 0.9 * Math.abs(Math.sin(u * Math.PI * 2));
            pitch = 0.15 * bump;
          } else if (A.kind === 'stretch') {
            open = 0.6 * bump;
            flap = 0.5;
          }
          if (u >= 1) G.act = null;
        } else headYaw = 0.4 * Math.sin(t * 0.7);
        G.heading += wrap(face - G.heading) * (1 - Math.exp(-dt * 6));
        // Pointing at the poster startles it: a hop and a flutter.
        if (hovered.current === poster.id && G.hop < 0.05 && !s.reduced) G.hop = 1;
        root.position.set(G.x, frame.y + 0.28 * Math.sin(Math.PI * G.hop), frame.z);
        if (G.hop > 0) {
          open = Math.max(open, Math.sin(Math.PI * G.hop));
          flap = Math.max(flap, 0.6 + 0.4 * Math.sin(t * 22));
          G.hop = Math.max(0, G.hop - dt * 1.6);
        }
        root.rotation.set(0, G.heading, 0, 'YXZ');
      }
    }

    // --- What the camera should look at.
    const C = cue.current;
    if (G.mode === 'fly' && G.follow && G.fly) {
      // a little ahead of the gull, along its path, so the camera leads rather than trails
      C.want = 1;
      C.x = root.position.x + v.t.x * 2;
      C.y = root.position.y + v.t.y * 2;
      C.z = root.position.z + v.t.z * 2;
      C.push = 0;
      C.pulse = 0;
    } else if (G.mode === 'perch' && G.hold > 0) {
      G.hold = s.focus ? 0 : G.hold - dt;
      C.want = G.hold > 0 ? 1 : 0;
      C.x = poster.x;
      C.y = poster.y + 0.4; // the gull on top in the picture too
      C.z = poster.z;
      C.push = 0.35;
      C.pulse = swell(HOLD - G.hold);
    } else {
      C.want = 0;
      C.pulse = 0;
    }

    root.visible = G.mode === 'fly' || G.mode === 'perch';
    G.pitch += (pitch - G.pitch) * (1 - Math.exp(-dt * 14));
    torso.rotation.z = G.pitch + 0.12; // stands a little nose-up
    neck.rotation.set(0, (G.yaw += (headYaw - G.yaw) * (1 - Math.exp(-dt * 8))), headPitch * 0.8);
    wingPose(bird, open, flap, bend);
    legs.scale.y = 1 - 0.75 * tuck;
    legs.rotation.z = 0.9 * tuck;
  });

  return (
    <primitive
      object={bird.root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta > 6) return;
        onOpen(poster.id);
      }}
    />
  );
}
