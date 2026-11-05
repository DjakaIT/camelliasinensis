// Adapter `demo` (API-CONTRACT §4): sve u pregledniku nad fixtures/, stranica za plaćanje /blagajna/ (samo demo build).
import {
  applySale,
  checkLines,
  isAllowedReturnUrl,
  live,
  maskEmail,
  newToken,
  ORDER_TTL_MS,
  priceForCheckout,
  setQuantity,
  withOrderToken,
} from '../../engine';
import { ShopError } from '../../errors';
import { shippingMethod, shippingPrice, type ShippingMethodId } from '../../shipping';
import type { Product, ProductTypeInfo, ShopBackend } from '../../types';
import { loadZivo } from '../../zivo';
import { applyZivo, baseHas, catalog, load, reset, save, type DemoOrder } from './state';

let offline = false;

const isBrowser = () => typeof window !== 'undefined';

/** Mala odgoda u pregledniku da se stanja učitavanja stvarno vide; u testovima 0. Prije svega živi podaci iz uredništva. */
async function tick<T>(fn: () => T): Promise<T> {
  if (isBrowser()) await Promise.all([new Promise((r) => setTimeout(r, 120)), loadZivo().then(applyZivo)]);
  if (offline) throw new ShopError('NETWORK');
  try {
    return fn();
  } catch (e) {
    throw ShopError.from(e);
  }
}

function allowedOrigins(): string[] {
  if (isBrowser()) return [window.location.origin];
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function findOrder(token: unknown): DemoOrder | null {
  if (typeof token !== 'string' || !/^[0-9a-f]{32,128}$/.test(token)) return null;
  const o = load().orders[token];
  if (!o || Date.now() - o.createdAt > ORDER_TTL_MS) return null;
  return o;
}

export function createDemoBackend(): ShopBackend {
  return {
    async listProducts() {
      const data = (await import('../../../../fixtures/products.json')).default as unknown as { products: Product[] };
      return data.products.filter((p) => p.published);
    },
    async listTypes() {
      const data = (await import('../../../../fixtures/products.json')).default as unknown as {
        types: ProductTypeInfo[];
      };
      return data.types;
    },
    getLive: (skus) => tick(() => live(catalog(), skus)),
    checkCart: (lines) => tick(() => checkLines(catalog(), lines)),
    startCheckout: (lines, urls) =>
      tick(() => {
        const origins = allowedOrigins();
        if (!isAllowedReturnUrl(urls?.success, origins) || !isAllowedReturnUrl(urls?.cancel, origins)) {
          throw new ShopError('INVALID_REQUEST');
        }
        const priced = priceForCheckout(catalog(), lines);
        const o = load();
        o.seq += 1;
        const token = newToken();
        o.orders[token] = {
          id: `demo-order-${o.seq}`,
          ref: `DEMO-${String(o.seq).padStart(4, '0')}`,
          token,
          lines: priced.lines,
          total: priced.total,
          status: 'pending',
          createdAt: Date.now(),
          successUrl: withOrderToken(urls.success, token),
          cancelUrl: urls.cancel,
          stockApplied: false,
        };
        save(o);
        // Stranica za plaćanje demo backenda (postoji samo u demo buildu, app/blagajna/page.demo.tsx).
        const redirect = new URL('/blagajna/', urls.success);
        redirect.searchParams.set('t', token);
        return { redirectUrl: redirect.toString(), orderToken: token };
      }),
    getOrderStatus: (token) =>
      tick(() => {
        const o = findOrder(token);
        if (!o) return { status: 'unknown' as const };
        return {
          status: o.status,
          ...(o.status === 'paid' ? { orderRef: o.ref, ...(o.emailMasked ? { email: o.emailMasked } : {}) } : {}),
        };
      }),
  };
}

/** Upravljanje demo "backendom": lažna stranica za plaćanje, testovi i window.__cs. */
export const demoControls = {
  getOrder: (token: string) => findOrder(token),
  /** Isto što bi napravio potpisani webhook: označi plaćeno i jednom umanji zalihu. Dostavu obračunava backend. */
  pay(token: string, details: { shipping?: ShippingMethodId; email?: string } = {}): DemoOrder {
    const o = load();
    const order = findOrder(token) && o.orders[token];
    if (!order || order.status !== 'pending') throw new ShopError('INVALID_REQUEST');
    const cat = catalog(o);
    for (const l of order.lines) {
      const s = cat.get(l.sku)?.stock;
      if (!s || (s.quantity != null && s.quantity < l.qty)) {
        order.status = 'failed';
        save(o);
        throw new ShopError('INSUFFICIENT_STOCK', { sku: l.sku, availableQty: s?.quantity ?? 0 });
      }
    }
    if (!order.stockApplied) {
      for (const l of order.lines) o.stock[l.sku] = applySale(cat.get(l.sku)!.stock, l.qty);
      order.stockApplied = true;
    }
    const method = shippingMethod(details.shipping ?? 'gls-adresa')!;
    const ship = shippingPrice(method, order.total.amount);
    order.shipping = { id: method.id, name: method.name, price: ship };
    order.grandTotal = { amount: order.total.amount + ship, currency: 'EUR' };
    order.emailMasked = maskEmail(details.email);
    order.status = 'paid';
    save(o);
    return order;
  },
  cancel(token: string): DemoOrder {
    const o = load();
    const order = findOrder(token) && o.orders[token];
    if (!order) throw new ShopError('INVALID_REQUEST');
    if (order.status === 'pending') order.status = 'cancelled';
    save(o);
    return order;
  },
  setStock(sku: string, qty: number) {
    if (!baseHas(sku)) throw new ShopError('UNKNOWN_SKU', { sku });
    const o = load();
    o.stock[sku] = setQuantity(catalog(o).get(sku)!.stock, qty);
    save(o);
    return o.stock[sku];
  },
  setPrice(sku: string, cents: number) {
    if (!baseHas(sku)) throw new ShopError('UNKNOWN_SKU', { sku });
    if (!Number.isInteger(cents) || cents <= 0) throw new ShopError('INVALID_REQUEST');
    const o = load();
    o.price[sku] = cents;
    save(o);
  },
  setPublished(sku: string, published: boolean) {
    const o = load();
    o.published[sku] = published;
    save(o);
  },
  setOffline(v: boolean) {
    offline = v;
  },
  reset() {
    offline = false;
    reset();
  },
};
