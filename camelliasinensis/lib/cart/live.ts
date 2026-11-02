'use client';

// Živa cijena i zaliha za jedan SKU (API-CONTRACT §3.2): dijeljeni zahtjev, keš ≤ 30 s, osvježavanje pri povratku na karticu.
import { useCallback, useEffect, useState } from 'react';
import { getShop, ShopError, type LiveInfo } from '../shop';

const TTL = 30_000;
const cache = new Map<string, { at: number; p: Promise<LiveInfo | null> }>();

function fetchLive(sku: string, force = false): Promise<LiveInfo | null> {
  const hit = cache.get(sku);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.p;
  const p = getShop()
    .getLive([sku])
    .then((r) => r.find((x) => x.sku === sku) ?? null);
  cache.set(sku, { at: Date.now(), p });
  p.catch(() => cache.delete(sku));
  return p;
}

export type LiveState =
  | { status: 'loading' }
  | { status: 'ok'; info: LiveInfo }
  | { status: 'missing' } // backend ne poznaje SKU ili nije objavljen
  | { status: 'error'; error: ShopError };

export function useLive(sku: string) {
  const [state, setState] = useState<LiveState>({ status: 'loading' });

  const load = useCallback(
    (force = false) => {
      fetchLive(sku, force).then(
        (info) => setState(info ? { status: 'ok', info } : { status: 'missing' }),
        (e) => setState({ status: 'error', error: ShopError.from(e) }),
      );
    },
    [sku],
  );

  useEffect(() => {
    load();
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  return { state, refresh: () => load(true) };
}
