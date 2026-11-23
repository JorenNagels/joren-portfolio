import * as THREE from 'three';
import { experience, headline, person } from '@/content/profile';
import { projects } from '@/content/projects';
import type { Locale } from '@/content/types';
import { period } from '@/content/ui';
import { streetCopy as t } from './copy';
import { kindOf } from './labels';

// Poster faces for the facades, drawn on a 2D canvas. 16:10, like the frames on the houses.
const W = 1600;
const H = 1000;
const PAPER = '#f4f0e4';
const INK = '#25262f';
const RED = '#c45a3d';

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines = 9) {
  let line = '';
  let n = 0;
  for (const w of text.split(' ')) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y + n * lh);
      line = w;
      if (++n >= maxLines) return n;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + n++ * lh);
  return n;
}

async function image(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, top = true) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, top ? 0 : (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function waveform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  const n = 70;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 6)) * (0.6 + 0.4 * Math.sin(i / 17));
    const jitter = 0.55 + 0.45 * Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
    const bh = Math.max(0.06, env * jitter) * h * 0.7;
    ctx.fillStyle = i % 10 === 0 ? RED : PAPER;
    ctx.fillRect(x + i * bw + bw * 0.2, y + h / 2 - bh / 2, bw * 0.6, bh);
  }
}

/*
 * The employers' posters: their logo on their own blue, over a map like the ones I built for them. The logos are
 * drawn in the poster's cream; width is how wide, and x/y nudge it so its letters, not its padding, line up with the
 * text (the Immoweb PNG has a margin round it).
 */
type Brand = { bg: string; logo: string; width: number; x: number; y: number; pin: string; pinInk: string };
const BRANDS: Record<string, Brand> = {
  realo: { bg: '#008aff', logo: '/logos/realo.svg', width: 560, x: 0, y: 0, pin: '#77cb00', pinInk: INK },
  immoweb: { bg: '#133dbd', logo: '/logos/immoweb.png', width: 760, x: -32, y: -36, pin: INK, pinInk: PAPER },
};

/** The same pseudo-random numbers every time, so a poster looks the same on every visit. */
function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** An image drawn in one flat colour, keeping its shape. */
function tint(img: HTMLImageElement, w: number, h: number, color: string) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, w, h);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, w, h);
  return c;
}

