import type { Project } from './types';

const site = { nl: 'Bekijk de site', en: 'Visit the site' };
const code = { nl: 'Code op GitHub', en: 'Code on GitHub' };

export const projects: Project[] = [
  {
    slug: 'guestnote',
    name: 'Guestnote',
    year: '2026',
    kind: { nl: 'Eigen product, in opbouw', en: 'My own product, in progress' },
    tagline: {
      nl: 'Planningssoftware voor weddingplanners en trouwlocaties.',
      en: 'Planning software for wedding planners and venues.',
    },
    story: {
      nl: 'Een weddingplanner runt elke bruiloft vanuit een Excel en een WhatsApp-groep. Guestnote zet al die bruiloften op één plek: taken die terugrekenen vanaf de trouwdatum, een draaiboek voor de dag, het budget en de betalingen, en de leveranciers. Elke leverancier krijgt een link naar zijn deel van de dag, en het koppel een eigen portaal waarin de planner kiest wat ze zien. Daarna volgt per koppel een trouwwebsite met RSVP voor de gasten. Ik doe het alleen: de naam (na zo’n 600 gecheckte domeinen), het ontwerp, de code en de AWS-setup.',
      en: 'Wedding planners run each wedding from a spreadsheet and a WhatsApp group. Guestnote puts all their weddings in one place: tasks that count back from the wedding date, a run sheet for the day, the budget and payments, and the vendors. Each vendor gets a link to their part of the day, and the couple gets a portal where the planner chooses what they see. Next comes a wedding website with RSVP for each couple’s guests. I’m doing it alone: the name (after checking about 600 domains), the design, the code and the AWS setup.',
    },
    detail: {
      nl: 'De data van elke studio moet gescheiden blijven, en een koppel of leverancier ziet enkel wat de planner deelt. Dat dwingt Postgres zelf af met row-level security, en de tests draaien tegen de echte database.',
      en: 'Each studio’s data has to stay separate, and a couple or vendor sees only what the planner shares. Postgres enforces that itself with row-level security, and the tests run against the real database.',
    },
    stack: ['Next.js', 'Postgres', 'Drizzle', 'Better Auth', 'SST', 'AWS'],
    links: [
      { label: site, href: 'https://guestnote.be' }, // the screenshot is of staging, which is ahead of guestnote.be
      { label: code, href: 'https://github.com/JorenNagels/guestnote' },
    ],
    image: '/projects/guestnote.jpg',
    poster: '/projects/guestnote-poster.jpg',
    cv: {
      nl: 'Planningssoftware voor weddingplanners: taken, draaiboek, budget en leveranciers van al hun bruiloften op één plek, met een portaal voor het koppel. Data per studio gescheiden met Postgres row-level security.',
      en: 'Planning software for wedding planners: tasks, run sheet, budget and vendors for all their weddings in one place, with a portal for the couple. Each studio’s data kept apart with Postgres row-level security.',
    },
  },
  {
    slug: 'beatcut',
    name: 'beatcut',
    year: '2026',
    kind: { nl: 'Open source', en: 'Open source' },
    tagline: {
      nl: 'Maakt een film van je reisbeelden, geknipt op de muziek.',
      en: 'Turns your trip footage into a film cut to the music.',
    },
    story: {
      nl: 'Na een skireis had ik uren beelden van GoPro’s en gsm’s. beatcut is een Claude Code-skill die het saaie werk doet: dubbele clips eruit, de grappige momenten zoeken, knippen op de beat en de film renderen. Daarna kijk je de preview en zeg je dingen als “0:58 is saai”.',
      en: 'After a ski trip I had hours of footage from GoPros and phones. beatcut is a Claude Code skill that does the boring part: drop the duplicate clips, find the funny moments, cut on the beat and render the film. Then you watch the preview and say things like “0:58 is boring”.',
    },
    detail: {
      nl: 'Alles draait lokaal met Python, ffmpeg en OpenCV. Whisper-ondertitels en het herkennen van gelach zijn optioneel.',
      en: 'Everything runs locally with Python, ffmpeg and OpenCV. Whisper subtitles and laughter detection are optional.',
    },
    stack: ['Python', 'ffmpeg', 'OpenCV', 'Whisper', 'Remotion'],
    links: [{ label: code, href: 'https://github.com/JorenNagels/beatcut' }],
    cv: {
      nl: 'Claude Code-skill die reisbeelden ontdubbelt, de beste momenten zoekt en ze op de beat tot een film knipt. Lokaal, met Python en ffmpeg.',
      en: 'Claude Code skill that de-duplicates trip footage, finds the best moments and cuts them into a film on the beat. Runs locally with Python and ffmpeg.',
    },
  },
  {
    slug: 'se-parti',
    name: 'S’e parti',
    year: '2025–2026',
    kind: { nl: 'Website en RSVP-app', en: 'Website and RSVP app' },
    tagline: {
      nl: 'Voor een Belgisch wedding- en eventbureau.',
      en: 'For a Belgian wedding and event planner.',
    },
    story: {
      nl: 'De website van S’e parti, en de RSVP-app die hun koppels gebruiken. Gasten zoeken zichzelf op naam en antwoorden voor hun hele groep. Het koppel beheert de gastenlijst zelf.',
      en: 'The S’e parti website, and the RSVP app their couples use. Guests look themselves up by name and reply for their whole group. The couple manages the guest list themselves.',
    },
    detail: {
      nl: 'Elke bruiloft krijgt een eigen AWS-stack met een eigen database, uitgerold uit dezelfde code. De gastenlijst van het ene koppel kan dus nooit bij het andere terechtkomen.',
      en: 'Every wedding gets its own AWS stack with its own database, deployed from the same code. One couple’s guest list can never end up with another.',
    },
    stack: ['Next.js', 'React', 'DynamoDB', 'Lambda', 'CDK', 'Clerk'],
    links: [{ label: site, href: 'https://se-parti.be' }],
    image: '/projects/se-parti.jpg',
    poster: '/projects/se-parti-poster.jpg',
    cv: {
      nl: 'Website en RSVP-app voor een wedding- en eventbureau. Elke bruiloft krijgt een eigen AWS-stack, uitgerold uit dezelfde CDK-code.',
      en: 'Website and RSVP app for a wedding and event planner. Every wedding gets its own AWS stack, deployed from the same CDK code.',
    },
  },
  {
    slug: 'flowsha',
    name: 'Flowsha',
    year: '2026',
    kind: { nl: 'Website, VK', en: 'Website, UK' },
    tagline: {
      nl: 'Voor een hoepelschool in het VK.',
      en: 'For a hula-hoop teacher in the UK.',
    },
    story: {
      nl: 'Een snelle site met lessen, optredens en een boekingsformulier dat via AWS SES mailt. Hosting kost zo goed als niets: S3, CloudFront en één Lambda, allemaal in CDK.',
      en: 'A fast site with classes, performances and a booking form that sends email through AWS SES. Hosting costs next to nothing: S3, CloudFront and one Lambda, all in CDK.',
    },
    stack: ['Next.js', 'CDK', 'Lambda', 'SES'],
    links: [
      { label: site, href: 'https://flowsha.co.uk' },
      { label: code, href: 'https://github.com/JorenNagels/flowsha' },
    ],
    image: '/projects/flowsha.jpg',
    poster: '/projects/flowsha-poster.jpg',
    cv: {
      nl: 'Website met boekingsformulier voor een hoepelschool in het VK. S3, CloudFront en Lambda in CDK.',
      en: 'Website with a booking form for a hula-hoop teacher in the UK. S3, CloudFront and Lambda in CDK.',
    },
  },
  {
    slug: 'elliot',
    name: 'Elliot Barham',
    year: '2026',
    kind: { nl: 'Portfoliosite, VK', en: 'Portfolio site, UK' },
    tagline: {
      nl: 'Voor een Britse presentator en eventhost.',
      en: 'For a UK event host and presenter.',
    },
    story: {
      nl: 'Een portfoliosite van één pagina voor Elliot Barham, presentator bij Dream Team Productions: zijn diensten, de merken waarvoor hij werkte, clips, foto’s en reviews. Het begon als een HTML-bestand van 3 MB dat met AI gemaakt was. Ik bouwde het opnieuw als statische Next.js-site, met dezelfde look.',
      en: 'A one-page portfolio for Elliot Barham, a presenter at Dream Team Productions: what he does, the brands he has worked for, clips, photos and reviews. It started as a 3 MB HTML file made with AI. I rebuilt it as a static Next.js site with the same look.',
    },
    detail: {
      nl: 'Elliot stuurt de link zelf naar klanten, dus de site houdt zoekmachines en AI-crawlers bewust buiten. De foto’s worden bij de build naar WebP omgezet, en hij draait gratis op GitHub Pages.',
      en: 'Elliot sends the link to clients himself, so the site keeps search engines and AI crawlers out on purpose. The photos are converted to WebP at build time, and it runs for free on GitHub Pages.',
    },
    stack: ['Next.js', 'Tailwind', 'GitHub Pages'],
    links: [{ label: site, href: 'https://elliot.dreamteamproductions.co.uk' }],
    image: '/projects/elliot.jpg',
    poster: '/projects/elliot-poster.jpg',
    cv: {
      nl: 'Portfoliosite voor een Britse presentator. Een AI-gegenereerd HTML-bestand van 3 MB herbouwd als statische Next.js-site op GitHub Pages.',
      en: 'Portfolio site for a UK presenter. A 3 MB AI-generated HTML file rebuilt as a static Next.js site on GitHub Pages.',
    },
  },
];

/** Smaller builds and experiments: one line each on the website, not on the CV. */
export const experiments: { name: string; year: string; text: { nl: string; en: string } }[] = [
  {
    name: 'Estate Guessr',
    year: '2025',
    text: { nl: 'Raad de prijs van Belgische huizen. Een mobiele game in Expo.', en: 'Guess the price of Belgian houses. A mobile game in Expo.' },
  },
  {
    name: 'Highsail',
    year: '2025',
    text: { nl: 'Een CRM waarin je zelf je objecten en velden definieert. Prototype.', en: 'A CRM where you define your own objects and fields. Prototype.' },
  },
  {
    name: 'Clapper',
    year: '2025',
    text: { nl: 'Filmreviews delen met vrienden. Een PWA op Supabase.', en: 'Share film reviews with friends. A PWA on Supabase.' },
  },
  {
    name: 'Le Massif Realo',
    year: '2026',
    text: { nl: 'Een bordspel voor de skireis van het werk, met darts en dobbelstenen. Op papier, geen code.', en: 'A board game for the work ski trip, with darts and dice. On paper, no code.' },
  },
];
