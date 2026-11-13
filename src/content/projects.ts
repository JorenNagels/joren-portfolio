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
      nl: 'Software voor weddingplanners.',
      en: 'Software for wedding planners.',
    },
    story: {
      nl: 'Een weddingplanner houdt vaak per bruiloft een eigen Excel bij voor gasten, RSVP’s en dieetwensen. Guestnote zet al die bruiloften in één dashboard, en elk koppel krijgt een trouwwebsite met het logo van de planner erop. Ik doe het alleen: de naam (na zo’n 600 gecheckte domeinen), het ontwerp, de code en de AWS-setup.',
      en: 'Wedding planners often keep a spreadsheet per wedding for guests, RSVPs and dietary needs. Guestnote puts all their weddings in one dashboard, and every couple gets a wedding website with the planner’s logo on it. I’m doing it alone: the name (after checking about 600 domains), the design, the code and the AWS setup.',
    },
    detail: {
      nl: 'De data van elke planner moet gescheiden blijven. Dat dwingt Postgres zelf af met row-level security, en de tests draaien tegen de echte database.',
      en: 'Each planner’s data has to stay separate. Postgres enforces that itself with row-level security, and the tests run against the real database.',
    },
    stack: ['Next.js', 'Postgres', 'Drizzle', 'Better Auth', 'SST', 'AWS'],
    links: [
      { label: site, href: 'https://guestnote.be' },
      { label: code, href: 'https://github.com/JorenNagels/guestnote' },
    ],
    image: '/projects/guestnote.jpg',
    cv: {
      nl: 'Software voor weddingplanners: al hun bruiloften in één dashboard, met een trouwwebsite per koppel. Data per planner gescheiden met Postgres row-level security.',
      en: 'Software for wedding planners: all their weddings in one dashboard, with a wedding website per couple. Each planner’s data kept apart with Postgres row-level security.',
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
    cv: {
      nl: 'Website met boekingsformulier voor een hoepelschool in het VK. S3, CloudFront en Lambda in CDK.',
      en: 'Website with a booking form for a hula-hoop teacher in the UK. S3, CloudFront and Lambda in CDK.',
    },
  },
  {
    slug: 'dream-team',
    name: 'Dream Team Productions',
    year: '2026',
    kind: { nl: 'Twee websites, VK', en: 'Two websites, UK' },
    tagline: {
      nl: 'Voor een productiehuis dat esports en vechtsport uitzendt.',
      en: 'For a production company that broadcasts esports and combat sports.',
    },
    story: {
      nl: 'De site van het productiehuis, met een filterbare lijst van hun producties, en de site van hun presentator Elliot Barham. De bedrijfssite is enkel typografie, wit op zwart.',
      en: 'The company site, with a filterable list of their productions, and the site of their presenter, Elliot Barham. The company site is type only, white on black.',
    },
    stack: ['Next.js', 'S3', 'CloudFront'],
    links: [
      { label: site, href: 'https://dreamteamproductions.co.uk' },
      { label: { nl: 'Elliot Barham', en: 'Elliot Barham' }, href: 'https://elliot.dreamteamproductions.co.uk' },
    ],
    image: '/projects/dream-team.jpg',
    cv: {
      nl: 'Twee sites voor een Brits productiehuis en hun presentator. Statische Next.js op S3 en CloudFront.',
      en: 'Two sites for a UK production company and its presenter. Static Next.js on S3 and CloudFront.',
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
