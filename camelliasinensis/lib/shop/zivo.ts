// Živi podaci iz uredništva (public_html/zivo.json, urednistvo/php/lib/zivo.php): cijena, zaliha i objavljenost vrijede
// odmah nakon spremanja, bez nove gradnje. Jedan zahtjev po učitavanju stranice, ponovno pri povratku na karticu.
// Bez datoteke (prije prvog spremanja, održavanje, greška mreže) ili s neispravnim sadržajem vrijede podaci iz gradnje.
import type { Money, Stock } from './types';

export type ZivoStavka = { name: string; price: Money; stock: Stock; published: boolean };
export type Zivo = { verzija: number; skus: Map<string, ZivoStavka> };

const STATUSI = new Set(['instock', 'low', 'outofstock', 'backorder']);
const SKU_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** provjera oblika: datoteka je naša, ali stranica se ne smije srušiti na pokvarenoj ili podmetnutoj */
export function parseZivo(raw: unknown): Zivo | null {
  if (!raw || typeof raw !== 'object') return null;
  const { verzija, skus } = raw as { verzija?: unknown; skus?: unknown };
  if (!Number.isInteger(verzija) || !skus || typeof skus !== 'object' || Array.isArray(skus)) return null;
  const out = new Map<string, ZivoStavka>();
  for (const [sku, v] of Object.entries(skus as Record<string, unknown>)) {
    if (!SKU_RE.test(sku) || !v || typeof v !== 'object') continue;
    const s = v as { name?: unknown; price?: { amount?: unknown; currency?: unknown }; stock?: Partial<Stock>; published?: unknown };
    const amount = s.price?.amount;
    const st = s.stock;
    if (typeof s.name !== 'string' || typeof s.published !== 'boolean') continue;
    if (!Number.isInteger(amount) || (amount as number) <= 0 || s.price?.currency !== 'EUR') continue;
    if (!st || !STATUSI.has(st.status as string) || !Number.isInteger(st.maxPerOrder)) continue;
    if (st.quantity !== null && !Number.isInteger(st.quantity)) continue;
    out.set(sku, {
      name: s.name,
      price: { amount: amount as number, currency: 'EUR' },
      stock: { status: st.status!, quantity: st.quantity ?? null, maxPerOrder: st.maxPerOrder! },
      published: s.published,
    });
  }
  return { verzija: verzija as number, skus: out };
}

let pending: Promise<Zivo | null> | null = null;

/** samo gradnja za hosting (npm run build:hosting) ima zivo.json; lokalno i u E2E vrijede podaci iz gradnje */
const UKLJUCENO = process.env.NEXT_PUBLIC_ZIVO === '1';

export function loadZivo(): Promise<Zivo | null> {
  if (!UKLJUCENO || typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve(null);
  pending ??= fetch(`/zivo.json?t=${Date.now()}`, { cache: 'no-store', credentials: 'omit' })
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
    .then(parseZivo, () => null)
    .catch(() => null);
  return pending;
}

/** sljedeće čitanje ide ponovno na poslužitelj (npr. kad se korisnik vrati na karticu) */
export function forgetZivo(): void {
  pending = null;
}
