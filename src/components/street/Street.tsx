'use client';

import type Lenis from 'lenis';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { experience, languages, person, skills, sport, summary } from '@/content/profile';
import { projects } from '@/content/projects';
import type { Locale } from '@/content/types';
import { period, ui } from '@/content/ui';
import { onFrame } from '@/lib/ticker';
import { BeatArt } from '../BeatArt';
import { streetCopy as t } from './copy';
import { kindOf, labelOf } from './labels';
import { Loader } from './Loader';
import { RIDE, STOPS } from './plan';
import { skyAt } from './sky';
import type { StreetState } from './StreetScene';

const StreetScene = dynamic(() => import('./StreetScene'), { ssr: false });
const lenis = () => (window as unknown as { lenis?: Lenis }).lenis;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Scroll budget: the wide opening shot, the walk past the houses, the wide closing shot.
const INTRO = 0.08;
const OUTRO = 0.9;

// Where the boat should be to see each poster best: a few metres before it, with the head turned.
const stops = STOPS.map((s) => ({ ...s, x: s.x - 8 }));

export function Street({ locale: l }: { locale: Locale }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const state = useRef<StreetState>({ x: stops[0].x, intro: 0, outro: 0, p: 0, pointer: false, reduced: false, focus: null, arrival: null });
  const els = useRef<Record<string, HTMLElement | null>>({});
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [active, setActive] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [current, setCurrent] = useState(stops[0].id);
  // Loading: the 3D code is in and the street built, then its first frame drawn, then the pop-up has folded away.
  const [built, setBuilt] = useState(false);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // Then the visitor steps aboard: a click or key press, which is also what lets the browser play the music.
  const [started, setStarted] = useState(false);
  const [gateGone, setGateGone] = useState(false);
  const startBtn = useRef<HTMLButtonElement>(null);
  const start = useCallback(() => setStarted(true), []);
  const gate = ready && !started;
  // The loader says where it drew the houses, so the 3D camera can start on the very same picture.
  const onMeasure = useCallback((m: number, base: number) => {
    if (!state.current.reduced) state.current.arrival = { m, base, at: Infinity };
  }, []);
  const onShown = useCallback(() => {
    setShown(true);
    // the swing starts once the drawn houses have dissolved into the real ones
    if (state.current.arrival) state.current.arrival.at = performance.now() + 1100;
  }, []);

  // Walking slows down in front of each poster.
  const table = useRef<{ x: number[]; c: number[] } | null>(null);
  if (!table.current) {
    const x0 = RIDE.from;
    const x1 = RIDE.to;
    const xs: number[] = [];
    const cs: number[] = [0];
    for (let x = x0; x <= x1 + 1e-6; x += 0.1) {
      const c = 1;
      if (xs.length) cs.push(cs.at(-1)! + c);
      xs.push(x);
    }
    table.current = { x: xs, c: cs };
  }
  const xAt = (w: number) => {
    const { x, c } = table.current!;
    const target = clamp01(w) * c.at(-1)!;
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] < target) lo = m;
      else hi = m;
    }
    const f = (target - c[lo]) / Math.max(1e-6, c[hi] - c[lo]);
    return x[lo] + (x[hi] - x[lo]) * f;
  };
  const progressAtX = (x: number) => {
    const { x: xs, c } = table.current!;
    const i = Math.max(0, Math.min(xs.length - 1, Math.round((x - xs[0]) / 0.1)));
    return INTRO + (OUTRO - INTRO) * (c[i] / c.at(-1)!);
  };

  useEffect(() => {
    let ok = false;
    try {
      ok = !!document.createElement('canvas').getContext('webgl2');
    } catch {}
    setWebgl(ok);
    document.documentElement.classList.toggle('walk', ok);
    // the same chunk next/dynamic loads below: this only tells the loader when it is in
    if (ok) import('./StreetScene').then(() => setBuilt(true));
    state.current.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!webgl) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    io.observe(root.current!);
    let last = '';
    // Only touch the page's styles when something moved: writing them every frame makes the browser redo the
    // style and repaint the sky behind the canvas, even when nobody is scrolling.
    let drawn: { p: number; focus: string | null } | null = null;
    const tick = () => {
      const el = root.current;
      const st = stage.current;
      if (!el || !st) return;
      const r = el.getBoundingClientRect();
      const p = clamp01(-r.top / (r.height - innerHeight));
      const s = state.current;
      if (drawn && drawn.p === p && drawn.focus === s.focus) return;
      drawn = { p, focus: s.focus };
      s.p = p;
      s.intro = clamp01(p / INTRO);
      s.outro = clamp01((p - OUTRO) / (1 - OUTRO));
      s.x = xAt((p - INTRO) / (OUTRO - INTRO));
      const sky = skyAt(p);
      st.style.background = `linear-gradient(to bottom, rgb(${sky.top.map(Math.round)}) 0%, rgb(${sky.horizon.map(Math.round)}) 62%)`;
      const fg = Math.round(37 + sky.dark * 205);
      st.style.setProperty('--fg', `rgb(${fg},${fg},${Math.min(255, fg + 8)})`);

      const show = (k: string, o: number) => {
        const x = els.current[k];
        if (!x) return;
        x.style.opacity = String(o);
        x.style.transform = `translate3d(0, ${((1 - o) * 14).toFixed(1)}px, 0)`;
        x.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      };
      const focus = s.focus ? 0 : 1;
      show('nav', clamp01((s.intro - 0.7) / 0.3) * (1 - clamp01(s.outro / 0.4)) * focus);
      show('hint', clamp01((s.intro - 0.8) / 0.2) * (1 - clamp01((s.x - stops[0].x + 2) / 6)) * focus);
      show('end', clamp01((s.outro - 0.55) / 0.4));

      let near = stops[0].id;
      for (const st2 of stops) if (Math.abs(st2.x - s.x) < Math.abs(stops.find((q) => q.id === near)!.x - s.x)) near = st2.id;
      if (near !== last) setCurrent((last = near));
    };
    tick();
    const off = onFrame(tick, 1);
    return () => {
      off();
      io.disconnect();
    };
    // xAt only reads a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  // While the start button waits: no scrolling yet (the trip would move on behind the loader), any key starts, and
  // trying to scroll gives the button a wiggle, since a scroll can't start the sound.
  useEffect(() => {
    if (!gate) return;
    const html = document.documentElement;
    html.classList.add('gated');
    lenis()?.stop();
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ['Tab', 'Shift', 'Escape', 'CapsLock'].includes(e.key)) return;
      // keep the header working from the keyboard: its links and the sound button
      if ((e.target as Element | null)?.closest?.('a, .music')) return;
      e.preventDefault();
      setStarted(true);
    };
    let last = 0;
    const tried = () => {
      const now = performance.now();
      if (now - last < 700) return;
      last = now;
      startBtn.current?.animate({ rotate: ['0deg', '-7deg', '6deg', '-4deg', '2deg', '0deg'] }, { duration: 550, easing: 'ease-out' });
    };
    addEventListener('keydown', key);
    addEventListener('wheel', tried, { passive: true });
    addEventListener('touchmove', tried, { passive: true });
    return () => {
      html.classList.remove('gated');
      lenis()?.start();
      removeEventListener('keydown', key);
      removeEventListener('wheel', tried);
      removeEventListener('touchmove', tried);
    };
  }, [gate]);
  useEffect(() => {
    if (!started) return;
    const id = setTimeout(() => setGateGone(true), 500);
    return () => clearTimeout(id);
  }, [started]);

  const openStop = useCallback((id: string) => {
    state.current.focus = id;
    setOpen(id);
    lenis()?.stop();
  }, []);
  const close = useCallback(() => {
    state.current.focus = null;
    setOpen(null);
    lenis()?.start();
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', key);
    document.getElementById('panel-close')?.focus();
    return () => removeEventListener('keydown', key);
  }, [open, close]);

  const goTo = (id: string) => {
    const el = root.current!;
    const x = stops.find((s) => s.id === id)!.x;
    const y = el.offsetTop + progressAtX(x) * (el.offsetHeight - innerHeight);
    if (lenis()) lenis()!.scrollTo(y, { duration: 1.8 });
    else scrollTo({ top: y, behavior: 'smooth' });
  };

  if (webgl === false) return null;
  const idx = stops.findIndex((s) => s.id === current);

  return (
    <section ref={root} className="relative h-[1000vh]" aria-label={person.name}>
      <div ref={stage} className="sticky top-0 h-dvh overflow-hidden text-[var(--fg)]" style={{ background: 'linear-gradient(to bottom, rgb(118,196,186), rgb(238,232,210) 62%)', ['--fg' as string]: '#25262f' }}>
        <div className={`absolute inset-0 transition-opacity duration-500 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}>
          {webgl && <StreetScene state={state} locale={l} active={active} onOpen={openStop} onReady={onReady} />}
        </div>
        <Loader l={l} built={built} ready={ready} go={started} onMeasure={onMeasure} onOut={onShown} />
        {/* Click anywhere to start (and not on the street behind, which is still hidden) */}
        {gate && <div className="absolute inset-0 cursor-pointer" onClick={start} aria-hidden />}

        {/* While the street loads: the name over the pop-up houses, and once it's in, the button to step aboard. Then
            the name hangs in the street's sky (skyBoard.ts), with the scroll hint under it, and the camera swings round
            to it. */}
        <div className="pointer-events-none absolute inset-x-0 top-[16%] px-4 text-center">
          <p className={`transition-opacity duration-700 ${shown ? 'opacity-0' : ''}`} aria-hidden>
            <span className="block text-base sm:text-lg">{t.role[l]}</span>
            <span className="mt-1 block text-[clamp(2.5rem,8.2vw,8.9rem)] font-semibold leading-[0.85] tracking-[-0.055em]">{person.name}</span>
          </p>
          {ready && !gateGone && (
            <div className="gate mt-[clamp(1.25rem,5vh,3rem)] flex flex-col items-center" data-go={started || undefined}>
              <button
                ref={startBtn}
                type="button"
                onClick={start}
                disabled={started}
                className="pointer-events-auto relative flex cursor-pointer items-center gap-3 rounded-full bg-[#f4f0e4] py-2.5 pl-2.5 pr-6 text-lg font-semibold text-[#25262f] shadow-[0_4px_0_#25262f] ring-[1.5px] ring-[#25262f] outline-offset-4 sm:text-xl"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25262f] text-[#f4f0e4]">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M3.5 1.8v10.4L12 7z" fill="currentColor" />
                  </svg>
                </span>
                {t.start[l]}
              </button>
            </div>
          )}
        </div>

        <div ref={(x) => { els.current.hint = x; }} className="pointer-events-none invisible absolute left-1/2 top-20 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-3xl text-center bg-[#25262f] px-4 py-2 text-sm text-[#f4f0e4]" style={{ opacity: 0 }}>
          <span className="[@media(pointer:coarse)]:hidden">{t.hint[l]}</span>
          <span className="hidden [@media(pointer:coarse)]:inline">{t.hintTouch[l]}</span>
        </div>

        {/* Where you are on the street */}
        <nav ref={(x) => { els.current.nav = x; }} aria-label={t.stops[l]} className="invisible absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-6" style={{ opacity: 0 }}>
          <div className="flex max-w-full items-center gap-1 rounded-full bg-[#f4f0e4]/90 p-1 text-sm text-[#25262f] shadow-[0_2px_0_#25262f] ring-[1.5px] ring-[#25262f] backdrop-blur">
            <button type="button" className="rounded-full px-3 py-1.5 hover:bg-black/5 disabled:opacity-30" disabled={idx <= 0} onClick={() => goTo(stops[idx - 1].id)} aria-label="←">←</button>
            <ul className="hidden items-center gap-0.5 lg:flex">
              {stops.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => (s.id === current ? openStop(s.id) : goTo(s.id))} className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${s.id === current ? 'bg-[#25262f] text-[#f4f0e4]' : 'hover:bg-black/5'}`}>
                    {labelOf(s.id, l)}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => openStop(current)} className="rounded-full bg-[#25262f] px-4 py-1.5 text-[#f4f0e4] lg:hidden">
              {labelOf(current, l)}
            </button>
            <button type="button" className="rounded-full px-3 py-1.5 hover:bg-black/5 disabled:opacity-30" disabled={idx >= stops.length - 1} onClick={() => goTo(stops[idx + 1].id)} aria-label="→">→</button>
          </div>
        </nav>

        {/* The end: the thanks hang in the night sky (skyBoard.ts); the links to follow it stay on the page */}
        <div ref={(x) => { els.current.end = x; }} className="invisible absolute inset-x-0 top-[37%] px-4 text-center sm:top-[33%]" style={{ opacity: 0 }}>
          <h2 className="sr-only">{t.endTitle[l]}</h2>
          <p className="sr-only">{t.endText[l]}</p>
          <ul className="flex flex-wrap justify-center gap-3">
            <Social href={`mailto:${person.email}`}>{person.email}</Social>
            <Social href={person.github} label="GitHub"><Mark name="github" /></Social>
            {person.linkedin && <Social href={person.linkedin} label="LinkedIn"><Mark name="linkedin" /></Social>}
            <Social href={`/${l}/cv/`} internal>CV</Social>
          </ul>
        </div>

        <Panel id={open} l={l} onClose={close} />
      </div>
    </section>
  );
}

