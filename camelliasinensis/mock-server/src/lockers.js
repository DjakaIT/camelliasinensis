// GLS paketomati za provjeru odabira iz košarice (isti popis kao na hostingu: public/gls/paketomati.json).
import { readFileSync } from 'node:fs';
import { lockerFromRow } from '../../lib/shop/shipping.ts';

let index = null;

export function findLocker(id) {
  if (!index) {
    index = new Map();
    try {
      const d = JSON.parse(readFileSync(new URL('../../public/gls/paketomati.json', import.meta.url), 'utf8'));
      for (const r of d.paketomati ?? []) index.set(r[0], lockerFromRow(r));
    } catch {
      // bez popisa nijedan paketomat nije valjan
    }
  }
  return index.get(id) ?? null;
}
