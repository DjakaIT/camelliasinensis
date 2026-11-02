import { lastPieces } from '../format';
import type { LiveState } from './live';

/** Koliko se smije dodati prema živoj zalihi; null = ne znamo (učitavanje ili greška). */
export function allowedFrom(state: LiveState): number | null {
  if (state.status === 'missing') return 0;
  if (state.status !== 'ok') return null;
  const s = state.info.stock;
  if (!state.info.available || s.status === 'outofstock') return 0;
  if (s.status === 'backorder' || s.quantity == null) return s.maxPerOrder;
  return Math.max(0, Math.min(s.quantity, s.maxPerOrder));
}

export function stockText(state: LiveState): { label: string; cls: string } {
  switch (state.status) {
    case 'loading':
      return { label: 'Provjeravamo zalihu…', cls: 'wait' };
    case 'error':
      return { label: 'Zalihu trenutno ne možemo provjeriti. Provjerit ćemo je pri dodavanju u košaricu.', cls: 'err' };
    case 'missing':
      return { label: 'Ovaj artikl trenutno nije u ponudi.', cls: 'out' };
  }
  const s = state.info.stock;
  if (!state.info.available || s.status === 'outofstock') return { label: 'Nema na zalihi', cls: 'out' };
  if (s.status === 'backorder') return { label: 'Po narudžbi', cls: 'low' };
  if (s.status === 'low') return { label: s.quantity != null ? lastPieces(s.quantity) : 'Još samo nekoliko komada', cls: 'low' };
  return { label: 'Na zalihi', cls: '' };
}
