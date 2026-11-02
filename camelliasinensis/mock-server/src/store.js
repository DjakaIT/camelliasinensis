// Stanje u memoriji: katalog iz fixtures/products.json, narudžbe, obrađeni webhook događaji.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applySale, newToken, ORDER_TTL_MS, setQuantity } from '../../lib/shop/engine.ts';

const FIXTURE = fileURLToPath(new URL('../../fixtures/products.json', import.meta.url));

export function createStore() {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  let products = [];
  let catalog = new Map();
  const orders = new Map(); // token → narudžba
  const byId = new Map(); // id → token
  const events = new Set(); // obrađeni Stripe event.id (idempotentnost)
  let seq = 0;

  function reset() {
    products = structuredClone(fixture.products).filter((p) => p.published);
    catalog = new Map(products.map((p) => [p.sku, { sku: p.sku, name: p.name, price: p.price, stock: p.stock, published: p.published }]));
    orders.clear();
    byId.clear();
    events.clear();
    seq = 0;
  }
  reset();

  return {
    reset,
    catalog: () => catalog,
    types: () => fixture.types,
    /** Proizvodi s trenutnom cijenom i zalihom (za build preko adaptera devserver). */
    products: () => products.map((p) => ({ ...p, price: catalog.get(p.sku).price, stock: catalog.get(p.sku).stock })),

    setStock(sku, qty) {
      const e = catalog.get(sku);
      if (!e) return null;
      e.stock = setQuantity(e.stock, qty);
      return e.stock;
    },
    setPrice(sku, amount) {
      const e = catalog.get(sku);
      if (!e) return null;
      e.price = { amount, currency: 'EUR' };
      return e.price;
    },

    createOrder({ lines, total, successUrl, cancelUrl }) {
      seq += 1;
      const token = newToken();
      const order = {
        id: `ord_${Date.now().toString(36)}_${seq}`,
        ref: `TEST-${String(seq).padStart(4, '0')}`,
        token,
        lines,
        total,
        status: 'pending',
        createdAt: Date.now(),
        successUrl,
        cancelUrl,
        stockApplied: false,
        sessionId: null,
      };
      orders.set(token, order);
      byId.set(order.id, token);
      return order;
    },
    orderByToken(token) {
      const o = orders.get(token);
      if (!o || Date.now() - o.createdAt > ORDER_TTL_MS) return null;
      return o;
    },
    orderById(id) {
      const t = byId.get(id);
      return t ? orders.get(t) ?? null : null;
    },

    /** Označi plaćeno i JEDNOM umanji zalihu (bez obzira koliko puta stigne potvrda). */
    markPaid(order) {
      if (!order || order.status === 'paid') return false;
      if (!order.stockApplied) {
        for (const l of order.lines) {
          const e = catalog.get(l.sku);
          if (e) e.stock = applySale(e.stock, l.qty);
        }
        order.stockApplied = true;
      }
      order.status = 'paid';
      return true;
    },
    markStatus(order, status) {
      if (order && order.status === 'pending') order.status = status;
    },

    seenEvent: (id) => events.has(id),
    rememberEvent: (id) => events.add(id),
  };
}
