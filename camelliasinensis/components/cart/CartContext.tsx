'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  countItems,
  getServerSnapshot,
  qtyOf,
  readCart,
  readSeenPrices,
  rememberPrices,
  removeLine,
  setQty as storeSetQty,
  subscribe,
} from '@/lib/cart/store';
import { getShop, ShopError, shopErrorMessage, type CartCheck, type CartLine } from '@/lib/shop';

export type AddResult = { ok: boolean; message?: string };
export type LineNotice = { kind: 'warn' | 'err'; text: string };
type CheckState =
  | { status: 'idle' }
  | { status: 'loading'; check?: CartCheck }
  | { status: 'ready'; check: CartCheck }
  | { status: 'error'; error: string; check?: CartCheck };
type Toast = { id: number; text: string; action?: boolean };

type Ctx = {
  lines: CartLine[];
  count: number;
  bump: number;
  drawerOpen: boolean;
  openCart(): void;
  closeCart(): void;
  add(item: { sku: string; name: string; seenPrice?: number }, qty?: number): Promise<AddResult>;
  setQty(sku: string, qty: number): void;
  remove(sku: string): void;
  toast: Toast | null;
  showToast(text: string, action?: boolean): void;
  announce(text: string): void;
  // provjera košarice (ladica i stranica /kosarica/)
  watch(): () => void;
  checkState: CheckState;
  recheck(): void;
  notices: Record<string, LineNotice>;
  changedPrices: Record<string, { from: number; to: number }>;
  acceptPrices(): void;
};

const CartCtx = createContext<Ctx | null>(null);

export function useCart(): Ctx {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart izvan CartProvider');
  return c;
}

