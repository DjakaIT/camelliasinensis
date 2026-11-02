// design-reference/src/data.js → fixtures/products.json (oblik iz API-CONTRACT §2) i fixtures/demo-live.json.
// SKU (prvi element retka u data.js) prenosi se nepromijenjen. Duplikat ili prazan SKU i cijena ≤ 0 ruše skriptu.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readDataJs, slugify } from './lib/read-data-js.mjs';

const IMG_DIR = resolve('design-reference/img');
const OUT_DIR = resolve('fixtures');

// Izmišljena zaliha SAMO za demo, da se vide sva stanja (GUIDE §2 "Stanja zalihe").
const DEMO_STOCK = { 'CSTVI-150': 0, 'CSLI-2': 2 };
const DEFAULT_QTY = 24;
const MAX_PER_ORDER = 20;
const LOW_AT = 3;
const UPDATED_AT = '2026-11-02T00:00:00.000Z';

const BADGE = { b: 'bio', r: 'rijetko', n: 'novo' };

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stockFor(sku) {
  const quantity = DEMO_STOCK[sku] ?? DEFAULT_QTY;
  const status = quantity <= 0 ? 'outofstock' : quantity <= LOW_AT ? 'low' : 'instock';
  return { status, quantity, maxPerOrder: MAX_PER_ORDER };
}

const { TYPES, BREW, RAW } = readDataJs();
const errors = [];
const seenSku = new Set();
const seenSlug = new Set();
const products = [];

for (const [i, r] of RAW.entries()) {
  const [sku, name, type, origin, lv, flavors, form, priceEur, unit, moods, flags, brewKey, desc] = r;
  const row = `redak ${i + 1} (${name ?? '?'})`;
  if (typeof sku !== 'string' || !sku.trim()) errors.push(`${row}: prazan SKU`);
  else if (seenSku.has(sku)) errors.push(`${row}: duplikat SKU-a ${sku}`);
  seenSku.add(sku);
  const amount = Math.round(Number(priceEur) * 100);
  if (!Number.isInteger(amount) || amount <= 0) errors.push(`${row}: cijena mora biti > 0 (${priceEur})`);
  if (!TYPES[type]) errors.push(`${row}: nepoznata vrsta ${type}`);

  let slug = slugify(name);
  if (seenSlug.has(slug)) slug = `${slug}-${slugify(sku)}`;
  seenSlug.add(slug);

  const images = [];
  const file = resolve(IMG_DIR, `${sku}.jpg`);
  if (existsSync(file)) {
    const meta = await sharp(file).metadata();
    images.push({ src: `/img/p/${sku}.jpg`, alt: name, width: meta.width, height: meta.height });
  }

  const brew = brewKey && BREW[brewKey] ? { temp: BREW[brewKey][0], time: BREW[brewKey][1], dose: BREW[brewKey][2] } : undefined;
  const attributes = {
    ...(origin ? { origin } : {}),
    ...(lv >= 0 ? { caffeine: lv } : {}),
    flavors: [...flavors],
    form,
    moods: [...moods],
    badges: String(flags)
      .split(',')
      .map((f) => BADGE[f.trim()])
      .filter(Boolean),
    ...(brew ? { brew } : {}),
  };

  products.push({
    id: `demo-${i + 1}`,
    sku,
    slug,
    name,
    type,
    unitLabel: unit,
    price: { amount, currency: 'EUR' },
    taxIncluded: true,
    descriptionHtml: `<p>${escapeHtml(desc)}</p>`,
    images,
    attributes,
    stock: stockFor(sku),
    published: true,
    updatedAt: UPDATED_AT,
  });
}

if (errors.length) {
  console.error('data-to-fixtures: neispravni podaci, fixture NIJE zapisan:\n  ' + errors.join('\n  '));
  process.exit(1);
}

const types = Object.entries(TYPES).map(([key, t]) => ({ key, name: t.n, description: t.d }));

mkdirSync(OUT_DIR, { recursive: true });
const note =
  'GENERIRANO skriptom scripts/data-to-fixtures.mjs iz design-reference/src/data.js; ne uređivati ručno. ' +
  'CIJENE SU PRIMJERI IZ PROTOTIPA (nisu Sarine potvrđene cijene) i ne smiju se prikazivati kao akcija ni staro/novo. ' +
  'ZALIHA JE IZMIŠLJENA za demo (stanja: na zalihi, malo, nema).';
writeFileSync(
  resolve(OUT_DIR, 'products.json'),
  JSON.stringify({ $comment: note, examplePrices: true, types, products }, null, 2) + '\n',
);

// Lagana verzija za demo adapter u pregledniku (ne vuče opise u bundle).
const live = Object.fromEntries(
  products.map((p) => [p.sku, { name: p.name, price: p.price, stock: p.stock, published: p.published }]),
);
writeFileSync(resolve(OUT_DIR, 'demo-live.json'), JSON.stringify({ $comment: note, skus: live }, null, 2) + '\n');

console.log(`data-to-fixtures: ${products.length} proizvoda, ${types.length} vrsta → fixtures/products.json`);
