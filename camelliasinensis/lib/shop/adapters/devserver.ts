// Adapter `devserver` (API-CONTRACT §4, §6): HTTP prema lokalnom mock-server/ na 127.0.0.1.
// Šalje samo { sku, qty }; cijenu i zalihu određuje poslužitelj.
import { ShopError } from '../errors';
import type { CartCheck, CartLine, CheckoutStart, LiveInfo, OrderStatus, Product, ProductTypeInfo, ShopBackend } from '../types';

const TIMEOUT_MS = 8000;

export function createDevserverBackend(baseUrl: string): ShopBackend {
  const base = baseUrl.replace(/\/+$/, '');

  async function call<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(base + path, {
        method: init?.method ?? 'GET',
        headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
        credentials: 'omit',
        // U pregledniku uvijek svježe; pri buildu bez `no-store` (Next bi stranicu proglasio dinamičnom).
        ...(typeof window !== 'undefined' ? { cache: 'no-store' as const } : {}),
      });
    } catch (e) {
      // Samo mrežne greške (TypeError, prekid) su NETWORK; ostalo (npr. greške frameworka) ne skrivamo.
      if (e instanceof TypeError || (e as { name?: string })?.name === 'AbortError') throw new ShopError('NETWORK');
      throw e;
    } finally {
      clearTimeout(timer);
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      throw new ShopError(res.ok ? 'UNKNOWN' : res.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN');
    }
    if (!res.ok) throw ShopError.from((data as { error?: unknown })?.error ?? data);
    return data as T;
  }

  const onlyLines = (lines: CartLine[]) => (Array.isArray(lines) ? lines.map((l) => ({ sku: l?.sku, qty: l?.qty })) : lines);

  return {
    listProducts: () => call<Product[]>('/products'),
    listTypes: () => call<ProductTypeInfo[]>('/types'),
    getLive(skus) {
      if (!Array.isArray(skus)) return Promise.reject(new ShopError('INVALID_REQUEST'));
      if (skus.length === 0) return Promise.resolve([]);
      return call<LiveInfo[]>(`/live?skus=${encodeURIComponent(skus.join(','))}`);
    },
    checkCart: (lines) => call<CartCheck>('/cart/check', { method: 'POST', body: { lines: onlyLines(lines) } }),
    startCheckout: (lines, urls) =>
      call<CheckoutStart>('/checkout/start', {
        method: 'POST',
        body: { lines: onlyLines(lines), urls: { success: urls?.success, cancel: urls?.cancel } },
      }),
    getOrderStatus: (token) =>
      typeof token === 'string' && token.length > 0 && token.length <= 256
        ? call<OrderStatus>(`/orders/${encodeURIComponent(token)}`)
        : Promise.resolve({ status: 'unknown' }),
  };
}