/** Komponenta koja prikazuje košaricu traži svježu provjeru dok je prikazana. */
export function useWatchCart(active = true) {
  const { watch } = useCart();
  useEffect(() => (active ? watch() : undefined), [watch, active]);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, readCart, getServerSnapshot);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [live, setLive] = useState('');
  const [watchers, setWatchers] = useState(0);
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' });
  const [notices, setNotices] = useState<Record<string, LineNotice>>({});
  const [seen, setSeen] = useState<Record<string, number>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const [nonce, setNonce] = useState(0);

  // Inicijalizira backend odmah (u demo buildu tada postoji i window.__cs za simulaciju zalihe).
  useEffect(() => {
    getShop();
  }, []);

  const showToast = useCallback((text: string, action = false) => {
    setToast({ id: Date.now(), text, action });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const announce = useCallback((text: string) => {
    setLive('');
    requestAnimationFrame(() => setLive(text));
  }, []);

  const clearNotice = (sku: string) =>
    setNotices((n) => {
      if (!(sku in n)) return n;
      const next = { ...n };
      delete next[sku];
      return next;
    });

  const setQty = useCallback((sku: string, qty: number) => {
    clearNotice(sku);
    storeSetQty(sku, qty);
  }, []);

  const remove = useCallback(
    (sku: string) => {
      clearNotice(sku);
      removeLine(sku);
      announce('Artikl je uklonjen iz košarice.');
    },
    [announce],
  );

  const add = useCallback<Ctx['add']>(
    async ({ sku, name, seenPrice }, qty = 1) => {
      const current = qtyOf(sku);
      const want = current + qty;
      if (seenPrice) rememberPrices({ [sku]: seenPrice });
      const added = (n: number, extra?: string) => {
        storeSetQty(sku, n);
        setBump((b) => b + 1);
        showToast(`${name} je u košarici${extra ? `. ${extra}` : ''}`, true);
      };
      try {
        const check = await getShop().checkCart([{ sku, qty: want }]);
        const line = check.lines[0];
        if (line?.ok) {
          clearNotice(sku);
          added(want);
          return { ok: true };
        }
        if (line && line.reason === 'INSUFFICIENT_STOCK' && (line.availableQty ?? 0) > 0) {
          const n = line.availableQty ?? 0;
          const message = shopErrorMessage('INSUFFICIENT_STOCK', { availableQty: n });
          if (n > current) added(n, `Količina je ograničena na ${n}.`);
          return { ok: false, message: n > current ? `${message} U košarici: ${n}.` : `${message} Već su svi u košarici.` };
        }
        const reason = line && !line.ok ? line.reason : 'UNKNOWN';
        return { ok: false, message: shopErrorMessage(reason === 'INSUFFICIENT_STOCK' ? 'OUT_OF_STOCK' : reason) };
      } catch (e) {
        const err = ShopError.from(e);
        if (err.code === 'NETWORK' || err.code === 'UNKNOWN') {
          // API-CONTRACT §3.2: bez veze dodavanje ostaje moguće; sve se ponovno provjerava prije plaćanja.
          added(want);
          return { ok: true, message: 'Dodano. Zaliha i cijena potvrdit će se prije plaćanja.' };
        }
        return { ok: false, message: err.message };
      }
    },
    [showToast],
  );

  const watch = useCallback(() => {
    setWatchers((w) => w + 1);
    return () => setWatchers((w) => w - 1);
  }, []);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);
  const openCart = useCallback(() => setDrawerOpen(true), []);
  const closeCart = useCallback(() => setDrawerOpen(false), []);

  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    if (watchers <= 0) return;
    const current = JSON.parse(linesKey) as CartLine[];
    if (current.length === 0) {
      setCheckState({ status: 'idle' });
      return;
    }
    const id = ++reqId.current;
    setCheckState((s) => ({ status: 'loading', check: 'check' in s ? s.check : undefined }));
    const t = setTimeout(async () => {
      try {
        const check = await getShop().checkCart(current);
        if (id !== reqId.current) return;
        const seenNow = readSeenPrices();
        const fresh: Record<string, number> = {};
        const newNotices: Record<string, LineNotice> = {};
        for (const l of check.lines) {
          if (l.ok && seenNow[l.sku] == null) fresh[l.sku] = l.unitPrice.amount;
          if (!l.ok && l.reason === 'INSUFFICIENT_STOCK' && (l.availableQty ?? 0) > 0) {
            // Količina se ograniči i kupac to jasno vidi (API-CONTRACT §5).
            newNotices[l.sku] = {
              kind: 'warn',
              text: `${shopErrorMessage('INSUFFICIENT_STOCK', { availableQty: l.availableQty })} Količina je smanjena s ${l.qty} na ${l.availableQty}.`,
            };
            storeSetQty(l.sku, l.availableQty ?? 0);
          } else if (!l.ok) {
            newNotices[l.sku] = {
              kind: 'err',
              text: shopErrorMessage(l.reason === 'INSUFFICIENT_STOCK' ? 'OUT_OF_STOCK' : l.reason),
            };
          }
        }
        if (Object.keys(fresh).length) rememberPrices(fresh);
        setSeen(readSeenPrices());
        setNotices((n) => ({ ...n, ...newNotices }));
        setCheckState({ status: 'ready', check });
      } catch (e) {
        if (id !== reqId.current) return;
        setCheckState((s) => ({ status: 'error', error: ShopError.from(e).message, check: 'check' in s ? s.check : undefined }));
      }
    }, 200);
    return () => clearTimeout(t);
  }, [linesKey, watchers, nonce]);

  const changedPrices = useMemo(() => {
    const out: Record<string, { from: number; to: number }> = {};
    const check = 'check' in checkState ? checkState.check : undefined;
    for (const l of check?.lines ?? []) {
      if (l.ok && seen[l.sku] != null && seen[l.sku] !== l.unitPrice.amount) out[l.sku] = { from: seen[l.sku]!, to: l.unitPrice.amount };
    }
    return out;
  }, [checkState, seen]);

  const acceptPrices = useCallback(() => {
    rememberPrices(Object.fromEntries(Object.entries(changedPrices).map(([sku, c]) => [sku, c.to])));
    setSeen(readSeenPrices());
  }, [changedPrices]);

  const value = useMemo<Ctx>(
    () => ({
      lines,
      count: countItems(lines),
      bump,
      drawerOpen,
      openCart,
      closeCart,
      add,
      setQty,
      remove,
      toast,
      showToast,
      announce,
      watch,
      checkState,
      recheck,
      notices,
      changedPrices,
      acceptPrices,
    }),
    [
      lines,
      bump,
      drawerOpen,
      openCart,
      closeCart,
      add,
      setQty,
      remove,
      toast,
      showToast,
      announce,
      watch,
      checkState,
      recheck,
      notices,
      changedPrices,
      acceptPrices,
    ],
  );

  return (
    <CartCtx.Provider value={value}>
      {children}
      <div className="sr" aria-live="polite" aria-atomic="true">
        {live}
      </div>
    </CartCtx.Provider>
  );
}
