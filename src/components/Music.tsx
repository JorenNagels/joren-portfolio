'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/content/types';
import { ui } from '@/content/ui';

// "Champ de tournesol" by Komiku, CC0: https://opengameart.org/content/champ-de-tournesol
const SRC = '/music/champ-de-tournesol.mp3';
const LEVEL = 0.4;

// Kept outside the component so the music carries on when you switch language.
let audio: HTMLAudioElement | null = null;
let playing = false;
let fade = 0;
let leaving: ReturnType<typeof setTimeout> | undefined;

function ramp(to: number, then?: () => void) {
  const a = audio;
  if (!a) return;
  cancelAnimationFrame(fade);
  const from = a.volume;
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(Math.max((t - t0) / 700, 0), 1);
    a.volume = from + (to - from) * k;
    if (k < 1) fade = requestAnimationFrame(step);
    else then?.();
  };
  fade = requestAnimationFrame(step);
}

/** Background music for the boat trip. Off until you ask for it. */
export function Music({ locale: l }: { locale: Locale }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    clearTimeout(leaving);
    setOn(playing);
    const hidden = () => {
      if (!audio || !playing) return;
      if (document.hidden) audio.pause();
      else void audio.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      // Leaving the page stops the music; a language switch mounts this again first and cancels that.
      leaving = setTimeout(() => {
        playing = false;
        audio?.pause();
      }, 300);
    };
  }, []);

  const toggle = () => {
    if (!audio) {
      audio = new Audio(SRC);
      audio.loop = true;
      audio.volume = 0;
    }
    const next = !on;
    playing = next;
    setOn(next);
    if (next) {
      audio
        .play()
        .then(() => playing && ramp(LEVEL))
        .catch(() => {
          playing = false;
          setOn(false);
        });
    } else {
      ramp(0, () => audio?.pause());
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={(on ? ui.nav.musicOff : ui.nav.musicOn)[l]}
      title={(on ? ui.nav.musicOff : ui.nav.musicOn)[l]}
      className="music flex cursor-pointer items-center gap-1.5 hover:underline"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" />
        {on ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>
      <span className="hidden sm:inline">{ui.nav.music[l]}</span>
    </button>
  );
}
