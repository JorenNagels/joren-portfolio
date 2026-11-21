import { person } from '@/content/profile';

/**
 * The boat sails the tab title while you go down the Leie, the way it does on the stage below.
 *
 * Nothing touches the title until the trip has actually moved. A crawler renders the page at a standstill,
 * so it keeps the <title> that was served — which is the one we want in a search result. Back at the very
 * top of the page the real title comes back too.
 */
const CELLS = 7;
const WATER = '〜';
const BOAT = '⛵';

let served = '';
let shown = '';
let stopped = false;

export function sailTitle(progress: number) {
  if (stopped) return;
  if (!served) {
    // A title that rewrites itself is motion in the one piece of chrome you cannot look away from.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return void (stopped = true);
    served = document.title;
  }

  let next = served;
  if (progress > 0) {
    const i = Math.min(CELLS - 1, Math.floor(progress * CELLS));
    // First name only: a tab is a few characters wide before it truncates, and the boat needs the room.
    next = `${WATER.repeat(i)}${BOAT}${WATER.repeat(CELLS - 1 - i)}  ${person.name.split(' ')[0]}`;
  }
  // Seven positions over the whole trip, so this writes about seven times, not once a frame.
  if (next !== shown) document.title = shown = next;
}

/** Put the served title back when the street goes away. */
export function restoreTitle() {
  if (served && document.title !== served) document.title = served;
  shown = '';
}
