'use client';

import { advance, Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { person } from '@/content/profile';
import type { Locale } from '@/content/types';
import { onFrame } from '@/lib/ticker';
import { loadBody } from './actor';
import type { Made } from './character';
import { Crew } from './Crew';
import { type Cue, Gull } from './Gull';
import { cabinBoat, kayak, ownBoat, type Rider, rowBoat, sloep, tourBoat } from './folk';
import { GRASLEI, RIDE, rowLength, STOPS } from './plan';
import { BRIDGE, FAR, MAT, MIDSTREAM, palette, QUAY, RIVER, WATER } from './houses';
import { People, Sitters } from './People';
import { mark, mb } from './mark';
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
/**
 * Turns one view direction towards another along the shortest arc, at an even rate: `t` of the way is `t` of
 * the angle. Sliding between two points to look at does not do this — how fast the view swings then depends on
 * how far off each point is — which is what made stepping up to a poster start with a whip of the head.
 */
function slerpDir(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  // already there, or facing exactly the other way, where no arc is shorter than any other
  if (ang < 1e-4 || ang > Math.PI - 1e-3) return out.copy(a).lerp(b, t).normalize();
  const s = Math.sin(ang);
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * ang) / s)
    .addScaledVector(b, Math.sin(t * ang) / s)
    .normalize();
}
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

// A phone starts at every pixel its screen has (three to the point on most) and steps down to two, then one and a
// half, if frames run slow. Never below that: the picture is stretched to fit the screen, and on a phone, at one, the
// ink lines and the title in the sky turn into staircases.
/**
 * Two to the point, not three. Three is four times the pixels of the one and a half this used to be, and the
 * colour buffer, the normals and the depth are each that size again — on a phone with a browserful of tabs behind
 * you there is not that much graphics memory to be had. It is not refused politely: the context goes, and Chrome
 * draws a small sad face where the street was while the menu and the trip bar carry on as though nothing had
 * happened. Two still clears the staircases that made one and a half worth leaving behind.
 */
const PHONE_SIZES = [2, 1.5];
/** And a ceiling on the total, for the wide screens where even two to the point adds up. */
const PHONE_PIXELS = 2.4e6;
const fits = (ratio: number) => {
  const px = innerWidth * innerHeight;
  if (!(px > 0) || px * ratio * ratio <= PHONE_PIXELS) return ratio;
  return Math.max(PHONE_SIZES[PHONE_SIZES.length - 1], Math.min(ratio, Math.sqrt(PHONE_PIXELS / px)));
};
const firstSize = () => (matchMedia('(pointer: coarse)').matches ? fits(Math.min(devicePixelRatio, PHONE_SIZES[0])) : 2);

/**
 * The render sizes to fall back through when frames take too long, which are not the same rungs on every screen.
 *
 * On a screen with two device pixels to the point, two *is* native: the street is drawn pixel for pixel and the
 * colour pass carries four MSAA samples for its edges, so one and a half really is a step down from it and one is
 * another.
 *
 * On a screen with one, two is supersampling — four times the pixels, scaled down, and that scaling down is the
 * only thing smoothing the ink lines there, since MSAA cannot touch them (they are worked out from the normal
 * buffer after the geometry has gone). A machine that cannot hold that has nothing to gain from one and a half,
 * because below two the colour pass turns MSAA back on: one and a half with four samples is 82MB of colour buffer
 * against two's 58MB, over four megapixels instead of seven but every one of them rasterised four times. It is
 * the same bill in a different envelope. So on those screens the rung does not exist — it is two, or native with
 * MSAA, and nothing in between.
 */
const sizeLadder = (): number[] => (matchMedia('(pointer: coarse)').matches ? PHONE_SIZES : devicePixelRatio >= 2 ? [2, 1.5, 1] : [2, 1]);

// How far the mouse's own look reaches: sideways, up and down (radians).
const YAW = 0.85;
const PITCH_UP = 0.3;
const PITCH_DOWN = 0.12;
// How far a drag can turn you: the whole way round, so you can watch the street you have already passed.
const TURN = Math.PI;
const TURN_SPEED = 0.0055; // radians a pixel dragged
// Pinching on a touch screen narrows the camera's view rather than enlarging the page, so the header and the
// buttons stay the size they are and only the town comes closer: close enough to read a poster from the boat.
const ZOOM_MAX = 4;
// How far a finger can tilt the view, down to the water and up to the rooftops (radians).
const TOUCH_PITCH_UP = 0.4;
const TOUCH_PITCH_DOWN = 0.25;

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

