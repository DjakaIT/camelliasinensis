// PHP trgovina (urednistvo/php/lib/trgovina.php) lokalno, sa Stripeom u TESTNOM načinu: postavljanje uredništva, Stripe
// ključ, plaćanje (Stripe Checkout testnom karticom u pregledniku), stanje narudžbe, zaliha, zivo.json, spremanje kataloga
// za vrijeme prodaje i webhook (potpis, ponavljanje). Ništa se ne naplaćuje; live ključ se odbija.
// Treba PHP 8.1+ s curl, gd, mbstring, zip, openssl. Ključ: STRIPE_TEST_KEY ili mock-server/.env (STRIPE_SECRET_KEY=sk_test_…).
// Pokretanje: PHP_BIN=putanja/do/php.exe [PHP_INI=php.ini] node tests/urednistvo/trgovina-php.mjs
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { pripremi } from '../../urednistvo/php/pripremi.mjs';
import { ROOT } from '../../urednistvo/lib/postavke.mjs';
import { totpKod, trenutniKorak } from '../../urednistvo/lib/sigurnost.mjs';

const PHP = process.env.PHP_BIN || 'php';
const PORT = 3460;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN_STRANICE = 'https://camelliasinensis.eu';
const TAJNA = 'whsec_lokalni_test_' + crypto.randomBytes(8).toString('hex');

