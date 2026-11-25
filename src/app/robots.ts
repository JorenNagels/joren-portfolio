import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
// `output: export` builds this once at build time rather than serving it per request.
export const dynamic = 'force-static';


/**
 * Everything is crawlable on purpose. /cv/, /walk/ and /model/ are kept out of the index by a noindex meta tag,
 * not from here: a Disallow would stop Google fetching the page at all, so it would never read the noindex
 * (and could still index the bare URL from a link), and it would break link previews at the same time.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: siteUrl('/sitemap.xml'),
  };
}
