'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type Actor, actor, hipsIn, type Move, pace } from './actor';
import type { Made } from './character';
import { sitterSpots } from './folk';
import { BRIDGE, FAR, QUAY } from './houses';

// The people on the quays: each one an actor (actor.ts) with hand-made animations. They walk at the speed
// their walk was made for, so the feet stay where they land; now and then someone stops, turns to the
// water and stands about (pairs talk), and walks on. Others sit on the edge of the quay.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A slow look to one side, held, then to the other: nobody turns their head like a pendulum. */
const glance = (t: number) => Math.tanh(2.6 * Math.sin(t));

type Mode = 'walk' | 'slow' | 'look' | 'go';

function cast(material: THREE.Material, body: Made, v0: number) {
  const all = Array.from({ length: 24 }, (_, i) => {
    const bank = i % 2 ? 1 : -1;
    const inset = 1.6 + (((i * 13) % 10) / 10) * 4.2;
    const a = actor(i + 1, material, { lod: 0.6 }, body);
    const dir = (i >> 1) % 2 ? 1 : -1;
    return {
      a,
      act: null as THREE.AnimationAction | null,
      move: '' as Move | '',
      bank,
      dir,
      x: -10 + (((i * 37) % 100) / 100) * (BRIDGE + 20),
      z: bank > 0 ? inset : FAR - inset,
      // the speed their walk was made for, give or take
      cruise: v0 * a.size * (0.95 + ((i * 7) % 5) * 0.05),
      v: 0,
      heading: (dir * Math.PI) / 2,
      mode: 'walk' as Mode,
      timer: 6 + ((i * 53) % 34),
      seed: i * 1.7,
      lead: -1,
      beside: 0,
      near: true,
    };
  });
  // Some walk in twos: the second keeps to the first one's side and pace.
  for (const i of [2, 7, 12, 17]) {
    const a = all[i];
    const b = all[i + 2];
    b.lead = i;
    b.dir = a.dir;
    b.heading = a.heading;
    b.z = a.z + (a.z > QUAY ? -0.62 : 0.62) * (i % 4 ? 1 : -1);
    a.timer = b.timer = Infinity;
    a.cruise = b.cruise = Math.min(a.cruise, b.cruise);
    a.beside = b.z > a.z ? 1 : -1;
    b.beside = -a.beside;
  }
  for (const p of all) p.v = p.cruise;
  return all;
}

