// Funkcionalni E2E (GUIDE §4.4) nad oba adaptera; plaćanje je FAKE (demo stranica ili mock-server).
import { cartLines, expect, expectPaymentPage, onPaymentPage, openCart, test } from './fixtures';

const BAI = { sku: 'CSTB-2', slug: 'bai-mu-dan-wang', name: 'Bai Mu Dan Wang' };
const HUI = { sku: 'CSTV-18', slug: 'huiming', name: 'Huiming' };
const SOLD = { sku: 'CSTVI-150', slug: 'puer-sheng-2007-yiwu-jing-long' };

test('1. naslovnica bez grešaka u konzoli; linkovi navigacije vode na 200', async ({ page, ctl, consoleErrors, request }) => {
  void ctl;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dobro došli');
  const hrefs = await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  for (const h of hrefs) expect((await request.get(h!)).status(), h!).toBe(200);
  await page.waitForLoadState('networkidle');
  expect(consoleErrors).toEqual([]);
});

test('2. katalog: vrsta i okus sužavaju, URL se ažurira, "Očisti" vraća sve', async ({ page, ctl }) => {
  void ctl;
  await page.goto('/katalog/');
  const count = page.locator('.x-count');
  await expect(count).toHaveText('Prikazano 1–12 od 71');
  await page.getByRole('checkbox', { name: /Zeleni čaj/ }).check();
  await expect(count).toHaveText('Prikazano 1–12 od 12');
  await expect(page).toHaveURL(/vrsta=zeleni/);
  await page.getByRole('button', { name: /^Cvjetni/ }).click();
  await expect(page).toHaveURL(/okus=cvjetni/);
  const n = Number((await count.textContent())!.match(/od (\d+)/)![1]);
  expect(n).toBeLessThan(12);
  expect(n).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Ukloni filtar: Cvjetni' })).toBeVisible();
  await page.getByRole('button', { name: 'Očisti', exact: true }).click();
  await expect(count).toHaveText('Prikazano 1–12 od 71');
  await expect(page).toHaveURL(/\/katalog\/$/);
});

test('2b. direktno otvaranje /katalog/zeleni/ i filtra iz URL-a', async ({ page, ctl }) => {
  void ctl;
  await page.goto('/katalog/zeleni/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zeleni čaj');
  await expect(page.locator('.x-count')).toHaveText('Prikazano 1–12 od 12');
  await page.goto('/katalog/?tein=0&namjena=vecer');
  await expect(page.locator('.x-grid .pc').first()).toBeVisible();
  const n = Number((await page.locator('.x-count').textContent())!.match(/od (\d+)/)![1]);
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(71);
});

test('3. proizvod: cijena i zaliha; HTML ima sadržaj bez JavaScripta', async ({ page, ctl, request }) => {
  void ctl;
  const html = await (await request.get(`/proizvod/${BAI.slug}/`)).text();
  expect(html).toContain(`<h1 class="x-ptitle">${BAI.name}</h1>`);
  expect(html).toMatch(/11,90\s*€/);
  expect(html).toContain('Klasični kineski bijeli čaj');
  expect(html).toContain('"@type":"Product"');
  await page.goto(`/proizvod/${BAI.slug}/`);
  await expect(page.getByTestId('price')).toContainText('11,90');
  await expect(page.getByTestId('stock')).toHaveText('Na zalihi');
});

test('3b. rasprodan proizvod ima onemogućen gumb; malo zalihe se jasno vidi', async ({ page, ctl }) => {
  void ctl;
  await page.goto(`/proizvod/${SOLD.slug}/`);
  await expect(page.getByTestId('stock')).toHaveText('Nema na zalihi');
  await expect(page.getByTestId('add-to-cart')).toBeDisabled();
  await page.goto('/proizvod/knjiga-tea-history-terroirs-varieties/');
  await expect(page.getByTestId('stock')).toHaveText('Zadnja 2 komada');
});

