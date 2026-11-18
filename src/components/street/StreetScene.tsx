'use client';

import { advance, Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { person } from '@/content/profile';
import type { Locale } from '@/content/types';
import { onFrame } from '@/lib/ticker';
import { loadBody } from './actor';
import type { Made } from './character';
import { Crew } from './Crew';
import { cabinBoat, kayak, ownBoat, type Rider, rowBoat, sloep, tourBoat } from './folk';
import { GRASLEI, RIDE, rowLength } from './plan';
import { BRIDGE, FAR, MAT, MIDSTREAM, palette, QUAY, RIVER, WATER } from './houses';
import { People, Sitters } from './People';
import { posterTexture } from './posters';
import { streetCopy } from './copy';
import { type Framing, type Line, paintBoard, placeBoard, skyBoard, split2 } from './skyBoard';
import { type RGB, skyAt } from './sky';
import { stage } from './stage';
import { inkPass, reflectionMaterial, toonMaterial, uniforms, waterMaterial } from './toon';
import { type World, world } from './world';

export type StreetState = {
  x: number; // the boat's position along the river, metres
  intro: number; // 0 = high over the river, 1 = in the boat
  outro: number; // 0 = in the boat, 1 = up on the bridge
  p: number; // overall scroll progress
  pointer: boolean;
  reduced: boolean;
  focus: string | null;
  /**
   * The match cut from the loader: the camera starts square on to the Graslei, where the pop-up row was drawn and at
   * the same size, then swings up into the opening shot. m: pixels per metre in the loader; base: how far down the
   * screen the houses stand, in pixels; at: when the swing starts (Infinity: hold the shot). Null once it is over.
   */
  arrival: { m: number; base: number; at: number } | null;
};

// The town starts building (in a worker) as soon as this file loads, alongside everything else that loads with it.
if (typeof window !== 'undefined') world();
/** The opening shot: high over the river, looking down it. */
function opening(portrait: boolean, pos: THREE.Vector3, look: THREE.Vector3) {
  pos.set(-64, portrait ? 36 : 25, MIDSTREAM);
  look.set(70, portrait ? 2 : 9, MIDSTREAM);
}

/** The closing shot, for the boat at x: up and back from it, the whole river below and the bridge ahead. */
function closing(portrait: boolean, x: number, pos: THREE.Vector3, look: THREE.Vector3) {
  pos.set(x - 52, portrait ? 30 : 19, MIDSTREAM + (portrait ? 6 : 0));
  look.set(BRIDGE + 90, portrait ? 0 : 7, MIDSTREAM - (portrait ? 14 : 0));
}

// Where the opening shot frames the name (with the scroll hint under it), and the closing shot the thanks. A board
// is as big in the street as it is far away: on a tall screen the name hangs closer, or its lower edge would dip
// below the roofs and into the houses on both quays.
const TITLE: Record<'wide' | 'tall', Framing> = { wide: { y: 0.36, w: 0.52, distance: 85 }, tall: { y: 0.32, w: 0.64, distance: 50 } };
const THANKS: Record<'wide' | 'tall', Framing> = { wide: { y: 0.58, w: 0.56, distance: 80 }, tall: { y: 0.58, w: 0.84, distance: 80 } };
// How high above its place a board waits before it is let down into the picture, in metres.
const LIFT = 80;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const INK = '#25262f';
const CREAM = '#f4f0e4';

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const UP = new THREE.Vector3(0, 1, 0);
/** Sets a three.js colour from one of the sky's sRGB colours. */
const srgb = (out: THREE.Color, c: RGB) => out.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

/**
 * Slides the sun (and the shadow map with it) only by whole shadow-map pixels. The light follows the boat; moved
 * smoothly, every shadow edge would be redrawn a fraction of a pixel further each frame and crawl.
 */
const basis = { m: new THREE.Matrix4(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
function snapToShadowPixels(l: THREE.DirectionalLight) {
  const c = l.shadow.camera;
  const px = (c.right - c.left) / l.shadow.mapSize.x;
  const py = (c.top - c.bottom) / l.shadow.mapSize.y;
  basis.m.lookAt(l.position, l.target.position, c.up);
  basis.m.extractBasis(basis.x, basis.y, basis.z);
  const x = l.target.position.dot(basis.x);
  const y = l.target.position.dot(basis.y);
  const shift = basis.x.multiplyScalar(Math.round(x / px) * px - x).addScaledVector(basis.y, Math.round(y / py) * py - y);
  l.target.position.add(shift);
  l.position.add(shift);
}

// Render sizes to fall back through when frames take too long.
const SIZES = [2, 1.5, 1];

// How far the mouse's own look reaches: sideways, up and down (radians).
const YAW = 0.85;
const PITCH_UP = 0.3;
const PITCH_DOWN = 0.12;
// How far a drag can turn you: the whole way round, so you can watch the street you have already passed.
const TURN = Math.PI;
const TURN_SPEED = 0.0055; // radians a pixel dragged

const toonCache = new Map<string, THREE.MeshToonMaterial>();
function toon(color: string) {
  if (!toonCache.has(color)) {
    const m = toonMaterial();
    m.vertexColors = false;
    m.color.set(color);
    toonCache.set(color, m);
  }
  return toonCache.get(color)!;
}

// People and boats carry their colours per vertex, so one material does for all of them.
const painted = toonMaterial();
// The people are skinned (animated on the graphics card) and so use another shader; with their own material
// they are drawn one after the other instead of switching back and forth between them and the boats.
const skinned = toonMaterial();

/* ---------------- Boats: moored ones, ones coming the other way, and the one you're in ---------------- */

/** Boats with people in them come with their crew; the rest are just a boat. */
const aboard = (b: THREE.BufferGeometry | { g: THREE.BufferGeometry; crew: Rider[] }) => (b instanceof THREE.BufferGeometry ? { g: b, crew: [] as Rider[] } : b);

function Boats({ body }: { body?: Made }) {
  const group = useRef<THREE.Group>(null);
  const boats = useMemo(() => {
    const left = (off: number) => QUAY + off;
    const right = (off: number) => FAR - QUAY - off;
    return [
      { ...aboard(cabinBoat(1, { len: 7.5, hull: palette.white, trim: palette.terracotta, cabin: palette.cream, quay: -1 })), x: 30, z: left(2.6), speed: 0 },
      { ...aboard(rowBoat({ hull: '#3c4a6b', trim: palette.white, quay: -1 })), x: 58, z: left(1.85), speed: 0 },
      { ...aboard(sloep({ len: 5.2, hull: palette.terracotta, trim: palette.white, tarp: '#40566b', quay: -1 })), x: 88, z: left(2.4), speed: 0 },
      { ...aboard(cabinBoat(2, { len: 6.6, hull: '#2f3b52', trim: palette.ochre, cabin: palette.white, quay: 1 })), x: 22, z: right(2.6), speed: 0 },
      { ...aboard(sloep({ len: 5, hull: palette.shutterGreen, trim: palette.cream, tarp: '#cdbf9c', quay: 1 })), x: 70, z: right(2.4), speed: 0 },
      { ...aboard(rowBoat({ hull: '#b8473f', trim: palette.cream, quay: 1 })), x: 99, z: right(1.85), speed: 0 },
      { ...aboard(tourBoat(3, { len: 9, hull: palette.terracotta, trim: palette.white, awning: ['#b8473f', '#f4f1e6'] })), x: 60, z: MIDSTREAM + 6, speed: -1.6 },
      { ...aboard(tourBoat(4, { len: 8.4, hull: palette.shutterBlue, trim: palette.cream })), x: 140, z: MIDSTREAM - 5.5, speed: -1.2 },
      { ...aboard(kayak(5, '#e6c15a')), x: 16, z: MIDSTREAM - 3.4, speed: 0.9 },
      { ...aboard(kayak(6, '#d9534a')), x: 104, z: MIDSTREAM + 3.2, speed: -0.8 },
    ];
  }, []);
  // The ones on the move can be heard: the tour boats' engines (the first two movers) and the kayaks' paddles.
  useEffect(() => {
    stage.movers = boats.filter((b) => b.speed !== 0).map((b, i) => Object.assign(b, { sound: i < 2 ? ('engine' as const) : ('paddle' as const) }));
    return () => {
      stage.movers = [];
    };
  }, [boats]);
  useFrame(({ clock }, dt) => {
    group.current?.children.forEach((c, i) => {
      const b = boats[i];
      b.x += b.speed * dt;
      if (b.x < -30) b.x = BRIDGE + 120;
      if (b.x > BRIDGE + 120) b.x = -30;
      const t = clock.elapsedTime + i * 2;
      c.position.set(b.x, WATER - 0.3 + Math.sin(t * 1.1) * 0.04, b.z);
      c.rotation.set(Math.sin(t * 0.6) * 0.015, b.speed < 0 ? Math.PI : 0, Math.sin(t * 0.8) * 0.015);
    });
  });
  return (
    <group ref={group}>
      {boats.map((b, i) => (
        <group key={i}>
          <mesh geometry={b.g} material={painted} castShadow />
          {body && b.crew.length > 0 && <Crew crew={b.crew} material={skinned} body={body} />}
        </group>
      ))}
    </group>
  );
}

// How far ahead of you the tip of the bow is, and how far below your eyes the deck.
const BOW_AHEAD = 4.9;
const BOW_BELOW = 1.42;
// Eye height in the boat, above the street.
const EYE = 2.5;
// The arrival shot: from just off the Korenlei quay, square on to the middle of the Graslei; and how long the swing
// from there into the opening shot takes, and how high it climbs on the way.
const ARRIVE_X = rowLength(GRASLEI) / 2;
const ARRIVE_Z = 28;
const ARRIVE_MS = 2800;
const ARRIVE_RISE = 9;

/**
 * Your own boat. It is always there, on the water, where the ride has got to: the opening shot comes down into it,
 * and it stays behind when you step up to a poster or climb onto the bridge at the end.
 */
function OwnBoat({ pose, body }: { pose: RefObject<{ x: number; y: number; z: number }>; body?: Made }) {
  const ref = useRef<THREE.Group>(null);
  const b = useMemo(() => ownBoat(BOW_AHEAD, EYE - BOW_BELOW - WATER), []);
  useFrame(() => {
    const p = pose.current;
    if (ref.current && p) ref.current.position.set(p.x + BOW_AHEAD, p.y - BOW_BELOW, p.z);
  });
  return (
    <group ref={ref}>
      <mesh geometry={b.g} material={painted} castShadow receiveShadow />
      {body && <Crew crew={b.crew} material={skinned} body={body} />}
    </group>
  );
}

function Clouds() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: -40 + i * 42 + ((i * 17) % 11),
        y: 48 + ((i * 23) % 16),
        z: (i % 2 ? -1 : 1) * (60 + ((i * 31) % 50)) + MIDSTREAM,
        s: 4.2 + ((i * 11) % 3),
      })),
    [],
  );
  const puffs = [[0, 0.5, 0, 1.25], [-1.4, 0.1, 0.2, 0.95], [1.5, 0.15, -0.1, 1.0], [-2.6, -0.2, 0, 0.7], [2.7, -0.15, 0.1, 0.72], [0.6, 1.2, 0, 0.8]] as const;
  useFrame((_, dt) => {
    group.current?.children.forEach((c) => {
      c.position.x += dt * 0.6;
      if (c.position.x > BRIDGE + 320) c.position.x = -60;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={[c.s, c.s * 0.78, c.s * 0.8]}>
          {puffs.map(([x, y, z, r], k) => (
            <mesh key={k} position={[x, y, z]} material={toon('#f7f4ea')}>
              <icosahedronGeometry args={[r, 2]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ---------------- Posters ---------------- */

function Posters({ street, locale, state, onOpen }: { street: World['street']; locale: Locale; state: RefObject<StreetState>; onOpen: (id: string) => void }) {
  const [tex, setTex] = useState<Record<string, THREE.Texture>>({});
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const font = getComputedStyle(document.body).fontFamily;
    document.fonts.ready.then(async () => {
      const out: Record<string, THREE.Texture> = {};
      for (const p of street.posters) out[p.id] = await posterTexture(p.id, locale, font);
      if (alive) setTex(out);
    });
    return () => {
      alive = false;
    };
  }, [locale, street]);
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.style.cursor = hover ? 'pointer' : '';
  }, [hover, gl]);
  return (
    <>
      {street.posters.map((p) => (
        <mesh
          key={p.id}
          position={[p.x, p.y, p.z]}
          rotation-y={p.nz < 0 ? Math.PI : 0}
          scale={hover === p.id ? 1.03 : 1}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            if (!state.current.focus) setHover(p.id);
          }}
          onPointerOut={() => setHover(null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (e.delta > 6) return; // that was a swipe to look around
            setHover(null);
            onOpen(p.id);
          }}
        >
          <planeGeometry args={[p.w, p.h]} />
          <meshBasicMaterial key={tex[p.id] ? 't' : 'n'} map={tex[p.id] ?? null} color={tex[p.id] ? '#ffffff' : palette.cream} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------- Camera, light, and the ink pipeline ---------------- */

function Scene({ town, state, locale, onOpen, onSlow, onReady }: { town: World; state: RefObject<StreetState>; locale: Locale; onOpen: (id: string) => void; onSlow: (dpr: number) => void; onReady: () => void }) {
  const { street, towers, background } = town;
  const { camera, size, gl, scene } = useThree();
  // the people's body and clothes, made in Blender (public/people/person.glb); they appear once it is in
  const [body, setBody] = useState<Made>();
  useEffect(() => void loadBody().then(setBody), []);
  const mirror = useRef<THREE.Mesh>(null);
  // Screens with one pixel per point are drawn at double size and scaled down, which smooths every line.
  // If the machine cannot keep up with that, step the size back down, but never below the screen's own.
  // The timing starts once the scene has settled: while it is being built, and again when the people arrive,
  // frames are slow for reasons that say nothing about the machine.
  const load = useRef({ frames: 0, time: 0, step: 0, from: Infinity });
  useEffect(() => {
    load.current = { ...load.current, frames: 0, time: 0, from: performance.now() + 3000 };
  }, [body]);
  const frame = useRef(0);
  // The first frame also compiles every shader and so takes long; from the second one the street is really there.
  const drawn = useRef(0);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const focus = useRef(0);
  const focusId = useRef<string | null>(null);
  const boat = useRef({ x: 0, y: 0, z: 0 });
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      fpos: new THREE.Vector3(),
      flook: new THREE.Vector3(),
      wpos: new THREE.Vector3(),
      wlook: new THREE.Vector3(),
      wdir: new THREE.Vector3(),
      apos: new THREE.Vector3(),
      opos: new THREE.Vector3(),
      olook: new THREE.Vector3(),
      cpos: new THREE.Vector3(),
      clook: new THREE.Vector3(),
      adir: new THREE.Vector3(),
      buf: new THREE.Vector2(),
    }),
    [],
  );
  const coarse = useMemo(() => matchMedia('(pointer: coarse)').matches, []);
  const land = useMemo(() => {
    const g = new THREE.PlaneGeometry(1800, 900);
    g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(MAT.ground), 1));
    return g;
  }, []);
  const mats = useMemo(
    () => ({ street: toonMaterial(), towers: toonMaterial(), reflection: reflectionMaterial(WATER), water: waterMaterial(QUAY), ground: toon('#cfc39f') }),
    [],
  );
  const ink = useMemo(inkPass, []);
  const boards = useMemo(() => ({ title: skyBoard(), thanks: skyBoard() }), []);
  const tall = size.width < size.height;
  // The screen in device pixels, in steps of 256: the boards are repainted when the window really changes size,
  // not on every pixel of a drag.
  const px = Math.round((size.width * gl.getPixelRatio()) / 256) * 256;
  useEffect(() => {
    let alive = true;
    const font = getComputedStyle(document.body).fontFamily;
    const t = streetCopy;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const S = 300;
      const name: Line[] = (tall ? person.name.split(' ') : [person.name]).map((text, i) => ({ text, size: S, weight: 600, tracking: -0.055, lead: 0.86, gap: i ? 0 : S * 0.06 }));
      const title: Line[] = [
        { text: t.role[locale], size: S * (tall ? 0.21 : 0.17), weight: 400 },
        ...name,
        { text: `${t.scroll[locale]} ↓`, size: S * (tall ? 0.15 : 0.12), weight: 400, gap: S * 0.3, pill: CREAM, color: INK },
      ];
      const thanks: Line[] = [
        ...(tall ? split2(t.endTitle[locale]) : [t.endTitle[locale]]).map((text) => ({ text, size: S, weight: 600, tracking: -0.045, lead: 0.95 })),
      ];
      const aniso = gl.capabilities.getMaxAnisotropy();
      // Paint each board at twice the width it covers on the screen, so the letters stay sharp when the shot
      // frames them and there is something left to shrink when the camera moves on. The ink line round the
      // letters is painted in at the same two pixels the ink pass used to draw it (skyBoard.ts).
      const plan = (at: Framing) => {
        const screen = px * at.w;
        const fit = Math.min(screen * 2, 4096, gl.capabilities.maxTextureSize);
        return { fit, edge: { color: INK, width: (2 * fit) / screen } };
      };
      const a = plan(TITLE[tall ? 'tall' : 'wide']);
      const z = plan(THANKS[tall ? 'tall' : 'wide']);
      paintBoard(boards.title, title, INK, font, aniso, a.fit, a.edge);
      paintBoard(boards.thanks, thanks, CREAM, font, aniso, z.fit, z.edge);
    });
    return () => {
      alive = false;
    };
  }, [boards, locale, tall, gl, px]);
  const normals = useMemo(() => new THREE.MeshNormalMaterial(), []);
  const targets = useMemo(() => {
    // 8 bits a channel: the colour is stored sRGB-encoded, so the darks keep as many steps as on screen and nothing
    // bands, and the normals only feed the ink lines. Half the memory and bandwidth of half-floats.
    const color = new THREE.WebGLRenderTarget(1, 1, { samples: coarse ? 2 : 4, colorSpace: THREE.SRGBColorSpace });
    const normal = new THREE.WebGLRenderTarget(1, 1);
    // Read pixel for pixel. This buffer is not a picture but a set of readings, and a blend of two of them is a
    // reading of nothing: half a normal, or the tag of a board that is not there (skyBoard.ts).
    normal.texture.minFilter = THREE.NearestFilter;
    normal.texture.magFilter = THREE.NearestFilter;
    normal.depthTexture = new THREE.DepthTexture(1, 1);
    return { color, normal };
  }, []);

  useEffect(() => {
    if (sun.current) scene.add(sun.current.target);
    gl.shadowMap.autoUpdate = false;
  }, [scene, gl]);

  // Two ways of looking, added together. `ty` is the gentle look the mouse's place on screen gives you, within
  // YAW either side of straight ahead. `turn` is which way you are facing, and a drag — with a finger or with
  // the mouse held down — swings it the whole way round, so you can look back down the river behind the boat.
  const look = useRef({ yaw: 0, pitch: 0, ty: 0, tp: 0, turn: 0, nx: 0, drag: null as null | { x: number; y: number } });
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'pan-y'; // vertical swipes still scroll the page
    const clamp = (a: number) => Math.max(-TURN, Math.min(TURN, a));
    const follows = (e: PointerEvent) => e.pointerType === 'mouse' && !state.current.reduced;
    const down = (e: PointerEvent) => {
      if (state.current.focus) return;
      look.current.drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      const L = look.current;
      if (state.current.focus) return;
      if (L.drag) {
        L.turn = clamp(L.turn + (e.clientX - L.drag.x) * TURN_SPEED);
        L.drag = { x: e.clientX, y: e.clientY };
      }
      if (!follows(e)) return;
      L.nx = (e.clientX / innerWidth) * 2 - 1;
      const ny = (e.clientY / innerHeight) * 2 - 1;
      L.tp = -ny * (ny < 0 ? PITCH_UP : PITCH_DOWN);
      // While you are dragging, the mouse is turning you; letting it also steer the gentle look would have the
      // two pulling against each other.
      if (!L.drag) L.ty = -L.nx * YAW;
    };
    const up = () => {
      const L = look.current;
      if (!L.drag) return;
      L.drag = null;
      // Hand the view back to the mouse without it moving: where you ended up facing stays put, and the pointer
      // picks up the gentle look again from wherever it is now.
      const held = -L.nx * YAW;
      L.turn = clamp(L.turn + L.ty - held);
      L.ty = held;
    };
    el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [gl, state]);

  useFrame((_, dt) => {
    const s = state.current;
    const portrait = size.width < size.height;
    const sky = skyAt(s.p);
    uniforms.uTime.value += dt;
    const q = load.current;
    if (!coarse && dt < 0.25 && q.step < SIZES.length - 1 && performance.now() > q.from) {
      q.frames++;
      q.time += dt;
      if (q.frames === 90) {
        if (q.time / q.frames > 1 / 40) onSlow(Math.max(1, Math.min(devicePixelRatio, 2), SIZES[++q.step]));
        q.frames = 0;
        q.time = 0;
      }
    }
    uniforms.uNight.value = sky.night;
    const fov = portrait ? 64 : 48;

    // --- In the boat, midstream, looking down the river.
    // The boat holds steady: any bob or sway makes the whole picture crawl, even when you are not scrolling.
    v.pos.set(s.x, EYE, MIDSTREAM);
    // Facing down the river, turned towards wherever the pointer is.
    const L = look.current;
    const k = 1 - Math.exp(-dt * 4.5);
    L.yaw += (L.turn + L.ty - L.yaw) * k;
    L.pitch += (L.tp - L.pitch) * k;
    v.dir.set(1, 0, 0).applyAxisAngle(UP, L.yaw);
    v.dir.y = Math.tan(L.pitch) - 0.02;
    v.dir.normalize();
    v.look.copy(v.pos).add(v.dir);
    boat.current = { x: v.pos.x, y: v.pos.y, z: v.pos.z };

    // --- The opening shot: high over the river, looking down it. The closing shot: up on the bridge.
    opening(portrait, v.opos, v.olook);
    if (s.intro < 1) {
      const e = easeInOut(1 - s.intro);
      v.pos.lerp(v.opos, e);
      v.look.lerp(v.olook, e);
    }
    // The name hangs where the opening shot frames it, the thanks where the closing shot does. They only move
    // when the screen changes shape.
    const key = `${size.width}x${size.height}`;
    if (boards.title.placed !== key) {
      boards.title.placed = key;
      placeBoard(boards.title, v.opos, v.olook, fov, size.width / size.height, TITLE[portrait ? 'tall' : 'wide']);
    }
    if (boards.thanks.placed !== key) {
      boards.thanks.placed = key;
      closing(portrait, RIDE.to, v.cpos, v.clook);
      placeBoard(boards.thanks, v.cpos, v.clook, fov, size.width / size.height, THANKS[portrait ? 'tall' : 'wide']);
    }
    // The thanks are only put out once the ride is over, high above the bridge where nobody in the boat sees them,
    // and are let down as you rise out of the boat.
    boards.thanks.on = s.outro > 0;
    boards.thanks.mesh.position.y = boards.thanks.y + LIFT * (1 - easeOut(clamp01(s.outro / 0.8)));
    if (s.outro > 0) {
      // The mirror of the opening: straight up out of the boat, then back, until the whole river lies below
      // with the boat moored at the bridge and the towers on the skyline.
      const e = easeInOut(s.outro);
      const rise = easeInOut(Math.min(1, s.outro * 1.25));
      closing(portrait, s.x, v.wpos, v.wlook);
      v.wdir.copy(v.wlook).sub(v.wpos).normalize();
      const y = v.pos.y + (v.wpos.y - v.pos.y) * rise;
      v.pos.lerp(v.wpos, e);
      v.pos.y = y;
      // turn the view itself, not a point to look at: that would dip towards the water on the way up
      v.dir.lerp(v.wdir, e).normalize();
      v.look.copy(v.pos).add(v.dir);
    }

    // --- Clicked a poster: step up to it, leaving room for the panel.
    if (s.focus) focusId.current = s.focus;
    focus.current += ((s.focus ? 1 : 0) - focus.current) * (1 - Math.exp(-dt * 3.2));
    const f = focusId.current ? street.posters.find((p) => p.id === focusId.current) : null;
    if (f && focus.current > 0.001) {
      const tv = Math.tan(((fov / 2) * Math.PI) / 180);
      const aspect = size.width / size.height;
      const d = portrait ? Math.max((f.w / 2 / (tv * aspect)) * 1.12, (f.h / 2 / tv) * 2.6) : (f.h / 2 / tv) * 1.9;
      // the panel covers the right of the screen (or the bottom on a phone): show the poster beside it
      v.flook.set(f.x + (portrait ? 0 : f.nz * f.w * 0.46), f.y - (portrait ? d * tv * 0.55 : 0), f.z);
      v.fpos.set(v.flook.x, v.flook.y, f.z + f.nz * d);
      const e = easeInOut(focus.current);
      v.pos.lerp(v.fpos, e);
      v.look.lerp(v.flook, e);
    } else if (focus.current < 0.001) focusId.current = null;

    // --- Arriving from the loader: start where its houses were drawn, then swing round into the shot above.
    let fovNow = fov;
    let lift = 0;
    // A measurement of nothing is not a shot to cut from (Street.tsx): belt and braces, so that no reading can
    // ever put a NaN in the camera and take the whole town off the screen.
    const a = s.arrival && s.arrival.m > 0 ? s.arrival : null;
    if (a) {
      const t = (performance.now() - a.at) / ARRIVE_MS;
      // The name waits high up while the camera swings round (it would fly straight through it), and is let down
      // into the picture in the second half, as the opening shot settles.
      lift = LIFT * (1 - easeOut(clamp01((t - 0.5) / 0.5)));
      if (t >= 1) s.arrival = null;
      else {
        const e = t <= 0 ? 0 : easeInOut(t);
        // Facades square on to the camera keep their shape, so only the size has to match: at ARRIVE_Z metres away,
        // the field of view that makes one metre a.m pixels; and eyes as high above the street as the loader's houses
        // stand below the middle of the screen.
        const half = size.height / 2;
        const aFov = (2 * Math.atan(half / (a.m * ARRIVE_Z)) * 180) / Math.PI;
        v.apos.set(ARRIVE_X, (a.base - half) / a.m, ARRIVE_Z);
        v.adir.set(0, 0, -1);
        v.dir.copy(v.look).sub(v.pos).normalize();
        v.dir.lerpVectors(v.adir, v.dir, e).normalize();
        v.pos.lerpVectors(v.apos, v.pos, e);
        v.pos.y += Math.sin(Math.PI * e) * ARRIVE_RISE;
        v.look.copy(v.pos).add(v.dir);
        fovNow = aFov + (fov - aFov) * e;
      }
    }

    boards.title.mesh.position.y = boards.title.y + lift;

    const cam = camera as THREE.PerspectiveCamera;
    camera.position.copy(v.pos);
    camera.lookAt(v.look);
    stage.cam.x = v.pos.x;
    stage.cam.y = v.pos.y;
    stage.cam.z = v.pos.z;
    stage.intro = s.intro;
    stage.outro = s.outro;
    stage.night = sky.night;
    if (cam.fov !== fovNow) {
      cam.fov = fovNow;
      cam.updateProjectionMatrix();
    }

    // --- Light: a low afternoon sun from upstream, over the Korenlei roofs.
    const l = sun.current;
    if (l && hemi.current) {
      l.target.position.set(v.pos.x + 25, 0, MIDSTREAM);
      l.position.set(sky.sun[0], sky.sun[1], sky.sun[2]).multiplyScalar(120).add(l.target.position);
      snapToShadowPixels(l);
      l.target.updateMatrixWorld();
      srgb(l.color, sky.sunColor);
      l.intensity = sky.sunIntensity;
      srgb(hemi.current.color, sky.skyLight);
      srgb(hemi.current.groundColor, sky.groundLight);
      hemi.current.intensity = sky.hemi;
    }

    // --- Render: colour, then normals and depth, then ink lines on top.
    gl.getDrawingBufferSize(v.buf);
    if (targets.color.width !== v.buf.x || targets.color.height !== v.buf.y) {
      targets.color.setSize(v.buf.x, v.buf.y);
      targets.normal.setSize(v.buf.x, v.buf.y);
      // Drawn at double size for a screen with one pixel per point, the scaling down already smooths every edge:
      // multisampling on top of that would be 16 samples a pixel.
      const samples = coarse ? 2 : gl.getPixelRatio() >= 2 * devicePixelRatio ? 0 : 4;
      if (targets.color.samples !== samples) {
        targets.color.samples = samples;
        targets.color.dispose();
      }
    }
    for (const b of Object.values(boards)) b.mesh.visible = b.on;
    gl.setClearColor(0x000000, 0);
    // Above 90 frames a second the shadows are redrawn every other frame; nobody sees a shadow a frame behind.
    gl.shadowMap.needsUpdate = dt > 1 / 90 || frame.current++ % 2 === 0;
    gl.setRenderTarget(targets.color);
    gl.clear();
    gl.render(scene, camera);
    // The mirror image is only colour under the water; it must not get outlines of its own.
    if (mirror.current) mirror.current.visible = false;
    for (const b of Object.values(boards)) b.mesh.visible = false;
    scene.overrideMaterial = normals;
    gl.setRenderTarget(targets.normal);
    gl.clear();
    // Nothing has moved since the colour pass: keep its matrices, and count this as the same frame so three.js does
    // not pose all the skeletons again. On a phone that repeat was a sixth of the frame.
    scene.matrixWorldAutoUpdate = false;
    gl.info.render.frame--;
    gl.render(scene, camera);
    scene.matrixWorldAutoUpdate = true;
    scene.overrideMaterial = null;
    if (mirror.current) mirror.current.visible = true;
    // the words get lines round their letters, not round the boards they are painted on (see skyBoard.ts)
    const auto = gl.autoClear;
    gl.autoClear = false;
    for (const b of Object.values(boards)) {
      b.mesh.visible = b.on;
      if (!b.on || !b.paint.visible) continue;
      b.mesh.material = b.cutout;
      gl.render(b.mesh, camera);
      b.mesh.material = b.paint;
    }
    gl.autoClear = auto;
    gl.setRenderTarget(null);
    const u = ink.mat.uniforms;
    u.tColor.value = targets.color.texture;
    u.tNormal.value = targets.normal.texture;
    u.tDepth.value = targets.normal.depthTexture;
    u.uRes.value.copy(v.buf);
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
    u.uThick.value = Math.max(1, gl.getPixelRatio() * 0.9);
    srgb(u.uHaze.value, sky.horizon);
    gl.clear();
    gl.render(ink.scene, ink.camera);
    if (drawn.current++ === 1) onReady();
  }, 1);

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={coarse ? [2048, 2048] : [4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={320}
      />
      <mesh geometry={street.geometry} material={mats.street} castShadow receiveShadow />
      <mesh ref={mirror} geometry={street.geometry} material={mats.reflection} scale={[1, -1, 1]} position={[0, WATER * 2, 0]} />
      <mesh geometry={towers} material={mats.towers} />
      <mesh geometry={background} material={mats.towers} receiveShadow />
      {/* the river, and land behind both rows of houses */}
      <mesh rotation-x={-Math.PI / 2} position={[BRIDGE / 2, WATER, MIDSTREAM]} material={mats.water}>
        <planeGeometry args={[1800, RIVER + 2]} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} rotation-x={-Math.PI / 2} position={[BRIDGE / 2, -0.05, MIDSTREAM + k * (RIVER / 2 + 1 + 450)]} geometry={land} material={mats.ground} receiveShadow />

      ))}
      {body && <People material={skinned} body={body} />}
      {body && <Sitters material={skinned} body={body} />}
      <Boats body={body} />
      <OwnBoat pose={boat} body={body} />
      <Clouds />
      <primitive object={boards.title.mesh} />
      <primitive object={boards.thanks.mesh} />
      <Posters street={street} locale={locale} state={state} onOpen={onOpen} />
    </>
  );
}

