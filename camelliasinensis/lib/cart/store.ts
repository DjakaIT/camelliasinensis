// Košarica u pregledniku (API-CONTRACT §1.1): samo { sku, qty }, localStorage `cs.cart.v1`, verzionirano.
import type { CartLine } from '../shop/types';

export const CART_KEY = 'cs.cart.v1';
const SEEN_KEY = 'cs.prices.v1';
const VERSION = 1;
export const MAX_LINES = 50;
export const MAX_QTY = 99;

type Stored = { v: number; lines: CartLine[]; updatedAt: string };
type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: CartLine[] | null = null;
const EMPTY: CartLine[] = [];

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Čita i čisti spremljenu košaricu. Nepoznata verzija ili neispravan oblik → prazna košarica. */
export function parseStored(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as Partial<Stored>;
    if (data?.v !== VERSION || !Array.isArray(data.lines)) return [];
    const merged = new Map<string, number>();
    for (const l of data.lines) {
      if (!l || typeof l.sku !== 'string' || !l.sku || l.sku.length > 64) continue;
      if (!Number.isInteger(l.qty) || l.qty < 1) continue;
      merged.set(l.sku, Math.min(MAX_QTY, (merged.get(l.sku) ?? 0) + l.qty));
    }
    return [...merged].slice(0, MAX_LINES).map(([sku, qty]) => ({ sku, qty }));
  } catch {
    return [];
  }
}

export function readCart(): CartLine[] {
  if (snapshot) return snapshot;
  snapshot = parseStored(storage()?.getItem(CART_KEY) ?? null);
  return snapshot;
}

function write(lines: CartLine[]) {
  snapshot = lines;
  try {
    const data: Stored = { v: VERSION, lines, updatedAt: new Date().toISOString() };
    storage()?.setItem(CART_KEY, JSON.stringify(data));
  } catch {
    // pohrana nedostupna: košarica živi do zatvaranja kartice
  }
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY || e.key === null) {
      snapshot = null;
      l();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export const getServerSnapshot = () => EMPTY;

export function qtyOf(sku: string): number {
  return readCart().find((l) => l.sku === sku)?.qty ?? 0;
}

/** Postavi točnu količinu retka (0 = ukloni). */
export function setQty(sku: string, qty: number) {
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));
  const lines = readCart().filter((l) => l.sku !== sku);
  const idx = readCart().findIndex((l) => l.sku === sku);
  if (q > 0) {
    const next = [...lines];
    next.splice(idx < 0 ? next.length : idx, 0, { sku, qty: q });
    if (next.length > MAX_LINES) return;
    write(next);
  } else write(lines);
}

export function addQty(sku: string, delta: number) {
  setQty(sku, qtyOf(sku) + delta);
}

export function removeLine(sku: string) {
  setQty(sku, 0);
}

export function clearCart() {
  write([]);
}

export const countItems = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty, 0);

/* Cijene koje je kupac zadnji put vidio, da se promjena cijene jasno pokaže prije plaćanja.
   Klijent ih NIKAD ne šalje backendu (API-CONTRACT §1.2). */
export function readSeenPrices(): Record<string, number> {
  try {
    const v = JSON.parse(storage()?.getItem(SEEN_KEY) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v).filter(([, a]) => Number.isInteger(a))) as Record<string, number>;
  } catch {
    return {};
  }
}

export function rememberPrices(prices: Record<string, number>) {
  try {
    storage()?.setItem(SEEN_KEY, JSON.stringify({ ...readSeenPrices(), ...prices }));
  } catch {
    // nije kritično
  }
}

/** Test pomoćnik: zaboravi međuspremnik nakon ručne promjene localStoragea. */
export function _resetSnapshot() {
  snapshot = null;
}
