'use client';

import { useEffect, useState } from 'react';
import { IconArrow } from '@/components/Icons';
import { beginCheckout } from '@/lib/cart/checkout';
import { FREE_SHIPPING_FROM, FREE_SHIPPING_GIFT } from '@/content/site';
import { formatMoney } from '@/lib/format';
import { useCart } from './CartContext';
import { useCatalogIndex } from './CatalogIndex';
import { type DeliveryChoice, DeliveryPicker, readDeliveryChoice, toDelivery } from './DeliveryPicker';

/**
 * Međuzbroj, upozorenja, način dostave (i paketomat) i "Na blagajnu". Cijenu dostave obračunava backend; ovdje se
 * prikazuje koliko nedostaje do besplatne dostave, a backendu ide samo odabrani način i ID paketomata.
 */
export function CheckoutPanel() {
  const { lines, checkState, changedPrices, acceptPrices, recheck } = useCart();
  const index = useCatalogIndex();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [delivery, setDelivery] = useState<DeliveryChoice>({ method: 'gls-adresa', locker: null });
  useEffect(() => setDelivery(readDeliveryChoice()), []);
  const chosen = toDelivery(delivery);

  const check = 'check' in checkState ? checkState.check : undefined;
  const fresh = checkState.status === 'ready';
  const badLines = check?.lines.filter((l) => !l.ok) ?? [];
  const hasChanged = Object.keys(changedPrices).length > 0;
  // Do odgovora backenda prikazujemo zbroj iz builda s jasnom napomenom.
  const subtotal = check ? check.subtotal.amount : lines.reduce((s, l) => s + (index[l.sku]?.price ?? 0) * l.qty, 0);
  const canPay = fresh && badLines.length === 0 && !hasChanged && !busy && chosen !== null;

  async function pay() {
    setBusy(true);
    setError('');
    const r = await beginCheckout(chosen ?? undefined);
    if (r.kind === 'redirect') {
      window.location.assign(r.url);
      return;
    }
    setBusy(false);
    if (r.kind === 'blocked') {
      setError(r.reason === 'price' ? 'Cijena se promijenila. Provjerite novu cijenu prije plaćanja.' : 'Ispravite označene artikle prije plaćanja.');
    } else setError(r.error.message);
    recheck();
  }

  const missing = Math.max(0, FREE_SHIPPING_FROM - subtotal);

  return (
    <>
      <div className="x-ship" data-testid="free-shipping">
        <p>
          {missing > 0 ? (
            <>
              Još <b>{formatMoney(missing)}</b> do besplatne dostave i poklona: {FREE_SHIPPING_GIFT}
            </>
          ) : (
            <>
              <b>Besplatna dostava</b> je uključena, a na poklon dobivate: {FREE_SHIPPING_GIFT}
            </>
          )}
        </p>
        <div className="x-bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_FROM) * 100)}%` }} />
        </div>
      </div>
      <div className="x-row">
        <span>Međuzbroj</span>
        <b data-testid="subtotal">{formatMoney(subtotal)}</b>
      </div>
      {checkState.status === 'loading' && <p className="x-small" role="status">Provjeravamo cijene i zalihu…</p>}
      {checkState.status === 'error' && (
        <div className="x-note err" role="alert">
          <span>{checkState.error} Cijene će se potvrditi pri plaćanju.</span>
          <button type="button" className="x-link" onClick={recheck}>
            Pokušaj ponovno
          </button>
        </div>
      )}
      {badLines.length > 0 && (
        <p className="x-note err" role="alert">
          Neki artikli nisu dostupni. Uklonite ih da biste nastavili na plaćanje.
        </p>
      )}
      {hasChanged && (
        <div className="x-note warn" role="alert">
          <span>Cijena nekih artikala se promijenila. Nove cijene su prikazane iznad.</span>
          <button type="button" className="x-link" onClick={acceptPrices}>
            Prihvaćam nove cijene
          </button>
        </div>
      )}
      <DeliveryPicker subtotal={subtotal} value={delivery} onChange={setDelivery} />
      {!chosen && <p className="x-small">Odaberite paketomat za nastavak.</p>}
      <button type="button" className="x-btn x-wide" onClick={pay} disabled={!canPay} aria-busy={busy}>
        {busy ? 'Preusmjeravamo…' : 'Na blagajnu'} <IconArrow />
      </button>
      {error && (
        <p className="x-err" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
