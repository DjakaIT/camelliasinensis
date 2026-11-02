'use client';

// LAŽNA stranica za plaćanje adaptera `demo` (API-CONTRACT §4). Predstavlja hosted checkout backenda;
// postoji samo u demo buildu (*.demo.tsx). Ništa se ne naplaćuje i ne prikupljaju se podaci o kartici ni adresi.
import { useEffect, useState } from 'react';
import { formatMoney } from '../../../format';
import { ShopError } from '../../errors';
import { demoControls } from './index';
import type { DemoOrder } from './state';

export function DemoCheckoutPage() {
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<DemoOrder | null | undefined>(undefined);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    setToken(t);
    setOrder(t ? demoControls.getOrder(t) : null);
  }, []);

  if (order === undefined) return <section className="x-done" />;

  if (!order || !token) {
    return (
      <section className="x-done">
        <div className="x-wrap x-narrow x-testpay">
          <span className="x-testtag lbl">Test</span>
          <h1 className="x-h2">Narudžba nije pronađena</h1>
          <p>Ova testna poveznica za plaćanje ne vrijedi ili je istekla.</p>
        </div>
      </section>
    );
  }

  const act = (fn: () => { successUrl: string; cancelUrl: string; status: string }, to: 'success' | 'cancel') => {
    try {
      const o = fn();
      window.location.assign(to === 'success' ? o.successUrl : o.cancelUrl);
    } catch (e) {
      setMsg(ShopError.from(e).message);
      setOrder(demoControls.getOrder(token));
    }
  };

  return (
    <section className="x-done">
      <div className="x-wrap x-narrow x-testpay" data-testid="demo-checkout">
        <span className="x-testtag lbl">Testna stranica za plaćanje</span>
        <h1 className="x-h2">Plaćanje (test)</h1>
        <p className="x-small">
          Ovo je simulacija stranice za plaćanje koju će dati backend. Novac se ne naplaćuje, a podaci o kartici i adresi se ne
          upisuju.
        </p>
        <div className="x-paylines">
          {order.lines.map((l) => (
            <div className="x-row" key={l.sku}>
              <span>
                {l.qty} × {l.name}
              </span>
              <span>{formatMoney(l.lineTotal)}</span>
            </div>
          ))}
          <div className="x-row x-tot">
            <span>Ukupno (bez dostave)</span>
            <b>{formatMoney(order.total)}</b>
          </div>
        </div>
        {order.status !== 'pending' && <p className="x-note warn">Status narudžbe: {order.status}</p>}
        {msg && (
          <p className="x-note err" role="alert">
            {msg}
          </p>
        )}
        <div className="x-donebtns">
          <button type="button" className="x-btn" disabled={order.status !== 'pending'} onClick={() => act(() => demoControls.pay(token), 'success')}>
            Plati (test)
          </button>
          <button
            type="button"
            className="x-btn x-ghost"
            disabled={order.status !== 'pending'}
            onClick={() => setMsg('Kartica je odbijena (test). Pokušajte ponovno ili odustanite.')}
          >
            Simuliraj odbijenu karticu
          </button>
          <button type="button" className="x-btn x-ghost" onClick={() => act(() => demoControls.cancel(token), 'cancel')}>
            Odustani
          </button>
        </div>
      </div>
    </section>
  );
}
