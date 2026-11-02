import type { Money } from './shop/types';

const nf = new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

/** 1190 → "11,90 €" (novac je u centima, GUIDE §1.4). */
export function formatMoney(m: Money | number): string {
  const cents = typeof m === 'number' ? m : m.amount;
  if (!Number.isInteger(cents)) throw new Error(`Iznos mora biti cijeli broj centi, a ne ${cents}`);
  // Intl u nekim okruženjima koristi uski razmak za tisućice; ujednačavamo na točku (hr: 1.234,50 €).
  return `${nf.format(cents / 100).replace(/[  \s]/g, '.')} €`;
}

/** 1 komad, 2 komada, 5 komada (hrvatska množina). */
export function pieces(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} komad`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} komada`;
  return `${n} komada`;
}

/** "zadnji komad", "zadnja 2 komada", "zadnja 3 komada". */
export function lastPieces(n: number): string {
  if (n === 1) return 'Zadnji komad';
  return `Zadnja ${n} komada`;
}

/** 30. 10. 2026. */
export function formatDate(d: Date): string {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`;
}
