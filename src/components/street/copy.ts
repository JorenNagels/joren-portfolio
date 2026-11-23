import type { L } from '@/content/types';

// Words used in the street itself: posters, captions, the panel and the ending.
export const streetCopy = {
  role: { nl: 'Software Engineer', en: 'Software Engineer' },
  loadHouses: { nl: 'De huizen rechtzetten', en: 'Propping up the houses' },
  loadBoat: { nl: 'De boot te water laten', en: 'Putting the boat in the water' },
  scroll: { nl: 'Scroll om te varen', en: 'Scroll to sail' },
  start: { nl: 'Stap aan boord', en: 'Step aboard' },
  hint: { nl: 'Beweeg je muis om rond te kijken, sleep om je om te draaien. Klik op een affiche voor meer.', en: 'Move your mouse to look around, drag to turn right round. Click a poster to read more.' },
  hintTouch: {
    nl: 'Veeg om rond te kijken, ook naar achter, en knijp om in te zoomen. Sleep de rivier onderaan om terug te varen, of pauzeer de tocht.',
    en: 'Swipe to look around, behind you too, and pinch to zoom in. Drag the river below to go back, or pause the trip.',
  },
  hello: { nl: 'Hallo, ik ben', en: 'Hi, I’m' },
  about: { nl: 'Over mij', en: 'About me' },
  work: { nl: 'Werk', en: 'Work' },
  more: { nl: 'Meer lezen', en: 'Read more' },
  close: { nl: 'Sluiten', en: 'Close' },
  stops: { nl: 'Huizen langs de Leie', en: 'Houses along the Leie' },
  endTitle: { nl: 'Bedankt voor de boottocht.', en: 'Thanks for the boat trip.' },
  endText: { nl: 'Mail me, of vind me hier:', en: 'Email me, or find me here:' },
  highlights: { nl: 'Een paar dingen die ik er deed', en: 'Some things I did there' },
  skills: { nl: 'Waar ik mee werk', en: 'What I work with' },
  languages: { nl: 'Talen', en: 'Languages' },
} satisfies Record<string, L>;
