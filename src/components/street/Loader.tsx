import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/content/types';
import { streetCopy as t } from './copy';
import { type Col, FLOOR, GRASLEI, GROUND, type HouseSpec, palette } from './plan';

/*
 * While the 3D street loads: the Graslei as a pop-up book. The same houses as the street, in the same order and
 * colours, fold up from the quay one by one, their reflections fold down into the water, and the boat bobs past.
 * Once the street has drawn its first frame, it comes in behind them seen from the very same spot and at the same
 * size, the drawn houses dissolve into the real ones from the middle out, and the camera swings up into the river.
 *
 * Everything that moves is a CSS transform on its own element, so the browser animates it off the main thread:
 * it keeps going while the street is being built, which holds up everything else for half a second.
 */

const INK = '#25262f';

/** A colour a little darker, like the street's toon shading. */
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `rgb(${c.join(',')})`;
}

/** One facade, front on, drawn like houses.ts builds it. Units are metres, y up from the quay. */
function House({ h, i }: { h: HouseSpec; i: number }) {
  const W = h.w;
  const H = GROUND + h.floors * FLOOR;
  const wall = palette[h.wall];
  const roof = palette[h.roof ?? 'roof'];
  const rise = h.gable === 'stepped' ? W * 0.62 : h.gable === 'pointed' ? W * 0.7 : W * 0.42 + 0.5;
  const top = h.gable === 'stepped' ? H + rise + 1.1 : H + rise + 0.2;
  const chimney = { x: (i % 2 ? -1 : 1) * W * 0.24, top: H + (h.gable === 'cornice' ? 0.5 : 0) + rise * 0.52 + 1.4 };
  const T = Math.max(top, chimney.top + 0.6);
  const Y = (y: number) => T - y; // SVG counts down from the top
  const pts = (p: [number, number][]) => p.map(([x, y]) => `${x + W / 2},${Y(y)}`).join(' ');
  const rect = (cx: number, cy: number, w: number, hh: number, fill: string, ink = true) => (
    <rect x={cx + W / 2 - w / 2} y={Y(cy + hh / 2)} width={w} height={hh} fill={fill} className={ink ? 'k' : undefined} />
  );
  const win = (cx: number, cy: number, w: number, hh: number, shutters?: Col) => (
    <g key={`${cx},${cy}`}>
      {shutters && [-1, 1].map((s) => <g key={s}>{rect(cx + s * (w / 2 + 0.24), cy, 0.44, hh, palette[shutters])}</g>)}
      {rect(cx, cy, w, hh, palette.frame)}
      {rect(cx, cy, w - 0.24, hh - 0.24, palette.glass, false)}
      {rect(cx, cy + hh * 0.12, w - 0.24, 0.1, palette.frame, false)}
    </g>
  );

  // the poster, and the windows it leaves room for
  const pw = Math.min(W * 0.74, 6.4);
  const ph = pw / 1.6;
  const py = GROUND + 0.45 + ph / 2;
  const cols = Math.max(1, Math.round((W - 1.2) / 2.3));
  const step = W / cols;
  const windows: [number, number][] = [];
  for (let f = 0; f < h.floors; f++)
    for (let c = 0; c < cols; c++) {
      const cx = -W / 2 + step * (c + 0.5);
      const cy = GROUND + f * FLOOR + 1.5;
      if (h.id && Math.abs(cx) < pw / 2 + 0.7 && Math.abs(cy - py) < ph / 2 + 1) continue;
      windows.push([cx, cy]);
    }

  // the outline of front wall and gable together, so there is no seam between them
  let body: [number, number][];
  if (h.gable === 'stepped') {
    const n = h.steps ?? 5;
    const sh = rise / n;
    const left: [number, number][] = [[-W / 2, 0]];
    for (let k = 0; k < n; k++) {
      const sw = W * (1 - k / n);
      left.push([-sw / 2, k ? H + sh * k : H], [-sw / 2, H + sh * (k + 1)]);
    }
    left.splice(1, 1);
    body = [...left, ...left.map(([x, y]) => [-x, y] as [number, number]).reverse()];
  } else if (h.gable === 'pointed') body = [[-W / 2, 0], [-W / 2, H], [0, H + rise], [W / 2, H], [W / 2, 0]];
  else body = [[-W / 2, 0], [-W / 2, H], [W / 2, H], [W / 2, 0]];

  const shopW = Math.max(1.4, W - 3.6);
  const shopX = -W / 2 + 0.6 + shopW / 2;
  const doorX = W / 2 - 1.3;

  return (
    <div className="house" style={{ ['--w' as string]: W, ['--h' as string]: T }}>
      <svg viewBox={`0 0 ${W} ${T}`} aria-hidden>
        {/* behind the front: chimney, and for a flat front the roof and dormer */}
        {rect(chimney.x, (chimney.top + H) / 2, 0.95, chimney.top - H, palette[h.wall === 'brick' ? 'terracotta' : 'brick'])}
        {rect(chimney.x, chimney.top + 0.08, 1.15, 0.16, palette.stone)}
        {h.gable === 'cornice' && (
          <>
            <polygon points={pts([[-W / 2, H + 0.5], [W / 2, H + 0.5], [0, H + rise]])} fill={roof} className="k" />
            {rect(0, H + 1.55, 1.7, 1.6, wall)}
            <polygon points={pts([[-1.05, H + 2.3], [1.05, H + 2.3], [0, H + 3.2]])} fill={roof} className="k" />
            {win(0, H + 1.5, 0.75, 1.0)}
          </>
        )}

        <polygon points={pts(body)} fill={wall} className="k" />
        {rect(0, 0.27, W, 0.55, shade(wall, 0.8), false)}
        {Array.from({ length: h.floors }, (_, k) => <g key={k}>{rect(0, GROUND + k * FLOOR - 0.08, W, 0.16, shade(wall, 0.9), false)}</g>)}

        {h.gable === 'stepped' && (
          <>
            {Array.from({ length: h.steps ?? 5 }, (_, k) => {
              const n = h.steps ?? 5;
              const sw = W * (1 - k / n);
              return [-1, 1].map((s) => <g key={`${k}${s}`}>{rect((s * (sw - 0.2)) / 2, H + (rise / n) * (k + 1) + 0.07, 0.42, 0.14, palette.stone)}</g>);
            })}
            {rect(0, H + rise + 0.55, 0.42, 1.1, palette.stone)}
            {win(0, H + rise * 0.3, 0.8, 1.2)}
          </>
        )}
        {h.gable === 'pointed' && (
          <>
            <polyline points={pts([[-W / 2 - 0.1, H - 0.1], [0, H + rise], [W / 2 + 0.1, H - 0.1]])} fill="none" stroke={palette.frame} strokeWidth={0.3} strokeLinejoin="round" />
            <polyline points={pts([[-W / 2 - 0.1, H - 0.1], [0, H + rise], [W / 2 + 0.1, H - 0.1]])} fill="none" className="k" />
            {win(0, H + rise * 0.32, 0.75, 1.15)}
          </>
        )}
        {h.gable === 'cornice' && (
          <>
            {rect(0, H + 0.27, W + 0.5, 0.55, palette.stone)}
            {rect(0, H + 0.6, W + 0.7, 0.18, shade(palette.stone, 0.85))}
          </>
        )}

        {windows.map(([cx, cy]) => win(cx, cy, Math.min(1.05, step * 0.45), 1.75, h.shutters))}
        {h.id && (
          <>
            {rect(0, py, pw + 0.34, ph + 0.34, palette.iron)}
            {rect(0, py, pw, ph, '#f4f0e4', false)}
            {rect(0, py + ph * 0.18, pw * 0.6, ph * 0.16, INK, false)}
            {rect(-pw * 0.1, py - ph * 0.12, pw * 0.4, ph * 0.06, shade(INK, 2.4), false)}
          </>
        )}

        {/* ground floor: a door and a shop window, sometimes an awning */}
        {rect(doorX, 1.28, 1.25, 2.55, palette.wood)}
        {rect(shopX, 1.85, shopW, 2.2, palette.frame)}
        {rect(shopX, 1.85, shopW - 0.24, 1.96, palette.glass, false)}
        {h.awning && (
          <g>
            {Array.from({ length: 10 }, (_, k) => (
              <g key={k}>{rect(shopX - (shopW + 0.6) / 2 + ((k + 0.5) * (shopW + 0.6)) / 10, 3.25, (shopW + 0.6) / 10 + 0.01, 0.7, k % 2 ? palette[h.awning!] : palette[h.awning === 'terracotta' ? 'cream' : 'terracotta'], false)}</g>
            ))}
            {rect(shopX, 3.25, shopW + 0.6, 0.7, 'none')}
          </g>
        )}
      </svg>
    </div>
  );
}

