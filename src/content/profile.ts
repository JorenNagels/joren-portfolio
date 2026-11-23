import type { L, Role } from './types';

export const person = {
  name: 'Joren Nagels',
  email: 'njoren@gmail.com',
  github: 'https://github.com/JorenNagels',
  linkedin: 'https://www.linkedin.com/in/joren-nagels-4223261ba/' as string | undefined,
  site: 'https://joren.nagels.dev',
  photo: '/joren.jpg', // square crop from a wedding photo, July 2025
  location: { nl: 'Gent', en: 'Ghent' } satisfies L,
  // Phone and date of birth are deliberately NOT here: this file is published.
  // The PDF export injects the phone number into the PDF only; it is never on the site.
};

export const headline: L = { nl: 'Software Engineer', en: 'Software Engineer' };

/** Meta description and the line under the name on the CV. */
export const intro: L = {
  nl: 'Software engineer in Gent. Werkt sinds 2021 aan Realo, nu deel van Immoweb.',
  en: 'Software engineer in Ghent. Working on Realo since 2021, now part of Immoweb.',
};

export const summary: L = {
  nl: 'Software engineer uit Gent. Sinds 2021 werk ik aan Realo, een Belgisch vastgoedplatform. Ik werk vooral in TypeScript, React en PHP, en heb wat ervaring met AWS. Naast mijn job bouw ik websites en apps voor kleine zaken.',
  en: 'Software engineer from Ghent. I’ve worked on Realo, a Belgian property platform, since 2021. I work mostly in TypeScript, React and PHP, and have some experience with AWS. Outside work I build websites and apps for small businesses.',
};

/**
 * The bullets of the Realo/Immoweb job, named one by one: the street panels show them all, the CV
 * picks the ones that earn their room on paper. Named, so neither list repeats a Dutch or English line.
 */
const bullet = {
  rewrite: {
    nl: 'Leidde de herbouw van Realo van PHP naar Next.js, pagina per pagina naast de live site. Zette de nieuwe codebase agent-first op: van bij de start gebouwd met Claude Code, met docs en skills voor AI-agents.',
    en: 'Led the rewrite of Realo from PHP to Next.js, page by page alongside the live site. Set up the new codebase agent-first: built with Claude Code from the start, with docs and skills for AI agents.',
  },
  login: {
    nl: 'Verhuisde de login naar de nieuwe stack, met 2FA en passkeys, terwijl de PHP-site gewoon bleef draaien.',
    en: 'Moved login to the new stack, including 2FA and passkeys, while the PHP site kept running.',
  },
  claudeCode: {
    nl: 'Een van de eersten in het bedrijf die Claude Code dagelijks gebruikte en nieuwe features uitprobeerde. Bracht het in het team, schreef gedeelde skills en hielp collega’s op weg.',
    en: 'One of the first in the company to use Claude Code daily and try out new features. Brought it into the team, wrote shared skills and helped colleagues get started.',
  },
  backOffice: {
    nl: 'Bouwde de sales-backoffice: offertes, abonnementen en facturatie voor vastgoedkantoren.',
    en: 'Built the sales back office: quotes, subscriptions and invoicing for estate agencies.',
  },
  mentoring: {
    nl: 'Begeleidde samen met de tech lead de developers die na mij begonnen. Voerde pull requests en code reviews in.',
    en: 'Onboarded and mentored the developers who joined after me, together with the tech lead. Introduced pull requests and code review.',
  },
  vlabel: {
    nl: 'Werkte aan Vlabel, de waarderingstool voor de Vlaamse Belastingdienst: transactiezoeker, vergelijkingspunten en het officiële waarderingsrapport.',
    en: 'Worked on Vlabel, the valuation tool for the Flemish Tax Administration: transaction search, comparison points and the official valuation report.',
  },
  reports: {
    nl: 'Bouwde waarderingsrapporten voor vastgoedkantoren, ook als white-label versie.',
    en: 'Built valuation reports for estate agencies, including white-label versions.',
  },
  savedSearches: {
    nl: 'Bouwde bewaarde zoekopdrachten voor kantoren: nieuwe panden die matchen komen als lead in hun CRM.',
    en: 'Built saved searches for agencies: matching new listings land in their CRM as leads.',
  },
  infra: {
    nl: 'Verhuisde de hele stack naar Docker op AWS ECS, met lagere AWS-kosten en snellere deploys als resultaat. Daarna de upgrade van PHP 7.4 naar 8.4.',
    en: 'Moved the whole stack to Docker on AWS ECS, which lowered AWS costs and sped up deploys. Then upgraded PHP from 7.4 to 8.4.',
  },
} satisfies Record<string, L>;

