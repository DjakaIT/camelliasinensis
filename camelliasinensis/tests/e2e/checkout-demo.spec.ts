// Cijeli tok naplate u demo buildu: blagajna demo backenda s GLS dostavom i testnim karticama.
import { cartLines, expect, fillDemoCheckout, test } from './fixtures';

const BAI = { sku: 'CSTB-2', slug: 'bai-mu-dan-wang' }; // 11,90 €
const SET = { slug: 'set-za-matchu-focus' }; // 59,00 €

test.beforeEach(({ browserName }, info) => {
  void browserName;
  test.skip(info.project.name !== 'demo', 'blagajna /blagajna/ postoji samo u demo buildu');
});

async function toCheckout(page: import('@playwright/test').Page, slug: string, qty = 1) {
  await page.goto(`/proizvod/${slug}/`);
  for (let i = 1; i < qty; i++) await page.getByRole('button', { name: 'Više' }).click();
  await page.getByTestId('add-to-cart').click();
  await expect(page.locator('.badge')).toHaveText(String(qty));
  await page.goto('/kosarica/');
  await page.locator('#sadrzaj').getByRole('button', { name: /Na blagajnu/ }).click();
  await expect(page).toHaveURL(/\/blagajna\/\?t=[0-9a-f]{32,}/);
  await expect(page.getByRole('heading', { level: 1, name: 'Blagajna' })).toBeVisible();
}

test('validacija: prazna forma pokazuje greške i ne plaća', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await page.getByRole('button', { name: /^Plati karticom/ }).click();
  await expect(page.getByRole('alert').first()).toContainText('Molimo ispravite');
  await expect(page.getByLabel('Ime i prezime')).toBeFocused();
  await expect(page.getByLabel('Ime i prezime')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/blagajna\//);
  expect(await cartLines(page)).toEqual([{ sku: BAI.sku, qty: 1 }]);
});

test('dostava: paketomat 3,90 €, adresa 4,90 €, ukupno se mijenja', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await expect(page.getByTestId('co-shipping')).toHaveText(/3,90/);
  await expect(page.getByTestId('co-total')).toHaveText(/15,80/);
  await page.getByRole('radio', { name: /GLS na adresu/ }).check();
  await expect(page.getByTestId('co-shipping')).toHaveText(/4,90/);
  await expect(page.getByTestId('co-total')).toHaveText(/16,80/);
  await expect(page.getByText('do besplatne dostave', { exact: false }).first()).toBeVisible();
});

test('besplatna dostava od 50 €', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, SET.slug); // 59,00 €
  await expect(page.getByTestId('co-shipping')).toHaveText('Besplatno');
  await expect(page.getByTestId('co-total')).toHaveText(/59,00/);
});

test('uspješno plaćanje karticom: potvrda s maskiranim e-mailom, košarica prazna, zaliha umanjena', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug, 2);
  await fillDemoCheckout(page);
  await page.getByRole('button', { name: /^Plati karticom · 28,70/ }).click(); // 2 × 11,90 + 4,90
  await expect(page).toHaveURL(/\/narudzba\/uspjeh\/\?narudzba=/);
  await expect(page.getByRole('heading', { name: 'Hvala na narudžbi!' })).toBeVisible();
  await expect(page.getByText('a***@example.com')).toBeVisible();
  await expect(page.getByText(/DEMO-\d{4}/)).toBeVisible();
  expect(await cartLines(page)).toEqual([]);
  const stock = await page.evaluate(() => JSON.parse(localStorage.getItem('cs.demo.v1')!).stock['CSTB-2'].quantity);
  expect(stock).toBe(22);
  // osobni podaci se ne spremaju u preglednik
  const raw = await page.evaluate(() => localStorage.getItem('cs.demo.v1'));
  expect(raw).not.toContain('Ana Horvat');
  expect(raw).not.toContain('ana.horvat@example.com');
  expect(raw).not.toContain('4242');
});

test('odbijena kartica: jasna poruka, ostaje na blagajni, ništa nije plaćeno', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await fillDemoCheckout(page, '4000 0000 0000 0002');
  await page.getByRole('button', { name: /^Plati karticom/ }).click();
  await expect(page.getByTestId('pay-error')).toHaveText(/Kartica je odbijena/);
  await expect(page).toHaveURL(/\/blagajna\//);
  expect(await cartLines(page)).toEqual([{ sku: BAI.sku, qty: 1 }]);
});

test('3D Secure: potvrda banke pa uspjeh', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await fillDemoCheckout(page, '4000 0027 6000 3184');
  await page.getByRole('button', { name: /^Plati karticom/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Potvrda banke (test)' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Potvrdi' }).click();
  await expect(page.getByRole('heading', { name: 'Hvala na narudžbi!' })).toBeVisible();
});

test('stvarna kartica se ne prihvaća u testnom načinu', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await fillDemoCheckout(page, '5555 5555 5555 4444');
  await page.getByRole('button', { name: /^Plati karticom/ }).click();
  await expect(page.getByText('Testni način: upišite testnu karticu', { exact: false }).last()).toBeVisible();
  await expect(page).toHaveURL(/\/blagajna\//);
});

test('paketomat traži mobitel i odabir paketomata; Apple Pay ne traži karticu', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await page.getByLabel('Ime i prezime').fill('Ana Horvat');
  await page.getByLabel('E-mail (za potvrdu i račun)').fill('ana@example.com');
  await page.getByRole('radio', { name: /Apple Pay/ }).check();
  await page.getByRole('checkbox', { name: /Prihvaćam/ }).check();
  await page.getByRole('button', { name: /^Plati s Apple Pay/ }).click();
  await expect(page.getByText('Za paketomat je potreban mobitel', { exact: false })).toBeVisible();
  await page.getByLabel('Mobitel (za obavijest GLS-a)').fill('091 234 5678');
  await page.getByLabel('Paketomat', { exact: true }).selectOption({ index: 2 });
  await page.getByRole('button', { name: /^Plati s Apple Pay/ }).click();
  await expect(page.getByRole('heading', { name: 'Hvala na narudžbi!' })).toBeVisible();
});

test('R1 račun traži ispravan OIB', async ({ page, ctl }) => {
  void ctl;
  await toCheckout(page, BAI.slug);
  await fillDemoCheckout(page);
  await page.getByRole('checkbox', { name: /R1 račun/ }).check();
  await page.getByLabel('Naziv tvrtke').fill('Primjer d.o.o.');
  await page.getByLabel('OIB').fill('12345678901');
  await page.getByRole('button', { name: /^Plati karticom/ }).click();
  await expect(page.getByText('OIB nije ispravan.')).toBeVisible();
  await page.getByLabel('OIB').fill('69435151530'); // ispravna kontrolna znamenka (primjer)
  await page.getByRole('button', { name: /^Plati karticom/ }).click();
  await expect(page.getByRole('heading', { name: 'Hvala na narudžbi!' })).toBeVisible();
});
