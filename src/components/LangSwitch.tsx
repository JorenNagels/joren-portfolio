import Link from 'next/link';
import { locales, type Locale } from '@/content/types';

/** NL / EN toggle that keeps you on the same page. `path` is relative to the locale root, e.g. '' or 'cv/'. */
export function LangSwitch({ locale, path = '' }: { locale: Locale; path?: string }) {
  return (
    <span className="text-sm uppercase">
      {locales.map((l, i) => (
        <span key={l}>
          {i > 0 && <span className="px-1 text-line">/</span>}
          <Link
            href={`/${l}/${path}`}
            hrefLang={l}
            aria-current={l === locale ? 'true' : undefined}
            className={l === locale ? 'font-semibold' : 'text-muted hover:text-ink'}
          >
            {l}
          </Link>
        </span>
      ))}
    </span>
  );
}
