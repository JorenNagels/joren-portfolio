export const locales = ['nl', 'en'] as const;
export type Locale = (typeof locales)[number];

/** A string in both languages. Every user-facing text lives in one of these, so NL and EN can't drift apart. */
export type L = Record<Locale, string>;

export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

export type Role = {
  company: string;
  companyNote?: L;
  url?: string;
  title: L;
  start: string; // YYYY-MM
  end?: string; // YYYY-MM, undefined = present
  highlights: L[];
};

export type Project = {
  slug: string;
  name: string;
  year: string;
  kind: L;
  /** One line: what it is. */
  tagline: L;
  /** A short paragraph in my own voice. */
  story: L;
  /** The technically interesting bit. */
  detail?: L;
  stack: string[];
  links: { label: L; href: string }[];
  image?: string;
  /** Include in the projects block of the CV, with this one-liner. */
  cv?: L;
};
