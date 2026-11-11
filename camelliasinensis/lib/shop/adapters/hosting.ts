// Adapter `hosting` (API-CONTRACT §4): prava trgovina na Hostingeru.
// - ponuda pri gradnji: fixtures/ (katalog iz uredništva, scripts/data-to-fixtures.mjs)
// - cijena i zaliha u pregledniku: zivo.json koji uredništvo zapiše pri svakom spremanju i prodaji (lib/shop/zivo.ts),
//   s istim pravilima kao poslužitelj (engine.ts); ako ga nema, podaci iz gradnje
// - plaćanje i stanje narudžbe: PHP na istoj domeni (urednistvo/php/lib/trgovina.php), koji SVE ponovno provjerava
//   i cijenu uvijek čita sam. Klijent šalje samo { sku, qty }.
import demoLive from '../../../fixtures/demo-live.json';
import { checkLines, live, type Catalog, type CatalogEntry } from '../engine';
import { ShopError } from '../errors';
import type { CheckoutStart, OrderStatus, Product, ProductTypeInfo, ShopBackend } from '../types';
import { loadZivo } from '../zivo';

export const HOSTING_API = '/urednistvo/api/trgovina';
const TIMEOUT_MS = 20_000; // stvaranje Stripe sesije na dijeljenom hostingu zna potrajati

type Base = Omit<CatalogEntry, 'sku'>;
const BASE = (demoLive as unknown as { skus: Record<string, Base> }).skus;

async function catalog(): Promise<Catalog> {
  const z = await loadZivo();
  const m = new Map<string, CatalogEntry>();
  for (const [sku, b] of Object.entries(BASE)) {
    const e = z?.skus.get(sku) ?? b;
    m.set(sku, { sku, name: e.name, price: e.price, stock: e.stock, published: e.published });
  }
  return m;
}

async function call<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(HOSTING_API + path, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (e) {
    if (e instanceof TypeError || (e as { name?: string })?.name === 'AbortError') throw new ShopError('NETWORK');
    throw e;
  } finally {
    clearTimeout(timer);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    throw new ShopError(res.status === 429 ? 'RATE_LIMITED' : res.status === 503 ? 'CHECKOUT_UNAVAILABLE' : 'UNKNOWN');
  }
  if (!res.ok) throw ShopError.from((data as { error?: unknown })?.error ?? data);
  return data as T;
}

export function createHostingBackend(): ShopBackend {
  return {
    async listProducts() {
      const data = (await import('../../../fixtures/products.json')).default as unknown as { products: Product[] };
      return data.products.filter((p) => p.published);
    },
    async listTypes() {
      const data = (await import('../../../fixtures/products.json')).default as unknown as { types: ProductTypeInfo[] };
      return data.types;
    },
    async getLive(skus) {
      try {
        return live(await catalog(), skus);
      } catch (e) {
        throw ShopError.from(e);
      }
    },
    async checkCart(lines) {
      try {
        return checkLines(await catalog(), lines);
      } catch (e) {
        throw ShopError.from(e);
      }
    },
    startCheckout: (lines, urls) =>
      call<CheckoutStart>('/narudzba', {
        method: 'POST',
        body: {
          lines: Array.isArray(lines) ? lines.map((l) => ({ sku: l?.sku, qty: l?.qty })) : lines,
          urls: { success: urls?.success, cancel: urls?.cancel },
        },
      }),
    getOrderStatus: (token) =>
      typeof token === 'string' && /^[0-9a-f]{48}$/.test(token)
        ? call<OrderStatus>(`/narudzba/${token}`)
        : Promise.resolve({ status: 'unknown' }),
  };
}
