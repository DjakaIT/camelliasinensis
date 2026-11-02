// Fixture: SKU iz data.js nepromijenjen, jedinstven i neprazan; build pada na loš katalog.
import { describe, expect, it } from 'vitest';
import fixture from '@/fixtures/products.json';
import { assertValidCatalog } from '@/lib/shop/validate';
import type { Product } from '@/lib/shop/types';
import { readDataJs } from '../../scripts/lib/read-data-js.mjs';

const products = fixture.products as unknown as Product[];

describe('fixtures/products.json', () => {
  it('ima 71 proizvod s jedinstvenim nepraznim SKU-om', () => {
    expect(products).toHaveLength(71);
    const skus = products.map((p) => p.sku);
    expect(skus.every((s) => typeof s === 'string' && s.trim().length > 0)).toBe(true);
    expect(new Set(skus).size).toBe(71);
  });
  it('SKU-ovi su točno prvi elementi redaka u data.js, istim redom', () => {
    const { RAW } = readDataJs() as { RAW: unknown[][] };
    expect(products.map((p) => p.sku)).toEqual(RAW.map((r) => r[0]));
  });
  it('cijene su cijeli centi > 0 i označene kao primjeri', () => {
    expect(fixture.examplePrices).toBe(true);
    expect(fixture.$comment).toMatch(/PRIMJERI/);
    expect(products.every((p) => Number.isInteger(p.price.amount) && p.price.amount > 0)).toBe(true);
  });
  it('prolazi provjeru kataloga za build', () => {
    expect(() => assertValidCatalog(products)).not.toThrow();
  });
});

describe('assertValidCatalog ruši build', () => {
  const base = products[0]!;
  it.each([
    ['duplikat SKU-a', [base, { ...base, slug: 'drugi' }], /duplikat SKU/],
    ['prazan SKU', [{ ...base, sku: ' ' }], /nema SKU/],
    ['cijena 0', [{ ...base, price: { amount: 0, currency: 'EUR' as const } }], /cijena/],
    ['decimalna cijena', [{ ...base, price: { amount: 11.9, currency: 'EUR' as const } }], /cijena/],
    ['duplikat sluga', [base, { ...base, sku: 'X-1' }], /duplikat sluga/],
  ])('%s', (_, list, msg) => {
    expect(() => assertValidCatalog(list as Product[])).toThrow(msg);
  });
});
