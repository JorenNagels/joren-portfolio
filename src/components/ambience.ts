// The sounds of the Graslei under the music: water, terraces, birds, passing boats, the odd bicycle bell and duck,
// and the bells when you reach the bridge. All CC0 recordings; sources in notes/music.md one folder up.
// It follows the boat trip through `stage`, which the 3D scene keeps up to date.

import { stage } from './street/stage';

const DIR = '/sounds/';
// Each loop file has PAD seconds of wrap-around either side of the loop itself, so the join is seamless even when
// a browser leaves the MP3 encoder's few milliseconds of silence at the start. Lengths are the loops' own, in seconds.
const PAD = 0.25;
const LOOPS = { water: 40, terrace: 40, birds: 20, gulls: 38, blackbird: 44, paddle: 15, engine: 6.2 };
// All of it together, under the music, at 100% on the volume slider. The one slider moves the music and these
// together (see setAmbienceVolume), so the balance stays the same: these are about 13 dB below the music.
const MAX = 0.39;
let level = 0.5 * 0.5 * MAX;
// Seconds the background sounds take to come in: when the sound is turned on, and when each loop has downloaded.
const FADE_IN = 3;
const SHOTS = ['bells', 'bike-bell', 'duck-1', 'duck-2', 'horn'] as const;
type Name = keyof typeof LOOPS | (typeof SHOTS)[number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Voice = { gain: GainNode; pan: StereoPannerNode };
type Boat = Voice & { near: number; tooted: number };

let ctx: AudioContext;
let bus: GainNode;
const buffers = new Map<Name, AudioBuffer>();
const loading = new Map<Name, Promise<AudioBuffer>>();
let beds: Record<string, Voice> = {};
let boats: Boat[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
let started = false;
let rung = false;
let nextBike = 0;
let nextDuck = 0;

/** Fetches and decodes a sound once, however often it is asked for. */
function load(name: Name) {
  let p = loading.get(name);
  if (!p) {
    p = fetch(DIR + name + '.mp3')
      .then((res) => res.arrayBuffer())
      // The callback form, because older Safari has no promise version.
      .then((data) => new Promise<AudioBuffer>((ok, no) => ctx.decodeAudioData(data, ok, no)))
      .then((buf) => (buffers.set(name, buf), buf));
    loading.set(name, p);
  }
  return p;
}

function voice(gain = 0, pan = 0): Voice {
  const g = ctx.createGain();
  g.gain.value = gain;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(bus);
  return { gain: g, pan: p };
}

/** A loop that runs for as long as the page is open; its voice's volume does the rest. */
function bed(name: keyof typeof LOOPS, v: Voice) {
  load(name).then((buf) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = PAD;
    src.loopEnd = PAD + LOOPS[name];
    // Each loop starts when its file has arrived, often a moment after the music: let it come in softly.
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0, ctx.currentTime);
    fade.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN);
    src.connect(fade).connect(v.gain);
    src.start(0, PAD + Math.random() * LOOPS[name]); // a different start each time, so it never sounds canned
  }, () => {});
  return v;
}

function shot(name: Name, gain: number, pan: number) {
  const buf = buffers.get(name);
  if (!buf) return;
  const v = voice(gain, pan);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(v.gain);
  src.onended = () => v.pan.disconnect();
  src.start();
}

function set(p: AudioParam, v: number, smooth = 0.25) {
  // While the 3D scene sets itself up (or after a resize mid-load) its camera can briefly be NaN: keep the last value.
  if (!Number.isFinite(v)) return;
  p.setTargetAtTime(v, ctx.currentTime, smooth);
}

/** Left (-1) to right (+1) of something at z, seen from the boat facing down the river. */
function panAt(z: number, d: number) {
  return Math.max(-0.9, Math.min(0.9, (z - stage.cam.z) / Math.max(d, 4)));
}

