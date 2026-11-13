import type { L, Locale } from './types';

export const ui = {
  nav: {
    work: { nl: 'Werk', en: 'Work' },
    projects: { nl: 'Projecten', en: 'Projects' },
    cv: { nl: 'CV', en: 'CV' },
    music: { nl: 'Muziek', en: 'Music' },
    musicOn: { nl: 'Muziek aanzetten', en: 'Turn the music on' },
    musicOff: { nl: 'Muziek uitzetten', en: 'Turn the music off' },
  },
  hero: {
    role: { nl: 'Developer in Gent', en: 'Developer in Ghent' },
    scroll: { nl: 'Scroll', en: 'Scroll' },
    one: {
      nl: 'Ik bouw websites en webapps. Vijf jaar aan Realo, het vastgoedplatform. Nu bij Immoweb.',
      en: 'I build websites and web apps. Five years on Realo, the property site. Now at Immoweb.',
    },
    oneNote: { nl: 'Hallo, ik ben Joren', en: 'Hi, I’m Joren' },
    two: {
      nl: 'Dit is Gent, waar ik woon. Elk gebouw komt uit OpenStreetMap en wordt in je browser opgetrokken.',
      en: 'This is Ghent, where I live. Every building comes from OpenStreetMap and is put up in your browser.',
    },
    twoNote: { nl: 'Three.js, eigen shaders', en: 'Three.js, custom shaders' },
    three: {
      nl: 'Sint-Niklaas, het Belfort en Sint-Baafs. De drie torens.',
      en: 'St Nicholas, the Belfry and St Bavo’s. The three towers.',
    },
    threeNote: { nl: 'Gent bij nacht', en: 'Ghent at night' },
    credit: { nl: 'Kaartdata © OpenStreetMap-bijdragers', en: 'Map data © OpenStreetMap contributors' },
  },
  work: {
    title: { nl: 'Werk', en: 'Work' },
    more: { nl: 'Alles staat in mijn cv', en: 'The full list is in my CV' },
    before: { nl: 'Daarvoor', en: 'Before that' },
  },
  projects: {
    title: { nl: 'Eigen projecten', en: 'Own projects' },
    text: {
      nl: 'Dingen die ik naast mijn job bouw. De meeste staan echt online en worden gebruikt.',
      en: 'Things I build next to my job. Most of them are online and in use.',
    },
    detail: { nl: 'Het interessante stuk', en: 'The interesting bit' },
    small: { nl: 'Kleiner werk', en: 'Smaller things' },
  },
  contact: {
    title: { nl: 'Mail me gerust', en: 'Feel free to email me' },
    cv: { nl: 'Of lees mijn cv', en: 'Or read my CV' },
    clock: { nl: 'In Gent is het nu', en: 'In Ghent it’s' },
  },
  cv: {
    profile: { nl: 'Profiel', en: 'Profile' },
    experience: { nl: 'Ervaring', en: 'Experience' },
    projects: { nl: 'Eigen projecten', en: 'Own projects' },
    skills: { nl: 'Skills', en: 'Skills' },
    education: { nl: 'Opleiding', en: 'Education' },
    languages: { nl: 'Talen', en: 'Languages' },
    learning: { nl: 'Conferenties en talks', en: 'Conferences and talks' },
    interests: { nl: 'Buiten het werk', en: 'Outside work' },
    print: { nl: 'Afdrukken of PDF', en: 'Print or save as PDF' },
    back: { nl: '← Terug', en: '← Back' },
    present: { nl: 'nu', en: 'now' },
  },
} satisfies Record<string, Record<string, L>>;

const months: Record<Locale, string[]> = {
  nl: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function formatMonth(ym: string, locale: Locale): string {
  const [y, m] = ym.split('-');
  return m ? `${months[locale][Number(m) - 1]} ${y}` : y;
}

export function formatDay(ymd: string, locale: Locale): string {
  const [y, m, d] = ymd.split('-');
  return `${Number(d)} ${months[locale][Number(m) - 1]} ${y}`;
}

export function period(start: string, end: string | undefined, locale: Locale): string {
  return `${formatMonth(start, locale)} – ${end ? formatMonth(end, locale) : ui.cv.present[locale]}`;
}
