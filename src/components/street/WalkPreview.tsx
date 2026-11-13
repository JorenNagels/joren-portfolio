'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Locale } from '@/content/types';
import type { Move } from './actor';

const WalkScene = dynamic(() => import('./WalkScene'), { ssr: false });

export type View = 'side' | 'three' | 'front' | 'face';
const MOVES: [Move, { nl: string; en: string }][] = [
  ['Walk_Loop', { nl: 'Wandelen', en: 'Walk' }],
  ['Walk_Formal_Loop', { nl: 'Rustig wandelen', en: 'Calm walk' }],
  ['Idle_Loop', { nl: 'Staan', en: 'Stand' }],
  ['Idle_Talking_Loop', { nl: 'Praten', en: 'Talk' }],
  ['Sitting_Idle_Loop', { nl: 'Zitten', en: 'Sit' }],
  ['Sitting_Talking_Loop', { nl: 'Zittend praten', en: 'Sit and talk' }],
];
const VIEWS: [View, { nl: string; en: string }][] = [
  ['side', { nl: 'Zij', en: 'Side' }],
  ['three', { nl: 'Driekwart', en: 'Three-quarter' }],
  ['front', { nl: 'Voor', en: 'Front' }],
  ['face', { nl: 'Hoofd', en: 'Head' }],
];
const t = {
  next: { nl: 'Volgende persoon', en: 'Next person' },
  slow: { nl: 'Vertraagd', en: 'Slow motion' },
};

const chip = (on: boolean) => `rounded-full px-3 py-1.5 ${on ? 'bg-[#25262f] text-white' : 'bg-white/75 hover:bg-white'}`;

export function WalkPreview({ locale: l }: { locale: Locale }) {
  const [seed, setSeed] = useState(1);
  const [move, setMove] = useState<Move>('Walk_Loop');
  const [view, setView] = useState<View>('side');
  const [slow, setSlow] = useState(false);
  // ?seed=3&move=Idle_Loop&view=front&slow=1, for screenshots
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('seed')) setSeed(Number(q.get('seed')));
    if (q.get('move')) setMove(q.get('move') as Move);
    if (q.get('view')) setView(q.get('view') as View);
    if (q.get('slow')) setSlow(true);
  }, []);
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[linear-gradient(#86cfc3,#d5ede4)] text-sm text-[#25262f]">
      <WalkScene seed={seed} move={move} view={view} slow={slow} />
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-4 sm:px-8">
        {MOVES.map(([m, label]) => (
          <button key={m} type="button" className={chip(move === m)} onClick={() => setMove(m)}>{label[l]}</button>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 p-4 sm:px-8">
        {VIEWS.map(([v, label]) => (
          <button key={v} type="button" className={chip(view === v)} onClick={() => setView(v)}>{label[l]}</button>
        ))}
        <button type="button" className={chip(slow)} onClick={() => setSlow((s) => !s)}>{t.slow[l]}</button>
        <button type="button" className={chip(false)} onClick={() => setSeed((s) => s + 1)}>{t.next[l]}</button>
      </div>
    </div>
  );
}
