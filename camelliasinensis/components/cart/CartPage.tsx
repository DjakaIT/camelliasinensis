'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CartLines } from './CartLines';
import { useCart, useWatchCart } from './CartContext';
import { CheckoutPanel } from './CheckoutPanel';

export function CartPage() {
  const { count } = useCart();
  const [mounted, setMounted] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  useWatchCart(true);

  useEffect(() => {
    setMounted(true);
    setCancelled(new URLSearchParams(window.location.search).get('otkazano') === '1');
  }, []);

  return (
    <section className="x-co">
      <div className="x-wrap">
        <nav aria-label="Putanja">
          <ol className="x-crumbs">
            <li>
              <Link href="/">Početna</Link>
            </li>
            <li>
              <span aria-current="page">Košarica</span>
            </li>
          </ol>
        </nav>
        <h1 className="x-h1">Košarica</h1>
        {cancelled && (
          <p className="x-note warn" role="status" style={{ margin: '20px 26px 0' }} data-testid="cancelled">
            Plaćanje je otkazano. Ništa nije naplaćeno, a košarica je ostala kakva je bila.
          </p>
        )}
        {!mounted ? null : count === 0 ? (
          <div className="x-done" style={{ paddingTop: 24 }}>
            <div className="x-narrow" style={{ margin: 0 }}>
              <p>Košarica je prazna.</p>
              <Link href="/katalog/" className="x-btn">
                Pogledaj katalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="x-cogrid">
            <div className="x-colist">
              <CartLines big />
            </div>
            <aside className="x-sum" aria-labelledby="sum-h">
              <h2 id="sum-h">Vaša narudžba</h2>
              <CheckoutPanel />
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
