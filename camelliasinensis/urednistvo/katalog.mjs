// Katalog iz uredništva (podaci/katalog.json): oblik, provjera, početni sadržaj i pretvorba u oblik stranice
// (fixtures/products.json, API-CONTRACT §2). Čisti JS: dijele ga build stranice (scripts/data-to-fixtures.mjs)
// i Node uredništvo. PHP uredništvo (urednistvo/php/lib/sadrzaj.php) provjerava po istim pravilima.
//
// Oblik datoteke:
// { format: 1, verzija, azurirano, azurirao,
//   vrste: [{ kljuc, naziv, opis }],                     redoslijed = redoslijed na stranici; ključevi su stalni
//   proizvodi: [{ id, sku, slug, naziv, vrsta, podrijetlo, tein, okusi, oblik, cijena, pakiranje, namjene,
//                 oznake, priprema, opis, zaliha, objavljeno, slika }],
//   izdvojeno: { polica: [sku, …] } }
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readDataJs } from '../scripts/lib/read-data-js.mjs';

export const FORMAT = 1;
export const VRSTE = ['bijeli', 'zeleni', 'oolong', 'crni', 'puer', 'aroma', 'biljni', 'pribor'];
export const OKUSI = {
  cvjetni: 'Cvjetni', vocni: 'Voćni', travnati: 'Travnati', orasasti: 'Orašasti', slatkasti: 'Slatkasti', zemljani: 'Zemljani',
  dimljeni: 'Dimljeni', zacinski: 'Začinski', citrusni: 'Citrusni', sladni: 'Sladni', mentolni: 'Mentolni', drvenasti: 'Drvenasti', medeni: 'Medeni',
};
export const NAMJENE = { jutro: 'Za jutro', fokus: 'Za fokus', opust: 'Za opuštanje', vecer: 'Za večer', poklon: 'Za poklon' };
export const OBLICI = { rastresiti: 'Rastresiti listovi', kolac: 'Prešani kolač', prah: 'Prah (matcha)', pribor: 'Pribor' };
export const OZNAKE = { bio: 'Organski', rijetko: 'Rijetko', novo: 'Novo' };
export const TEIN = ['Bez teina', 'Malo teina', 'Srednje teina', 'Puno teina'];
export const NAJVISE_NA_POLICI = 12;
export const NAJVISE_PO_NARUDZBI = 20;

/** ključ slike: postojeća fotografija proizvoda (design-reference/img/<SKU>.jpg) ili učitana u uredništvu (n-<24 hex>) */
export const KLJUC_SLIKE = /^(?:[A-Za-z0-9._-]{1,64}|n-[a-f0-9]{24})$/;
export const SKU = /^[A-Za-z0-9._-]{1,64}$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const noviId = () => crypto.randomBytes(6).toString('hex');