const immoweb: Role = {
  company: 'Immoweb',
  companyNote: { nl: 'AVIV Group', en: 'AVIV Group' },
  url: 'https://www.immoweb.be',
  title: { nl: 'Software Engineer', en: 'Software Engineer' },
  start: '2026-04',
  highlights: [bullet.rewrite, bullet.login, bullet.claudeCode],
};

const realo: Role = {
  company: 'Realo',
  companyNote: { nl: 'in april 2026 overgenomen door Immoweb', en: 'acquired by Immoweb in April 2026' },
  url: 'https://www.realo.be',
  title: { nl: 'Software Engineer', en: 'Software Engineer' },
  start: '2021-11',
  end: '2026-04',
  highlights: [bullet.backOffice, bullet.mentoring, bullet.vlabel, bullet.reports, bullet.savedSearches, bullet.infra],
};

const rocketCore: Role = {
  company: 'Rocket Core',
  companyNote: { nl: 'esports-toernooien', en: 'esports tournaments' },
  title: { nl: 'Medeoprichter', en: 'Co-founder' },
  start: '2019-09',
  end: '2022-08',
  highlights: [
    {
      nl: 'Organiseerde esports-toernooien met vrienden. Ik deed het contact met spelers en sponsors, en bouwde de website.',
      en: 'Ran esports tournaments with friends. I dealt with players and sponsors, and built the website.',
    },
  ],
};

/** One entry per employer: the street has a facade, a poster and a panel for each. */
export const experience: Role[] = [immoweb, realo, rocketCore];

/**
 * The CV puts Realo and Immoweb in one block: it is one unbroken job, before and after Immoweb
 * acquired Realo in April 2026, and two entries read like a job change that never happened.
 */
export const cvExperience: Role[] = [
  {
    ...realo,
    companyNote: { nl: 'overgenomen door Immoweb, AVIV Group', en: 'acquired by Immoweb, AVIV Group' },
    end: undefined,
    highlights: [bullet.rewrite, bullet.claudeCode, bullet.mentoring, bullet.reports, bullet.savedSearches, bullet.infra],
  },
  rocketCore,
];

export const education: { school: string; program: L; start: string; end: string; note?: L }[] = [
  {
    school: 'HOGENT',
    program: { nl: 'Toegepaste Informatica', en: 'Applied Computer Science' },
    start: '2018',
    end: '2021',
    note: { nl: 'gestopt om zelf React te leren', en: 'left to teach myself React' },
  },
  {
    school: 'UGent',
    program: { nl: 'Industrieel Ingenieur', en: 'Industrial Engineering' },
    start: '2017',
    end: '2018',
    note: { nl: 'overgestapt naar HOGENT', en: 'switched to HOGENT' },
  },
];

export const skills: { group: L; items: string }[] = [
  { group: { nl: 'Talen', en: 'Languages' }, items: 'TypeScript, PHP, SQL' },
  { group: { nl: 'Frontend', en: 'Frontend' }, items: 'React, Next.js, Tailwind' },
  { group: { nl: 'Backend', en: 'Backend' }, items: 'Node.js, MySQL, Postgres, Redis, OpenSearch, DynamoDB' },
  { group: { nl: 'Infra', en: 'Infra' }, items: 'AWS (ECS, Lambda, S3, CloudFront, SES, WAF), Docker, nginx, GitHub Actions' },
];

export const languages: { name: L; level: L }[] = [
  { name: { nl: 'Nederlands', en: 'Dutch' }, level: { nl: 'moedertaal', en: 'native' } },
  { name: { nl: 'Engels', en: 'English' }, level: { nl: 'vloeiend', en: 'fluent' } },
];

/** One line under "Outside work" on the About poster. */
export const sport: L = {
  nl: 'Ik speel volleybal in eerste nationale.',
  en: 'I play volleyball in Belgium’s first national division.',
};

export const learning: L[] = [
  { nl: 'React Summit en JSNation, Amsterdam (2025, 2026)', en: 'React Summit and JSNation, Amsterdam (2025, 2026)' },
  { nl: 'Gaf intern talks over de Next.js-herbouw en de Docker-devomgeving', en: 'Gave internal talks on the Next.js rewrite and the Docker dev environment' },
];

export const interests: L[] = [
  { nl: 'Volleybal, eerste nationale', en: 'Volleyball, first national division' },
];