test('4. košarica: dodaj 2, promijeni, ukloni; ostaje nakon osvježavanja', async ({ page, ctl }) => {
  void ctl;
  await page.goto(`/proizvod/${BAI.slug}/`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.x-toast')).toContainText(`${BAI.name} je u košarici`);
  await page.goto(`/proizvod/${HUI.slug}/`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('2');
  const d = await openCart(page);
  await d.getByRole('button', { name: `Povećaj količinu: ${BAI.name}` }).click();
  await expect(d.getByTestId('subtotal')).toHaveText(/37,70/); // 2 × 11,90 + 13,90
  await d.getByRole('button', { name: `Ukloni ${HUI.name} iz košarice` }).click();
  await expect(d.getByTestId('subtotal')).toHaveText(/23,80/);
  await page.reload();
  expect(await cartLines(page)).toEqual([{ sku: BAI.sku, qty: 2 }]);
  await expect(page.locator('.badge')).toHaveText('2');
});

test('5. zaliha se promijeni tijekom sesije: dodavanje vraća grešku i UI je lijepo prikaže', async ({ page, ctl }) => {
  await page.goto(`/proizvod/${BAI.slug}/`);
  await expect(page.getByTestId('stock')).toHaveText('Na zalihi');
  await ctl.setStock(BAI.sku, 0);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('buy-msg')).toHaveText('Ovaj artikl je upravo rasprodan.');
  await expect(page.getByTestId('stock')).toHaveText('Nema na zalihi');
  expect(await cartLines(page)).toEqual([]);
});

test('5b. u košarici se količina ograniči kad zaliha padne, a rasprodan redak blokira plaćanje', async ({ page, ctl }) => {
  await page.goto(`/proizvod/${BAI.slug}/`);
  await page.getByRole('button', { name: 'Više' }).click();
  await page.getByRole('button', { name: 'Više' }).click();
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('3');
  await ctl.setStock(BAI.sku, 2);
  await page.goto('/kosarica/');
  await expect(page.locator('#sadrzaj').getByText('Nažalost, od ovog artikla imamo još samo 2.', { exact: false })).toBeVisible();
  await expect.poll(() => cartLines(page)).toEqual([{ sku: BAI.sku, qty: 2 }]);
  await ctl.setStock(BAI.sku, 0);
  await page.reload();
  await expect(page.locator('#sadrzaj').getByText('Ovaj artikl je upravo rasprodan.')).toBeVisible();
  await expect(page.locator('#sadrzaj').getByRole('button', { name: /Na blagajnu/ })).toBeDisabled();
});

test('5c. promjena cijene traži potvrdu prije plaćanja', async ({ page, ctl }) => {
  await page.goto(`/proizvod/${BAI.slug}/`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('1');
  await ctl.setPrice(BAI.sku, 1350);
  await page.goto('/kosarica/');
  await expect(page.locator('#sadrzaj').getByText('Cijena je promijenjena: bila je 11,90', { exact: false })).toBeVisible();
  const main = page.locator('#sadrzaj');
  await expect(main.getByRole('button', { name: /Na blagajnu/ })).toBeDisabled();
  await main.getByRole('button', { name: 'Prihvaćam nove cijene' }).click();
  await expect(main.getByRole('button', { name: /Na blagajnu/ })).toBeEnabled();
  await expect(main.getByTestId('subtotal')).toHaveText(/13,50/);
});

test('6. otkazivanje vraća na /kosarica/?otkazano=1 s netaknutom košaricom', async ({ page, ctl }) => {
  void ctl;
  await page.goto(`/proizvod/${BAI.slug}/`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('1');
  await page.goto('/kosarica/');
  await page.locator('#sadrzaj').getByRole('button', { name: /Na blagajnu/ }).click();
  await expectPaymentPage(page);
  await onPaymentPage(page, 'cancel');
  await expect(page).toHaveURL(/\/kosarica\/\?otkazano=1$/);
  await expect(page.getByTestId('cancelled')).toBeVisible();
  expect(await cartLines(page)).toEqual([{ sku: BAI.sku, qty: 1 }]);
});

test('6b. uspješno plaćanje: potvrda tek kad je paid, košarica se tada briše', async ({ page, ctl }) => {
  void ctl;
  await page.goto(`/proizvod/${BAI.slug}/`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('1');
  const d = await openCart(page);
  await d.getByRole('button', { name: /Na blagajnu/ }).click();
  await expectPaymentPage(page);
  // košarica se NE briše pri polasku na plaćanje
  await page.goto('/kosarica/');
  expect(await cartLines(page)).toEqual([{ sku: BAI.sku, qty: 1 }]);
  await page.goBack();
  await onPaymentPage(page, 'pay');
  await expect(page).toHaveURL(/\/narudzba\/uspjeh\/\?narudzba=[0-9a-f]{32,}/);
  await expect(page.getByTestId('order-result')).toHaveAttribute('data-state', 'paid');
  await expect(page.getByRole('heading', { name: 'Hvala na narudžbi!' })).toBeVisible();
  expect(await cartLines(page)).toEqual([]);
});

test('6c. /narudzba/uspjeh/ bez valjanog tokena ne prikazuje potvrdu i ne briše košaricu', async ({ page, ctl }) => {
  void ctl;
  await page.goto(`/proizvod/${BAI.slug}/`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('1');
  await page.goto('/narudzba/uspjeh/');
  await expect(page.getByTestId('order-result')).toHaveAttribute('data-state', 'unknown');
  await page.goto(`/narudzba/uspjeh/?narudzba=${'ab'.repeat(24)}`);
  await expect(page.getByTestId('order-result')).toHaveAttribute('data-state', 'unknown');
  await expect(page.getByText('Hvala na narudžbi!')).toHaveCount(0);
  expect(await cartLines(page)).toEqual([{ sku: BAI.sku, qty: 1 }]);
});

test('7. nepoznata putanja vraća aplikaciju s 404 stranicom', async ({ page }) => {
  await page.goto('/ovo-ne-postoji/');
  await expect(page.getByRole('heading', { name: 'Ova stranica ne postoji' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
});

test('8. mobitel 390 px: donja navigacija, hero čitljiv, ciljevi dodira ≥ 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Glavna navigacija' });
  const box = (await nav.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(844 - 40); // pri dnu zaslona
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  const small = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>('header a, header button, nav a, .pc .plus, .pill, .x-btn').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.height < 44 || r.width < 44)) out.push(`${el.tagName} ${el.className} ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    return out;
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('demo build nikad nije za indeksiranje', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  expect(await (await request.get('/robots.txt')).text()).toMatch(/Disallow: \//);
});

test('bez grešaka u konzoli (uključujući CSP) na svim vrstama stranica', async ({ page, ctl, consoleErrors }) => {
  void ctl;
  for (const path of ['/', '/katalog/', '/katalog/puer/', `/proizvod/${BAI.slug}/`, '/o-nama/', '/kosarica/', '/narudzba/uspjeh/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  await page.getByRole('link', { name: 'Katalog', exact: true }).first().click(); // klijentska navigacija (RSC prefetch)
  await page.waitForLoadState('networkidle');
  expect(consoleErrors).toEqual([]);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).not.toContain('unsafe-inline\' \'self\'; style');
});
