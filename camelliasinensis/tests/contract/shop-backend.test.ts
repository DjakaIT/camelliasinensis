// Test ugovora (API-CONTRACT §7): isti skup nad svakim adapterom.
import { beforeEach, describe, expect, it } from 'vitest';
import { ShopError } from '@/lib/shop/errors';
import type { CartLine } from '@/lib/shop/types';
import { ADAPTERS, URLS } from './adapters';

const SKU = 'CSTB-2'; // Bai Mu Dan Wang, 11,90 € u fixturi
const SKU2 = 'CSTV-18'; // Huiming, 13,90 €
const SOLD_OUT = 'CSTVI-150'; // u fixturi zaliha 0

async function rejects(p: Promise<unknown>, code: string) {
  const e = await p.then(
    () => null,
    (x) => x,
  );
  expect(e, `očekivana greška ${code}`).toBeInstanceOf(ShopError);
  expect((e as ShopError).code).toBe(code);
  expect((e as ShopError).message).toMatch(/[a-zčćšžđ]/i); // hrvatska poruka za kupca
  return e as ShopError;
}

describe.each(ADAPTERS)('ShopBackend: $name', ({ backend, controls }) => {
  beforeEach(async () => {
    await controls.reset();
  });

  describe('listProducts / listTypes (build)', () => {
    it('vraća sve objavljene proizvode s jedinstvenim nepraznim SKU-om i cijenom > 0', async () => {
      const ps = await backend.listProducts();
      expect(ps).toHaveLength(70); // 71 u katalogu, knjiga nije objavljena (13. 11. 2026.)
      const skus = new Set(ps.map((p) => p.sku));
      expect(skus.size).toBe(ps.length);
      for (const p of ps) {
        expect(p.sku.trim()).not.toBe('');
        expect(Number.isInteger(p.price.amount) && p.price.amount > 0).toBe(true);
        expect(p.price.currency).toBe('EUR');
        expect(p.taxIncluded).toBe(true);
        expect(p.published).toBe(true);
        expect(['instock', 'low', 'outofstock', 'backorder']).toContain(p.stock.status);
        expect(Array.isArray(p.attributes.flavors) && Array.isArray(p.attributes.moods)).toBe(true);
      }
    });
    it('vraća 8 vrsta', async () => {
      const ts = await backend.listTypes();
      expect(ts.map((t) => t.key)).toEqual(['bijeli', 'zeleni', 'oolong', 'crni', 'puer', 'aroma', 'biljni', 'pribor']);
    });
  });

  describe('getLive', () => {
    it('vraća cijenu i zalihu za poznat SKU, preskače nepoznat', async () => {
      const r = await backend.getLive([SKU, 'NE-POSTOJI-1']);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ sku: SKU, price: { amount: 1190, currency: 'EUR' }, available: true });
    });
    it('prazan popis → []', async () => {
      expect(await backend.getLive([])).toEqual([]);
    });
    it('više od 50 SKU-ova → INVALID_REQUEST', async () => {
      await rejects(backend.getLive(Array.from({ length: 51 }, (_, i) => `X-${i}`)), 'INVALID_REQUEST');
    });
    it('rasprodan proizvod nije dostupan', async () => {
      const [r] = await backend.getLive([SOLD_OUT]);
      expect(r?.available).toBe(false);
      expect(r?.stock.status).toBe('outofstock');
    });
  });

  describe('checkCart', () => {
    it('ispravna košarica: zbroj samo ispravnih redaka', async () => {
      const c = await backend.checkCart([
        { sku: SKU, qty: 2 },
        { sku: 'NE-POSTOJI-1', qty: 1 },
      ]);
      expect(c.lines[0]).toMatchObject({ ok: true, unitPrice: { amount: 1190 }, lineTotal: { amount: 2380 } });
      expect(c.lines[1]).toMatchObject({ ok: false, reason: 'UNKNOWN_SKU' });
      expect(c.subtotal).toEqual({ amount: 2380, currency: 'EUR' });
      expect(typeof c.checkedAt).toBe('string');
    });
    it.each([0, -1, 1.5])('količina %s → INVALID_REQUEST', async (qty) => {
      await rejects(backend.checkCart([{ sku: SKU, qty }]), 'INVALID_REQUEST');
    });
    it('količina 9999 → INSUFFICIENT_STOCK s dopuštenom količinom', async () => {
      const c = await backend.checkCart([{ sku: SKU, qty: 9999 }]);
      expect(c.lines[0]).toMatchObject({ ok: false, reason: 'INSUFFICIENT_STOCK' });
      const l = c.lines[0]!;
      expect(!l.ok && l.availableQty).toBeGreaterThan(0);
      expect(!l.ok && (l.availableQty ?? 0) <= 20).toBe(true);
      expect(c.subtotal.amount).toBe(0);
    });
    it('rasprodan → OUT_OF_STOCK', async () => {
      const c = await backend.checkCart([{ sku: SOLD_OUT, qty: 1 }]);
      expect(c.lines[0]).toMatchObject({ ok: false, reason: 'OUT_OF_STOCK', availableQty: 0 });
    });
    it('zaliha se promijenila nakon učitavanja (kao da ju je promijenila blagajna)', async () => {
      const [before] = await backend.getLive([SKU]);
      expect(before?.stock.quantity).toBe(24);
      await controls.setStock(SKU, 1);
      const c = await backend.checkCart([{ sku: SKU, qty: 2 }]);
      expect(c.lines[0]).toMatchObject({ ok: false, reason: 'INSUFFICIENT_STOCK', availableQty: 1 });
      const [after] = await backend.getLive([SKU]);
      expect(after?.stock).toMatchObject({ status: 'low', quantity: 1 });
    });
    it('promjena cijene se vidi u sljedećoj provjeri', async () => {
      await controls.setPrice(SKU, 1350);
      const c = await backend.checkCart([{ sku: SKU, qty: 1 }]);
      expect(c.lines[0]).toMatchObject({ ok: true, unitPrice: { amount: 1350 } });
    });
    it('klijent ne diktira cijenu: dodatna polja (amount, price) se ignoriraju', async () => {
      const honest = await backend.checkCart([{ sku: SKU, qty: 2 }]);
      const sneaky = await backend.checkCart([{ sku: SKU, qty: 2, amount: 1, price: { amount: 1 }, priceId: 'x' } as unknown as CartLine]);
      expect(sneaky.subtotal).toEqual(honest.subtotal);
      expect(sneaky.lines[0]).toMatchObject({ unitPrice: { amount: 1190 } });
    });
    it('neispravan oblik → INVALID_REQUEST', async () => {
      await rejects(backend.checkCart('x' as unknown as CartLine[]), 'INVALID_REQUEST');
      await rejects(backend.checkCart([{ sku: 123, qty: 1 } as unknown as CartLine]), 'INVALID_REQUEST');
      await rejects(backend.checkCart(Array.from({ length: 51 }, (_, i) => ({ sku: `X-${i}`, qty: 1 }))), 'INVALID_REQUEST');
    });
  });

  describe('startCheckout / getOrderStatus', () => {
    it('ispravna košarica → redirectUrl i neprozirni token; narudžba je pending', async () => {
      const r = await backend.startCheckout(
        [
          { sku: SKU, qty: 2 },
          { sku: SKU2, qty: 1 },
        ],
        URLS,
      );
      expect(r.redirectUrl).toMatch(/^https?:\/\//);
      expect(r.orderToken).toMatch(/^[0-9a-f]{32,}$/); // ≥ 128 bita
      expect(r.orderToken.length * 4).toBeGreaterThanOrEqual(128);
      expect(await backend.getOrderStatus(r.orderToken)).toEqual({ status: 'pending' });
    });
    it('plaćanje: status paid, zaliha umanjena točno jednom', async () => {
      const r = await backend.startCheckout([{ sku: SKU, qty: 3 }], URLS);
      await controls.pay(r.orderToken, r.redirectUrl);
      const s = await backend.getOrderStatus(r.orderToken);
      expect(s.status).toBe('paid');
      expect(s.orderRef).toBeTruthy();
      await controls.pay(r.orderToken, r.redirectUrl).catch(() => undefined); // ponovljena potvrda
      const [l] = await backend.getLive([SKU]);
      expect(l?.stock.quantity).toBe(21);
    });
    it('klijent ne diktira cijenu ni pri startCheckout', async () => {
      const r = await backend.startCheckout([{ sku: SKU, qty: 1, amount: 1 } as unknown as CartLine], URLS);
      await controls.pay(r.orderToken, r.redirectUrl);
      // ako je iznos bio prihvaćen, narudžba bi bila na 0,01 €; provjera ide preko kataloga, ne klijenta
      const c = await backend.checkCart([{ sku: SKU, qty: 1 }]);
      expect(c.subtotal.amount).toBe(1190);
    });
    it('neispravna košarica se odbija', async () => {
      await rejects(backend.startCheckout([{ sku: 'NE-POSTOJI-1', qty: 1 }], URLS), 'UNKNOWN_SKU');
      await rejects(backend.startCheckout([{ sku: SOLD_OUT, qty: 1 }], URLS), 'OUT_OF_STOCK');
      await rejects(backend.startCheckout([], URLS), 'INVALID_REQUEST');
      await rejects(backend.startCheckout([{ sku: SKU, qty: 0 }], URLS), 'INVALID_REQUEST');
      await rejects(backend.startCheckout([{ sku: SKU, qty: 21 }], URLS), 'INVALID_REQUEST'); // > maxPerOrder
    });
    it('nedovoljna zaliha pri polasku na plaćanje → INSUFFICIENT_STOCK s brojem komada', async () => {
      await controls.setStock(SKU, 2);
      const e = await rejects(backend.startCheckout([{ sku: SKU, qty: 3 }], URLS), 'INSUFFICIENT_STOCK');
      expect(e.details).toMatchObject({ sku: SKU, availableQty: 2 });
      expect(e.message).toContain('2');
    });
    it('povratni URL izvan dopuštenog origina se odbija', async () => {
      await rejects(
        backend.startCheckout([{ sku: SKU, qty: 1 }], { success: 'https://evil.example/ok', cancel: URLS.cancel }),
        'INVALID_REQUEST',
      );
    });
    it('nepoznat ili neispravan token → unknown', async () => {
      expect(await backend.getOrderStatus('0'.repeat(48))).toEqual({ status: 'unknown' });
      expect(await backend.getOrderStatus('nije-token')).toEqual({ status: 'unknown' });
      expect(await backend.getOrderStatus('')).toEqual({ status: 'unknown' });
    });
  });
});
