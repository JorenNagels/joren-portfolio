/**
 * A line in the debug panel, for the allocations worth naming.
 *
 * The street can run out of graphics memory and lose its context, and the log that comes back from the phone it
 * happened on says only that it went — not what the page was doing at the time. These marks put the boot's
 * allocations in the log in order, with a running total, so the last line before the loss names the one that
 * tipped it instead of leaving us to guess.
 *
 * The hook is installed by Debug.tsx, which only runs with `?debug=1`. For an ordinary visitor this is a property
 * lookup that comes back undefined, and nothing is measured, formatted or kept.
 */
export const mark = (s: string) => {
  if (typeof window === 'undefined') return;
  (window as unknown as { __mark?: (s: string) => void }).__mark?.(s);
};

/** Bytes a texture of this size occupies on the card, mipmaps and all, as megabytes. */
export const mb = (w: number, h: number, bytesPerPixel = 4, mips = true) => (w * h * bytesPerPixel * (mips ? 4 / 3 : 1)) / 1e6;
