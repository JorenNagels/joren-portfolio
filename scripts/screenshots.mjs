// Captures fresh screenshots of the live project sites into public/projects/.
// Run with `npm run screenshots` whenever a site changes.
import { chromium } from 'playwright';

const sites = {
  guestnote: 'https://guestnote.be',
  'se-parti': 'https://se-parti.be',
  flowsha: 'https://flowsha.co.uk',
  'dream-team': 'https://dreamteamproductions.co.uk',
  elliot: 'https://elliot.dreamteamproductions.co.uk',
};

const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

for (const [slug, url] of Object.entries(sites)) {
  if (only.length && !only.includes(slug)) continue;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500); // let hero animations settle
    await page.screenshot({ path: `public/projects/${slug}.jpg`, type: 'jpeg', quality: 78 });
    console.log('ok  ', slug);
  } catch (err) {
    console.warn('fail', slug, err.message);
  }
}
await browser.close();
