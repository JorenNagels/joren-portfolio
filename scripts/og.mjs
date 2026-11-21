// Builds the share card (public/og.jpg) and the iOS home-screen icon (public/apple-icon.png).
// Run with `npm run og` after changing the name, the headline or the photo.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

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
  *{margin:0;padding:0}body{width:180px;height:180px;background:#0b0d12}
  svg{width:180px;height:180px;display:block}
</style></head><body>${readFileSync('public/icon.svg', 'utf8').replace('rx="7"', 'rx="0"')}</body></html>`;

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

await browser.close();