export function slugify(name) {
  return String(name ?? '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** u čaju se govori o teinu (Daniel, 2. 11. 2026.) */
export const uTein = (s) => String(s ?? '').replace(/([Kk])ofein/g, (_, k) => (k === 'K' ? 'Tein' : 'tein'));

// ---------------- početni sadržaj iz prototipa (design-reference/src/data.js) ----------------
const DEMO_ZALIHA = { 'CSTVI-150': 0, 'CSTHG-32': 2 }; // samo demo; knjiga (CSLI-2) više nije objavljena
const POCETNA_POLICA = ['CSTVI-282', 'CSTV-237', 'CSTN-220', 'CSTW-1', 'CSTB-6', 'CSTP-88', 'CSTHJC-79', 'CSTN-97', 'CSTO-2'];

export function pocetniKatalog(root) {
  const { TYPES, BREW, RAW } = readDataJs(path.join(root, 'design-reference/src/data.js'));
  const slug = new Set();
  const proizvodi = RAW.map((r) => {
    const [sku, naziv, vrsta, podrijetlo, lv, okusi, oblik, cijena, pakiranje, namjene, oznake, brewKey, opis] = r;
    let s = slugify(naziv);
    if (slug.has(s)) s = `${s}-${slugify(sku)}`;
    slug.add(s);
    const b = brewKey ? BREW[brewKey] : null;
    return {
      // stalan id iz SKU-a: build bez uredništva daje uvijek iste podatke
      id: crypto.createHash('sha1').update(sku).digest('hex').slice(0, 12),
      sku,
      slug: s,
      naziv,
      vrsta,
      podrijetlo: podrijetlo || '',
      tein: lv >= 0 ? lv : null,
      okusi: [...okusi],
      oblik,
      cijena: Number(cijena),
      pakiranje,
      namjene: [...namjene],
      oznake: String(oznake).split(',').map((f) => ({ b: 'bio', r: 'rijetko', n: 'novo' })[f.trim()]).filter(Boolean),
      priprema: b ? { temp: b[0], vrijeme: b[1], kolicina: b[2] } : null,
      opis: uTein(opis),
      zaliha: DEMO_ZALIHA[sku] ?? 24,
      objavljeno: true,
      slika: fs.existsSync(path.join(root, 'design-reference/img', `${sku}.jpg`)) ? sku : null,
    };
  });
  return uskladi({
    format: FORMAT,
    verzija: 1,
    azurirano: new Date().toISOString(),
    azurirao: 'početni sadržaj',
    vrste: Object.entries(TYPES).map(([kljuc, t]) => ({ kljuc, naziv: t.n, opis: uTein(t.d) })),
    proizvodi,
    izdvojeno: { polica: POCETNA_POLICA.filter((s) => proizvodi.some((p) => p.sku === s)) },
  });
}

// ---------------- usklađivanje starijih kataloga ----------------
// 13. 11. 2026. (Daniel): vrsta "pribor" zove se samo "Pribor", knjige nisu u ponudi.
const PRIBOR_STARO = { naziv: 'Pribor i knjige', opis: 'Gaiwani, setovi za matchu, daske, knjiga.' };
const PRIBOR_NOVO = { naziv: 'Pribor', opis: 'Gaiwani, setovi za matchu i čajne daske.' };
const jeKnjiga = (p) => p?.vrsta === 'pribor' && (/^knjiga\b/i.test(String(p.naziv ?? '')) || String(p.slug ?? '').startsWith('knjiga-'));

/**
 * Katalog spremljen prije 13. 11. 2026. ima vrstu "Pribor i knjige" i objavljenu knjigu. Usklađuje se pri čitanju
 * (gradnja stranice, uredništvo), pa ga ne treba ručno mijenjati: vrsta postaje "Pribor", knjiga se skida s objave
 * (ne briše se; urednik je može ponovno objaviti) i s police. Radi samo dok vrsta ima stari naziv, a novi katalog
 * vraća nepromijenjen. Ista pravila: uskladi_katalog() u urednistvo/php/lib/sadrzaj.php.
 */
export function uskladi(k) {
  if (!k || typeof k !== 'object' || !Array.isArray(k.vrste) || !Array.isArray(k.proizvodi)) return k;
  const v = k.vrste.find((x) => x?.kljuc === 'pribor');
  if (!v || v.naziv !== PRIBOR_STARO.naziv) return k;
  const knjige = new Set(k.proizvodi.filter(jeKnjiga).map((p) => p.sku));
  return {
    ...k,
    vrste: k.vrste.map((x) => (x === v ? { ...x, naziv: PRIBOR_NOVO.naziv, opis: x.opis === PRIBOR_STARO.opis ? PRIBOR_NOVO.opis : x.opis } : x)),
    proizvodi: k.proizvodi.map((p) => (jeKnjiga(p) ? { ...p, objavljeno: false } : p)),
    izdvojeno: { ...k.izdvojeno, polica: Array.isArray(k.izdvojeno?.polica) ? k.izdvojeno.polica.filter((s) => !knjige.has(s)) : k.izdvojeno?.polica },
  };
}

// ---------------- provjera ----------------
const tekst = (v, max) => typeof v === 'string' && v.trim().length <= max;
const dvijeDecimale = (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

/**
 * Provjerava i normalizira katalog. Vraća { ok, sadrzaj, greske: [{ putanja, poruka }] }.
 * @param {(kljuc: string) => boolean} [slikaPostoji]
 */
export function provjeri(k, slikaPostoji = () => true) {
  const g = [];
  const greska = (putanja, poruka) => g.push({ putanja, poruka });
  if (!k || typeof k !== 'object') return { ok: false, greske: [{ putanja: [], poruka: 'Neispravan katalog' }] };
  if (k.format !== FORMAT) greska(['format'], 'Nepoznat format kataloga');
  if (!Number.isInteger(k.verzija) || k.verzija < 1) greska(['verzija'], 'Neispravna verzija');

  // vrste: točno 8 poznatih ključeva (boje i stranice po vrsti su u kodu), redoslijed je slobodan
  const vrste = Array.isArray(k.vrste) ? k.vrste : [];
  const kljucevi = vrste.map((v) => v?.kljuc);
  if (vrste.length !== VRSTE.length || !VRSTE.every((x) => kljucevi.includes(x))) greska(['vrste'], 'Vrste čaja moraju biti točno: ' + VRSTE.join(', '));
  vrste.forEach((v, i) => {
    if (!tekst(v?.naziv, 40) || !v.naziv.trim()) greska(['vrste', i, 'naziv'], 'Upiši naziv vrste (najviše 40 znakova)');
    if (!tekst(v?.opis, 200)) greska(['vrste', i, 'opis'], 'Opis vrste je predug (najviše 200 znakova)');
  });

  const proizvodi = Array.isArray(k.proizvodi) ? k.proizvodi : [];
  if (proizvodi.length > 1000) greska(['proizvodi'], 'Previše proizvoda');
  const skus = new Set();
  const slugs = new Set();
  const ids = new Set();
  proizvodi.forEach((p, i) => {
    const P = (...x) => ['proizvodi', i, ...x];
    if (!p || typeof p !== 'object') return greska(P(), 'Neispravan proizvod');
    if (typeof p.id !== 'string' || !/^[a-z0-9]{6,32}$/.test(p.id) || ids.has(p.id)) greska(P('id'), 'Neispravan id');
    ids.add(p.id);
    if (typeof p.sku !== 'string' || !SKU.test(p.sku)) greska(P('sku'), 'Šifra (SKU): slova, brojke, točka, crtica, najviše 64 znaka');
    else if (skus.has(p.sku)) greska(P('sku'), `Šifra ${p.sku} već postoji`);
    skus.add(p.sku);
    if (typeof p.slug !== 'string' || !SLUG.test(p.slug)) greska(P('slug'), 'Adresa: mala slova, brojke i crtice');
    else if (slugs.has(p.slug)) greska(P('slug'), 'Ta adresa već postoji');
    slugs.add(p.slug);
    if (!tekst(p.naziv, 120) || !p.naziv.trim()) greska(P('naziv'), 'Upiši naziv (najviše 120 znakova)');
    if (!VRSTE.includes(p.vrsta)) greska(P('vrsta'), 'Odaberi vrstu');
    if (!tekst(p.podrijetlo, 60)) greska(P('podrijetlo'), 'Podrijetlo je predugo');
    if (!(p.tein === null || [0, 1, 2, 3].includes(p.tein))) greska(P('tein'), 'Razina teina 0–3 ili bez oznake');
    if (!Array.isArray(p.okusi) || !p.okusi.every((x) => x in OKUSI)) greska(P('okusi'), 'Nepoznat okus');
    if (!Array.isArray(p.namjene) || !p.namjene.every((x) => x in NAMJENE)) greska(P('namjene'), 'Nepoznata namjena');
    if (!(p.oblik in OBLICI)) greska(P('oblik'), 'Odaberi oblik');
    if (!Array.isArray(p.oznake) || !p.oznake.every((x) => x in OZNAKE)) greska(P('oznake'), 'Nepoznata oznaka');
    if (typeof p.cijena !== 'number' || !(p.cijena > 0) || p.cijena > 9999 || !dvijeDecimale(p.cijena)) greska(P('cijena'), 'Cijena mora biti veća od 0, najviše dvije decimale');
    if (!tekst(p.pakiranje, 40) || !p.pakiranje.trim()) greska(P('pakiranje'), 'Upiši pakiranje (npr. 50 g)');
    if (p.priprema !== null && !(p.priprema && ['temp', 'vrijeme', 'kolicina'].every((x) => tekst(p.priprema[x], 40)))) greska(P('priprema'), 'Neispravna priprema');
    if (!tekst(p.opis, 2000) || !p.opis.trim()) greska(P('opis'), 'Upiši opis (najviše 2000 znakova)');
    if (!(p.zaliha === null || (Number.isInteger(p.zaliha) && p.zaliha >= 0 && p.zaliha <= 100000))) greska(P('zaliha'), 'Zaliha je cijeli broj ≥ 0 (ili prazno = ne broji se)');
    if (typeof p.objavljeno !== 'boolean') greska(P('objavljeno'), 'Neispravno');
    if (!(p.slika === null || (typeof p.slika === 'string' && KLJUC_SLIKE.test(p.slika) && slikaPostoji(p.slika)))) greska(P('slika'), 'Fotografija ne postoji');
  });
  if (!proizvodi.some((p) => p?.objavljeno)) greska(['proizvodi'], 'Barem jedan proizvod mora biti objavljen');

  const polica = Array.isArray(k.izdvojeno?.polica) ? k.izdvojeno.polica : null;
  if (!polica) greska(['izdvojeno', 'polica'], 'Neispravan popis');
  else {
    if (polica.length > NAJVISE_NA_POLICI) greska(['izdvojeno', 'polica'], `Na polici može biti najviše ${NAJVISE_NA_POLICI} proizvoda`);
    if (new Set(polica).size !== polica.length) greska(['izdvojeno', 'polica'], 'Proizvod je na polici dvaput');
    polica.forEach((s, i) => {
      const p = proizvodi.find((x) => x?.sku === s);
      if (!p) greska(['izdvojeno', 'polica', i], `Proizvod ${s} ne postoji`);
      else if (!p.objavljeno) greska(['izdvojeno', 'polica', i], `${p.naziv} nije objavljen`);
    });
  }
  if (g.length) return { ok: false, greske: g };

  const trim = (s) => s.trim();
  const sadrzaj = {
    format: FORMAT,
    verzija: k.verzija,
    azurirano: String(k.azurirano ?? '').slice(0, 40),
    azurirao: String(k.azurirao ?? '').slice(0, 40),
    vrste: vrste.map((v) => ({ kljuc: v.kljuc, naziv: trim(v.naziv), opis: trim(v.opis) })),
    proizvodi: proizvodi.map((p) => ({
      id: p.id, sku: p.sku, slug: p.slug, naziv: trim(p.naziv), vrsta: p.vrsta, podrijetlo: trim(p.podrijetlo), tein: p.tein,
      okusi: [...new Set(p.okusi)], oblik: p.oblik, cijena: Math.round(p.cijena * 100) / 100, pakiranje: trim(p.pakiranje),
      namjene: [...new Set(p.namjene)], oznake: [...new Set(p.oznake)],
      priprema: p.priprema ? { temp: trim(p.priprema.temp), vrijeme: trim(p.priprema.vrijeme), kolicina: trim(p.priprema.kolicina) } : null,
      opis: trim(p.opis), zaliha: p.zaliha, objavljeno: p.objavljeno, slika: p.slika,
    })),
    izdvojeno: { polica: [...polica] },
  };
  return { ok: true, sadrzaj, greske: [] };
}

// ---------------- pretvorba u oblik stranice (API-CONTRACT §2) ----------------
const LOW_AT = 3;
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stanje(zaliha) {
  if (zaliha === null) return { status: 'instock', quantity: null, maxPerOrder: NAJVISE_PO_NARUDZBI };
  const status = zaliha <= 0 ? 'outofstock' : zaliha <= LOW_AT ? 'low' : 'instock';
  return { status, quantity: zaliha, maxPerOrder: NAJVISE_PO_NARUDZBI };
}

/**
 * @param {{ vrste, proizvodi, izdvojeno, azurirano }} k  provjereni katalog
 * @param {(p) => { width: number, height: number } | null} dimenzije  dimenzije fotografije proizvoda
 */
export function uOblikStranice(k, dimenzije) {
  const redVrste = Object.fromEntries(k.vrste.map((v, i) => [v.kljuc, i]));
  const products = k.proizvodi
    .map((p, i) => ({ p, i }))
    .sort((a, b) => redVrste[a.p.vrsta] - redVrste[b.p.vrsta] || a.i - b.i)
    .map(({ p }) => {
      const dim = p.slika ? dimenzije(p) : null;
      return {
        id: `cs-${p.id}`,
        sku: p.sku,
        slug: p.slug,
        name: p.naziv,
        type: p.vrsta,
        unitLabel: p.pakiranje,
        price: { amount: Math.round(p.cijena * 100), currency: 'EUR' },
        taxIncluded: true,
        descriptionHtml: p.opis.split(/\n{2,}/).map((x) => `<p>${escapeHtml(x.trim())}</p>`).join(''),
        images: dim ? [{ src: `/img/p/${p.sku}.jpg`, alt: p.naziv, width: dim.width, height: dim.height }] : [],
        attributes: {
          ...(p.podrijetlo ? { origin: p.podrijetlo } : {}),
          ...(p.tein !== null ? { caffeine: p.tein } : {}),
          flavors: p.okusi,
          form: p.oblik,
          moods: p.namjene,
          badges: p.oznake,
          ...(p.priprema ? { brew: { temp: p.priprema.temp, time: p.priprema.vrijeme, dose: p.priprema.kolicina } } : {}),
        },
        stock: stanje(p.zaliha),
        published: p.objavljeno,
        updatedAt: k.azurirano || new Date(0).toISOString(),
      };
    });
  return {
    types: k.vrste.map((v) => ({ key: v.kljuc, name: v.naziv, description: v.opis })),
    products,
    izdvojeno: { polica: k.izdvojeno.polica },
  };
}