export function People({ material, body }: { material: THREE.Material; body: Made }) {
  const v0 = useMemo(() => pace('Walk_Loop', material), [material]);
  const people = useMemo(() => cast(material, body, v0), [material, body, v0]);
  const clock = useRef(0);
  useEffect(() => () => people.forEach((p) => p.a.dispose()), [people]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = (clock.current += dt);
    const eye = state.camera.position.x;
    for (const p of people) {
      const walkTo = (p.dir * Math.PI) / 2;
      const water = p.bank > 0 ? 0 : Math.PI;
      let want = walkTo;
      let pace = p.cruise;

      if (p.lead >= 0) {
        const a = people[p.lead];
        p.x = a.x + 0.14 * a.dir;
        p.v = a.v;
      } else {
        // Now and then someone stops, turns to the water, looks for a while and walks on.
        if (p.mode === 'walk') {
          p.timer -= dt;
          if (p.timer < 0 && p.x > 4 && p.x < BRIDGE - 6) p.mode = 'slow';
        } else if (p.mode === 'slow') {
          pace = 0;
          if (p.v < 0.02) {
            p.mode = 'look';
            p.timer = 5 + ((p.seed * 7 + t) % 6);
          }
        } else if (p.mode === 'look') {
          pace = 0;
          want = water;
          p.timer -= dt;
          if (p.timer < 0) {
            p.mode = 'go';
            if ((p.seed * 3 + t) % 4 < 1) p.dir = -p.dir; // some turn back the way they came
          }
        } else {
          pace = 0;
          want = (p.dir * Math.PI) / 2;
          if (Math.abs(Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading))) < 0.2) {
            p.mode = 'walk';
            p.timer = 18 + ((p.seed * 11 + t) % 30);
          }
        }
        p.v += clamp(pace - p.v, -1.6 * dt, 1.2 * dt);
        p.x += p.dir * p.v * dt;
        if (p.x > BRIDGE + 4) p.x = -12;
        if (p.x < -12) p.x = BRIDGE + 4;
      }
      const turn = Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading));
      p.heading += clamp(turn, -2.4 * dt, 2.4 * dt);

      const m = p.a.mesh;
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.heading;
      // Nobody behind the boat is ever in view, and far away a shadow is a pixel or two.
      m.visible = p.x > eye - 20;
      const near = p.x < eye + 70;
      if (near !== p.near) {
        p.near = near;
        m.castShadow = near;
      }
      if (!m.visible) continue;

      // walking at their own pace, or standing about: pairs talk, the rest look at the water
      const walking = p.v > 0.25 * p.cruise;
      const move: Move = walking ? 'Walk_Loop' : p.beside || (p.seed | 0) % 3 === 0 ? 'Idle_Talking_Loop' : 'Idle_Loop';
      if (move !== p.move) {
        p.act = p.a.play(move, 0.45, (p.seed * 0.37) % 1);
        p.move = move;
      }
      if (p.act) p.act.timeScale = walking ? clamp(p.v / (v0 * p.a.size), 0.55, 1.4) : 1;
      p.a.update(dt, near);
      if (!walking && !p.beside) p.a.look(0.35 * glance(t * 0.21 + p.seed));
    }
  });

  return (
    <group>
      {people.map((p, i) => (
        <primitive key={i} object={p.a.mesh} />
      ))}
    </group>
  );
}

/** Puts a sitter's hips at `seat` (the top of what they sit on) facing `turn`, a hand's breadth back from the front edge. */
export function seatActor(a: Actor, seat: THREE.Vector3, turn: number, material: THREE.Material, move: Move = 'Sitting_Idle_Loop') {
  const h = hipsIn(move, material).clone().multiplyScalar(a.size);
  const back = new THREE.Vector3(0, 0, -0.06 * a.size).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  a.mesh.rotation.y = turn;
  a.mesh.position.copy(seat).add(back).add(new THREE.Vector3(0, 0.085 * a.size, 0)).sub(h.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn));
}

/** People sitting on the edge of both quays, legs over the water. Some talk to the one beside them; all look about. */
export function Sitters({ material, body }: { material: THREE.Material; body: Made }) {
  const list = useMemo(
    () =>
      sitterSpots(BRIDGE - 20, QUAY + 0.35, FAR).map((sp, i) => {
        const a = actor(sp.seed, material, { kinds: ['tee', 'tee', 'stripes', 'jacket', 'hoodie'], lod: 0.6 }, body);
        const move: Move = i % 3 === 1 ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
        a.play(move, 0, (i * 0.37) % 1);
        seatActor(a, new THREE.Vector3(sp.x, 0.09, sp.z), sp.turn, material);
        return { a, talk: move === 'Sitting_Talking_Loop', seed: i * 2.1 };
      }),
    [material, body],
  );
  useEffect(() => () => list.forEach((s) => s.a.dispose()), [list]);
  const clock = useRef(0);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = (clock.current += dt);
    const eye = state.camera.position.x;
    for (const s of list) {
      const m = s.a.mesh;
      m.visible = m.position.x > eye - 20;
      if (!m.visible) continue;
      s.a.update(dt, false);
      if (!s.talk) s.a.look(0.5 * glance(t * (0.21 + (s.seed % 4) * 0.04) + s.seed));
    }
  });
  return (
    <group>
      {list.map((s, i) => (
        <primitive key={i} object={s.a.mesh} />
      ))}
    </group>
  );
}

