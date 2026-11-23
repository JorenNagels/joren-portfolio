import type { Metadata } from 'next';
import { education, experience, headline, intro, person, skills } from '@/content/profile';
import { locales, type Locale } from '@/content/types';

/** Absolute URL for a path on the site. `metadataBase` covers the meta tags; JSON-LD has to spell them out. */
export const siteUrl = (path: string) => new URL(path, person.site).href;

/**
 * The hreflang cluster for one page. `sub` is the path under the locale: '' for the home page, 'cv/' for the CV.
 *
 * This belongs on the page, never on the layout: a canonical set on `[locale]/layout.tsx` is inherited by
 * everything under it, so /en/cv/ would tell Google "the real version of me is /en/" and drop itself.
 */
export const alternates = (locale: Locale, sub = '') => ({
  canonical: `/${locale}/${sub}`,
  languages: {
    ...Object.fromEntries(locales.map((l) => [l, `/${l}/${sub}`])),
    // '/' picks a language from the browser, so it is the version for a visitor we have no language for.
    // Only the home page has one: there is no language-neutral URL for the CV.
    ...(sub === '' && { 'x-default': '/' }),
  },
});

/**
 * The favicons, one set for both the home page and every page under a locale.
 *
 * The SVG is what browsers draw, but Google Search does not read one: its list is BMP, GIF, ICO, PNG,
 * JPEG, PPM and TIFF, so the same mark also ships as a PNG (square and over 48px, as Google asks) and
 * as a favicon.ico at the root for anything that still goes looking for one. Built by `npm run og`.
 */
export const icons: Metadata['icons'] = {
  icon: [
    { url: '/icon.svg', type: 'image/svg+xml' },
    { url: '/icon-96.png', type: 'image/png', sizes: '96x96' },
  ],
  shortcut: '/favicon.ico',
  apple: '/apple-icon.png',
};

/** The card LinkedIn, Slack and WhatsApp draw when the link is pasted. Built by `npm run og`. */
export const ogImage = {
  url: '/og.jpg',
  width: 1200,
  height: 630,
  alt: `${person.name} — ${headline.en}`,
};

/** Terms without the bracketed detail: 'AWS (ECS, Lambda), Docker' → ['AWS', 'Docker']. */
const terms = (items: string) =>
  items
    .replace(/\s*\([^)]*\)/g, '')
    .split(', ')
    .filter(Boolean);

/**
 * Person schema: the machine-readable version of "this site is about this person", so a search for the name
 * can tie the domain to the GitHub and LinkedIn profiles instead of guessing they are the same Joren.
 */
export function personSchema(l: Locale) {
  const current = experience.find((r) => !r.end);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    jobTitle: headline[l],
    description: intro[l],
    url: siteUrl(`/${l}/`),
    image: siteUrl(person.photo),
    email: `mailto:${person.email}`,
    address: { '@type': 'PostalAddress', addressLocality: person.location[l], addressCountry: 'BE' },
    ...(current && {
      worksFor: { '@type': 'Organization', name: current.company, ...(current.url && { url: current.url }) },
    }),
    alumniOf: education.map((e) => ({ '@type': 'EducationalOrganization', name: e.school })),
    knowsLanguage: [...locales],
    knowsAbout: skills.flatMap((s) => terms(s.items)),
    sameAs: [person.github, person.linkedin].filter((x): x is string => Boolean(x)),
  };
}
