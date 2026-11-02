'use client';

import { useState } from 'react';
import { useCart } from './cart/CartContext';
import { IconCheck, IconPlus } from './Icons';

/** Okrugli "+" na kartici proizvoda. Zaliha se provjerava pri dodavanju (API-CONTRACT §1.6). */
export function AddButton({ sku, name, price, soldOut }: { sku: string; name: string; price: number; soldOut?: boolean }) {
  const { add, showToast } = useCart();
  const [state, setState] = useState<'idle' | 'busy' | 'ok'>('idle');

  async function onClick() {
    if (state === 'busy') return;
    setState('busy');
    const r = await add({ sku, name, seenPrice: price });
    if (!r.ok && r.message) showToast(r.message);
    setState(r.ok ? 'ok' : 'idle');
    if (r.ok) setTimeout(() => setState('idle'), 900);
  }

  return (
    <button
      type="button"
      className={`plus${state === 'ok' ? ' ok' : ''}`}
      onClick={onClick}
      disabled={soldOut}
      aria-busy={state === 'busy'}
      aria-label={soldOut ? `${name}: rasprodano` : `Dodaj ${name} u košaricu`}
    >
      {state === 'ok' ? <IconCheck /> : <IconPlus />}
    </button>
  );
}