/** The boat you'll ride in, side on: brown hull, cream stripe, a skipper and a lantern. */
function Boat() {
  return (
    <svg viewBox="0 0 8 3.4" aria-hidden>
      <line x1="1.2" y1="2.2" x2="1.2" y2="0.5" stroke={INK} strokeWidth="0.09" />
      <rect x="0.98" y="0.3" width="0.44" height="0.5" rx="0.08" fill={palette.gold} className="k" />
      <circle cx="3.6" cy="0.95" r="0.36" fill="#e9b88f" className="k" />
      <path d="M3.05 2.2 L3.2 1.4 Q3.6 1.15 4 1.4 L4.15 2.2 Z" fill={palette.shutterBlue} className="k" />
      <path d="M0.2 1.9 L7.1 1.9 Q7.7 1.85 7.9 1.3 L7.6 2.6 Q7.3 3.2 6.4 3.2 L0.9 3.2 Q0.4 3.2 0.3 2.7 Z" fill="#7a4a35" className="k" />
      <path d="M0.27 2.25 L7.72 2.25" stroke={palette.cream} strokeWidth="0.16" />
      <path d="M0.42 2.9 Q0.6 3.2 0.9 3.2 L6.4 3.2 Q7.1 3.2 7.4 2.9 Z" fill="#5a2f2a" />
      <path d="M0.2 1.9 L7.1 1.9 Q7.7 1.85 7.9 1.3 L7.6 2.6 Q7.3 3.2 6.4 3.2 L0.9 3.2 Q0.4 3.2 0.3 2.7 Z" fill="none" className="k" />
    </svg>
  );
}

