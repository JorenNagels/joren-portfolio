'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '@/content/types';
import { ui } from '@/content/ui';
import { pauseAmbience, setAmbienceVolume, startAmbience } from './ambience';

// Five songs from Komiku's album "It's time for adventure", all CC0 (public domain).
// Sources are listed in notes/music.md one folder up.
const TRACKS = [
  '/music/champ-de-tournesol.mp3',
  '/music/barque-sur-le-lac.mp3',
  '/music/de-lherbe-sous-les-pieds.mp3',
  '/music/bleu.mp3',
  '/music/la-ville-aux-ponts-suspendus.mp3',
];
// The music's volume at 100% on the slider. Squared, so the slider feels even; the default, 50%, gives 0.2.
// The same slider moves the background sounds (MAX in ambience.ts), so the balance between the two stays put.
const MUSIC_MAX = 0.82;
const FADE = 0.7; // seconds, turning the music on or off
// Between songs: the ending song fades out over its last OUT seconds, the next one starts OVERLAP seconds before
// it ends and fades in over IN seconds. So the music gently dips and comes back, rather than one song cutting in.
const OUT = 8;
const IN = 6;
const OVERLAP = 2.5;

type Deck = { el: HTMLAudioElement; gain: GainNode };

// Kept outside the component so the music carries on when you switch language.
// Two decks, like a DJ: one plays the song, the other holds the next one ready.
// Volume goes through Web Audio because iPhones ignore audio.volume.
let ctx: AudioContext | null = null;
let master: GainNode | null = null; // on/off for music and background sounds together
let musicBus: GainNode | null = null; // the music's share of the volume slider
let decks: Deck[] = [];
let cur = 0; // the deck playing the current song
let queue: number[] = []; // songs in shuffled order: [0] is playing, [1] waits on the other deck
let ending = false; // the current song is fading out, the next one hasn't started yet
let fading = false; // the other deck is still fading out
let playing = false; // the sound is meant to be on (it may still be waiting for the browser to allow it)
let audible = false; // the browser allowed it and it is actually playing
let attempt = 0; // each start gets a number, so a late answer from an earlier try is ignored
let unlocked = false; // the waiting deck has been played once from a tap (see unlock)
let stopping: ReturnType<typeof setTimeout> | undefined;
let leaving: ReturnType<typeof setTimeout> | undefined;

// Muted or not, and the volume, are remembered for this visit (this tab), not for good: a new visit starts with
// sound again. Storage can be missing (private windows, blocked site data); then the defaults simply apply.
type Prefs = { muted: boolean; volume: number };
const DEFAULTS: Prefs = { muted: false, volume: 0.5 };
const KEY = 'sound';
function prefs(): Prefs {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    return { muted: p.muted === true, volume: typeof p.volume === 'number' ? p.volume : DEFAULTS.volume };
  } catch {
    return DEFAULTS;
  }
}
function save(p: Partial<Prefs>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...prefs(), ...p }));
  } catch {}
}

function setMusicVolume(v: number) {
  if (!ctx || !musicBus) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(v * v * MUSIC_MAX, ctx.currentTime, 0.05);
}

/** iPhones only let a song start from a tap, so play the waiting deck once (silently) while we have one. */
function unlock() {
  if (unlocked) return;
  const spare = decks[1 - cur].el;
  void spare
    .play()
    .then(() => {
      unlocked = true;
      if (decks[cur].el !== spare) {
        spare.pause();
        spare.currentTime = 0;
      }
    })
    .catch(() => {});
}

/** Shuffle: every song once per round, in a new order each round, and never the same song twice in a row. */
function fill() {
  while (queue.length < 2) {
    const round = TRACKS.map((_, i) => i);
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    const last = queue[queue.length - 1];
    if (round[0] === last) [round[0], round[round.length - 1]] = [round[round.length - 1], round[0]];
    queue.push(...round);
  }
}

/** A smooth fade (an S-curve: it starts and ends gently), from 0 to 1 or from 1 to 0. */
function curve(p: AudioParam, up: boolean, dur: number) {
  if (!ctx) return;
  const c = new Float32Array(64);
  for (let k = 0; k < c.length; k++) {
    const s = (1 - Math.cos((k / (c.length - 1)) * Math.PI)) / 2;
    c[k] = up ? s : 1 - s;
  }
  const t = ctx.currentTime;
  p.cancelScheduledValues(t);
  p.setValueCurveAtTime(c, t, dur);
}

function rampMaster(to: number) {
  if (!ctx || !master) return;
  const g = master.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(to, t + FADE);
}

/** Called as the current song plays: fade it out near the end, then bring in the next one. */
function follow(el: HTMLAudioElement) {
  const left = el.duration - el.currentTime;
  if (!ending && !fading && left <= OUT) {
    ending = true;
    curve(decks[cur].gain.gain, false, Math.max(left, 0.05));
  }
  if (ending && left <= OVERLAP) next();
}

/** Start the next song on the other deck, fading in. */
function next() {
  const to = decks[1 - cur];
  queue.shift();
  fill();
  cur = 1 - cur;
  ending = false;
  fading = true;
  to.el.currentTime = 0;
  curve(to.gain.gain, true, IN);
  void to.el.play().catch(() => {});
}

