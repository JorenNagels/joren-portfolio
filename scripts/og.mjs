// Builds the share card (public/og.jpg), the iOS home-screen icon (public/apple-icon.png) and the
// raster favicons (public/icon-96.png, public/favicon.ico).
// Run with `npm run og` after changing the name, the headline or the photo.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

// Read the two lines straight out of the CV content, so the card cannot drift from the site.
const profile = readFileSync('src/content/profile.ts', 'utf8');
const pick = (re) => (profile.match(re)?.[1] ?? '').trim();
const name = pick(/name:\s*'([^']+)'/);
const site = pick(/site:\s*'https:\/\/([^']+)'/);
const headline = pick(/export const headline: L = \{ nl: '[^']*', en: '([^']+)'/);
const photo = readFileSync('public/joren.jpg').toString('base64');

if (!name || !headline || !site) throw new Error(`could not read profile.ts: ${JSON.stringify({ name, headline, site })}`);

const card = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:#0b0d12;color:#efeee9;
    font-family:'Schibsted Grotesk',sans-serif;display:flex;align-items:center;justify-content:center;gap:72px;padding:0 96px;overflow:hidden;position:relative}
  /* the sunset the hero ends on */
  .glow{position:absolute;inset:auto -200px -340px -200px;height:620px;
    background:radial-gradient(ellipse at 50% 100%,rgba(255,176,102,.30),rgba(255,138,61,.09) 45%,transparent 70%)}
  .photo{width:260px;height:260px;border-radius:999px;object-fit:cover;object-position:50% 25%;
    flex:none;box-shadow:0 0 0 2px rgba(255,176,102,.5),0 24px 70px rgba(0,0,0,.6);position:relative}
  .text{position:relative}
  h1{font-size:92px;font-weight:600;letter-spacing:-.05em;line-height:.98}
  .role{margin-top:22px;font-size:38px;color:#8d8f96;letter-spacing:-.02em}
  .site{margin-top:40px;font-size:27px;color:#ffb066;letter-spacing:.01em}
</style></head><body>
<div class="glow"></div>
<img class="photo" src="data:image/jpeg;base64,${photo}">
<div class="text">
  <h1>${name}</h1>
  <p class="role">${headline}</p>
  <p class="site">${site}</p>
</div></body></html>`;

const icon = `<!doctype html><html><head><meta charset="utf-8"><style>
  /* iOS masks this to its own rounded square, so the page carries the icon's cream right to the
     edge and the round mark in icon.svg simply disappears into it. */
  *{margin:0;padding:0}body{width:180px;height:180px;background:#efeee9}
  svg{width:180px;height:180px;display:block}
</style></head><body>${readFileSync('public/icon.svg', 'utf8')}</body></html>`;

const browser = await chromium.launch();

const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(card, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400); // let the webfont paint before the shutter
await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 90 });
console.log('ok   public/og.jpg      1200x630');

await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(icon, { waitUntil: 'load' });
await page.screenshot({ path: 'public/apple-icon.png', type: 'png' });
console.log('ok   public/apple-icon.png 180x180');

// Google Search does not take an SVG favicon: its list is BMP, GIF, ICO, PNG, JPEG, PPM and TIFF.
// So the same mark is rasterised — one 96x96 PNG (Google asks for square and larger than 48px) and
// a classic multi-size favicon.ico for anything that still looks for one at the root.
const mark = `<!doctype html><html><head><meta charset="utf-8"><style>
  /* Transparent here, unlike the iOS icon: the round mark keeps its own cream and the corners stay
     clear, the way a favicon sits on a tab or a search result. */
  *{margin:0;padding:0}
  svg{width:100vw;height:100vh;display:block}
</style></head><body>${readFileSync('public/icon.svg', 'utf8')}</body></html>`;

const markPng = async (size) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(mark, { waitUntil: 'load' });
  return page.screenshot({ type: 'png', omitBackground: true });
};

writeFileSync('public/icon-96.png', await markPng(96));
console.log('ok   public/icon-96.png  96x96');

// An .ico is a 6-byte header, one 16-byte directory entry per size, then the images themselves —
// PNG payloads, which every browser since IE11 reads.
const icoSizes = [16, 32, 48];
const icoImages = [];
for (const size of icoSizes) icoImages.push(await markPng(size));

const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(1, 2); // type 1 = icon
icoHeader.writeUInt16LE(icoSizes.length, 4);

let icoOffset = icoHeader.length + 16 * icoSizes.length;
const icoDir = icoSizes.map((size, i) => {
  const entry = Buffer.alloc(16);
  entry[0] = size; // width and height; 0 would mean 256
  entry[1] = size;
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(icoImages[i].length, 8);
  entry.writeUInt32LE(icoOffset, 12);
  icoOffset += icoImages[i].length;
  return entry;
});

writeFileSync('public/favicon.ico', Buffer.concat([icoHeader, ...icoDir, ...icoImages]));
console.log(`ok   public/favicon.ico  ${icoSizes.join('/')}`);

await browser.close();
