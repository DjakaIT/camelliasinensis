// Živi podaci iz uredništva (zivo.json): provjera oblika i da demo katalog uzima živu cijenu i zalihu.
import { afterEach, describe, expect, it } from 'vitest';
import { parseZivo } from '@/lib/shop/zivo';
import { applyZivo, catalog, reset } from '@/lib/shop/adapters/demo/state';

const stavka = { name: 'Bai Mu Dan Wang', price: { amount: 1250, currency: 'EUR' }, stock: { status: 'low', quantity: 2, maxPerOrder: 20 }, published: true };

describe('parseZivo', () => {
  it('prihvaća oblik koji piše urednistvo/php/lib/zivo.php', () => {
    const z = parseZivo({ verzija: 3, azurirano: null, skus: { 'CSTB-2': stavka } });
    expect(z?.verzija).toBe(3);
    expect(z?.skus.get('CSTB-2')?.price.amount).toBe(1250);
  });
  it('odbacuje pokvarene stavke, a ne cijelu datoteku', () => {
    const z = parseZivo({
      verzija: 1,
      skus: {
        'CSTB-2': stavka,
        'X-1': { ...stavka, price: { amount: 11.9, currency: 'EUR' } },
        'X-2': { ...stavka, price: { amount: 0, currency: 'EUR' } },
        'X-3': { ...stavka, stock: { status: 'sve', quantity: 1, maxPerOrder: 20 } },
        '../x': stavka,
      },
    });
    expect([...(z?.skus.keys() ?? [])]).toEqual(['CSTB-2']);
  });
  it.each([null, 'x', [], { skus: {} }, { verzija: 1, skus: [] }])('bez valjanog oblika vraća null: %j', (raw) => {
    expect(parseZivo(raw)).toBeNull();
  });
});

describe('demo katalog sa živim podacima', () => {
  afterEach(() => {
    applyZivo(null);
    reset();
  });
  it('živa cijena i zaliha zamijene podatke iz gradnje', () => {
    const prije = catalog().get('CSTB-2')!;
    applyZivo(parseZivo({ verzija: 9, skus: { 'CSTB-2': stavka } }));
    const poslije = catalog().get('CSTB-2')!;
    expect(poslije.price.amount).toBe(1250);
    expect(poslije.stock).toEqual(stavka.stock);
    expect(prije.price.amount).not.toBe(1250);
  });
});