/**
 * A button at the end of the trip. `label` is for the two that show a logo instead of a word: it names the button
 * for a screen reader and on hover, and tightens the padding round the mark so the button comes out round.
 */
function Social({ href, children, internal, label }: { href: string; children: React.ReactNode; internal?: boolean; label?: string }) {
  const cls = `inline-block rounded-full [text-shadow:none] bg-[#f4f0e4] py-2.5 text-[#25262f] shadow-[0_3px_0_#25262f] ring-[1.5px] ring-[#25262f] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_#25262f] ${label ? 'px-3' : 'px-5'}`;
  const a = { className: cls, 'aria-label': label, title: label };
  return <li>{internal ? <Link href={href} {...a}>{children}</Link> : <a href={href} {...a}>{children}</a>}</li>;
}

// The GitHub and LinkedIn marks, as each of them publishes it.
const MARKS = {
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z',
};

function Mark({ name }: { name: keyof typeof MARKS }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false" className="block">
      <path d={MARKS[name]} />
    </svg>
  );
}

/* ---------------- The panel next to a poster ---------------- */

function Panel({ id, l, onClose }: { id: string | null; l: Locale; onClose: () => void }) {
  const [shown, setShown] = useState<string | null>(id);
  useEffect(() => {
    if (id) setShown(id);
  }, [id]);
  const kind = shown ? kindOf(shown) : null;
  return (
    <>
      <div className={`absolute inset-0 ${id ? '' : 'pointer-events-none'}`} onClick={onClose} aria-hidden />
      <aside
        className={`absolute inset-x-0 bottom-0 max-h-[60dvh] overflow-y-auto rounded-t-2xl bg-[#f4f0e4] p-6 text-[#25262f] ring-[1.5px] ring-[#25262f] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-16 sm:max-h-none sm:w-[min(500px,42vw)] sm:rounded-2xl sm:p-9 sm:shadow-[4px_4px_0_#25262f] ${
          id ? 'translate-y-0 sm:translate-x-0' : 'translate-y-[110%] sm:translate-x-[115%] sm:translate-y-0'
        }`}
        aria-hidden={!id}
        data-lenis-prevent
      >
        <button id="panel-close" type="button" onClick={onClose} className="float-right -mr-2 -mt-2 rounded-full px-3 py-1 text-sm ring-[1.5px] ring-[#25262f] hover:bg-black/5">
          {t.close[l]} ✕
        </button>
        {kind === 'about' && <AboutPanel l={l} />}
        {kind === 'work' && <WorkPanel id={shown!} l={l} />}
        {kind === 'project' && <ProjectPanel id={shown!} l={l} />}
      </aside>
    </>
  );
}