function setup() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const c = new AC();
  const m = c.createGain();
  m.gain.value = 0;
  m.connect(c.destination);
  const music = c.createGain();
  music.gain.value = prefs().volume ** 2 * MUSIC_MAX;
  music.connect(m);
  ctx = c;
  master = m;
  musicBus = music;
  fill();
  decks = [0, 1].map((i) => {
    const el = new Audio(TRACKS[queue[i]]);
    el.preload = 'auto';
    const gain = c.createGain();
    gain.gain.value = i === 0 ? 1 : 0;
    c.createMediaElementSource(el).connect(gain).connect(music);
    el.addEventListener('timeupdate', () => {
      if (i === cur && playing) follow(el);
    });
    el.addEventListener('ended', () => {
      // Normally the next song has already started; this catches a missed one.
      if (i === cur) next();
      fading = false;
      el.src = TRACKS[queue[1]];
      el.load();
    });
    return { el, gain };
  });
}

function hold() {
  audible = false;
  pauseAmbience();
  decks.forEach((d) => d.el.pause());
  void ctx?.suspend();
}

/** Plays again. Fails when the browser doesn't allow sound yet; then nothing plays and nothing is downloaded. */
async function resume() {
  if (!ctx || !master) return;
  void ctx.resume();
  await decks[cur].el.play();
  if (fading) void decks[1 - cur].el.play().catch(() => {});
  // A browser can let the song "play" while keeping all sound off; give it a moment, then check.
  if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 400))]);
  if (ctx.state !== 'running') {
    decks.forEach((d) => d.el.pause());
    throw new Error('Sound not allowed yet');
  }
  audible = true;
  startAmbience(ctx, master);
}

function stop() {
  hold();
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
  }
}

/** Background music for the boat trip, five songs in shuffled order that flow into each other, with the sounds of
 * the Graslei under it. It starts at the visitor's first click, tap or key press, the only thing that lets a browser
 * play sound: normally that's "Step aboard" (street/Street.tsx), which waits for one. The button opens a small panel: mute, and one volume for the music and sounds together. */
export function Music({ locale: l }: { locale: Locale }) {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [vol, setVol] = useState(DEFAULTS.volume);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  // The icon and the panel show whether you can actually hear it, so `on` changes only once the browser said yes.
  const start = () => {
    if (!ctx) setup();
    setAmbienceVolume(prefs().volume);
    playing = true;
    clearTimeout(stopping);
    const n = ++attempt;
    resume()
      .then(() => {
        if (n !== attempt || !playing) return;
        setOn(true);
        rampMaster(1);
      })
      .catch(() => {
        if (n !== attempt) return;
        playing = false;
        setOn(false);
      });
    unlock();
  };

  const off = () => {
    playing = false;
    attempt++;
    setOn(false);
    rampMaster(0);
    stopping = setTimeout(() => !playing && stop(), FADE * 1000);
  };

  useEffect(() => {
    clearTimeout(leaving);
    setOn(audible);
    setVol(prefs().volume);
    // Turning it off used to be remembered for good; now it is only for the visit. Forget the old setting.
    try {
      localStorage.removeItem('music');
    } catch {}

    // Start by itself, only on the 3D trip (where the sound button is), and not if it was muted during this visit.
    // Also while an earlier try is still waiting on the browser: this click or key press is what it was waiting for.
    const wanted = () => !audible && !prefs().muted && document.documentElement.classList.contains('walk');
    const gesture = (e: Event) => {
      const t = e.target as Element | null;
      // The sound button only opens its panel, the panel does its own thing, and a link is about to leave the page.
      if (t?.closest?.('.music, a') || (e instanceof KeyboardEvent && e.key === 'Escape')) return;
      if (wanted()) start();
    };
    const events = ['pointerup', 'touchend', 'keydown'] as const;
    events.forEach((n) => addEventListener(n, gesture, { capture: true, passive: true }));

    const hidden = () => {
      if (!ctx || !playing) return;
      if (document.hidden) hold();
      else void resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      events.forEach((n) => removeEventListener(n, gesture, { capture: true }));
      document.removeEventListener('visibilitychange', hidden);
      // Leaving the page stops the music; a language switch mounts this again first and cancels that.
      leaving = setTimeout(() => {
        playing = false;
        stop();
      }, 300);
    };
  }, []);

  // The panel closes on a click or tap outside it, and on Escape (back to the button).
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    addEventListener('pointerdown', outside);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('pointerdown', outside);
      removeEventListener('keydown', key);
    };
  }, [open]);

  const mute = () => {
    save({ muted: on });
    if (on) off();
    else start();
  };

  // Moving the slider means you want to hear it, so it also turns the sound back on.
  const slide = (v: number) => {
    setVol(v);
    save({ volume: v, muted: false });
    setMusicVolume(v);
    setAmbienceVolume(v);
    if (!playing) start();
  };

  return (
    <div className="music flex">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={ui.nav.soundSettings[l]}
        title={ui.nav.soundSettings[l]}
        className="flex cursor-pointer items-center gap-1.5 hover:underline"
      >
        <Speaker on={on} />
        <span className="hidden sm:inline">{ui.nav.sound[l]}</span>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="group"
          aria-label={ui.nav.soundSettings[l]}
          className="absolute right-0 top-full mt-3 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#14161c]/95 p-4 text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
        >
          <button
            type="button"
            data-mute
            onClick={mute}
            aria-pressed={!on}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 font-medium hover:bg-white/20"
          >
            <Speaker on={!on} />
            {on ? ui.nav.mute[l] : ui.nav.soundOn[l]}
          </button>
          <Slider label={ui.nav.volume[l]} value={vol} onChange={slide} />
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-[13px]">
        <label htmlFor={id}>{label}</label>
        <span className="tabular-nums text-white/60" aria-hidden="true">
          {pct}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-6 w-full cursor-pointer accent-[#ffb066]"
      />
    </div>
  );
}

/** A speaker: with sound waves when on, with a cross when off. */
function Speaker({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" />
      {on ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}
