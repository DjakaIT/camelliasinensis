'use client';

import Link from 'next/link';
import { NoImage, Picture } from '@/components/Picture';
import { productHref } from '@/lib/catalog-view';
import { formatMoney } from '@/lib/format';
import { MAX_QTY } from '@/lib/cart/store';
import { useCart } from './CartContext';
import { useCatalogIndex } from './CatalogIndex';

type Props = { onNavigate?: () => void; big?: boolean };

/** Popis redaka košarice (ladica i stranica /kosarica/). Cijene i zaliha iz zadnjeg checkCart, inače iz builda. */
export function CartLines({ onNavigate, big }: Props) {
  const products = useCatalogIndex();
  const { lines, setQty, remove, checkState, notices, changedPrices, announce } = useCart();
  const check = 'check' in checkState ? checkState.check : undefined;

  return (
    <ul style={{ listStyle: 'none' }}>
      {lines.map((l) => {
        const p = products[l.sku];
        const c = check?.lines.find((x) => x.sku === l.sku);
        const unit = c ? (c.ok ? c.unitPrice.amount : (c.unitPrice?.amount ?? null)) : (p?.price ?? null);
        const bad = c ? !c.ok : false;
        const max = c?.ok ? Math.min(MAX_QTY, c.stock.quantity ?? c.stock.maxPerOrder, c.stock.maxPerOrder) : MAX_QTY;
        const notice = notices[l.sku];
        const changed = changedPrices[l.sku];
        const name = p?.name ?? l.sku;
        const href = p ? productHref(p.slug) : null;
        return (
          <li key={l.sku} className={`x-di${bad ? ' bad' : ''}`} data-sku={l.sku}>
            {href ? (
              <Link href={href} className="x-dimg" onClick={onNavigate} tabIndex={-1} aria-hidden="true">
                {p?.image ? <Picture src={p.image.src} alt="" sizes={big ? '90px' : '70px'} /> : <NoImage />}
              </Link>
            ) : (
              <span className="x-dimg">
                <NoImage />
              </span>
            )}
            <div className="x-dinfo">
              {href ? (
                <Link href={href} onClick={onNavigate}>
                  <b>{name}</b>
                </Link>
              ) : (
                <b>{name}</b>
              )}
              <small>
                {p?.unitLabel}
                {unit != null ? ` · ${formatMoney(unit)}` : ''}
              </small>
              {changed && (
                <p className="x-lmsg warn">
                  Cijena je promijenjena: bila je {formatMoney(changed.from)}, sada je {formatMoney(changed.to)}.
                </p>
              )}
              {notice && <p className={`x-lmsg${notice.kind === 'warn' ? ' warn' : ''}`}>{notice.text}</p>}
              {!bad && (
                <div className="x-qty sm" role="group" aria-label={`Količina: ${name}`}>
                  <button
                    type="button"
                    aria-label={`Smanji količinu: ${name}`}
                    onClick={() => (l.qty <= 1 ? remove(l.sku) : (setQty(l.sku, l.qty - 1), announce(`Količina: ${l.qty - 1}`)))}
                  >
                    −
                  </button>
                  <output aria-live="off">{l.qty}</output>
                  <button
                    type="button"
                    aria-label={`Povećaj količinu: ${name}`}
                    disabled={l.qty >= max}
                    onClick={() => (setQty(l.sku, l.qty + 1), announce(`Količina: ${l.qty + 1}`))}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
            <div className="x-dright">
              <b>{c?.ok ? formatMoney(c.lineTotal) : unit != null && !bad ? formatMoney(unit * l.qty) : ''}</b>
              <button type="button" className="x-link" onClick={() => remove(l.sku)} aria-label={`Ukloni ${name} iz košarice`}>
                Ukloni
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
