// Stanje demo "backenda": osnovni katalog iz fixture + promjene (zaliha, cijena, narudžbe) u localStorageu.
// U Node okruženju (testovi) pohrana je u memoriji.
import demoLive from '../../../../fixtures/demo-live.json';
import type { Catalog, CatalogEntry, PricedLine } from '../../engine';
import type { Money, OrderStatus, Stock } from '../../types';
import type { Zivo } from '../../zivo';

export type DemoOrder = {
  id: string;
  ref: string;
  token: string;
  lines: PricedLine[];
  /** Međuzbroj proizvoda (bez dostave). */
  total: Money;
  status: OrderStatus['status'];
  createdAt: number;
  successUrl: string;
  cancelUrl: string;
  stockApplied: boolean;
  /** Popunjava stranica za plaćanje. Osobni podaci se ne spremaju, samo maskirani e-mail. */
  shipping?: { id: string; name: string; price: number };
  grandTotal?: Money;
  emailMasked?: string;
};

type Overrides = {
  stock: Record<string, Stock>;
  price: Record<string, number>;
  published: Record<string, boolean>;
  orders: Record<string, DemoOrder>;
  seq: number;
  /** verzija kataloga iz zivo.json na koju se odnose promjene zalihe i cijene u ovom pregledniku */
  zivoVerzija?: number;
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

/** živi podaci iz uredništva (lib/shop/zivo.ts) zamjenjuju podatke iz gradnje za SKU-ove koje stranica već ima */
let zivo: Zivo | null = null;

export function applyZivo(z: Zivo | null): void {
  zivo = z;
  if (!z) return;
  // uredništvo je spremilo novu verziju: probne promjene zalihe i cijene u ovom pregledniku više ne vrijede
  const o = load();
  if (o.zivoVerzija !== z.verzija) save({ ...o, stock: {}, price: {}, published: {}, zivoVerzija: z.verzija });
}

export function catalog(o = load()): Catalog {
  const m = new Map<string, CatalogEntry>();
  for (const [sku, built] of Object.entries(BASE)) {
    const b = zivo?.skus.get(sku) ?? built;
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
