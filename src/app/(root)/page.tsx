import type { Metadata } from 'next';
import Link from 'next/link';
import { headline, intro, person } from '@/content/profile';
import { icons, ogImage } from '@/lib/seo';

// This page only picks a language and redirects, but it is the URL people type and link to, so it carries
// real metadata of its own: a description, a self-canonical, and x-default for visitors we have no language for.
export const metadata: Metadata = {
  metadataBase: new URL(person.site),
  title: `${person.name} · ${headline.en}`,
  description: intro.en,
  alternates: { canonical: '/', languages: { nl: '/nl/', en: '/en/', 'x-default': '/' } },
  icons,
  openGraph: { title: person.name, description: intro.en, type: 'profile', images: [ogImage] },
  twitter: { card: 'summary_large_image', title: person.name, description: intro.en, images: [ogImage] },
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