function Row({ reflect }: { reflect?: boolean }) {
  const mid = (GRASLEI.length - 1) / 2;
  return (
    <div className={reflect ? 'row reflect' : 'row'}>
      {GRASLEI.map((h, i) => (
        // the middle house goes up first and the rest follow outwards, like a book being opened
        <div key={i} style={{ ['--d' as string]: Math.abs(i - mid) }}>
          <House h={h} i={i} />
        </div>
      ))}
    </div>
  );
}

export function Loader({ l, built, ready, onMeasure, onOut }: { l: Locale; built: boolean; ready: boolean; onMeasure: (m: number, base: number) => void; onOut: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);

  // How big a metre is drawn and where the houses stand, measured on the stage the 3D canvas fills.
  useEffect(() => {
    const el = root.current;
    const house = el?.querySelector<HTMLElement>('.row .house');
    const quay = el?.querySelector<HTMLElement>('.quay');
    const stage = el?.parentElement;
    if (!house || !quay || !stage) return;
    const measure = () => onMeasure(house.offsetWidth / GRASLEI[0].w, quay.getBoundingClientRect().top - stage.getBoundingClientRect().top);
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [onMeasure]);

  // Let every house finish popping up before they fold away again, then hand over to the street.
  useEffect(() => {
    if (!ready || !root.current) return;
    let alive = true;
    const pops = root.current.getAnimations({ subtree: true }).filter((a) => (a as CSSAnimation).animationName === 'pop-up');
    Promise.all(pops.map((a) => a.finished))
      .catch(() => {})
      .then(() => {
        if (!alive) return;
        setOut(true);
        onOut();
      });
    return () => {
      alive = false;
    };
  }, [ready, onOut]);
  useEffect(() => {
    if (!out) return;
    const id = setTimeout(() => setGone(true), 1400);
    return () => clearTimeout(id);
  }, [out]);

  if (gone) return null;
  return (
    <div ref={root} className="loader pointer-events-none absolute inset-x-0 bottom-0" data-out={out || undefined} aria-hidden>
      <Row />
      <div className="quay" />
      <div className="water">
        <Row reflect />
        <div className="waves" />
        <div className="waves waves-2" />
        <div className="boat">
          <div className="bob">
            <Boat />
          </div>
        </div>
        {/* where the street's own menu will be, in the same pill */}
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f4f0e4] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#25262f] shadow-[0_2px_0_#25262f] ring-[1.5px] ring-[#25262f] sm:bottom-6">
          {built ? t.loadBoat[l] : t.loadHouses[l]}
          <span className="dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
      </div>
    </div>
  );
}
