// Brza provjera uredništva (Node pozadina) nad pokrenutim poslužiteljem: postavljanje računa, 2FA, katalog, spremanje.
// Pokretanje: npm run urednistvo (u drugom terminalu, prazna mapa podaci/), pa node tests/urednistvo/smoke.mjs [adresa]
import { totpKod, trenutniKorak } from '../../urednistvo/lib/sigurnost.mjs';

const BASE = process.argv[2] ?? 'http://localhost:3300';
let kolacic = '';
let csrf = '';
async function zahtjev(metoda, put, tijelo) {
  const r = await fetch(`${BASE}/urednistvo/api${put}`, {
    method: metoda,
    headers: {
      origin: BASE,
      'sec-fetch-site': 'same-origin',
      ...(tijelo ? { 'content-type': 'application/json' } : {}),
      ...(kolacic ? { cookie: kolacic } : {}),
      ...(csrf ? { 'x-csrf': csrf } : {}),
    },
    body: tijelo ? JSON.stringify(tijelo) : undefined,
  });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) kolacic = sc.map((c) => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metoda} ${put} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}
const ok = (uvjet, poruka) => {
  if (!uvjet) throw new Error(`NIJE PROŠLO: ${poruka}`);
  console.log(`✓ ${poruka}`);
};

const st = await zahtjev('GET', '/stanje');
ok(st.prvoPostavljanje, 'uredništvo još nije postavljeno');
const postav = await zahtjev('POST', '/postavljanje', { ime: 'daniel', lozinka: 'plava kaseta svira jazz' });
ok(postav.korak === 'postavljanje-2fa', 'lozinka postavljena, slijedi 2FA');
const kljuc = postav.kljuc.replace(/\s/g, '');
const potvrda = await zahtjev('POST', '/2fa/potvrdi', { kod: totpKod(kljuc, trenutniKorak()) });
csrf = potvrda.csrf;
ok(potvrda.rezervniKodovi?.length === 8 && potvrda.uloga === 'admin', 'prijavljen kao administrator, 8 rezervnih kodova');

const k = await zahtjev('GET', '/katalog');
ok(k.sadrzaj.proizvodi.length === 71 && k.sadrzaj.vrste.length === 8, 'katalog: 71 proizvod, 8 vrsta');
const radni = structuredClone(k.sadrzaj);
const bai = radni.proizvodi.find((p) => p.sku === 'CSTB-2');
bai.cijena = 12.5;
bai.zaliha = 7;
radni.izdvojeno.polica = ['CSTB-2', ...radni.izdvojeno.polica.filter((s) => s !== 'CSTB-2')].slice(0, 12);

let odbijeno = false;
try {
  const los = structuredClone(radni);
  los.proizvodi[0].sku = los.proizvodi[1].sku;
  await zahtjev('PUT', '/katalog', { verzija: k.sadrzaj.verzija, katalog: los });
} catch (e) {
  odbijeno = /422/.test(e.message) && /već postoji/.test(e.message);
}
ok(odbijeno, 'duplikat SKU-a se odbija (422)');

const s = await zahtjev('PUT', '/katalog', { verzija: k.sadrzaj.verzija, katalog: radni, opis: 'Bai Mu Dan Wang' });
ok(s.sadrzaj.verzija === k.sadrzaj.verzija + 1, `spremljeno kao verzija ${s.sadrzaj.verzija}`);
let sukob = false;
try {
  await zahtjev('PUT', '/katalog', { verzija: k.sadrzaj.verzija, katalog: radni });
} catch (e) {
  sukob = /409/.test(e.message);
}
ok(sukob, 'staro spremanje (stara verzija) dobiva 409');
const pov = await zahtjev('GET', '/povijest');
ok(pov[0].opis === 'Bai Mu Dan Wang', 'povijest ima opis promjene');
const ob = await zahtjev('GET', '/objava');
ok(['u-tijeku', 'spremno'].includes(ob.stanje), `objava: ${ob.stanje}`);
console.log('\nUredništvo radi. Objava (Next build) traje oko minutu; stranica: ' + BASE);
