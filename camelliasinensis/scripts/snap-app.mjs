// Snima zaslone izgrađene aplikacije (GUIDE §4.3) u docs/screenshots/ za ručnu usporedbu s docs/design-snapshots/.
// Pokretanje: npm run build:demo && npm run serve (u drugom terminalu), pa node scripts/snap-app.mjs [baseURL]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:3000';
const outDir = resolve('docs/screenshots');
mkdirSync(outDir, { recursive: true });

const pages = [
  ['naslovnica', '/'],
  ['katalog', '/katalog/'],
  ['katalog-zeleni', '/katalog/zeleni/'],
  ['proizvod', '/proizvod/bai-mu-dan-wang/'],
  ['o-nama', '/o-nama/'],
  ['kontakt', '/kontakt/'],
  ['povrat', '/povrat/'],
  ['blagajna', '/kosarica/', true, false, true],
  ['kosarica', '/kosarica/', true],
  ['kosarica-ladica', '/', true, true],
  ['404', '/ne-postoji/'],
];
const viewports = [
  ['1440', { width: 1440, height: 900 }],
  ['390', { width: 390, height: 844 }],
];
const cart = JSON.stringify({ v: 1, lines: [{ sku: 'CSTB-2', qty: 2 }, { sku: 'CSTV-18', qty: 1 }], updatedAt: '2026-11-02T00:00:00Z' });

const browser = await chromium.launch();
for (const [vname, viewport] of viewports) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const [name, path, withCart, drawer, checkout] of pages) {
    await page.goto(base + '/');
    await page.evaluate((c) => (c ? localStorage.setItem('cs.cart.v1', c) : localStorage.clear()), withCart ? cart : null);
    await page.goto(base + path, { waitUntil: 'networkidle' });
    if (drawer) await page.locator('.cartp').click();
    if (checkout) {
      await page.locator('#sadrzaj').getByRole('button', { name: /Na blagajnu/ }).click();
      await page.getByRole('heading', { level: 1, name: 'Blagajna' }).waitFor();
    }
    await page.evaluate(async () => {
      document.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
      document.querySelectorAll('img[loading=lazy]').forEach((img) => (img.loading = 'eager'));
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/${name}-${vname}.png`, fullPage: !drawer });
    console.log('snimljeno', name, vname);
  }
  await ctx.close();
}
await browser.close();
