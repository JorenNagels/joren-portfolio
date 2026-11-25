import type { MetadataRoute } from 'next';
import { locales } from '@/content/types';
import { siteUrl } from '@/lib/seo';
// `output: export` builds this once at build time rather than serving it per request.
export const dynamic = 'force-static';


/**
 * The list of pages worth indexing, with every page's language versions attached.
 *
 * Only the home page is in here. /nl/cv/, /nl/walk/ and /nl/model/ (and their /en/ twins) are deliberately
 * absent and say noindex themselves: the CV is for the people who get the link, the other two are dev
 * previews. `lastModified` is the build time, which for a static export is when the content changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Each page lists all its language versions, itself included, as Google asks.
  const cluster = (sub: string) => Object.fromEntries(locales.map((l) => [l, siteUrl(`/${l}/${sub}`)]));
  // '/' picks a language from the browser, so it is the version for a visitor we have no language for.
  const home = { ...cluster(''), 'x-default': siteUrl('/') };

  return [
    { url: siteUrl('/'), lastModified, changeFrequency: 'monthly', priority: 1, alternates: { languages: home } },
    ...locales.map((l): MetadataRoute.Sitemap[number] => ({
      url: siteUrl(`/${l}/`),
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: home },
    })),
  ];
}
