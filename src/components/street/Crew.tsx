'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type Actor, actor, type Move } from './actor';
import { seatActor } from './People';
import type { Made } from './character';
import type { Rider } from './folk';
import { RIG } from './folk';

// The people in the boats. Passengers and skippers are actors (actor.ts) with hand-made animations: sitting,
// talking, standing about, and they look at the houses on either side. A kayaker is still built from pieces,
// as there is no paddling clip: the paddle rolls so one blade and then the other goes in.

/** A slow look to one side, held, then to the other: nobody turns their head like a pendulum. */
const glance = (t: number) => Math.tanh(2.6 * Math.sin(t));

type Arm = { upper: THREE.Object3D; fore: THREE.Object3D; s: number };
type Rig = { r: Rider; chest: THREE.Object3D; head: THREE.Object3D; arms: Arm[]; paddle: THREE.Object3D | null };
type Animated = { r: Rider; a: Actor };

/** A person in a boat: the pieces hang from small groups at the joints (chest, head, arms, paddle). */
function build(r: Rider, material: THREE.Material): { root: THREE.Object3D; rig: Rig } {
  const P = r.pieces!;
  const mesh = (g: THREE.BufferGeometry, shadow = false) => {
    const m = new THREE.Mesh(g, material);
    m.castShadow = shadow;
    return m;
  };
  const root = new THREE.Group();
  root.position.set(...r.at);
  root.rotation.y = r.turn;
  if (P.still) root.add(mesh(P.still, true));
  const chest = new THREE.Group();
  chest.position.y = P.hip;
  root.add(chest);
  if (P.torso) chest.add(mesh(P.torso, true));
  const head = new THREE.Group();
  head.position.y = RIG.neck;
  head.add(mesh(P.head));
  chest.add(head);
  const arms = [-1, 1].map((s) => {
    const upper = new THREE.Group();
    upper.position.set(s * P.armX, RIG.shoulder, 0);
    upper.rotation.z = s * 0.07;
    upper.add(mesh(P.upper));
    const fore = new THREE.Group();
    fore.position.y = -RIG.upper;
    fore.add(mesh(s > 0 && P.foreHold ? P.foreHold : P.fore));
    upper.add(fore);
    chest.add(upper);
    return { upper, fore, s };
  });
  let paddle: THREE.Object3D | null = null;
  if (P.paddle) {
    paddle = mesh(P.paddle);
    paddle.position.set(0, P.hip + 0.34, 0.42);
    root.add(paddle);
  }
  return { root, rig: { r, chest, head, arms, paddle } };
}

/** A kayaker paddles: the paddle rolls so one blade and then the other goes in, the shoulders turn with it. */
function paddle(k: Rig, t: number) {
  const { r, chest, head, arms, paddle } = k;
  const sd = r.seed * 1.37;
  const f = t * ((2 * Math.PI) / 1.5) + sd;
  const sweep = -0.35 * Math.cos(f);
  paddle!.rotation.set(0, sweep, -0.42 * Math.sin(f));
  chest.rotation.set(0.08, sweep * 0.7, 0);
  for (const a of arms) {
    // the arm on the side of the blade in the water is low and pulls; the other is up and pushes
    const down = a.s * Math.sin(f);
    a.upper.rotation.x = -(1.05 - 0.28 * down);
    a.fore.rotation.x = -(0.35 + 0.25 * Math.max(0, -down));
  }
  head.rotation.set(-0.05, -sweep * 0.5 + 0.25 * glance(t * 0.13 + sd), 0);
}

/** A passenger or a skipper: an actor sitting on the bench, or standing at the helm. */
function animate(r: Rider, material: THREE.Material, body: Made): Animated {
  const a = actor(r.seed, material, r.wish, body);
  if (r.pose === 'sit') {
    const move: Move = r.seed % 2 ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
    a.play(move, 0, (r.seed * 0.37) % 1);
    seatActor(a, new THREE.Vector3(...r.at), r.turn, material);
  } else {
    a.play('Idle_Loop', 0, (r.seed * 0.37) % 1);
    a.mesh.position.set(...r.at);
    a.mesh.rotation.y = r.turn;
  }
  return { r, a };
}

export function Crew({ crew, material, body }: { crew: Rider[]; material: THREE.Material; body: Made }) {
  const made = useMemo(() => crew.map((r) => (r.pose === 'paddle' ? build(r, material) : animate(r, material, body))), [crew, material, body]);
  const clock = useRef(0);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    for (const m of made) g.add('a' in m ? m.a.mesh : m.root);
    return () => {
      for (const m of made) {
        g.remove('a' in m ? m.a.mesh : m.root);
        if ('a' in m) m.a.dispose();
      }
    };
  }, [made]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = (clock.current += dt);
    for (const m of made) {
      if (!('a' in m)) {
        paddle(m.rig, t);
        continue;
      }
      m.a.update(dt, m.r.pose === 'stand');
      // passengers look at the houses on either side, each with a favourite bank
      const sd = m.r.seed * 1.37;
      const side = (m.r.seed >> 1) % 2 ? 1 : -1;
      if (m.r.pose === 'sit') m.a.look(0.85 * glance(t * (0.13 + (m.r.seed % 5) * 0.02) + sd) + 0.3 * side);
      else m.a.look(0.4 * glance(t * 0.17 + sd));
    }
  });
  return <group ref={group} />;
}
