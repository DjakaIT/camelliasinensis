// Stanje demo "backenda": osnovni katalog iz fixture + promjene (zaliha, cijena, narudžbe) u localStorageu.
// U Node okruženju (testovi) pohrana je u memoriji.
import demoLive from '../../../../fixtures/demo-live.json';
import type { Catalog, CatalogEntry, PricedLine } from '../../engine';
import type { Money, OrderStatus, Stock } from '../../types';

export type DemoOrder = {
  id: string;
  ref: string;
  token: string;
  lines: PricedLine[];
  total: Money;
  status: OrderStatus['status'];
  createdAt: number;
  successUrl: string;
  cancelUrl: string;
  stockApplied: boolean;
};

type Overrides = {
  stock: Record<string, Stock>;
  price: Record<string, number>;
  published: Record<string, boolean>;
  orders: Record<string, DemoOrder>;
  seq: number;
};

const KEY = 'cs.demo.v1';
type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const memory = new Map<string, string>();
const memoryStore: KV = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => void memory.set(k, v),
  removeItem: (k) => void memory.delete(k),
};

function store(): KV {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // privatni način ili blokirana pohrana: radimo u memoriji
  }
  return memoryStore;
}

const empty = (): Overrides => ({ stock: {}, price: {}, published: {}, orders: {}, seq: 0 });

export function load(): Overrides {
  try {
    const raw = store().getItem(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as Partial<Overrides>;
    return { ...empty(), ...v };
  } catch {
    return empty();
  }
}

export function save(o: Overrides): void {
  try {
    store().setItem(KEY, JSON.stringify(o));
  } catch {
    // pohrana puna ili zabranjena; demo nastavlja bez trajnosti
  }
}

export function reset(): void {
  store().removeItem(KEY);
}

type Base = { name: string; price: Money; stock: Stock; published: boolean };
const BASE = (demoLive as unknown as { skus: Record<string, Base> }).skus;

export function catalog(o = load()): Catalog {
  const m = new Map<string, CatalogEntry>();
  for (const [sku, b] of Object.entries(BASE)) {
    m.set(sku, {
      sku,
      name: b.name,
      price: o.price[sku] != null ? { amount: o.price[sku]!, currency: 'EUR' } : b.price,
      stock: o.stock[sku] ?? b.stock,
      published: o.published[sku] ?? b.published,
    });
  }
  return m;
}

export const baseHas = (sku: string) => sku in BASE;
