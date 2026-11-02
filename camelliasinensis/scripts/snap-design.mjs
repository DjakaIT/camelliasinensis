// Snima referentne zaslone HTML-a dizajna B (GUIDE §2, §4.3) u docs/design-snapshots/.
// Pokretanje: node scripts/snap-design.mjs [putanja-do-html]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const html = resolve(process.argv[2] ?? 'design-reference/prototip-B.html');
const outDir = resolve('docs/design-snapshots');
mkdirSync(outDir, { recursive: true });

const pages = [
  ['naslovnica', ''],
  ['katalog', '#katalog'],
  ['katalog-zeleni', '#katalog?vrsta=zeleni'],
  ['proizvod', '#proizvod/1'],
  ['o-nama', '#o-nama'],
  ['kontakt', '#kontakt'],
  ['kosarica', '', true],
  ['blagajna', '#blagajna', true],
];
const viewports = [
  ['1440', { width: 1440, height: 900 }],
  ['390', { width: 390, height: 844 }],
];

const browser = await chromium.launch();
for (const [vname, viewport] of viewports) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const [name, hash, withCart] of pages) {
    await page.goto(pathToFileURL(html).href + hash);
    if (withCart) {
      await page.evaluate(() => localStorage.setItem('cs-cart', JSON.stringify([{ id: 1, v: '50 g', q: 2 }, { id: 9, v: '50 g', q: 1 }])));
      await page.reload();
      if (name === 'kosarica') await page.click('#openCart');
    }
    await page.evaluate(() => document.querySelectorAll('.rv').forEach((el) => el.classList.add('in')));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/${name}-${vname}.png`, fullPage: name !== 'kosarica' });
    console.log('snimljeno', name, vname);
  }
  await ctx.close();
}
await browser.close();