export default function StreetScene(props: { state: RefObject<StreetState>; locale: Locale; active: boolean; onOpen: (id: string) => void; onReady: () => void }) {
  const { active, ...rest } = props;
  const { state } = props;
  // The render size lives here, not only inside three.js: the canvas puts back whatever size it is given each
  // time this component renders, which would undo a step down.
  const [dpr, setDpr] = useState<number | [number, number]>(() => (matchMedia('(pointer: coarse)').matches ? [1, 1.5] : 2));
  const [town, setTown] = useState<World>();
  useEffect(() => {
    let alive = true;
    world().then((w) => alive && setTown(w));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!active || !town) return;
    // On a fast screen (120 Hz and up), while nobody scrolls, looks around or opens a poster, only the town itself
    // moves: then every other frame is drawn. People strolling and boats drifting look the same at 60 frames a
    // second, for half the work. Any input brings back the full rate at once.
    let stirred = performance.now();
    let seen = { p: -1, focus: null as string | null };
    let skip = false;
    const stir = () => {
      stirred = performance.now();
    };
    addEventListener('pointermove', stir, { passive: true });
    addEventListener('pointerdown', stir, { passive: true });
    const off = onFrame((t, dt) => {
      const s = state.current;
      if (s.p !== seen.p || s.focus !== seen.focus) {
        seen = { p: s.p, focus: s.focus };
        stirred = t;
      }
      if (dt < 1 / 90 && t - stirred > 1500 && (skip = !skip)) return;
      // R3F wants seconds here; requestAnimationFrame gives milliseconds.
      advance(t / 1000);
    }, 2);
    return () => {
      off();
      removeEventListener('pointermove', stir);
      removeEventListener('pointerdown', stir);
    };
  }, [active, state, town]);
  if (!town) return null;
  return (
    <Canvas
      className="!absolute inset-0"
      frameloop="never"
      dpr={dpr}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ antialias: false, alpha: true, toneMapping: THREE.NoToneMapping }}
      camera={{ fov: 48, near: 0.3, far: 1200, position: [-22, 32, MIDSTREAM] }}
    >
      <Scene {...rest} town={town} onSlow={setDpr} />
    </Canvas>
  );
}
