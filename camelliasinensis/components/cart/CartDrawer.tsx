'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { IconX } from '@/components/Icons';
import { CartLines } from './CartLines';
import { useCart, useWatchCart } from './CartContext';
import { CheckoutPanel } from './CheckoutPanel';

export function CartDrawer() {
  const { drawerOpen, closeCart, count, toast, openCart } = useCart();
  const panel = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  useWatchCart(drawerOpen);

  // zatvori pri promjeni rute
  useEffect(() => {
    closeCart();
  }, [pathname, closeCart]);

  useEffect(() => {
    if (!drawerOpen) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    document.body.classList.add('x-lock');
    const el = panel.current;
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,[tabindex="0"]')].filter(
          (x) => x.offsetParent !== null,
        );
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('x-lock');
      returnFocus.current?.focus?.();
    };
  }, [drawerOpen, closeCart]);

  return (
    <>
      <div className={`x-scrim${drawerOpen ? ' on' : ''}`} onClick={closeCart} aria-hidden="true" />
      <aside
        ref={panel}
        className={`x-drawer${drawerOpen ? ' on' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
      >
        <div className="x-dh">
          <h2 id="drawer-title">
            Košarica <em>{count ? `(${count})` : ''}</em>
          </h2>
          <button type="button" className="x-icon" onClick={closeCart} aria-label="Zatvori košaricu" data-autofocus>
            <IconX />
          </button>
        </div>
        <div className="x-dl">
          {count ? (
            <>
              <CartLines onNavigate={closeCart} />
              <p style={{ padding: '6px 0 16px' }}>
                <Link href="/kosarica/" className="x-link" onClick={closeCart}>
                  Pregled košarice
                </Link>
              </p>
            </>
          ) : (
            <div className="x-dempty">
              <p>Košarica je prazna.</p>
              <Link href="/katalog/" className="x-btn" onClick={closeCart}>
                Pogledaj katalog
              </Link>
            </div>
          )}
        </div>
        {count > 0 && (
          <div className="x-df">
            <CheckoutPanel />
          </div>
        )}
      </aside>
      <div className={`x-toast${toast ? ' on' : ''}`} role="status">
        {toast && (
          <>
            <span>{toast.text}</span>
            {toast.action && (
              <button type="button" onClick={openCart}>
                Pogledaj
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
