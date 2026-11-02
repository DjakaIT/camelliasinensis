'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { CaffeineDots } from '@/components/Icons';
import { allowedFrom, stockText } from '@/lib/cart/stock-text';
import { useLive } from '@/lib/cart/live';
import { qtyOf, rememberPrices } from '@/lib/cart/store';
import { formatMoney } from '@/lib/format';

type Props = { sku: string; name: string; unitLabel: string; buildPrice: number; caffeine: string | null; caffeineLevel: number | null };

/** Cijena (iz builda dok getLive ne odgovori). Ako getLive ne uspije, ostaje cijena iz builda s napomenom. */
export function LivePrice({ sku, unitLabel, buildPrice, caffeine, caffeineLevel }: Omit<Props, 'name'>) {
  const { state } = useLive(sku);
  const price = state.status === 'ok' ? state.info.price.amount : buildPrice;
  useEffect(() => {
    if (state.status === 'ok') rememberPrices({ [sku]: state.info.price.amount });
  }, [state, sku]);
  return (
    <>
      <div className="x-pprice">
        <b data-testid="price">{formatMoney(price)}</b>
        <small>/ {unitLabel}</small>
        {caffeine && caffeineLevel != null && (
          <span className="x-pkf">
            <CaffeineDots level={caffeineLevel} /> {caffeine}
          </span>
        )}
      </div>
      {state.status === 'error' && <p className="x-small">Cijena će se potvrditi pri plaćanju.</p>}
    </>
  );
}

/** Količina, "Dodaj u košaricu" i stanje zalihe (sva stanja iz GUIDE §2). */
export function BuyRow({ sku, name, buildPrice }: Pick<Props, 'sku' | 'name' | 'buildPrice'>) {
  const { state, refresh } = useLive(sku);
  const { add, lines } = useCart();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const inCart = lines.find((l) => l.sku === sku)?.qty ?? 0;
  const allowed = allowedFrom(state); // null = ne znamo (greška ili učitavanje)
  const room = allowed == null ? 99 : Math.max(0, allowed - inCart);
  const soldOut = allowed === 0 || state.status === 'missing';
  const max = Math.max(1, room);
  const q = Math.min(qty, max);
  const text = stockText(state);

  async function onAdd() {
    setBusy(true);
    setMsg(null);
    const price = state.status === 'ok' ? state.info.price.amount : buildPrice;
    const before = qtyOf(sku);
    const r = await add({ sku, name, seenPrice: price }, q);
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setTimeout(() => setDone(false), 1400);
      setQty(1);
      if (r.message) setMsg({ kind: 'ok', text: r.message });
    } else {
      setMsg({ kind: 'err', text: r.message ?? 'Nažalost, nema dovoljno komada.' });
    }
    if (!r.ok || qtyOf(sku) !== before + q) refresh();
  }

  return (
    <>
      <p className={`x-stock ${text.cls}`} data-testid="stock" role="status">
        {text.label}
      </p>
      <div className="x-buy" style={{ marginTop: 14 }}>
        <div className="x-qty" role="group" aria-label="Količina">
          <button type="button" aria-label="Manje" onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1 || soldOut}>
            −
          </button>
          <output aria-live="polite" aria-label="Količina">
            {q}
          </output>
          <button type="button" aria-label="Više" onClick={() => setQty(Math.min(max, q + 1))} disabled={q >= max || soldOut}>
            +
          </button>
        </div>
        <button
          type="button"
          className={`x-btn x-addbig${done ? ' ok' : ''}`}
          onClick={onAdd}
          disabled={busy || soldOut || (allowed != null && room === 0)}
          aria-busy={busy}
          data-testid="add-to-cart"
        >
          {soldOut ? 'Nema na zalihi' : done ? 'Dodano ✓' : allowed != null && room === 0 ? 'Svi komadi su u košarici' : 'Dodaj u košaricu'}
        </button>
      </div>
      {msg && (
        <p className={`x-note ${msg.kind === 'err' ? 'err' : 'ok'} x-buymsg`} role={msg.kind === 'err' ? 'alert' : 'status'} data-testid="buy-msg">
          {msg.text}
        </p>
      )}
    </>
  );
}
