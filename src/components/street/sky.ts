import * as THREE from 'three';

// An afternoon on the Graslei, keyed to scroll progress p (0 = top, 1 = end): bright, golden, then dusk.

type RGB = [number, number, number];
type Stop = { at: number; top: RGB; horizon: RGB; sun: RGB; sunColor: RGB; sunI: number; sky: RGB; ground: RGB; hemi: number; night: number };

const stops: Stop[] = [
  { at: 0, top: [118, 196, 186], horizon: [238, 232, 210], sun: [-0.45, 0.62, 0.65], sunColor: [255, 247, 232], sunI: 2.3, sky: [185, 228, 222], ground: [214, 196, 160], hemi: 1.15, night: 0 },
  { at: 0.55, top: [112, 186, 182], horizon: [246, 226, 190], sun: [-0.55, 0.5, 0.67], sunColor: [255, 236, 205], sunI: 2.3, sky: [180, 220, 214], ground: [220, 190, 150], hemi: 1.05, night: 0 },
  { at: 0.76, top: [214, 140, 112], horizon: [250, 208, 152], sun: [-0.75, 0.2, 0.62], sunColor: [255, 186, 120], sunI: 2.2, sky: [236, 180, 160], ground: [180, 130, 110], hemi: 0.9, night: 0.12 },
  { at: 0.9, top: [62, 66, 112], horizon: [214, 140, 124], sun: [-0.7, 0.12, 0.7], sunColor: [190, 150, 200], sunI: 0.9, sky: [110, 110, 160], ground: [70, 60, 80], hemi: 0.75, night: 0.75 },
  { at: 1, top: [34, 38, 70], horizon: [92, 80, 118], sun: [-0.3, 0.6, 0.7], sunColor: [150, 160, 220], sunI: 0.45, sky: [80, 90, 140], ground: [40, 40, 56], hemi: 0.7, night: 1 },
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const col = (c: RGB, out: THREE.Color) => out.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

const out = { sunColor: new THREE.Color(), skyLight: new THREE.Color(), groundLight: new THREE.Color(), horizon: new THREE.Color() };

export function skyAt(p: number) {
  let i = 0;
  while (i < stops.length - 2 && p > stops[i + 1].at) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const r = Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at)));
  const t = r * r * (3 - 2 * r);
  const sun = mix3(a.sun, b.sun, t);
  const len = Math.hypot(...sun);
  const top = mix3(a.top, b.top, t);
  const horizon = mix3(a.horizon, b.horizon, t);
  const lum = (0.2126 * horizon[0] + 0.7152 * horizon[1] + 0.0722 * horizon[2]) / 255;
  return {
    top,
    horizonRGB: horizon,
    horizon: col(horizon, out.horizon),
    sun: [sun[0] / len, sun[1] / len, sun[2] / len] as RGB,
    sunColor: col(mix3(a.sunColor, b.sunColor, t), out.sunColor),
    sunIntensity: mix(a.sunI, b.sunI, t),
    skyLight: col(mix3(a.sky, b.sky, t), out.skyLight),
    groundLight: col(mix3(a.ground, b.ground, t), out.groundLight),
    hemi: mix(a.hemi, b.hemi, t),
    night: mix(a.night, b.night, t),
    /** 0 = dark text reads best, 1 = light text */
    dark: Math.min(1, Math.max(0, (0.62 - lum) / 0.2)),
  };
}
