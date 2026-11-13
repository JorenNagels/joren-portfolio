'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Locale } from '@/content/types';

const ModelScene = dynamic(() => import('./ModelScene'), { ssr: false });

const text = {
  title: { nl: 'De mensen op de kaaien', en: 'The people on the quays' },
  face: { nl: 'Gezichten van dichtbij', en: 'Faces close up' },
  all: { nl: 'Iedereen', en: 'Everyone' },
};

export function ModelPreview({ locale: l }: { locale: Locale }) {
  const [close, setClose] = useState(false);
  useEffect(() => setClose(new URLSearchParams(location.search).get('v') === 'face'), []);
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[linear-gradient(#86cfc3,#d5ede4)] text-[#25262f]">
      <ModelScene close={close} />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-4 text-sm sm:px-8">
        <p>{text.title[l]}</p>
        <button type="button" onClick={() => setClose((c) => !c)} className="shrink-0 rounded-full bg-white/75 px-4 py-2 hover:bg-white">
          {close ? text.all[l] : text.face[l]}
        </button>
      </div>
    </div>
  );
}
