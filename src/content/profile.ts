import type { L, Role } from './types';

export const person = {
  name: 'Joren Nagels',
  email: 'njoren@gmail.com',
  github: 'https://github.com/JorenNagels',
  linkedin: undefined as string | undefined, // TODO: add your LinkedIn URL
  site: 'https://jorennagels.be', // TODO: confirm the domain
  photo: '/joren.jpg', // stand-in from the 2023 CV: replace public/joren.jpg with a new square photo
  location: { nl: 'Gent', en: 'Ghent' } satisfies L,
  // Phone and date of birth are deliberately NOT here: this file is published.
  // The PDF export injects the phone number into the PDF only; it is never on the site.
};

export const headline: L = { nl: 'Developer', en: 'Developer' };

/** Meta description and the line under the name on the CV. */
export const intro: L = {
  nl: 'Developer in Gent. Vijf jaar aan Realo gewerkt, nu bij Immoweb. Bouwt ’s avonds eigen dingen.',
  en: 'Developer in Ghent. Five years on Realo, now at Immoweb. Builds his own things in the evenings.',
};

export const summary: L = {
  nl: 'Developer uit Gent. Sinds november 2021 werk ik aan Realo, een Belgisch vastgoedplatform dat in 2026 bij Immoweb kwam. Ik begon op de sales-backoffice en trok uiteindelijk de herbouw van de site in Next.js, die in november 2026 als bèta live ging. Ik ben het meest thuis in TypeScript, React en PHP, en regel de AWS-kant zelf. In mijn vrije tijd bouw ik websites voor kleine zaken en software voor weddingplanners.',
  en: 'Developer from Ghent. Since November 2021 I’ve worked on Realo, a Belgian property platform that became part of Immoweb in 2026. I started on the sales back office and ended up leading the rewrite of the site in Next.js, which went live as a beta in November 2026. I’m most at home in TypeScript, React and PHP, and I handle the AWS side myself. In my own time I build websites for small businesses and software for wedding planners.',
};