function AboutPanel({ l }: { l: Locale }) {
  return (
    <article>
      <img src={person.photo} alt={person.name} className="h-20 w-20 rounded-full object-cover ring-[1.5px] ring-[#25262f]" style={{ objectPosition: '50% 25%' }} />
      <h2 className="mt-5 text-5xl font-semibold tracking-[-0.04em]">{person.name}</h2>
      <p className="mt-5 leading-relaxed">{summary[l]}</p>
      <h3 className="mt-8 text-sm font-semibold">{t.skills[l]}</h3>
      <dl className="mt-2 space-y-2 text-[15px]">
        {skills.map((s) => (
          <div key={s.group.en} className="border-t border-black/10 pt-2">
            <dt className="font-medium">{s.group[l]}</dt>
            <dd className="text-[#5d5a52]">{s.items}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-8 text-sm font-semibold">{t.languages[l]}</h3>
      <p className="mt-2 text-[15px]">{languages.map((x) => `${x.name[l]} (${x.level[l]})`).join(', ')}</p>
      <h3 className="mt-8 text-sm font-semibold">{ui.cv.interests[l]}</h3>
      <p className="mt-2 text-[15px]">{sport[l]}</p>
      <Link href={`/${l}/cv/`} className="mt-8 inline-block underline">{ui.work.more[l]} →</Link>
    </article>
  );
}

function WorkPanel({ id, l }: { id: string; l: Locale }) {
  const r = experience.find((x) => x.company.toLowerCase() === id)!;
  return (
    <article>
      <p className="text-sm text-[#76736a]">{period(r.start, r.end, l)}</p>
      <h2 className="mt-3 text-5xl font-semibold tracking-[-0.04em]">{r.company}</h2>
      <p className="mt-2 text-lg">{r.title[l]}</p>
      <h3 className="mt-8 text-sm font-semibold">{t.highlights[l]}</h3>
      <ul className="mt-3 space-y-4 leading-relaxed">
        {r.highlights.map((h) => (
          <li key={h.en} className="border-t border-black/10 pt-4">{h[l]}</li>
        ))}
      </ul>
    </article>
  );
}

function ProjectPanel({ id, l }: { id: string; l: Locale }) {
  const p = projects.find((x) => x.slug === id)!;
  return (
    <article>
      <p className="text-sm text-[#76736a]">{p.kind[l]}, {p.year}</p>
      <h2 className="mt-3 text-5xl font-semibold leading-[0.95] tracking-[-0.04em]">{p.name}</h2>
      <p className="mt-4 text-xl font-medium leading-snug">{p.tagline[l]}</p>
      <div className="mt-6 aspect-[16/10] overflow-hidden rounded-lg ring-[1.5px] ring-[#25262f]">
        {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover object-top" /> : <BeatArt />}
      </div>
      <div className="mt-6 space-y-3 leading-relaxed">
        {p.story[l].split('\n\n').map((para) => <p key={para}>{para}</p>)}
      </div>
      {p.detail && (
        <p className="mt-5 border-l-2 border-[#c45a3d] pl-4 leading-relaxed">
          <span className="block text-sm font-semibold">{ui.projects.detail[l]}</span>
          {p.detail[l]}
        </p>
      )}
      <p className="mt-5 text-sm text-[#76736a]">{p.stack.join(', ')}</p>
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {p.links.map((x) => (
          <a key={x.href} href={x.href} className="underline">{x.label[l]} ↗</a>
        ))}
      </p>
    </article>
  );
}
