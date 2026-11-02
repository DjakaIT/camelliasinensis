// axe (GUIDE §4.6): 0 kršenja razine serious i critical na svim stranicama, desktop i mobitel.
import AxeBuilder from '@axe-core/playwright';
import { expect, openCart, test } from './fixtures';

const PAGES: [string, string, boolean?][] = [
  ['naslovnica', '/'],
  ['katalog', '/katalog/'],
  ['katalog-zeleni', '/katalog/zeleni/?okus=cvjetni'],
  ['proizvod', '/proizvod/bai-mu-dan-wang/'],
  ['proizvod-rasprodan', '/proizvod/puer-sheng-2007-yiwu-jing-long/'],
  ['o-nama', '/o-nama/'],
  ['kontakt', '/kontakt/'],
  ['povrat', '/povrat/'],
  ['kosarica', '/kosarica/', true],
  ['kosarica-prazna', '/kosarica/'],
  ['uspjeh-bez-tokena', '/narudzba/uspjeh/'],
  ['404', '/ne-postoji/'],
];

const cart = JSON.stringify({ v: 1, lines: [{ sku: 'CSTB-2', qty: 2 }, { sku: 'CSTVI-150', qty: 1 }], updatedAt: '' });

for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  for (const [name, path, withCart] of PAGES) {
    test(`axe ${name} @${w}`, async ({ page, ctl }, info) => {
      test.skip(info.project.name !== 'demo', 'isti UI; dovoljno nad jednim adapterom');
      void ctl;
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: w!, height: h! });
      if (withCart) await page.evaluate((c) => localStorage.setItem('cs.cart.v1', c), cart);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.querySelectorAll('.rv').forEach((el) => el.classList.add('in')));
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const bad = r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`);
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
}

test('axe ladica košarice otvorena', async ({ page, ctl }, info) => {
  test.skip(info.project.name !== 'demo', 'isti UI');
  void ctl;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate((c) => localStorage.setItem('cs.cart.v1', c), cart);
  await page.goto('/katalog/');
  await expect(page.locator('.cartp')).toHaveAccessibleName(/^Košarica ?, artikala: 3$/);
  await openCart(page);
  await page.waitForTimeout(700);
  const r = await new AxeBuilder({ page }).include('.x-drawer').withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
  expect(bad).toEqual([]);
});

test('axe blagajna (demo)', async ({ page, ctl }, info) => {
  test.skip(info.project.name !== 'demo', 'blagajna postoji samo u demo buildu');
  void ctl;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/proizvod/bai-mu-dan-wang/');
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('1');
  await page.goto('/kosarica/');
  await page.locator('#sadrzaj').getByRole('button', { name: /Na blagajnu/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Blagajna' })).toBeVisible();
  await page.getByRole('button', { name: /^Plati karticom/ }).click(); // stanje s greškama
  await page.waitForTimeout(300);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(bad, bad.join('\n')).toEqual([]);
});