/** A town seen from above in the brand's blue: blocks, a river and price pins, faded out under the text on the left. */
function cityMap(ctx: CanvasRenderingContext2D, b: Brand, font: string, seed: number) {
  const r = seeded(seed);
  ctx.fillStyle = b.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W * 0.6, H * 0.5);
  ctx.rotate(-0.2);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = -W; x < W; x += 80 + r() * 110) xs.push(x);
  for (let y = -H; y < H; y += 70 + r() * 90) ys.push(y);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const k = r();
      if (k < 0.08) continue; // a square
      ctx.fillStyle = k < 0.16 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.075)'; // a park, or houses
      ctx.beginPath();
      ctx.roundRect(xs[i] + 8, ys[j] + 8, xs[i + 1] - xs[i] - 16, ys[j + 1] - ys[j] - 16, 8);
      ctx.fill();
    }
  }
  ctx.restore();

  // the river, darker than the blocks it runs through
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 54;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W * 0.42, H + 60);
  ctx.bezierCurveTo(W * 0.62, H * 0.62, W * 0.7, H * 0.5, W + 60, H * 0.22);
  ctx.stroke();

  // the left side fades back to plain blue, so the logo and text sit on calm ground
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, b.bg);
  g.addColorStop(0.36, b.bg);
  g.addColorStop(0.62, `${b.bg}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // price pins, as on a property search map; one stands out, as if you'd hovered it
  const spots = [[0.63, 0.17], [0.86, 0.11], [0.75, 0.36], [0.93, 0.48], [0.63, 0.6], [0.83, 0.68], [0.71, 0.86], [0.93, 0.88]];
  ctx.font = `600 34px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  spots.forEach(([sx, sy], i) => {
    const hot = i === 2;
    const text = `€ ${Math.round(195 + r() * 420)}k`;
    const w = ctx.measureText(text).width + 40;
    const h = 58;
    const x = sx * W;
    const y = sy * H;
    const pin = () => {
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      ctx.moveTo(x - 12, y + h / 2 - 2);
      ctx.lineTo(x, y + h / 2 + 14);
      ctx.lineTo(x + 12, y + h / 2 - 2);
      ctx.fill();
    };
    ctx.save();
    ctx.translate(0, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    pin();
    ctx.restore();
    ctx.fillStyle = hot ? b.pin : PAPER;
    pin();
    ctx.fillStyle = hot ? b.pinInk : b.bg;
    ctx.fillText(text, x, y + 2);
  });
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/** Fit a single line by shrinking the font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, weight: number, size: number, font: string) {
  ctx.font = `${weight} ${size}px ${font}`;
  while (ctx.measureText(text).width > max && size > 30) ctx.font = `${weight} ${(size -= 4)}px ${font}`;
  return size;
}

/**
 * One poster face: the texture for the facade, and the way to take its "Read more" button off again. The button
 * is painted into the canvas like the rest, so hiding it means putting back the pixels that were under it: the
 * ones there before it was drawn are kept, and drawing it again is a call away.
 */
export type Poster = { tex: THREE.CanvasTexture; showMore: (on: boolean) => void };

export async function posterTexture(id: string, l: Locale, font: string): Promise<Poster> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const f = (weight: number, size: number) => `${weight} ${size}px ${font}`;
  const kind = kindOf(id);
  // Where the button below starts: text above it has to stop short of here.
  const MORE_TOP = H - 80 - 120;
  // A button, not a line of small print: from the boat a poster is only a few centimetres across on a phone, and
  // this is the one thing on it that has to be read and tapped. Shaped like the buttons on the page, with the
  // same hard shadow under it.
  // The button as it stands on the poster, and the poster without it: see showMore at the end.
  let pill: { x: number; y: number; clean: ImageData; draw: () => void } | null = null;
  const more = (x: number, bg = INK, ink = PAPER) => {
    const h = 120;
    const y = MORE_TOP;
    ctx.font = f(600, 64);
    const w = Math.min(W - x, ctx.measureText(`${t.more[l]} →`).width + 2 * 56);
    const draw = () => {
      ctx.font = f(600, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.roundRect(x, y + 10, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${t.more[l]} →`, x + 56, y + h / 2 + 3);
      ctx.textBaseline = 'alphabetic';
    };
    // Taken before it is drawn, and a little wider and taller than the button, so the hard shadow under it
    // comes back off the poster too.
    pill = { x, y, clean: ctx.getImageData(x, y, Math.min(W - x, w + 2), Math.min(H - y, h + 14)), draw };
    draw();
  };

  if (kind === 'about') {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    cover(ctx, await image(person.photo), 0, 0, 640, H, false);
    ctx.fillStyle = INK;
    ctx.font = f(500, 46);
    ctx.fillText(t.hello[l], 720, 200);
    fit(ctx, person.name, W - 790, 600, 150, font);
    ctx.fillText(person.name, 714, 380);
    ctx.font = f(500, 56);
    wrap(ctx, `${headline[l]}, ${person.location[l]}`, 720, 490, W - 800, 70, 2);
    more(720);
  }

  if (kind === 'work') {
    const r = experience.find((x) => x.company.toLowerCase() === id)!;
    const b = BRANDS[id];
    cityMap(ctx, b, font, id.length * 7919);
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.8;
    ctx.font = f(500, 44);
    ctx.fillText(`${t.work[l]} · ${period(r.start, r.end, l)}`, 100, 150);
    ctx.globalAlpha = 1;
    const logo = await image(b.logo);
    const lh = (b.width * logo.height) / logo.width;
    ctx.drawImage(tint(logo, b.width, lh, PAPER), 100 + b.x, 250 + b.y);
    ctx.fillStyle = PAPER;
    ctx.font = f(500, 58);
    wrap(ctx, r.title[l], 100, 250 + b.y + lh + 110, 760, 72, 3);
    more(100, PAPER, b.bg);
  }

  if (kind === 'project') {
    const p = projects.find((x) => x.slug === id)!;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const iw = 880;
    const shot = p.poster ?? p.image;
    if (shot) cover(ctx, await image(shot), 0, 0, iw, H);
    else waveform(ctx, 0, 0, iw, H);
    const x = iw + 70;
    const max = W - x - 70;
    ctx.fillStyle = '#76736a';
    ctx.font = f(500, 38);
    wrap(ctx, `${p.kind[l]}, ${p.year}`, x, 130, max, 48, 2);
    ctx.fillStyle = INK;
    let size = 124;
    ctx.font = f(600, size);
    const longest = p.name.split(' ').reduce((a, b) => (b.length > a.length ? b : a));
    while (ctx.measureText(longest).width > max && size > 60) ctx.font = f(600, (size -= 6));
    const lines = wrap(ctx, p.name, x, 300, max, size * 0.95, 3);
    ctx.font = f(500, 48);
    // as many lines of tagline as fit above the button
    const ty = 300 + lines * size * 0.95 + 40;
    wrap(ctx, p.tagline[l], x, ty, max, 60, Math.max(1, Math.min(4, Math.floor((MORE_TOP - 50 - ty) / 60) + 1)));
    more(x);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return {
    tex,
    /** Off while the poster's panel is open: the story is already being read, so asking for it again is odd. */
    showMore(on: boolean) {
      if (!pill) return;
      if (on) pill.draw();
      else ctx.putImageData(pill.clean, pill.x, pill.y);
      tex.needsUpdate = true;
    },
  };
}
