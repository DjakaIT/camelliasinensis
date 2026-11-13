// Katalog → fixtures/products.json (oblik iz API-CONTRACT §2), fixtures/demo-live.json, fixtures/izdvojeno.json.
// Izvor: <UREDNISTVO_PODACI>/katalog.json iz uredništva, SAMO kad je varijabla zadana (lokalna objava uredništva,
// GitHub Actions s grane `sadrzaj`). Inače (npm run build, testovi): početni sadržaj iz design-reference/src/data.js
// (SKU nepromijenjen, cijene su primjeri), da razvoj i testovi ne ovise o lokalnim podacima uredništva.
// Neispravan katalog (duplikat ili prazan SKU, cijena ≤ 0 …) ruši build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import sharp from 'sharp';
import { pocetniKatalog, provjeri, uOblikStranice, uskladi } from '../urednistvo/katalog.mjs';

const ROOT = resolve('.');
const PODACI = process.env.UREDNISTVO_PODACI ? resolve(process.env.UREDNISTVO_PODACI) : null;
const OUT_DIR = resolve('fixtures');
const IZ_UREDNISTVA = Boolean(PODACI && existsSync(resolve(PODACI, 'katalog.json')));

/** izvorna datoteka fotografije: učitana u uredništvu (podaci/slike) ili iz prototipa (design-reference/img) */
const izvorSlike = (kljuc) =>
  kljuc.startsWith('n-') ? resolve(PODACI ?? 'podaci', 'slike', `${kljuc}.webp`) : resolve('design-reference/img', `${kljuc}.jpg`);

// uskladi: katalog spremljen prije 13. 11. 2026. ("Pribor i knjige", objavljena knjiga) usklađuje se ovdje i u uredništvu
const katalog = uskladi(IZ_UREDNISTVA ? JSON.parse(readFileSync(resolve(PODACI, 'katalog.json'), 'utf8')) : pocetniKatalog(ROOT));
const r = provjeri(katalog, (k) => existsSync(izvorSlike(k)));
if (!r.ok) {
  console.error(
    'data-to-fixtures: katalog nije ispravan, fixture NIJE zapisan:\n  ' + r.greske.map((g) => `${g.putanja.join('.')}: ${g.poruka}`).join('\n  '),
  );
  process.exit(1);
}

const dims = {};
for (const p of r.sadrzaj.proizvodi) {
  if (!p.slika) continue;
  const m = await sharp(izvorSlike(p.slika)).metadata();
  dims[p.sku] = { width: m.width, height: m.height };
}
const { types, products, izdvojeno } = uOblikStranice(r.sadrzaj, (p) => dims[p.sku] ?? null);

mkdirSync(OUT_DIR, { recursive: true });
const note = IZ_UREDNISTVA
  ? `GENERIRANO iz uredništva (podaci/katalog.json, verzija ${r.sadrzaj.verzija}); ne uređivati ručno.`
  : 'GENERIRANO iz design-reference/src/data.js dok uredništvo nema katalog; ne uređivati ručno. ' +
    'CIJENE SU PRIMJERI IZ PROTOTIPA i ne smiju se prikazivati kao akcija ni staro/novo. ZALIHA JE IZMIŠLJENA za demo.';
writeFileSync(
  resolve(OUT_DIR, 'products.json'),
  JSON.stringify({ $comment: note, examplePrices: !IZ_UREDNISTVA, types, products }, null, 2) + '\n',
);
const live = Object.fromEntries(products.map((p) => [p.sku, { name: p.name, price: p.price, stock: p.stock, published: p.published }]));
writeFileSync(resolve(OUT_DIR, 'demo-live.json'), JSON.stringify({ $comment: note, skus: live }, null, 2) + '\n');
writeFileSync(resolve(OUT_DIR, 'izdvojeno.json'), JSON.stringify(izdvojeno, null, 2) + '\n');
// za optimize-images: SKU → izvorna fotografija (relativno od korijena projekta, isto na svakom računalu)
writeFileSync(
  resolve(OUT_DIR, 'slike-izvori.json'),
  JSON.stringify(
    Object.fromEntries(
      r.sadrzaj.proizvodi.filter((p) => p.slika).map((p) => [p.sku, relative(ROOT, izvorSlike(p.slika)).replaceAll('\\', '/')]),
    ),
    null,
    2,
  ) + '\n',
);

console.log(
  `data-to-fixtures: ${products.length} proizvoda, ${types.length} vrsta, ${izdvojeno.polica.length} na polici → fixtures/ (izvor: ${IZ_UREDNISTVA ? 'uredništvo' : 'data.js'})`,
);
