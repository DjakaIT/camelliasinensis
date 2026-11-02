// Čista logika "backenda" koju dijele adapter `demo` (u pregledniku) i `mock-server/` (Node).
// Ne zna ništa o pohrani ni o HTTP-u. Pisano kao "erasable" TypeScript da ga Node može uvesti izravno.
import { ShopError } from './errors.ts';
import type { CartCheck, CartCheckLine, CartLine, LiveInfo, Money, Stock } from './types.ts';
import { LIMITS } from './types.ts';

export type CatalogEntry = { sku: string; name: string; price: Money; stock: Stock; published: boolean };
export type Catalog = ReadonlyMap<string, CatalogEntry>;

const LOW_AT = 3;
const MAX_QTY_INPUT = 10_000;
const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

export const eur = (amount: number): Money => ({ amount, currency: 'EUR' });

export function deriveStatus(quantity: number): Stock['status'] {
  if (quantity <= 0) return 'outofstock';
  if (quantity <= LOW_AT) return 'low';
  return 'instock';
}

/** Koliko komada se smije naručiti u jednom retku (null = backend ne zna/ne otkriva). */
export function allowedQty(stock: Stock): number {
  if (stock.status === 'outofstock') return 0;
  if (stock.status === 'backorder' || stock.quantity == null) return stock.maxPerOrder;
  return Math.max(0, Math.min(stock.quantity, stock.maxPerOrder));
}

/**
 * Prihvaća samo `{ sku, qty }`. Sve ostalo (amount, price, priceId, price_data…) se ignorira.
 * Neispravan oblik, qty koji nije cijeli broj ≥ 1 ili više od 50 redaka → INVALID_REQUEST.
 */
export function parseLines(input: unknown, opts: { allowEmpty: boolean }): CartLine[] {
  if (!Array.isArray(input)) throw new ShopError('INVALID_REQUEST');
  if (!opts.allowEmpty && input.length === 0) throw new ShopError('INVALID_REQUEST');
  if (input.length > LIMITS.maxCartLines) throw new ShopError('INVALID_REQUEST');
  const merged = new Map<string, number>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') throw new ShopError('INVALID_REQUEST');
    const { sku, qty } = raw as { sku?: unknown; qty?: unknown };
    if (typeof sku !== 'string' || !SKU_RE.test(sku)) throw new ShopError('INVALID_REQUEST');
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_INPUT) {
      throw new ShopError('INVALID_REQUEST', { sku });
    }
    merged.set(sku, (merged.get(sku) ?? 0) + qty);
  }
  return [...merged].map(([sku, qty]) => ({ sku, qty }));
}

export function parseSkus(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > LIMITS.maxSkusPerLive) throw new ShopError('INVALID_REQUEST');
  for (const s of input) if (typeof s !== 'string' || !SKU_RE.test(s)) throw new ShopError('INVALID_REQUEST');
  return [...new Set(input as string[])];
}

export function live(catalog: Catalog, skusInput: unknown): LiveInfo[] {
  const out: LiveInfo[] = [];
  for (const sku of parseSkus(skusInput)) {
    const e = catalog.get(sku);
    if (!e || !e.published) continue; // nepoznat ili neobjavljen SKU se ne vraća
    out.push({ sku, price: e.price, stock: e.stock, available: allowedQty(e.stock) > 0 });
  }
  return out;
}

export function checkLines(catalog: Catalog, linesInput: unknown, now = new Date()): CartCheck {
  const lines = parseLines(linesInput, { allowEmpty: true });
  const result: CartCheckLine[] = [];
  let subtotal = 0;
  for (const { sku, qty } of lines) {
    const e = catalog.get(sku);
    if (!e) {
      result.push({ sku, qty, ok: false, reason: 'UNKNOWN_SKU', availableQty: null });
      continue;
    }
    if (!e.published) {
      result.push({ sku, qty, ok: false, reason: 'UNPUBLISHED', availableQty: null });
      continue;
    }
    const allowed = allowedQty(e.stock);
    if (allowed === 0) {
      result.push({ sku, qty, ok: false, reason: 'OUT_OF_STOCK', availableQty: 0, unitPrice: e.price });
      continue;
    }
    if (qty > allowed) {
      result.push({ sku, qty, ok: false, reason: 'INSUFFICIENT_STOCK', availableQty: allowed, unitPrice: e.price });
      continue;
    }
    const lineTotal = e.price.amount * qty;
    subtotal += lineTotal;
    result.push({ sku, qty, ok: true, unitPrice: e.price, lineTotal: eur(lineTotal), stock: e.stock });
  }
  return { lines: result, subtotal: eur(subtotal), priceChanged: false, checkedAt: now.toISOString() };
}

export type PricedLine = { sku: string; name: string; qty: number; unitPrice: Money; lineTotal: Money };

/** Provjera za startCheckout: sve mora biti ispravno, inače greška s prvim problemom. */
export function priceForCheckout(catalog: Catalog, linesInput: unknown): { lines: PricedLine[]; total: Money } {
  const lines = parseLines(linesInput, { allowEmpty: false });
  for (const { sku, qty } of lines) {
    const e = catalog.get(sku);
    if (e && e.published && qty > e.stock.maxPerOrder) throw new ShopError('INVALID_REQUEST', { sku });
  }
  const check = checkLines(catalog, lines);
  const bad = check.lines.find((l) => !l.ok);
  if (bad && !bad.ok) throw new ShopError(bad.reason, { sku: bad.sku, availableQty: bad.availableQty });
  const priced = check.lines.map((l) => {
    if (!l.ok) throw new ShopError('UNKNOWN');
    return { sku: l.sku, name: catalog.get(l.sku)!.name, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal };
  });
  return { lines: priced, total: check.subtotal };
}

/** Umanji zalihu za plaćenu narudžbu (pozivatelj jamči da se zove jednom po narudžbi). */
export function applySale(stock: Stock, qty: number): Stock {
  if (stock.quantity == null) return stock;
  const quantity = Math.max(0, stock.quantity - qty);
  return { ...stock, quantity, status: stock.status === 'backorder' ? 'backorder' : deriveStatus(quantity) };
}

export function setQuantity(stock: Stock, quantity: number): Stock {
  if (!Number.isInteger(quantity) || quantity < 0) throw new ShopError('INVALID_REQUEST');
  return { ...stock, quantity, status: deriveStatus(quantity) };
}

/** ≥ 128 bita slučajnosti (API-CONTRACT §3.7). */
export function newToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

export function isAllowedReturnUrl(url: string, allowedOrigins: readonly string[]): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && allowedOrigins.includes(u.origin);
  } catch {
    return false;
  }
}

export function withOrderToken(url: string, token: string): string {
  const u = new URL(url);
  u.searchParams.set('narudzba', token);
  return u.toString();
}

/** "marko.horvat@gmail.com" → "m***@gmail.com" (OrderStatus.email, API-CONTRACT §2). */
export function maskEmail(email: unknown): string | undefined {
  if (typeof email !== 'string') return undefined;
  const m = email.trim().match(/^([^@\s])[^@\s]*@([^@\s]+\.[^@\s]+)$/);
  return m ? `${m[1]}***@${m[2]}` : undefined;
}
