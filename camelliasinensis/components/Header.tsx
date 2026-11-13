'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from './cart/CartContext';
import { IconSearch } from './Icons';

export type NavItem = { href: string; label: string; match: (p: string) => boolean };

export function Header({ nav }: { nav: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? '/';
  const { count, bump, openCart } = useCart();
  const badge = useRef<HTMLSpanElement>(null);
  // Mobitel (Daniel, 13. 11. 2026.): traka je gore, pri listanju prema dolje se skriva, a pokretom prema gore vraća
  // (CSS samo do 820 px; na računalu je uvijek vidljiva). Pri vrhu stranice i na novoj stranici uvijek se vidi.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (y < 80) {
          setHidden(false);
          last = y;
        } else if (Math.abs(y - last) > 8) {
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
  useEffect(() => setHidden(false), [pathname]);

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
    <header className={`bar${hidden ? ' skriven' : ''}`}>
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
      </div>
    </header>
  );
}
