import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { fontVars } from '../fonts';
import { headline, intro, person } from '@/content/profile';
import { isLocale, locales } from '@/content/types';
import { ogImage } from '@/lib/seo';

export const dynamicParams = false;
export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    metadataBase: new URL(person.site),
    title: { default: `${person.name} · ${headline[locale]}`, template: `%s · ${person.name}` },
    description: intro[locale],
    // No `alternates` here: canonical and hreflang are per page, set in each page's own generateMetadata.
    // Setting them on the layout made every page below claim the home page as its real version.
    icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], apple: '/apple-icon.png' },
    openGraph: {
      title: person.name,
      description: intro[locale],
      locale: locale === 'nl' ? 'nl_BE' : 'en_GB',
      type: 'profile',
      images: [ogImage],
    },
    twitter: { card: 'summary_large_image', title: person.name, description: intro[locale], images: [ogImage] },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} className={fontVars}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
