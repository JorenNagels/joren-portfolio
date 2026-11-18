import type { Project } from './types';

const site = { nl: 'Bekijk de site', en: 'Visit the site' };
const code = { nl: 'Code op GitHub', en: 'Code on GitHub' };

export const projects: Project[] = [
  {
    slug: 'guestnote',
    name: 'Guestnote',
    year: '2026',
    kind: { nl: 'Eigen product, in ontwikkeling', en: 'My own product, in development' },
    tagline: {
      nl: 'Planningssoftware voor weddingplanners en trouwlocaties.',
      en: 'Planning software for wedding planners and venues.',
    },
    story: {
      nl: 'Een weddingplanner runt elke bruiloft vanuit een Excel en een WhatsApp-groep. Guestnote brengt ze samen op één plek: taken die terugrekenen vanaf de trouwdatum, een draaiboek voor de dag, budget, betalingen en leveranciers. Leveranciers krijgen een link naar hun deel van de dag, koppels een portaal met wat de planner met hen deelt. Ik bouw het alleen, van het ontwerp tot de AWS-setup.',
      en: 'Wedding planners run each wedding from a spreadsheet and a WhatsApp group. Guestnote brings them together in one place: tasks planned back from the wedding date, a run sheet for the day, budget, payments and vendors. Vendors get a link to their part of the day, and couples get a portal with whatever the planner shares. I’m building it on my own, from the design to the AWS setup.',
    },
    detail: {
      nl: 'Postgres houdt de data van elke studio zelf gescheiden, met row-level security. De tests draaien tegen een echte database.',
      en: 'Postgres itself keeps each studio’s data apart, with row-level security. The tests run against a real database.',
    },
    stack: ['Next.js', 'Postgres', 'Drizzle', 'Better Auth', 'SST', 'AWS'],
    links: [
      { label: site, href: 'https://guestnote.be' }, // the screenshot is of staging, which is ahead of guestnote.be
      { label: code, href: 'https://github.com/JorenNagels/guestnote' },
    ],
    image: '/projects/guestnote.jpg',
    poster: '/projects/guestnote-poster.jpg',
    cv: {
      nl: 'Planningssoftware voor weddingplanners: taken, draaiboek, budget en leveranciers van al hun bruiloften op één plek, met een portaal voor het koppel. In ontwikkeling.',
      en: 'Planning software for wedding planners: tasks, run sheet, budget and vendors for all their weddings in one place, with a portal for the couple. In development.',
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
      nl: 'Na een skireis had ik uren beelden van GoPro’s en gsm’s. beatcut is een Claude Code-skill die het saaie werk doet: dubbele clips eruit, de grappige momenten zoeken, knippen op de beat en de film renderen. Daarna geef je feedback zoals “0:58 is saai”.',
      en: 'After a ski trip I had hours of footage from GoPros and phones. beatcut is a Claude Code skill that does the boring part: drop the duplicate clips, find the funny moments, cut on the beat and render the film. Then you give notes like “0:58 is boring”.',
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
      nl: 'De website van S’e parti, en de RSVP-app die hun koppels gebruiken. Gasten zoeken zichzelf op naam en antwoorden voor hun hele groep, het koppel beheert de gastenlijst. Al gebruikt voor drie bruiloften.',
      en: 'The S’e parti website, and the RSVP app their couples use. Guests look themselves up by name and reply for their whole group, and the couple manages the guest list. Used for three weddings so far.',
    },
    detail: {
      nl: 'Elke bruiloft krijgt een eigen AWS-stack en database, uitgerold uit dezelfde code.',
      en: 'Each wedding gets its own AWS stack and database, deployed from the same code.',
    },
    stack: ['Next.js', 'React', 'DynamoDB', 'Lambda', 'CDK', 'Clerk'],
    links: [{ label: site, href: 'https://se-parti.be' }],
    image: '/projects/se-parti.jpg',
    poster: '/projects/se-parti-poster.jpg',
    cv: {
      nl: 'Website en RSVP-app voor een wedding- en eventbureau, al gebruikt voor drie bruiloften. Elke bruiloft draait op een eigen AWS-stack, uitgerold uit dezelfde CDK-code.',
      en: 'Website and RSVP app for a wedding and event planner, used for three weddings so far. Each wedding runs on its own AWS stack, deployed from the same CDK code.',
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
      nl: 'Een snelle site met lessen, optredens en een boekingsformulier dat via AWS SES mailt. Draait op S3, CloudFront en één Lambda, opgezet in CDK.',
      en: 'A fast site with classes, performances and a booking form that sends email through AWS SES. Runs on S3, CloudFront and one Lambda, set up in CDK.',
    },
    stack: ['Next.js', 'CDK', 'Lambda', 'SES'],
    links: [
      { label: site, href: 'https://flowsha.co.uk' },
      { label: code, href: 'https://github.com/JorenNagels/flowsha' },
    ],
    image: '/projects/flowsha.jpg',
    poster: '/projects/flowsha-poster.jpg',
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
      nl: 'Een portfoliosite van één pagina voor Elliot Barham, presentator bij Dream Team Productions: zijn diensten, de merken waarvoor hij werkte, clips, foto’s en reviews. Gebouwd als statische Next.js-site.',
      en: 'A one-page portfolio for Elliot Barham, a presenter at Dream Team Productions: what he does, the brands he has worked for, clips, photos and reviews. Built as a static Next.js site.',
    },
    detail: {
      nl: 'Elliot stuurt de link zelf naar klanten, dus de site blijft bewust buiten zoekmachines. Hij draait gratis op GitHub Pages.',
      en: 'Elliot sends the link to clients himself, so the site stays out of search engines on purpose. It runs for free on GitHub Pages.',
    },
    stack: ['Next.js', 'Tailwind', 'GitHub Pages'],
    links: [{ label: site, href: 'https://elliot.dreamteamproductions.co.uk' }],
    image: '/projects/elliot.jpg',
    poster: '/projects/elliot-poster.jpg',
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
