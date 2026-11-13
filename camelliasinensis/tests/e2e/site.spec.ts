// Sadržaj: klizač teina, vrste sa slikama, istaknute stavke, kontakt, pravne stranice, podnožje.
import { expect, openCart, test } from './fixtures';

test('klizač teina: bez automatskog pomicanja, mijenja se samo ručno', async ({ page }) => {
  await page.goto('/');
  const meter = page.locator('.t-caf');
  await meter.scrollIntoViewIfNeeded();
  await expect(meter.getByRole('heading', { name: /Koliko teina\?/ })).toBeVisible();
  await expect(meter.locator('.now b')).toHaveText('Malo teina');
  await page.waitForTimeout(3500); // prototip je ovdje sam pomicao klizač
  await expect(meter.locator('.now b')).toHaveText('Malo teina');
  await meter.getByRole('button', { name: 'Puno' }).click();
  await expect(meter.locator('.now b')).toHaveText('Puno teina');
  await expect(meter.getByRole('link', { name: /Svih \d+: puno teina/ })).toHaveAttribute('href', '/katalog/?tein=3');
  // mjerač govori o teinu; samo FAQ ("Imaju li čajevi kofein?") namjerno objašnjava da je tein isto što i kofein
  expect(await meter.innerText()).not.toMatch(/kofein/i);
});

test('vrste čaja imaju fotografije', async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('.types .ty');
  await expect(tiles).toHaveCount(8);
  for (let i = 0; i < 8; i++) expect(await tiles.nth(i).locator('.ty-ph img').count()).toBeGreaterThan(0);
});

test('istaknute stavke: organski, zemlje, besplatna dostava od 50 €', async ({ page }) => {
  await page.goto('/');
  const hl = page.locator('.hl');
  await expect(hl.getByText(/\d+ organskih/)).toBeVisible();
  await expect(hl.getByText(/\d+ zemalja/)).toBeVisible();
  await expect(hl.getByText('Besplatna dostava od 50 €')).toBeVisible();
});

test('košarica pokazuje koliko nedostaje do besplatne dostave', async ({ page, ctl }) => {
  void ctl;
  await page.goto('/proizvod/bai-mu-dan-wang/');
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText('1');
  const d = await openCart(page);
  await expect(d.getByTestId('free-shipping')).toContainText('Još 38,10 € do besplatne dostave');
});

test('kontakt: forma s provjerom i potvrdom slanja', async ({ page }) => {
  await page.goto('/kontakt/');
  await expect(page.getByRole('heading', { level: 1, name: 'Kontakt' })).toBeVisible();
  await expect(page.locator('#sadrzaj').getByText('info@camelliasinensis.eu').first()).toBeVisible();
  await page.getByRole('button', { name: 'Pošalji poruku' }).click();
  await expect(page.getByLabel('Ime')).toBeFocused();
  await expect(page.getByText('Upišite ime.')).toBeVisible();
  await page.getByLabel('Ime').fill('Ana');
  await page.getByLabel('E-mail').fill('ana@example.com');
  await page.getByLabel('Tema').selectOption('Preporuka čaja');
  await page.getByLabel('Poruka').fill('Inače pijem zeleni čaj, tražim nešto blaže za večer.');
  await page.getByRole('checkbox', { name: /Slažem se/ }).check();
  await page.getByRole('button', { name: 'Pošalji poruku' }).click();
  await expect(page.getByTestId('contact-sent')).toContainText('ana@example.com');
});

test('karta se učitava tek na klik', async ({ page }) => {
  await page.goto('/kontakt/');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Prikaži kartu' }).click();
  await expect(page.locator('iframe[title^="Karta"]')).toHaveCount(1);
});

test('podnožje: kontakt i pravne stranice; sve vode na 200', async ({ page, request }) => {
  await page.goto('/');
  const foot = page.locator('footer');
  // Instagram se prikazuje tek kad Sara potvrdi profil (content/site.ts, social.instagram)
  for (const name of ['Kontakt', 'Uvjeti kupnje', 'Pravila privatnosti', 'Dostava i povrat', 'Kolačići']) {
    const href = await foot.getByRole('link', { name, exact: true }).getAttribute('href');
    expect((await request.get(href!)).status(), name).toBe(200);
  }
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link', { name: 'Kontakt' })).toBeVisible();
});

test('pravne stranice imaju sadržaj i oznaku nacrta u demo/probnoj izvedbi', async ({ page }) => {
  await page.goto('/povrat/');
  await expect(page.getByRole('heading', { level: 1, name: 'Dostava i povrat' })).toBeVisible();
  await expect(page.getByText('Besplatna dostava za narudžbe od 50 €, uz poklon (platnena torba Camellia sinensis).')).toBeVisible();
  await expect(page.getByText('Nacrt teksta za demo verziju', { exact: false })).toBeVisible();
});

test('polica "Istaknuto": bez filtara, povlačenje mišem i strelice pomiču policu', async ({ page }) => {
  await page.goto('/');
  const shelf = page.locator('.shelf');
  await shelf.scrollIntoViewIfNeeded();
  await expect(page.locator('.moods')).toHaveCount(0);
  const prev = page.getByRole('button', { name: 'Prethodni proizvodi' });
  const next = page.getByRole('button', { name: 'Sljedeći proizvodi' });
  await expect(prev).toBeDisabled();
  // povlačenje mišem
  const box = (await shelf.boundingBox())!;
  await page.mouse.move(box.x + box.width - 50, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 450, box.y + 100, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => shelf.evaluate((e) => e.scrollLeft)).toBeGreaterThan(250);
  await expect(page).toHaveURL(/\/$/); // povlačenje nije otvorilo proizvod
  await expect(prev).toBeEnabled();
  // strelice
  const before = await shelf.evaluate((e) => e.scrollLeft);
  await next.click();
  await expect.poll(() => shelf.evaluate((e) => e.scrollLeft)).toBeGreaterThan(before + 200);
});