/* ---------------- The camera goes with the gull ---------------- */

// The gull (Gull.tsx) says where to look: at itself as it flies in across the river, then at the first poster where
// it lands. The camera eases round to that, follows it a little behind (a bird darts; a camera should not), leans
// in on the poster, and hands the view back. Any look of your own cuts it short: a mouse that wanders off, a drag,
// a scroll.
const FOLLOW_IN = 1.2; // seconds to ease into following, and to let go
const FOLLOW_PUSH = 1; // how much of the gull's lean-in (Cue.push) the camera takes
// The furthest it tilts up, in radians: the name hangs in the sky over the river ahead, so looking down the river
// it barely tilts at all; turned towards the quays, it can look up to a poster.
const FOLLOW_UP = { ahead: 0.03, aside: 0.1 };
type Follow = { on: boolean; u: number; cut: boolean; moved: number; p: number; at: THREE.Vector3; push: number };

/* ---------------- Posters ---------------- */

function Posters({ street, locale, state, onOpen, hovered, cue }: { street: World['street']; locale: Locale; state: RefObject<StreetState>; onOpen: (id: string) => void; hovered: RefObject<string | null>; cue: RefObject<Cue> }) {
  const [tex, setTex] = useState<Record<string, THREE.Texture>>({});
  const [hover, setHover] = useState<string | null>(null);
  // Sizes are set here every frame rather than as a prop: the poster the gull shows you swells twice.
  const meshes = useRef<Record<string, THREE.Mesh | null>>({});
  useFrame(() => {
    const c = cue.current;
    for (const p of street.posters) meshes.current[p.id]?.scale.setScalar((hover === p.id ? 1.03 : 1) * (c.id === p.id ? 1 + 0.06 * c.pulse : 1));
  });
  // the gull on the first poster hops when you point at it
  useEffect(() => {
    hovered.current = hover;
  }, [hover, hovered]);
  useEffect(() => {
    let alive = true;
    const font = getComputedStyle(document.body).fontFamily;
    document.fonts.ready.then(async () => {
      const out: Record<string, THREE.Texture> = {};
      let total = 0;
      for (const p of street.posters) {
        out[p.id] = await posterTexture(p.id, locale, font);
        // Seven of these are built before the street draws a frame, and together they are the largest thing the
        // page puts on the card. If the context goes in the middle of this loop, the log says which one it was on.
        const c = out[p.id].image as HTMLCanvasElement;
        total += mb(c.width, c.height);
        mark(`poster ${p.id} ${c.width}x${c.height} · ${total.toFixed(0)}MB of posters so far`);
      }
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
          ref={(m) => {
            meshes.current[p.id] = m;
          }}
          position={[p.x, p.y, p.z]}
          rotation-y={p.nz < 0 ? Math.PI : 0}
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

function Scene({ town, state, locale, dpr, onOpen, onSlow, onLost, onReady }: { town: World; state: RefObject<StreetState>; locale: Locale; dpr: number; onOpen: (id: string) => void; onSlow: (dpr: number) => void; onLost: () => void; onReady: () => void }) {
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
  // The size of buffer last found to be usable, so the check below runs once a size rather than once a frame.
  const checked = useRef('');
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
      fdir: new THREE.Vector3(),
      sdir: new THREE.Vector3(),
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
  const steps = useMemo(sizeLadder, []);
  // The size the map is built at, and nothing more: the effect below owns every change to it after that, so this
  // has to keep the same identity across renders or R3F would quietly put the opening size back without
  // disposing the map the effect had swapped in, leaving three.js drawing a 4096 viewport into a 2048 texture.
  const shadowMap = useMemo(() => [coarse ? 2048 : 4096, coarse ? 2048 : 4096] as [number, number], [coarse]);
  const first = useMemo(() => street.posters.find((p) => p.id === STOPS[0].id) ?? null, [street]);
  const hovered = useRef<string | null>(null);
  const cue = useRef<Cue>({ want: 0, x: 0, y: 0, z: 0, push: 0, pulse: 0, id: first?.id ?? null });
  const follow = useRef<Follow>({ on: false, u: 0, cut: false, moved: 0, p: 0, at: new THREE.Vector3(), push: 0 });
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
    const m = sun.current?.shadow.mapSize;
    if (m) mark(`shadow map ${m.x}x${m.y} · ~${mb(m.x, m.y, 4, false).toFixed(0)}MB`);
  }, [scene, gl]);

  /**
   * The shadow map follows the ladder down.
   *
   * 4096 square is sixteen megapixels an update — the single largest item on the bill, and a quarter of it buys
   * shadows that are a quarter as crisp. Worth it on a machine holding the opening size; not worth it on one that
   * has already been stepped down, where the frame has to come from somewhere and everything else on screen is
   * being drawn at half the density anyway.
   *
   * three.js never resizes a map it has already made (it only builds one when `shadow.map` is null), so the old
   * one has to be disposed and cleared by hand for the new size to take.
   */
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    const want = coarse || dpr < steps[0] ? 2048 : 4096;
    if (l.shadow.mapSize.x === want) return;
    l.shadow.mapSize.set(want, want);
    l.shadow.map?.depthTexture?.dispose();
    l.shadow.map?.dispose();
    l.shadow.map = null;
    mark(`shadow map ${want}x${want} · ~${mb(want, want, 4, false).toFixed(0)}MB`);
  }, [dpr, coarse, steps]);

  /**
   * If the graphics card takes the context away, the street is over.
   *
   * This used to ask for a smaller size here and hope the next context would fit, which cannot work and never did:
   * three.js asks for the context back (it calls preventDefault itself and reinstates everything on
   * webglcontextrestored), but on the phones this happens to, webglcontextrestored never fires — and a context
   * that is gone cannot be resized either, so the smaller size went to a canvas with no drawing buffer at all.
   * What the visitor got was Chrome's sad face with the menu still floating over it.
   *
   * So: say so, and let the page put something else there. Whether a rebuilt canvas would get a context is a
   * question the debug panel now answers out loud on the phones where this happens (Debug.tsx), and until one of
   * those logs comes back there is nothing here worth guessing at.
   */
  useEffect(() => {
    const el = gl.domElement;
    const lost = () => onLost();
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);

  // The street's own targets outlive a render; nothing else disposes them, and now that losing the context
  // unmounts the whole scene they would otherwise be left on the card every time it happens.
  useEffect(
    () => () => {
      targets.color.dispose();
      targets.normal.depthTexture?.dispose();
      targets.normal.dispose();
    },
    [targets],
  );

  // Two ways of looking, added together. `ty` is the gentle look the mouse's place on screen gives you, within
  // YAW either side of straight ahead. `turn` is which way you are facing, and a drag — with a finger or with
  // the mouse held down — swings it the whole way round, so you can look back down the river behind the boat.
  // `zoom` is where two fingers have pinched the view to, `z` the zoom the camera has eased to.
  const look = useRef({ yaw: 0, pitch: 0, ty: 0, tp: 0, turn: 0, nx: 0, zoom: 1, z: 1, drag: null as null | { x: number; y: number } });
  useEffect(() => {
    const el = gl.domElement;
    // The boat sails itself on a touch screen, so the page underneath has nothing to scroll and every swipe,
    // in any direction, is yours to look with, and every pinch is yours to zoom with. Nothing has to be shared
    // between looking and travelling, and the browser zooming the whole page (header and all) is not wanted.
    el.style.touchAction = coarse ? 'none' : 'pan-y';
    const clamp = (a: number) => Math.max(-TURN, Math.min(TURN, a));
    const follows = (e: PointerEvent) => e.pointerType === 'mouse' && !state.current.reduced;
    const fingers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; zoom: number } | null = null;
    const spread = () => {
      const [a, b] = [...fingers.values()];
      return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    };
    const down = (e: PointerEvent) => {
      if (state.current.focus) return;
      if (e.pointerType === 'touch') {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size >= 2) {
          // A second finger turns the swipe into a pinch: stop turning, and zoom from where the view is now.
          look.current.drag = null;
          if (!pinch) pinch = { d: spread(), zoom: look.current.zoom };
          return;
        }
      }
      look.current.drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      const L = look.current;
      if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.current.focus) return;
      if (pinch && fingers.size >= 2) {
        L.zoom = Math.max(1, Math.min(ZOOM_MAX, (pinch.zoom * spread()) / pinch.d));
        return;
      }
      if (L.drag) {
        // Zoomed in, the same swipe turns you less, so what is under your finger stays under it.
        const speed = TURN_SPEED / L.z;
        L.turn = clamp(L.turn + (e.clientX - L.drag.x) * speed);
        // A finger tilts the view as well (the mouse does that by where it is), to look up a facade or down at
        // the water.
        if (e.pointerType === 'touch') L.tp = Math.max(-TOUCH_PITCH_DOWN, Math.min(TOUCH_PITCH_UP, L.tp + (e.clientY - L.drag.y) * speed));
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
    const up = (e: PointerEvent) => {
      const L = look.current;
      fingers.delete(e.pointerId);
      if (pinch) {
        if (fingers.size >= 2) return;
        pinch = null;
        // Nearly all the way out is all the way out.
        if (L.zoom < 1.1) L.zoom = 1;
        // The finger still down carries on turning from where it is.
        const [rest] = [...fingers.values()];
        L.drag = rest ?? null;
        return;
      }
      if (!L.drag) return;
      L.drag = null;
      // Hand the view back to the mouse without it moving: where you ended up facing stays put, and the pointer
      // picks up the gentle look again from wherever it is now.
      const held = -L.nx * YAW;
      L.turn = clamp(L.turn + L.ty - held);
      L.ty = held;
    };
    // Your own look cuts the camera's following short.
    const F = follow.current;
    let mx = NaN;
    let my = NaN;
    const stir = (e: PointerEvent) => {
      if (Number.isFinite(mx)) F.moved += Math.hypot(e.clientX - mx, e.clientY - my);
      mx = e.clientX;
      my = e.clientY;
      if (F.on && F.moved > 90) F.cut = true;
    };
    const press = () => {
      if (F.on) F.cut = true;
    };
    el.addEventListener('pointerdown', press);
    addEventListener('pointermove', stir, { passive: true });
    addEventListener('wheel', press, { passive: true });
    el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', press);
      removeEventListener('pointermove', stir);
      removeEventListener('wheel', press);
      el.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [gl, state, coarse]);

  useFrame((_, dt) => {
    const s = state.current;
    const portrait = size.width < size.height;
    const sky = skyAt(s.p);
    uniforms.uTime.value += dt;
    const q = load.current;
    if (dt < 0.25 && q.step < steps.length - 1 && performance.now() > q.from) {
      q.frames++;
      q.time += dt;
      // Thirty frames to the window, not ninety. It has to be long enough that one slow frame cannot decide it,
      // and short enough that a machine which was never going to hold the opening size is not left sitting on it:
      // at the fifteen frames a second this exists to catch, ninety frames was six seconds of stuttering before
      // anything happened at all, and twelve before it reached the bottom of the ladder.
      if (q.frames === 30) {
        const avg = q.time / q.frames;
        if (avg > 1 / 40) {
          // Badly behind rather than merely short: take the whole ladder in one go. Walking down a rung at a time
          // costs another windowful of bad frames for each rung, and a machine at fifteen a second is not going
          // to be saved by the one just above the bottom.
          q.step = avg > 1 / 20 ? steps.length - 1 : q.step + 1;
          const next = steps[q.step];
          onSlow(coarse ? fits(Math.min(devicePixelRatio, next)) : Math.max(1, Math.min(devicePixelRatio, 2), next));
        }
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
    // Opening a poster brings you right up to it, so a pinch is let go of.
    if (s.focus) L.zoom = 1;
    L.z += (L.zoom - L.z) * (1 - Math.exp(-dt * 12));

    // --- Going with the gull (see FOLLOW_IN).
    const C = cue.current;
    const F = follow.current;
    if (C.want && !F.on) {
      Object.assign(F, { on: true, cut: false, moved: 0, p: s.p });
      F.at.set(C.x, C.y, C.z);
    }
    let fe = 0;
    if (F.on) {
      // Scrolling is a look of your own too (unless the boat sails itself, on a touch screen).
      if (s.focus || s.reduced || (!coarse && Math.abs(s.p - F.p) > 0.002)) F.cut = true;
      const want = C.want && !F.cut ? 1 : 0;
      F.u = Math.min(1, Math.max(0, F.u + (want ? dt : -dt) / FOLLOW_IN));
      if (C.want) F.at.lerp(v.tmp.set(C.x, C.y, C.z), 1 - Math.exp(-dt * 4.5));
      F.push += ((want ? C.push * FOLLOW_PUSH : 0) - F.push) * (1 - Math.exp(-dt * 2.5));
      if (!C.want && F.u === 0) F.on = false;
      fe = easeInOut(F.u);
    }
    let yaw = L.yaw;
    let pitch = L.pitch;
    if (fe > 0) {
      const dx = F.at.x - v.pos.x;
      const dz = F.at.z - v.pos.z;
      const yawTo = Math.atan2(-dz, dx);
      // the view's own tilt carries a small dip (below); take it out, so what it follows lands in the middle
      // and never so far up that the name hanging in the sky over the street comes into the picture
      const up = FOLLOW_UP.ahead + (FOLLOW_UP.aside - FOLLOW_UP.ahead) * clamp01((Math.abs(yawTo) - 0.45) / 0.4);
      const pitchTo = Math.min(up, Math.atan(Math.tan(Math.atan2(F.at.y - EYE, Math.hypot(dx, dz))) + 0.02));
      yaw += Math.atan2(Math.sin(yawTo - yaw), Math.cos(yawTo - yaw)) * fe;
      pitch += (pitchTo - pitch) * fe;
    }
    v.dir.set(1, 0, 0).applyAxisAngle(UP, yaw);
    v.dir.y = Math.tan(pitch) - 0.02;
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
    // One poster at a time. Tapping a second while the camera is still flying back from the first used to swap
    // the target from under the easing: at half-way out, the aim jumped half the distance between the two
    // posters in a single frame. The one being left keeps the flight until it is done, and only then does the
    // new one take over — so the camera is always easing between two places it has actually been.
    if (s.focus && !focusId.current) focusId.current = s.focus;
    const leaving = !!focusId.current && s.focus !== focusId.current;
    focus.current += ((s.focus && !leaving ? 1 : 0) - focus.current) * (1 - Math.exp(-dt * 3.2));
    const f = focusId.current ? street.posters.find((p) => p.id === focusId.current) : null;
    if (f && focus.current > 0.001) {
      const tv = Math.tan(((fov / 2) * Math.PI) / 180);
      const aspect = size.width / size.height;
      const d = portrait ? Math.max((f.w / 2 / (tv * aspect)) * 1.12, (f.h / 2 / tv) * 2.6) : (f.h / 2 / tv) * 1.9;
      // the panel covers the right of the screen (or the bottom on a phone): show the poster beside it
      v.flook.set(f.x + (portrait ? 0 : f.nz * f.w * 0.46), f.y - (portrait ? d * tv * 0.55 : 0), f.z);
      v.fpos.set(v.flook.x, v.flook.y, f.z + f.nz * d);
      const e = easeInOut(focus.current);
      // Turn the view, not a point to look at. The boat's look point sits one metre in front of the eye while
      // the poster's is metres off, so sliding between the two points swung the whole head in the first few
      // frames and then crawled the rest of the way — a whip-pan, and the further the poster the harder the
      // whip. Rotating the direction itself turns at an even rate, in step with the walk across.
      v.fdir.copy(v.flook).sub(v.fpos).normalize();
      // where the view points right now, whatever set it — the boat, the opening shot, or a flight still easing out
      v.sdir.copy(v.look).sub(v.pos).normalize();
      v.pos.lerp(v.fpos, e);
      slerpDir(v.dir, v.sdir, v.fdir, e);
      v.look.copy(v.pos).add(v.dir);
    } else if (focus.current < 0.001) {
      focus.current = 0;
      focusId.current = s.focus ?? null;
    }

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

    // The pinch: a narrower view from the same place. It is a look from the boat, so it fades out as the camera
    // leaves the boat, for the opening shot, a poster or the bridge.
    const zoom = (1 + (L.z - 1) * s.intro * (1 - focus.current) * (1 - s.outro)) * (1 + F.push * fe * (1 - focus.current));
    if (zoom > 1.001) fovNow = (2 * Math.atan(Math.tan((fovNow * Math.PI) / 360) / zoom) * 180) / Math.PI;

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
      // multisampling on top of that would be 16 samples a pixel. On a phone drawing two or three pixels to the
      // point, an edge is already a fraction of a point wide and nobody can see the steps in it from reading
      // distance — while the extra samples cost a whole screen of memory again, on the device least able to spare
      // it. Below that the lines are coarse enough to be worth smoothing.
      const samples = coarse ? (gl.getPixelRatio() >= 2 ? 0 : 2) : gl.getPixelRatio() >= 2 * devicePixelRatio ? 0 : 4;
      if (targets.color.samples !== samples) {
        targets.color.samples = samples;
        targets.color.dispose();
      }
      // The buffers the street draws into, at the size they have just been given. A step down the sizes above
      // should make this number fall; if it rises, the step down is costing memory rather than saving it.
      const px = v.buf.x * v.buf.y;
      mark(
        `targets ${v.buf.x}x${v.buf.y} dpr ${gl.getPixelRatio()} samples ${samples} · colour ~${mb(v.buf.x, v.buf.y, 4 * Math.max(1, samples) + 4, false).toFixed(0)}MB` +
          ` · normals ~${mb(v.buf.x, v.buf.y, 8, false).toFixed(0)}MB · canvas ~${mb(v.buf.x, v.buf.y, 8, false).toFixed(0)}MB · ${(px / 1e6).toFixed(2)}Mpx`,
      );
    }
    for (const b of Object.values(boards)) b.mesh.visible = b.on;
    gl.setClearColor(0x000000, 0);
    // Asking for buffers a phone has not got to give does not throw: the framebuffer simply comes back unusable and
    // everything drawn into it goes nowhere, which on screen is a blank canvas with the menu and the trip bar still
    // on top of it. Check the one the street is drawn into, once per size, and come back smaller if it is no good.
    if (checked.current !== `${v.buf.x}x${v.buf.y}`) {
      checked.current = `${v.buf.x}x${v.buf.y}`;
      gl.setRenderTarget(targets.color);
      const g = gl.getContext();
      if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) {
        gl.setRenderTarget(null);
        const next = steps.find((s) => s < gl.getPixelRatio());
        // Smaller buffers next time round; there is nothing worth drawing into these ones. At the smallest size
        // there is nowhere left to go, so draw anyway rather than hold the loader up for ever.
        if (next !== undefined) {
          onSlow(coarse ? fits(Math.min(devicePixelRatio, next)) : next);
          return;
        }
      }
    }
    // The shadows are redrawn every other frame. Nobody sees a shadow a sixtieth of a second behind — the sun
    // creeps round with the scroll and the shadow camera is snapped to its own texel grid, so the picture does not
    // even shimmer — and at 4096 square the redraw is the most expensive single thing the street does: a whole
    // second pass over the town's geometry into sixteen megapixels, as much as the colour pass and the normals
    // pass put together.
    //
    // This used to read `dt > 1 / 90 || frame.current++ % 2 === 0`, which held the saving back for screens above
    // ninety frames a second — the one case that did not need it. At sixty the left-hand side is true on all but
    // the odd frame, so the shadows were redrawn on nearly every one, on exactly the machines least able to
    // afford it. And because `||` short-circuits, the counter barely moved either: once something had nudged it
    // to 1 it stuck there, and the first-frame mark below was logged once a frame for ever — forty lines of it in
    // the log that came back from the Windows machine this was found on, filling the debug panel's fifty and
    // pushing anything that mattered off the top.
    const tick = frame.current++;
    gl.shadowMap.needsUpdate = tick % 2 === 0;
    if (tick === 0) mark('first frame — everything above this line is allocated and the street drew');
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
        shadow-mapSize={shadowMap}
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
      <Posters street={street} locale={locale} state={state} onOpen={onOpen} hovered={hovered} cue={cue} />
      {first && <Gull poster={first} state={state} hovered={hovered} onOpen={onOpen} cue={cue} />}
    </>
  );
}

// Opening and closing a poster is a React state change up in Street.tsx, and without this the whole scene
// re-rendered on the very frame of the click — the slowest frame there is to lose, since it is the one the
// flight to the poster starts on. Every prop here is already stable across those renders.
function StreetScene(props: { state: RefObject<StreetState>; locale: Locale; active: boolean; onOpen: (id: string) => void; onLost: () => void; onReady: () => void }) {
  const { active, ...rest } = props;
  const { state } = props;
  // The render size lives here, not only inside three.js: the canvas puts back whatever size it is given each
  // time this component renders, which would undo a step down.
  const [dpr, setDpr] = useState(firstSize);
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
      <Scene {...rest} town={town} dpr={dpr} onSlow={setDpr} />
    </Canvas>
  );
}

export default memo(StreetScene);
