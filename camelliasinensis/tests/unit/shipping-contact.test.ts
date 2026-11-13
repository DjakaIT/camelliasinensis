import { describe, expect, it } from 'vitest';
import { DUMMY_CONTENT, FREE_SHIPPING_FROM, legalPages, SHIPPING_FROM_PRICE } from '@/content/site';
import { validateContact } from '@/lib/contact';
import { validOib } from '@/lib/shop/adapters/demo/checkout-page';
import { createDemoBackend, demoControls } from '@/lib/shop/adapters/demo';
import { maskEmail } from '@/lib/shop/engine';
import { SHIPPING_METHODS, shippingMethod, shippingPrice } from '@/lib/shop/shipping';

describe('dostava', () => {
  const pak = shippingMethod('gls-paketomat')!;
  const adr = shippingMethod('gls-adresa')!;
  it('besplatna od 50 €, inače cijena metode', () => {
    expect(FREE_SHIPPING_FROM).toBe(5000);
    expect(shippingPrice(pak, 4999)).toBe(390);
    expect(shippingPrice(adr, 1190)).toBe(490);
    expect(shippingPrice(adr, 5000)).toBe(0);
    expect(SHIPPING_FROM_PRICE).toBe(Math.min(...SHIPPING_METHODS.map((m) => m.price)));
    expect(shippingMethod('dron')).toBeNull();
  });

  it('demo backend obračunava dostavu pri plaćanju (ne klijent)', async () => {
    demoControls.reset();
    const shop = createDemoBackend();
    const urls = { success: 'http://localhost:3000/narudzba/uspjeh/', cancel: 'http://localhost:3000/kosarica/?otkazano=1' };
    const r = await shop.startCheckout([{ sku: 'CSTB-2', qty: 2 }], urls);
    const o = demoControls.pay(r.orderToken, { shipping: 'gls-paketomat', email: 'marko.horvat@gmail.com' });
    expect(o.shipping).toMatchObject({ id: 'gls-paketomat', price: 390 });
    expect(o.grandTotal?.amount).toBe(2 * 1190 + 390);
    expect(await shop.getOrderStatus(r.orderToken)).toMatchObject({ status: 'paid', email: 'm***@gmail.com' });
    expect(JSON.stringify(o)).not.toContain('marko.horvat');
  });
});

describe('maskEmail', () => {
  it.each([
    ['marko.horvat@gmail.com', 'm***@gmail.com'],
    ['a@b.hr', 'a***@b.hr'],
    ['nije-email', undefined],
    [undefined, undefined],
  ])('%s → %s', (i, o) => expect(maskEmail(i)).toBe(o));
});

describe('OIB', () => {
  it('provjerava kontrolnu znamenku', () => {
    expect(validOib('69435151530')).toBe(true);
    expect(validOib('12345678901')).toBe(false);
    expect(validOib('6943515153')).toBe(false);
    expect(validOib('6943515153a')).toBe(false);
  });
});

describe('kontakt forma', () => {
  const ok = { name: 'Ana', email: 'ana@example.com', topic: 'Suradnja', message: 'Pozdrav, zanima me suradnja.', consent: true };
  it('ispravna poruka nema grešaka', () => expect(validateContact(ok)).toEqual({}));
  it('traži ime, e-mail, temu, poruku i pristanak', () => {
    const e = validateContact({ name: '', email: 'x', topic: 'Spam', message: 'kratko', consent: false });
    expect(Object.keys(e).sort()).toEqual(['consent', 'email', 'message', 'name', 'topic']);
  });
});

describe('probni sadržaj', () => {
  it('nema izmišljenih podataka (inače se build za indeksiranje ruši)', () => {
    expect(DUMMY_CONTENT).toEqual([]);
  });
  it('pravne stranice imaju tekst', () => {
    expect(legalPages.every((p) => (p.html ?? '').length > 200)).toBe(true);
  });
});
