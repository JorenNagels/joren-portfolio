import type { Metadata } from 'next';
import Link from 'next/link';
import { person } from '@/content/profile';

export const metadata: Metadata = {
  title: person.name,
  alternates: { languages: { nl: '/nl/', en: '/en/' } },
};

const pickLanguage = `(function(){var l=(navigator.languages||[navigator.language||'']).join(',').toLowerCase();location.replace(/(^|,)nl/.test(l)?'/nl/':'/en/');})();`;

export default function RootPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <script dangerouslySetInnerHTML={{ __html: pickLanguage }} />
      <div>
        <p className="text-4xl font-semibold tracking-tight">{person.name}</p>
        <p className="mt-4 text-muted">
          <Link className="underline" href="/nl/">Nederlands</Link> · <Link className="underline" href="/en/">English</Link>
        </p>
      </div>
    </main>
  );
}
