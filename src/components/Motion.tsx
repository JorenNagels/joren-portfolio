'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';
import { onFrame } from '@/lib/ticker';

/** Smooth scrolling, driven by the page-wide ticker so the 3D walk moves in the same frame. */
export function Motion() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.085 });
    (window as unknown as { lenis?: Lenis }).lenis = lenis;
    const off = onFrame((t) => lenis.raf(t), 0);
    return () => {
      off();
      lenis.destroy();
    };
  }, []);
  return null;
}