const kljuc = (() => {
  if (process.env.STRIPE_TEST_KEY) return process.env.STRIPE_TEST_KEY;
  const env = path.join(ROOT, 'mock-server/.env');
  const m = fs.existsSync(env) ? fs.readFileSync(env, 'utf8').match(/^STRIPE_SECRET_KEY=["']?([^"'\r\n]+)/m) : null;
  return m?.[1] ?? '';
})();
if (!/^(sk|rk)_test_/.test(kljuc)) {
  console.error('Treba Stripe TEST ključ (sk_test_/rk_test_) u STRIPE_TEST_KEY ili mock-server/.env. Live ključ se ovdje nikad ne koristi.');
  process.exit(1);
}

// ---------- lokalna kopija hostinga ----------
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-trgovina-'));
const JAVNO = path.join(T, 'javno');
const U = path.join(JAVNO, 'urednistvo');
const PODACI = path.join(T, 'podaci');
fs.mkdirSync(path.join(U, 'lib'), { recursive: true });
fs.mkdirSync(path.join(U, 'static'), { recursive: true });
fs.mkdirSync(PODACI, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'urednistvo/php/index.php'), path.join(U, 'index.php'));
for (const f of fs.readdirSync(path.join(ROOT, 'urednistvo/php/lib'))) if (f.endsWith('.php')) fs.copyFileSync(path.join(ROOT, 'urednistvo/php/lib', f), path.join(U, 'lib', f));
for (const f of ['index.html', 'app.js', 'app.css', 'ikona.svg', 'qrcode.mjs']) fs.copyFileSync(path.join(ROOT, 'urednistvo/sucelje', f), path.join(U, 'static', f));
await pripremi(U, { origin: ORIGIN_STRANICE });
fs.writeFileSync(path.join(T, 'router.php'), `<?php\nif (str_starts_with((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/urednistvo')) { require ${JSON.stringify(path.join(U, 'index.php'))}; return true; }\nreturn false;\n`);

const args = [...(process.env.PHP_INI ? ['-c', process.env.PHP_INI] : []), '-S', `127.0.0.1:${PORT}`, '-t', JAVNO, path.join(T, 'router.php')];
const php = spawn(PHP, args, {
  env: { ...process.env, UREDNISTVO_LOKALNO: '1', UREDNISTVO_PODACI: PODACI, UREDNISTVO_JAVNO: JAVNO, UREDNISTVO_OSVJEZI_MS: '0', UREDNISTVO_WEBHOOK_TAJNA: TAJNA },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let phpLog = '';
php.stdout.on('data', (d) => (phpLog += d));
php.stderr.on('data', (d) => (phpLog += d));
const kraj = (kod) => {
  php.kill();
  if (kod) console.error('--- PHP log ---\n' + phpLog.split('\n').filter((l) => /error|warning|trgovina|uredništvo/i.test(l)).slice(-30).join('\n'));
  process.exit(kod);
};
for (let i = 0; i < 50; i++) {
  try {
    await fetch(`${BASE}/urednistvo/api/stanje`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ---------- pomoćne ----------
let kolacic = '';
let csrf = '';
async function zahtjev(metoda, put, tijelo, { origin = BASE, zaglavlja = {}, sirovo } = {}) {
  const r = await fetch(`${BASE}/urednistvo/api${put}`, {
    method: metoda,
    headers: {
      ...(origin ? { origin, 'sec-fetch-site': 'same-origin' } : {}),
      ...(tijelo !== undefined || sirovo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(kolacic ? { cookie: kolacic } : {}),
      ...(csrf ? { 'x-csrf': csrf } : {}),
      ...zaglavlja,
    },
    body: sirovo ?? (tijelo !== undefined ? JSON.stringify(tijelo) : undefined),
  });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) kolacic = sc.map((c) => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}
async function mora(metoda, put, tijelo, o) {
  const r = await zahtjev(metoda, put, tijelo, o);
  if (r.status >= 300) throw new Error(`${metoda} ${put} → ${r.status} ${JSON.stringify(r.j)}`);
  return r.j;
}
const ok = (uvjet, poruka) => {
  if (!uvjet) {
    console.error(`✗ ${poruka}`);
    kraj(1);
  }
  console.log(`✓ ${poruka}`);
};
const potpisi = (tijelo, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac('sha256', TAJNA).update(`${t}.${tijelo}`).digest('hex')}`;
const zaliha = (k, sku) => k.sadrzaj.proizvodi.find((p) => p.sku === sku)?.zaliha;
const zivo = () => JSON.parse(fs.readFileSync(path.join(JAVNO, 'zivo.json'), 'utf8'));

try {
  // ---------- uredništvo i plaćanje ----------
  const postav = await mora('POST', '/postavljanje', { ime: 'daniel', lozinka: 'zeleni caj u pet sati' });
  const potvrda = await mora('POST', '/2fa/potvrdi', { kod: totpKod(postav.kljuc.replace(/\s/g, ''), trenutniKorak()) });
  csrf = potvrda.csrf;
  ok(potvrda.uloga === 'admin', 'uredništvo postavljeno (administrator s 2FA)');

  const bez = await zahtjev('POST', '/trgovina/narudzba', { lines: [{ sku: 'CSTB-2', qty: 1 }], urls: { success: `${ORIGIN_STRANICE}/narudzba/uspjeh/`, cancel: `${ORIGIN_STRANICE}/kosarica/` } });
  ok(bez.status === 503 && bez.j.error?.code === 'CHECKOUT_UNAVAILABLE', 'bez Stripe ključa plaćanje je nedostupno (503 CHECKOUT_UNAVAILABLE)');

  const los = await zahtjev('POST', '/placanje', { kljuc: 'sk_test_ovo_nije_pravi_kljuc_1234567890', emailTrgovine: 'trgovina@example.com' });
  ok(los.status === 422, `neispravan ključ se odbija: ${los.j.greska}`);
  const nevazeci = await zahtjev('POST', '/placanje', { kljuc: 'sk_test_' + crypto.randomBytes(20).toString('hex'), emailTrgovine: 'trgovina@example.com' });
  ok(nevazeci.status === 422 && /ne prihvaća/.test(nevazeci.j.greska), `ključ koji Stripe ne poznaje se odbija: ${nevazeci.j.greska}`);
  const pl = await mora('POST', '/placanje', { kljuc, emailTrgovine: 'trgovina@example.com', posiljatelj: '' });
  ok(pl.ukljuceno && pl.nacin === 'test' && !JSON.stringify(pl).includes(kljuc.slice(8, 20)), 'test ključ provjeren na Stripeu (probna sesija), plaćanje uključeno; ključ se ne vraća');

  // ---------- košarica ----------
  const k0 = await mora('GET', '/katalog');
  const SKU = k0.sadrzaj.proizvodi.find((p) => p.objavljeno && Number.isInteger(p.zaliha) && p.zaliha >= 5).sku;
  const z0 = zaliha(k0, SKU);
  const urls = { success: `${ORIGIN_STRANICE}/narudzba/uspjeh/`, cancel: `${ORIGIN_STRANICE}/kosarica/?otkazano=1` };

  const tudi = await zahtjev('POST', '/trgovina/narudzba', { lines: [{ sku: SKU, qty: 1 }], urls }, { origin: 'https://zlo.example' });
  ok(tudi.status === 403, 'plaćanje se ne može pokrenuti s tuđe stranice');
  const losUrl = await zahtjev('POST', '/trgovina/narudzba', { lines: [{ sku: SKU, qty: 1 }], urls: { success: 'https://zlo.example/', cancel: urls.cancel } });
  ok(losUrl.status === 400, 'povratna adresa mora biti naša stranica');
  for (const [opis, lines, kod] of [
    ['nepoznat SKU', [{ sku: 'NEMA-1', qty: 1 }], 'UNKNOWN_SKU'],
    ['količina 0', [{ sku: SKU, qty: 0 }], 'INVALID_REQUEST'],
    ['više od zalihe', [{ sku: SKU, qty: 9999 }], 'INVALID_REQUEST'],
    ['decimalna količina', [{ sku: SKU, qty: 1.5 }], 'INVALID_REQUEST'],
  ]) {
    const r = await zahtjev('POST', '/trgovina/narudzba', { lines, urls });
    ok(r.j.error?.code === kod, `${opis} → ${kod}`);
  }

  const start = await mora('POST', '/trgovina/narudzba', { lines: [{ sku: SKU, qty: 2, amount: 1, price: 1 }], urls });
  ok(/^https:\/\/checkout\.stripe\.com\//.test(start.redirectUrl) && /^[0-9a-f]{48}$/.test(start.orderToken), 'Stripe Checkout sesija stvorena (klijentova cijena se zanemaruje)');
  const prije = await mora('GET', `/trgovina/narudzba/${start.orderToken}`, undefined, { origin: null });
  ok(prije.status === 'pending', 'narudžba čeka plaćanje');
  const nepoznat = await mora('GET', `/trgovina/narudzba/${'0'.repeat(48)}`, undefined, { origin: null });
  ok(nepoznat.status === 'unknown', 'nepoznat token → unknown');

  // ---------- plaćanje testnom karticom na Stripeovoj stranici ----------
  const preglednik = await chromium.launch();
  const str = await preglednik.newPage({ locale: 'hr-HR' });
  await str.route(`${ORIGIN_STRANICE}/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>povratak</p>' }));
  await str.goto(start.redirectUrl);
  await str.locator('#email').fill('kupac.test@example.com');
  await str.locator('#shippingName').fill('Ana Kupac');
  const zemlja = str.locator('#shippingCountry');
  if (await zemlja.count()) await zemlja.selectOption('HR').catch(() => {});
  await str.locator('#shippingAddressLine1').fill('Ilica 1');
  await str.locator('#shippingPostalCode').fill('10000');
  await str.locator('#shippingLocality').fill('Zagreb');
  await str.locator('select[name="phoneNumberCountryCode"]').selectOption('HR').catch(() => {});
  await str.locator('#phoneNumber').fill('912345678');
  await str.locator('input[name="paketomat"]').fill('GLS paketomat Ilica');
  // načini plaćanja: odaberi "Kartica" (polja kartice se tada otvore)
  await str.locator('[data-testid="card-accordion-item-button"]').dispatchEvent('click'); // prozirni gumb preko retka
  await str.locator('#cardNumber').waitFor({ timeout: 20_000 });
  await str.locator('#cardNumber').fill('4242424242424242');
  await str.locator('#cardExpiry').fill('12 / 34');
  await str.locator('#cardCvc').fill('123');
  const ime = str.locator('#billingName');
  if (await ime.count()) await ime.fill('Ana Kupac');
  // bez Stripe Linka (inače traži SMS potvrdu)
  const link = str.locator('#enableStripePass');
  if ((await link.count()) && (await link.isChecked())) await link.uncheck().catch(() => {});
  await str.locator('[data-testid="hosted-payment-submit-button"]').click();
  await str.waitForURL(`${ORIGIN_STRANICE}/**`, { timeout: 60_000 });
  const povratak = new URL(str.url());
  await preglednik.close();
  ok(povratak.searchParams.get('narudzba') === start.orderToken, 'Stripe je vratio kupca na našu stranicu s našim tokenom');

  // webhook ovdje ne stiže (localhost): stanje pita Stripe izravno, kao kad webhook kasni
  let st = { status: 'pending' };
  for (let i = 0; i < 10 && st.status === 'pending'; i++) {
    await new Promise((r) => setTimeout(r, i ? 5500 : 1000));
    st = await mora('GET', `/trgovina/narudzba/${start.orderToken}`, undefined, { origin: null });
  }
  ok(st.status === 'paid' && /^CS-\d+$/.test(st.orderRef) && st.email === 'k***@example.com', `narudžba ${st.orderRef} plaćena, e-mail maskiran (${st.email})`);

  const nar = (await mora('GET', '/narudzbe')).narudzbe.find((n) => n.id === st.orderRef);
  ok(nar.kupac.ime === 'Ana Kupac' && nar.adresa.grad === 'Zagreb' && nar.adresa.postanski === '10000', 'kupac i adresa dostave zapisani');
  ok(nar.stavke[0].kol === 2 && nar.medjuzbroj === nar.stavke[0].cijena * 2 && nar.ukupno === nar.medjuzbroj + nar.dostava.cijena, `iznosi točni: ${nar.medjuzbroj} + dostava ${nar.dostava.cijena} (${nar.dostava.naziv}) = ${nar.ukupno} centi`);
  ok(!JSON.stringify(nar).includes(start.orderToken), 'popis narudžbi u uredništvu ne otkriva token');

  const k1 = await mora('GET', '/katalog');
  ok(zaliha(k1, SKU) === z0 - 2 && k1.prodajaSeq === k0.prodajaSeq + 1, `zaliha nakon prodaje ${z0} → ${zaliha(k1, SKU)} (verzija kataloga ista: ${k1.sadrzaj.verzija === k0.sadrzaj.verzija})`);
  ok(zivo().skus[SKU].stock.quantity === z0 - 2, 'zivo.json odmah ima novu zalihu');

  // ---------- webhook ----------
  const dogadaj = JSON.stringify({ id: 'evt_test_lokalno', type: 'checkout.session.completed', data: { object: { id: nar.sesija } } });
  const krivi = await zahtjev('POST', '/stripe/webhook', undefined, { origin: null, sirovo: dogadaj, zaglavlja: { 'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` } });
  ok(krivi.status === 400, 'webhook s krivim potpisom → 400');
  const stari = await zahtjev('POST', '/stripe/webhook', undefined, { origin: null, sirovo: dogadaj, zaglavlja: { 'stripe-signature': potpisi(dogadaj, Math.floor(Date.now() / 1000) - 3600) } });
  ok(stari.status === 400, 'webhook sa zastarjelim potpisom → 400');
  const dobar = await zahtjev('POST', '/stripe/webhook', undefined, { origin: null, sirovo: dogadaj, zaglavlja: { 'stripe-signature': potpisi(dogadaj) } });
  ok(dobar.status === 200, 'webhook s ispravnim potpisom → 200');
  const k2 = await mora('GET', '/katalog');
  ok(zaliha(k2, SKU) === z0 - 2, 'ponovljena potvrda ne skida zalihu drugi put');

  // ---------- urednik sprema katalog dok se prodaje ----------
  // urednik je otvorio katalog (k1), u međuvremenu se proda još 1 komad, pa urednik spremi drugu promjenu
  const start2 = await mora('POST', '/trgovina/narudzba', { lines: [{ sku: SKU, qty: 1 }], urls });
  const nar2 = (await mora('GET', '/narudzbe')).narudzbe.find((n) => n.stanje === 'pending' && n.stavke[0].kol === 1);
  void start2;
  // drugu sesiju ne plaćamo u pregledniku: zapis prodaje kao da je stigla potvrda (isti put kao plaćanje)
  const radni = structuredClone(k1.sadrzaj);
  radni.proizvodi.find((p) => p.sku === SKU).opis += '\n\nTest uredništva.';
  const prodajaPrije = JSON.parse(fs.readFileSync(path.join(PODACI, 'prodaja.json'), 'utf8'));
  prodajaPrije.seq += 1;
  prodajaPrije.stavke.push({ seq: prodajaPrije.seq, sku: SKU, kol: 1, narudzba: nar2.id, vrijeme: new Date().toISOString() });
  fs.writeFileSync(path.join(PODACI, 'prodaja.json'), JSON.stringify(prodajaPrije));
  const spremljeno = await mora('PUT', '/katalog', { verzija: k1.sadrzaj.verzija, katalog: radni, opis: 'test', prodajaSeq: k1.prodajaSeq });
  ok(zaliha(spremljeno, SKU) === z0 - 3, `spremanje kataloga uračuna prodaju dok je urednik uređivao (${z0 - 2} upisano → ${zaliha(spremljeno, SKU)})`);
  ok(zivo().skus[SKU].stock.quantity === z0 - 3 && JSON.parse(fs.readFileSync(path.join(PODACI, 'prodaja.json'), 'utf8')).stavke.length === 0, 'nakon spremanja zapis prodaje je prazan, zivo.json točan');

  // ---------- poslano, isključivanje ----------
  const posl = await mora('POST', '/narudzbe/poslano', { id: st.orderRef, poslano: true });
  ok(!!posl.poslano, 'narudžba označena kao poslana');
  const isk = await mora('POST', '/placanje', { ukloni: true });
  ok(!isk.ukljuceno, 'plaćanje isključeno');

  console.log('\nPHP trgovina radi (Stripe test način).');
  kraj(0);
} catch (e) {
  console.error('✗', e.message);
  kraj(1);
}
