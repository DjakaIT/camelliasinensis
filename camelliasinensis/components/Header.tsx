'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from './cart/CartContext';
import { IconMenu, IconSearch } from './Icons';

export type NavItem = { href: string; label: string; match: (p: string) => boolean };

export function Header({ nav }: { nav: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? '/';
  const { count, bump, openCart } = useCart();
  const badge = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false); // izbornik na mobitelu
  // Svi uređaji (Daniel, 19. 11. 2026.): traka se skrije čim se krene listati prema dolje, a vrati se pokretom prema gore.
  // Na samom vrhu stranice, na novoj stranici i dok je izbornik otvoren uvijek se vidi.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (y <= 4) {
          setHidden(false);
          last = y;
        } else if (Math.abs(y - last) > 4) {
          setHidden(y > last);
          last = y;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    setHidden(false);
    setOpen(false);
  }, [pathname]);

  // izbornik se zatvara tipkom Esc i dodirom izvan trake
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!bump || !badge.current) return;
    const b = badge.current;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }, [bump]);

  const isOn = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/katalog/' && pathname.startsWith('/proizvod/'));

  return (
    <header ref={bar} className={`bar${hidden && !open ? ' skriven' : ''}${open ? ' otvoren' : ''}`}>
      <Link href="/" className="logo" aria-label="Camellia sinensis, početna">
        <img src="/brand/logo-vodoravni.svg" alt="Camellia sinensis" width={137} height={44} />
      </Link>
      <nav className="links" aria-label="Glavna navigacija">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={isOn(n.href) ? 'on' : undefined} aria-current={isOn(n.href) ? 'page' : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="bar-r">
        <Link className="ib" href="/katalog/?trazi=1">
          <IconSearch />
          <span className="sr">Pretraži katalog</span>
        </Link>
        {/* Ime gumba nastaje iz vidljivog teksta ("Košarica, artikala: 2"), pa se poklapa s onim što se vidi. */}
        <button type="button" className="cartp" onClick={openCart} aria-haspopup="dialog">
          <span className="t">Košarica</span>
          <span className="sr">, artikala: </span>
          <span className="badge" ref={badge}>
            {count}
          </span>
        </button>
        {/* mobitel (do 820 px): samo logo, tražilica i izbornik; stranice i košarica su u izborniku */}
        <button
          type="button"
          className="ib burger"
          aria-expanded={open}
          aria-controls="mob-izbornik"
          aria-label={open ? 'Zatvori izbornik' : 'Izbornik'}
          onClick={() => setOpen((o) => !o)}
        >
          <IconMenu open={open} />
        </button>
      </div>
      <div className="mmenu" id="mob-izbornik" hidden={!open}>
        <nav aria-label="Izbornik">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={isOn(n.href) ? 'on' : undefined}
              aria-current={isOn(n.href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="mcart"
          onClick={() => {
            setOpen(false);
            openCart();
          }}
          aria-haspopup="dialog"
        >
          <span>Košarica</span>
          <span className="sr">, artikala: </span>
          <span className="mbadge">{count}</span>
        </button>
      </div>
    </header>
  );
}
