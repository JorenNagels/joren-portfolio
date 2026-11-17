import type { L } from '@/content/types';

// Words used in the street itself: posters, captions, the panel and the ending.
export const streetCopy = {
  role: { nl: 'Developer in Gent', en: 'Developer in Ghent' },
  loadHouses: { nl: 'De huizen rechtzetten', en: 'Propping up the houses' },
  loadBoat: { nl: 'De boot te water laten', en: 'Putting the boat in the water' },
  scroll: { nl: 'Scroll om met de boot over de Leie te varen', en: 'Scroll to take the boat down the Leie' },
  hint: { nl: 'Beweeg je muis om rond te kijken. Klik op een affiche voor meer.', en: 'Move your mouse to look around. Click a poster to read more.' },
  hintTouch: { nl: 'Veeg opzij om rond te kijken. Tik op een affiche voor meer.', en: 'Swipe sideways to look around. Tap a poster to read more.' },
  hello: { nl: 'Hallo, ik ben', en: 'Hi, I’m' },
  about: { nl: 'Over mij', en: 'About me' },
  work: { nl: 'Werk', en: 'Work' },
  more: { nl: 'Meer lezen', en: 'Read more' },
  close: { nl: 'Sluiten', en: 'Close' },
  stops: { nl: 'Huizen langs de Leie', en: 'Houses along the Leie' },
  endTitle: { nl: 'Bedankt voor de boottocht.', en: 'Thanks for the boat trip.' },
  endText: { nl: 'Mail me, of vind me hier:', en: 'Email me, or find me here:' },
  highlights: { nl: 'Wat ik er deed', en: 'What I did there' },
  skills: { nl: 'Waar ik mee werk', en: 'What I work with' },
  languages: { nl: 'Talen', en: 'Languages' },
} satisfies Record<string, L>;
