// fixtures/products.json → woo/products-import.csv (format WooCommerce uvoza proizvoda).
// Priprema za MOGUĆI Woo (STACK §5); backend nije odabran. SKU je uvijek popunjen i jedinstven.
// Cijene u fixturi su primjeri, pa se u CSV NE upisuju osim uz --with-example-prices.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const withPrices = process.argv.includes('--with-example-prices');
const { products, types } = JSON.parse(readFileSync(resolve('fixtures/products.json'), 'utf8'));
const typeName = Object.fromEntries(types.map((t) => [t.key, t.name]));

const seen = new Set();
for (const p of products) {
  if (!p.sku?.trim()) throw new Error(`Proizvod "${p.name}" nema SKU`);
  if (seen.has(p.sku)) throw new Error(`Duplikat SKU-a ${p.sku}`);
  seen.add(p.sku);
}

const cols = [
  'Type', 'SKU', 'Name', 'Published', 'Is featured?', 'Visibility in catalog', 'Short description', 'Description',
  'Tax status', 'In stock?', 'Stock', 'Regular price', 'Categories', 'Tags', 'Images',
  'Attribute 1 name', 'Attribute 1 value(s)', 'Attribute 1 visible', 'Attribute 1 global',
  'Attribute 2 name', 'Attribute 2 value(s)', 'Attribute 2 visible', 'Attribute 2 global',
  'Meta: _cs_unit_label', 'Meta: _cs_caffeine', 'Meta: _cs_moods', 'Meta: _cs_badges',
];
const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows = products.map((p) => {
  const a = p.attributes;
  return [
    'simple', p.sku, p.name, 1, 0, 'visible', '', p.descriptionHtml,
    'taxable', 1, '', withPrices ? (p.price.amount / 100).toFixed(2) : '', typeName[p.type], '', '',
    'Podrijetlo', a.origin ?? '', 1, 1,
    'Okus', a.flavors.join(', '), 1, 1,
    p.unitLabel, a.caffeine ?? '', a.moods.join('|'), a.badges.join('|'),
  ];
});

mkdirSync(resolve('woo'), { recursive: true });
const csv = [cols, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
writeFileSync(resolve('woo/products-import.csv'), '﻿' + csv);
console.log(
  `data-to-woo-csv: ${rows.length} proizvoda → woo/products-import.csv` +
    (withPrices ? ' (S PRIMJER CIJENAMA, ne za produkciju)' : ' (bez cijena; Sara ih unosi)'),
);
