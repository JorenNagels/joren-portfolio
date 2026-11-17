// Captures fresh screenshots of the live project sites into public/projects/.
// Run with `npm run screenshots` whenever a site changes.
import { chromium } from 'playwright';

const sites = {
  guestnote: 'https://staging.guestnote.be', // staging: the public site there is ahead of production
  'se-parti': 'https://se-parti.be',
  flowsha: 'https://flowsha.co.uk',
  'dream-team': 'https://dreamteamproductions.co.uk',
  elliot: 'https://elliot.dreamteamproductions.co.uk',
};

const only = process.argv.slice(2);
const browser = await chromium.launch();
const DESKTOP = { width: 1440, height: 900 }; // the panel next to a poster
const POSTER = { width: 880, height: 1000 }; // the picture on the poster itself (posters.ts)
const page = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1 });

for (const [slug, url] of Object.entries(sites)) {
  if (only.length && !only.includes(slug)) continue;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500); // let hero animations settle
    await page.screenshot({ path: `public/projects/${slug}.jpg`, type: 'jpeg', quality: 78 });
    // and at the shape of the picture on the billboard, so the site lays itself out for it rather than being cropped
    await page.setViewportSize(POSTER);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `public/projects/${slug}-poster.jpg`, type: 'jpeg', quality: 78 });
    await page.setViewportSize(DESKTOP);
    console.log('ok  ', slug);
  } catch (err) {
    console.warn('fail', slug, err.message);
  }
}
await browser.close();
