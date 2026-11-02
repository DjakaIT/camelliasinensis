import { beforeEach, describe, expect, it } from 'vitest';

// Minimalni localStorage za Node.
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
const ls = new MemStorage();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: ls,
  addEventListener() {},
  removeEventListener() {},
};

const cart = await import('@/lib/cart/store');

describe('košarica (cs.cart.v1)', () => {
  beforeEach(() => {
    ls.m.clear();
    cart._resetSnapshot();
  });

  it('dodaj, promijeni, ukloni; sprema se verzionirano samo { sku, qty }', () => {
    cart.addQty('CSTB-2', 1);
    cart.addQty('CSTB-2', 2);
    cart.addQty('CSTV-18', 1);
    expect(cart.readCart()).toEqual([
      { sku: 'CSTB-2', qty: 3 },
      { sku: 'CSTV-18', qty: 1 },
    ]);
    cart.setQty('CSTB-2', 1);
    cart.removeLine('CSTV-18');
    const stored = JSON.parse(ls.getItem(cart.CART_KEY)!);
    expect(stored.v).toBe(1);
    expect(stored.lines).toEqual([{ sku: 'CSTB-2', qty: 1 }]);
    expect(Object.keys(stored.lines[0])).toEqual(['sku', 'qty']); // nikad cijena
  });

  it('košarica preživi "osvježavanje" (novo čitanje iz pohrane)', () => {
    cart.addQty('CSTB-2', 2);
    cart._resetSnapshot();
    expect(cart.readCart()).toEqual([{ sku: 'CSTB-2', qty: 2 }]);
  });

  it('qty 0 uklanja redak; gornja granica 99', () => {
    cart.setQty('CSTB-2', 500);
    expect(cart.qtyOf('CSTB-2')).toBe(99);
    cart.setQty('CSTB-2', 0);
    expect(cart.readCart()).toEqual([]);
  });

  it('nepoznata verzija ili neispravan sadržaj → prazna košarica', () => {
    expect(cart.parseStored(JSON.stringify({ v: 2, lines: [{ sku: 'A', qty: 1 }] }))).toEqual([]);
    expect(cart.parseStored('{nije json')).toEqual([]);
    expect(cart.parseStored(JSON.stringify([{ id: 1, v: '50 g', q: 2 }]))).toEqual([]); // stari ključ prototipa
  });

  it('čisti neispravne retke i spaja duplikate', () => {
    const raw = JSON.stringify({
      v: 1,
      lines: [
        { sku: 'A', qty: 1 },
        { sku: 'A', qty: 2 },
        { sku: '', qty: 1 },
        { sku: 'B', qty: -1 },
        { sku: 'C', qty: 1.5 },
        { sku: 'D', qty: 1, price: 1 },
      ],
    });
    expect(cart.parseStored(raw)).toEqual([
      { sku: 'A', qty: 3 },
      { sku: 'D', qty: 1 },
    ]);
  });

  it('clearCart', () => {
    cart.addQty('A', 1);
    cart.clearCart();
    expect(cart.readCart()).toEqual([]);
  });
});
