import { describe, expect, it } from 'vitest';
import fixture from '@/fixtures/products.json';
import { applyFilters, countFor, emptyFilters, parseFilters, toSearch } from '@/lib/catalog-filter';
import { toCard } from '@/lib/catalog-view';
import { applySale, checkLines, parseLines, type Catalog } from '@/lib/shop/engine';
import { ShopError } from '@/lib/shop/errors';
import type { Product } from '@/lib/shop/types';

const products = fixture.products as unknown as Product[];
const names = Object.fromEntries(fixture.types.map((t) => [t.key, t.name]));
const cards = products.map((p) => toCard(p, names[p.type]!, p.descriptionHtml));

describe('engine', () => {
  const cat: Catalog = new Map(products.map((p) => [p.sku, { sku: p.sku, name: p.name, price: p.price, stock: p.stock, published: true }]));

  it('parseLines prihvaća samo { sku, qty } i odbija loše količine', () => {
    expect(parseLines([{ sku: 'A', qty: 2, amount: 1 }], { allowEmpty: false })).toEqual([{ sku: 'A', qty: 2 }]);
    for (const qty of [0, -1, 1.5, '2', null]) {
      expect(() => parseLines([{ sku: 'A', qty }], { allowEmpty: false })).toThrow(ShopError);
    }
    expect(() => parseLines([], { allowEmpty: false })).toThrow(ShopError);
    expect(() => parseLines([{ sku: '<script>', qty: 1 }], { allowEmpty: true })).toThrow(ShopError);
  });

  it('zaliha se promijenila između učitavanja i dodavanja u košaricu', () => {
    const changed = new Map(cat);
    const e = changed.get('CSTB-2')!;
    changed.set('CSTB-2', { ...e, stock: { ...e.stock, quantity: 1, status: 'low' } });
    expect(checkLines(cat, [{ sku: 'CSTB-2', qty: 2 }]).lines[0]).toMatchObject({ ok: true });
    expect(checkLines(changed, [{ sku: 'CSTB-2', qty: 2 }]).lines[0]).toMatchObject({ ok: false, reason: 'INSUFFICIENT_STOCK', availableQty: 1 });
  });

  it('applySale umanjuje i preračuna status', () => {
    expect(applySale({ status: 'instock', quantity: 4, maxPerOrder: 20 }, 3)).toEqual({ status: 'low', quantity: 1, maxPerOrder: 20 });
    expect(applySale({ status: 'low', quantity: 1, maxPerOrder: 20 }, 1).status).toBe('outofstock');
    expect(applySale({ status: 'instock', quantity: null, maxPerOrder: 20 }, 1).quantity).toBeNull();
  });

  it('proizvod bez slike i rasprodan proizvod imaju isti oblik', () => {
    const noImg = products.find((p) => !p.images.length)!;
    const sold = products.find((p) => p.stock.status === 'outofstock')!;
    expect(toCard(noImg, 'x').image).toBeNull();
    expect(Object.keys(toCard(sold, 'x'))).toEqual(Object.keys(toCard(noImg, 'x')));
  });
});

describe('filtri kataloga', () => {
  it('vrsta i okus sužavaju popis; "Očisti" vraća sve', () => {
    const all = applyFilters(cards, emptyFilters());
    expect(all).toHaveLength(71);
    const green = applyFilters(cards, { ...emptyFilters(), type: ['zeleni'] });
    expect(green.length).toBe(12);
    const greenFloral = applyFilters(cards, { ...emptyFilters(), type: ['zeleni'], flav: ['cvjetni'] });
    expect(greenFloral.length).toBeGreaterThan(0);
    expect(greenFloral.length).toBeLessThan(green.length);
    expect(greenFloral.every((c) => c.type === 'zeleni' && c.flavors.includes('cvjetni'))).toBe(true);
  });

  it('pretraga ne ovisi o dijakritici i velikim slovima', () => {
    expect(applyFilters(cards, { ...emptyFilters(), q: 'PUER' }).length).toBeGreaterThanOrEqual(5);
    expect(applyFilters(cards, { ...emptyFilters(), q: 'zlicica' }).map((c) => c.sku)).toContain('CSAC-516');
  });

  it('URL ↔ filtri', () => {
    const f = parseFilters('?vrsta=zeleni,crni&okus=cvjetni&tein=2&q=sencha&poredaj=cu&stranica=2&bio=1');
    expect(f).toMatchObject({ type: ['zeleni', 'crni'], flav: ['cvjetni'], lv: ['2'], q: 'sencha', sort: 'cu', page: 2, bio: true });
    expect(parseFilters(toSearch(f))).toEqual(f);
    expect(toSearch(emptyFilters())).toBe('');
  });

  it('na /katalog/<vrsta>/ vrsta se ne ponavlja u URL-u', () => {
    const f = parseFilters('?okus=cvjetni', 'zeleni');
    expect(f.type).toEqual(['zeleni']);
    expect(toSearch(f, 'zeleni')).toBe('?okus=cvjetni');
  });

  it('brojači u grupi ne ovise o odabiru u istoj grupi', () => {
    const f = { ...emptyFilters(), type: ['zeleni'] };
    expect(countFor(cards, f, 'type', 'crni')).toBe(14);
  });
});
