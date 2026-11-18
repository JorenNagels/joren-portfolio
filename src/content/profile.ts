import type { L, Role } from './types';

export const person = {
  name: 'Joren Nagels',
  email: 'njoren@gmail.com',
  github: 'https://github.com/JorenNagels',
  linkedin: 'https://www.linkedin.com/in/joren-nagels-4223261ba/' as string | undefined,
  site: 'https://jorennagels.be', // TODO: confirm the domain
  photo: '/joren.jpg', // stand-in from the 2023 CV: replace public/joren.jpg with a new square photo
  location: { nl: 'Gent', en: 'Ghent' } satisfies L,
  // Phone and date of birth are deliberately NOT here: this file is published.
  // The PDF export injects the phone number into the PDF only; it is never on the site.
};

export const headline: L = { nl: 'Full-stack developer', en: 'Full-stack developer' };

/** Meta description and the line under the name on the CV. */
export const intro: L = {
  nl: 'Full-stack developer in Gent. Werkt sinds 2021 aan Realo, nu deel van Immoweb.',
  en: 'Full-stack developer in Ghent. Working on Realo since 2021, now part of Immoweb.',
};

export const summary: L = {
  nl: 'Full-stack developer uit Gent. Sinds 2021 werk ik aan Realo, een Belgisch vastgoedplatform. Ik werk vooral in TypeScript, React en PHP, en heb ook ervaring met AWS. Naast mijn job bouw ik websites en apps voor kleine zaken.',
  en: 'Full-stack developer from Ghent. I’ve worked on Realo, a Belgian property platform, since 2021. I work mostly in TypeScript, React and PHP, and have experience with AWS too. Outside work I build websites and apps for small businesses.',
};

export const experience: Role[] = [
  {
    company: 'Immoweb',
    companyNote: { nl: 'AVIV Group', en: 'AVIV Group' },
    url: 'https://www.immoweb.be',
    title: { nl: 'Full-stack developer', en: 'Full-stack developer' },
    start: '2026-04',
    highlights: [
      {
        nl: 'Leidde de herbouw van Realo van PHP naar Next.js, pagina per pagina naast de live site. De bèta ging in november 2026 online.',
        en: 'Led the rewrite of Realo from PHP to Next.js, page by page alongside the live site. The beta went live in November 2026.',
      },
      {
        nl: 'Verhuisde de login naar de nieuwe stack, met 2FA en passkeys, terwijl de PHP-site gewoon bleef draaien.',
        en: 'Moved login to the new stack, including 2FA and passkeys, while the PHP site kept running.',
      },
      {
        nl: 'Bouwde de zoek- en kaartpagina’s op OpenSearch en deck.gl.',
        en: 'Built the search and map pages on OpenSearch and deck.gl.',
      },
      {
        nl: 'Bracht Claude Code in het team. Mijn PR-review-setup wordt nu in heel AVIV gedeeld.',
        en: 'Introduced Claude Code to the team. My PR-review setup is now shared across AVIV.',
      },
    ],
  },
  {
    company: 'Realo',
    url: 'https://www.realo.be',
    title: { nl: 'Full-stack developer', en: 'Full-stack developer' },
    start: '2021-11',
    end: '2026-04',
    highlights: [
      {
        nl: 'Bouwde de sales-backoffice: offertes, abonnementen en facturatie voor vastgoedkantoren.',
        en: 'Built the sales back office: quotes, subscriptions and invoicing for estate agencies.',
      },
      {
        nl: 'Begeleidde samen met een collega en de tech lead de developers die na mij begonnen. Kreeg het team zover om met pull requests en code reviews te werken in plaats van rechtstreeks te committen.',
        en: 'Onboarded and mentored the developers who joined after me, together with a colleague and the tech lead. Got the team working with pull requests and code review instead of committing straight to main.',
      },
      {
        nl: 'Werkte aan Vlabel, de waarderingstool voor de Vlaamse Belastingdienst: transactiezoeker, vergelijkingspunten en het officiële waarderingsrapport.',
        en: 'Worked on Vlabel, the valuation tool for the Flemish Tax Administration: transaction search, comparison points and the official valuation report.',
      },
      {
        nl: 'Bouwde waarderingsrapporten voor vastgoedkantoren, onder meer voor ERA, en een white-label versie voor Logic-Immo.',
        en: 'Built valuation reports for estate agencies, including ERA’s, and a white-label version for Logic-Immo.',
      },
      {
        nl: 'Bouwde bewaarde zoekopdrachten voor kantoren: nieuwe panden die matchen komen als lead in hun CRM.',
        en: 'Built saved searches for agencies: matching new listings land in their CRM as leads.',
      },
      {
        nl: 'Verhuisde de hele stack naar Docker op AWS ECS, met lagere AWS-kosten en snellere deploys als resultaat. Daarna de upgrade van PHP 7.4 naar 8.4.',
        en: 'Moved the whole stack to Docker on AWS ECS, which lowered AWS costs and sped up deploys. Then upgraded PHP from 7.4 to 8.4.',
      },
      {
        nl: 'Blokkeerde met AWS WAF de scrapers die de site overspoelden.',
        en: 'Blocked the scrapers that were flooding the site, using AWS WAF.',
      },
    ],
  },
  {
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
  },
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
  { nl: 'Bordspellen ontwerpen', en: 'Designing board games' },
];