function tick() {
  const { cam, intro, outro, night } = stage;
  const now = ctx.currentTime;
  const aboard = intro > 0.5 && outro < 0.5;
  // Up high (the opening shot, the bridge at the end) the water is further away and the town is all around.
  const low = clamp01(1 - (cam.y - 3) / 30);
  const day = 1 - clamp01((night - 0.1) / 0.7);
  // The blackbird sings at dusk: in when the sun goes down, gone when it is dark.
  const dusk = Math.sin(Math.PI * clamp01((night - 0.05) / 0.8));

  set(beds.waterL.gain.gain, 0.75 * (0.35 + 0.65 * low));
  set(beds.waterR.gain.gain, 0.75 * (0.35 + 0.65 * low));
  set(beds.terrace.gain.gain, 0.5 * day ** 1.5);
  set(beds.terrace2.gain.gain, 0.28 * day ** 1.5);
  set(beds.birds.gain.gain, 0.3 * day);
  set(beds.gulls.gain.gain, 0.18 * (0.2 + 0.8 * day));
  set(beds.blackbird.gain.gain, 0.32 * dusk);

  // The scene may come after the music was turned on; give each boat on the move its sound as it turns up.
  while (boats.length < stage.movers.length) boats.push({ ...bed(stage.movers[boats.length].sound, voice()), near: Infinity, tooted: 0 });
  stage.movers.forEach((m, i) => {
    const b = boats[i];
    const d = Math.hypot(m.x - cam.x, m.z - cam.z, (cam.y - 1) * 0.6);
    const loud = m.sound === 'engine' ? 0.55 : 0.5;
    set(b.gain.gain, loud / (1 + (d / 9) ** 2), 0.15);
    set(b.pan.pan, panAt(m.z, d), 0.15);
    // A tour boat gives one toot as it comes up to you, now and then.
    if (m.sound === 'engine' && aboard && d < 24 && b.near >= 24 && now > b.tooted && Math.random() < 0.6) {
      b.tooted = now + 120;
      shot('horn', 0.35 / (1 + (d / 14) ** 2), panAt(m.z, d));
    }
    b.near = d;
  });

  // Now and then a bicycle bell on one of the quays, and a duck near the water.
  if (now > nextBike) {
    if (aboard && day > 0.4) shot('bike-bell', rand(0.12, 0.22), Math.random() < 0.5 ? rand(-0.8, -0.5) : rand(0.5, 0.8));
    nextBike = now + rand(25, 60);
  }
  if (now > nextDuck) {
    if (aboard && night < 0.8) shot(Math.random() < 0.5 ? 'duck-1' : 'duck-2', rand(0.2, 0.35), rand(-0.7, 0.7));
    nextDuck = now + rand(35, 80);
  }

  // The bells ring once when you climb onto the bridge, and again only after you have gone back down the river.
  if (outro > 0.35 && !rung) {
    rung = true;
    shot('bells', 1, 0.15);
  } else if (outro < 0.05) rung = false;
}

/** Starts the ambience on the music's audio context. Call it again after a stop: it only builds things once. */
export function startAmbience(c: AudioContext, out: AudioNode) {
  if (!started) {
    started = true;
    ctx = c;
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(out);
    // The water twice, half a loop apart and spread left and right, so it sounds wide.
    const w = bed('water', voice(0, -0.6));
    beds = {
      waterL: w,
      waterR: voice(0, 0.6),
      terrace: bed('terrace', voice(0, -0.45)), // the Graslei terraces, on your left
      terrace2: voice(0, 0.5), // a quieter Korenlei, on your right
      birds: bed('birds', voice(0, 0.25)),
      gulls: bed('gulls', voice(0, -0.2)),
      blackbird: bed('blackbird', voice(0, -0.5)),
    };
    // The same recordings again, started elsewhere in the loop, for the other side.
    bed('water', beds.waterR);
    bed('terrace', beds.terrace2);
    SHOTS.forEach((n) => void load(n).catch(() => {}));
    nextBike = ctx.currentTime + rand(15, 30);
    nextDuck = ctx.currentTime + rand(20, 40);
  }
  // Every time the sound comes on, the background comes in softly, a little after the music.
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(level, t + FADE_IN);
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 100);
}

/** Stops following the trip (the music is off). The sound itself fades and stops with the music's context. */
export function pauseAmbience() {
  clearInterval(timer);
}

/** The volume slider, 0 to 1. Squared, so the slider feels even from quiet to loud. */
export function setAmbienceVolume(v: number) {
  level = v * v * MAX;
  if (!bus) return;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setTargetAtTime(level, ctx.currentTime, 0.05);
}
