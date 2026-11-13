import * as THREE from 'three';
import { experience, headline, person } from '@/content/profile';
import { experiments, projects } from '@/content/projects';
import type { Locale } from '@/content/types';
import { period } from '@/content/ui';
import { streetCopy as t } from './copy';

// Poster faces for the facades, drawn on a 2D canvas. 16:10, like the frames on the houses.
const W = 1600;
const H = 1000;
const PAPER = '#f4f0e4';
const INK = '#25262f';
const RED = '#c45a3d';
const TEAL = '#2f7d7a';

export type Kind = 'about' | 'work' | 'project' | 'small' | 'contact';
export function kindOf(id: string): Kind {
  if (id === 'about' || id === 'small' || id === 'contact') return id;
  if (projects.some((p) => p.slug === id)) return 'project';
  return 'work';
}

export function labelOf(id: string, l: Locale) {
  const k = kindOf(id);
  if (k === 'project') return projects.find((p) => p.slug === id)!.name;
  if (k === 'work') return experience.find((r) => r.company.toLowerCase() === id)!.company;
  return t[k][l];
}

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

/** Fit a single line by shrinking the font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, weight: number, size: number, font: string) {
  ctx.font = `${weight} ${size}px ${font}`;
  while (ctx.measureText(text).width > max && size > 30) ctx.font = `${weight} ${(size -= 4)}px ${font}`;
  return size;
}

export async function posterTexture(id: string, l: Locale, font: string) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const f = (weight: number, size: number) => `${weight} ${size}px ${font}`;
  const kind = kindOf(id);
  const more = (x: number, y: number, color = RED) => {
    ctx.fillStyle = color;
    ctx.font = f(600, 44);
    ctx.fillText(`${t.more[l]} →`, x, y);
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
    more(720, H - 100);
  }

  if (kind === 'work') {
    const r = experience.find((x) => x.company.toLowerCase() === id)!;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#a7a8ad';
    ctx.font = f(500, 44);
    ctx.fillText(`${t.work[l]} · ${period(r.start, r.end, l)}`, 100, 150);
    ctx.fillStyle = PAPER;
    fit(ctx, r.company, W - 200, 600, 260, font);
    ctx.fillText(r.company, 92, 470);
    ctx.font = f(500, 60);
    wrap(ctx, r.title[l], 100, 600, W - 200, 76, 2);
    more(100, H - 100, '#e9a77b');
  }

  if (kind === 'project') {
    const p = projects.find((x) => x.slug === id)!;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const iw = 880;
    if (p.image) cover(ctx, await image(p.image), 0, 0, iw, H);
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
    wrap(ctx, p.tagline[l], x, 300 + lines * size * 0.95 + 40, max, 60, 4);
    more(x, H - 90);
  }

  if (kind === 'small') {
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.font = f(600, 116);
    ctx.fillText(t.small[l], 100, 200);
    experiments.forEach((e, i) => {
      const y = 340 + i * 145;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(100, y - 72, W - 200, 3);
      ctx.globalAlpha = 1;
      ctx.font = f(600, 66);
      ctx.fillText(e.name, 100, y + 8);
      ctx.font = f(500, 42);
      ctx.fillText(e.year, W - 210, y + 8);
    });
    more(100, H - 70, '#f2d39b');
  }

  if (kind === 'contact') {
    ctx.fillStyle = RED;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.font = f(600, 120);
    ctx.fillText(t.contactTitle[l], 100, 250);
    fit(ctx, person.email, W - 200, 600, 140, font);
    ctx.fillText(person.email, 96, 520);
    ctx.font = f(500, 50);
    ctx.fillText('GitHub · CV', 100, 660);
    more(100, H - 100, INK);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
