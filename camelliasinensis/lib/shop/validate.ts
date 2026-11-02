import { PRODUCT_TYPES, type Product } from './types';

/** API-CONTRACT §3.1: bez SKU-a, duplikat SKU-a ili cijena ≤ 0 ruše build (ne preskače se tiho). */
export function assertValidCatalog(products: Product[]): void {
  const problems: string[] = [];
  const skus = new Set<string>();
  const slugs = new Set<string>();
  for (const [i, p] of products.entries()) {
    const label = `#${i + 1} "${p?.name ?? '?'}"`;
    if (typeof p.sku !== 'string' || !p.sku.trim()) problems.push(`${label}: nema SKU`);
    else if (skus.has(p.sku)) problems.push(`${label}: duplikat SKU-a ${p.sku}`);
    else skus.add(p.sku);
    if (!Number.isInteger(p.price?.amount) || p.price.amount <= 0) problems.push(`${label}: cijena mora biti > 0`);
    if (p.price?.currency !== 'EUR') problems.push(`${label}: valuta mora biti EUR`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug ?? '')) problems.push(`${label}: neispravan slug "${p.slug}"`);
    else if (slugs.has(p.slug)) problems.push(`${label}: duplikat sluga ${p.slug}`);
    else slugs.add(p.slug);
    if (!PRODUCT_TYPES.includes(p.type)) problems.push(`${label}: nepoznata vrsta ${p.type}`);
  }
  if (problems.length) throw new Error(`Katalog nije ispravan:\n  ${problems.join('\n  ')}`);
}