export const experience: Role[] = [
  {
    company: 'Immoweb',
    companyNote: { nl: 'AVIV Group', en: 'AVIV Group' },
    url: 'https://www.immoweb.be',
    title: { nl: 'Software Engineer, tech lead van de Realo-herbouw', en: 'Software Engineer, tech lead on the Realo rewrite' },
    start: '2026-04',
    highlights: [
      {
        nl: 'Schreef het plan om de ~83 schermen van Realo pagina per pagina van PHP naar Next.js te verhuizen, achter nginx. Het team koos in juni 2026 voor die aanpak.',
        en: 'Wrote the plan for moving Realo’s ~83 screens from PHP to Next.js one page at a time, behind nginx. The team went with it in June 2026.',
      },
      {
        nl: 'Bouwde een proof of concept waarin Node de PHP-sessies (igbinary in Redis) en de bestaande MySQL leest. Zette de nieuwe codebase op en ben er de grootste bijdrager aan.',
        en: 'Built a proof of concept in which Node reads PHP’s sessions (igbinary in Redis) and the existing MySQL. Set up the new codebase and am its biggest contributor.',
      },
      {
        nl: 'Verhuisde de login naar Node terwijl de PHP-site gewoon bleef draaien, inclusief 2FA en passkeys. 142 tests, waarvan een deel de uitkomst vergelijkt met die van PHP.',
        en: 'Moved login to Node while the PHP site kept running, including 2FA and passkeys. 142 tests, some of which compare the result with PHP’s.',
      },
      {
        nl: 'Bouwde de zoek- en kaartpagina’s op OpenSearch en deck.gl. Zette de bèta op 3 november 2026 live op een eigen ECS-service, uitgerold via CircleCI en Terraform.',
        en: 'Built the search and map pages on OpenSearch and deck.gl. Put the beta live on 3 November 2026 on its own ECS service, deployed with CircleCI and Terraform.',
      },
      {
        nl: 'Zette Claude Code op voor het team. Mijn multi-agent PR-review wordt nu gedeeld binnen heel AVIV.',
        en: 'Set up Claude Code for the team. My multi-agent PR review is now shared across AVIV.',
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
        nl: 'Werkte aan Vlabel, de waarderingstool die Realo bouwt voor de Vlaamse Belastingdienst. Ik maakte de transactiezoeker, de vergelijkingspunten en het officiële waarderingsrapport.',
        en: 'Worked on Vlabel, the valuation tool Realo builds for the Flemish Tax Administration. I made the transaction search, the comparison points and the official valuation report.',
      },
      {
        nl: 'Maakte waarderingsrapporten voor vastgoedkantoren, waaronder het franchiserapport van ERA en een white-label versie voor Logic-Immo. Verhuisde de PDF-rendering naar Gotenberg.',
        en: 'Made valuation reports for estate agencies, including ERA’s franchise report and a white-label version for Logic-Immo. Moved PDF rendering to Gotenberg.',
      },
      {
        nl: 'Bouwde bewaarde zoekopdrachten voor kantoren: nieuwe panden worden gematcht met een Elasticsearch-percolator en als lead in hun CRM gezet.',
        en: 'Built saved searches for agencies. New listings are matched with an Elasticsearch percolator and land in the agency’s CRM as leads.',
      },
      {
        nl: 'Stak in 2024 de hele stack in Docker en verhuisde hem naar AWS ECS. Daarna de gedeelde devomgeving en de upgrade van PHP 7.4 naar 8.4.',
        en: 'Put the whole stack in Docker and moved it to AWS ECS in 2024. After that, the shared dev environment and the PHP 7.4 to 8.4 upgrade.',
      },
      {
        nl: 'Merkte dat scrapers de site overspoelden en blokkeerde ze met AWS WAF, zo’n 810.000 requests per dag. Googlebot crawlde daarna ~700k pagina’s per dag in plaats van ~300k.',
        en: 'Noticed scrapers swamping the site and blocked them with AWS WAF, about 810,000 requests a day. Afterwards Googlebot crawled ~700k pages a day instead of ~300k.',
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
  {
    company: 'Horeca',
    title: { nl: 'Jobstudent', en: 'Student jobs' },
    start: '2014-07',
    end: '2021-08',
    highlights: [
      {
        nl: 'Bediening in restaurants, van mijn vijftiende tot ik bij Realo begon.',
        en: 'Waiting tables in restaurants, from the age of fifteen until I started at Realo.',
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
    note: { nl: 'niet afgerond', en: 'not completed' },
  },
  {
    school: 'UGent',
    program: { nl: 'Industrieel Ingenieur', en: 'Industrial Engineering' },
    start: '2017',
    end: '2018',
    note: { nl: 'niet afgerond', en: 'not completed' },
  },
];

export const skills: { group: L; items: string }[] = [
  { group: { nl: 'Talen', en: 'Languages' }, items: 'TypeScript, PHP, SQL, Python, Bash' },
  { group: { nl: 'Frontend', en: 'Frontend' }, items: 'React, Next.js, Tailwind, TanStack, deck.gl, MapLibre' },
  { group: { nl: 'Backend', en: 'Backend' }, items: 'Node.js, MySQL, Postgres, Redis, OpenSearch, DynamoDB' },
  { group: { nl: 'Infra', en: 'Infra' }, items: 'AWS (ECS, Lambda, S3, CloudFront, SES, WAF), Terraform, CDK, SST, Docker, nginx, CircleCI, GitHub Actions' },
  { group: { nl: 'Verder', en: 'Also' }, items: 'Vitest, Playwright, Sentry, passkeys, Claude Code' },
];

export const languages: { name: L; level: L }[] = [
  { name: { nl: 'Nederlands', en: 'Dutch' }, level: { nl: 'moedertaal', en: 'native' } },
  { name: { nl: 'Engels', en: 'English' }, level: { nl: 'vloeiend', en: 'fluent' } },
  { name: { nl: 'Frans', en: 'French' }, level: { nl: 'werkkennis', en: 'working knowledge' } },
];

export const learning: L[] = [
  { nl: 'React Summit, Amsterdam (2026)', en: 'React Summit, Amsterdam (2026)' },
  { nl: 'Gaf intern talks over de Next.js-herbouw en de Docker-devomgeving', en: 'Gave internal talks on the Next.js rewrite and the Docker dev environment' },
];

export const interests: L[] = [
  { nl: 'Volleybal, nationale reeksen', en: 'Volleyball, national league' },
  { nl: 'Leiding bij de scouts', en: 'Scout leader' },
  { nl: 'Bordspellen ontwerpen', en: 'Designing board games' },
];
