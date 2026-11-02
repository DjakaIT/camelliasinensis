'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconAlert, IconDone, IconWait } from '@/components/Icons';
import { ORDER_TOKEN_KEY } from '@/lib/cart/checkout';
import { clearCart } from '@/lib/cart/store';
import { getShop, ShopError, type OrderStatus } from '@/lib/shop';

const POLL_MS = 3000;
const POLL_FOR_MS = 30_000;

type View = { kind: 'checking' } | { kind: 'paid'; ref?: string } | { kind: 'pending-timeout' } | { kind: 'failed' } | { kind: 'unknown' } | { kind: 'error'; text: string };

/**
 * Posjet stranici NIJE dokaz plaćanja (API-CONTRACT §3.5): "plaćanje potvrđeno" samo za status `paid`.
 * Za `pending` provjeravamo svake 3 s do 30 s. Košarica se briše tek kad je `paid`.
 */
export function OrderResult() {
  const [view, setView] = useState<View>({ kind: 'checking' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fromUrl = new URLSearchParams(window.location.search).get('narudzba');
    let token = fromUrl;
    try {
      token ||= sessionStorage.getItem(ORDER_TOKEN_KEY);
    } catch {
      // nema sessionStoragea
    }
    if (!token) {
      setView({ kind: 'unknown' });
      return;
    }
    const t0 = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      let s: OrderStatus;
      try {
        s = await getShop().getOrderStatus(token!);
      } catch (e) {
        if (Date.now() - t0 < POLL_FOR_MS) timer = setTimeout(tick, POLL_MS);
        else setView({ kind: 'error', text: ShopError.from(e).message });
        return;
      }
      if (s.status === 'paid') {
        clearCart();
        try {
          sessionStorage.removeItem(ORDER_TOKEN_KEY);
        } catch {
          // ništa
        }
        setView({ kind: 'paid', ref: s.orderRef });
      } else if (s.status === 'pending') {
        if (Date.now() - t0 < POLL_FOR_MS) timer = setTimeout(tick, POLL_MS);
        else setView({ kind: 'pending-timeout' });
      } else if (s.status === 'failed' || s.status === 'cancelled') setView({ kind: 'failed' });
      else setView({ kind: 'unknown' });
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="x-done">
      <div className="x-wrap x-narrow" aria-live="polite" data-testid="order-result" data-state={view.kind}>
        {view.kind === 'checking' && (
          <>
            <span className="x-donei wait">
              <IconWait size={72} />
            </span>
            <h1 className="x-h2">Plaćanje se obrađuje</h1>
            <p>Provjeravamo status plaćanja. Ne zatvarajte ovu stranicu.</p>
          </>
        )}
        {view.kind === 'paid' && (
          <>
            <span className="x-donei">
              <IconDone size={72} />
            </span>
            <h1 className="x-h1">Hvala na narudžbi!</h1>
            <p>
              Plaćanje je potvrđeno{view.ref ? (
                <>
                  , broj narudžbe <b>{view.ref}</b>
                </>
              ) : null}
              .
            </p>
            <div className="x-donebtns">
              <Link href="/katalog/" className="x-btn">
                Nastavi kupovinu
              </Link>
              <Link href="/" className="x-btn x-ghost">
                Na početnu
              </Link>
            </div>
          </>
        )}
        {view.kind === 'pending-timeout' && (
          <>
            <span className="x-donei">
              <IconWait size={72} />
            </span>
            <h1 className="x-h2">Plaćanje još nije potvrđeno</h1>
            <p>
              Potvrda plaćanja kasni. Ako je novac skinut s računa, narudžba će biti potvrđena čim stigne obavijest o plaćanju. Ne
              plaćajte ponovno. Košarica je sačuvana.
            </p>
            <div className="x-donebtns">
              <button type="button" className="x-btn" onClick={() => window.location.reload()}>
                Provjeri ponovno
              </button>
              <Link href="/kosarica/" className="x-btn x-ghost">
                Natrag u košaricu
              </Link>
            </div>
          </>
        )}
        {view.kind === 'failed' && (
          <>
            <span className="x-donei">
              <IconAlert size={72} />
            </span>
            <h1 className="x-h2">Plaćanje nije uspjelo</h1>
            <p>Ništa nije naplaćeno. Košarica je sačuvana pa možete pokušati ponovno.</p>
            <div className="x-donebtns">
              <Link href="/kosarica/" className="x-btn">
                Natrag u košaricu
              </Link>
            </div>
          </>
        )}
        {(view.kind === 'unknown' || view.kind === 'error') && (
          <>
            <span className="x-donei">
              <IconAlert size={72} />
            </span>
            <h1 className="x-h2">Narudžba nije pronađena</h1>
            <p>{view.kind === 'error' ? view.text : 'Za ovu poveznicu ne možemo pronaći narudžbu.'}</p>
            <div className="x-donebtns">
              <Link href="/kosarica/" className="x-btn">
                Natrag u košaricu
              </Link>
              <Link href="/" className="x-btn x-ghost">
                Na početnu
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
