import Link from 'next/link';
import { hasContact, publishedLegal } from '@/content/site';

/** Podnožje bez velikog natpisa (GUIDE §2). Linkovi samo na stranice koje postoje i imaju potvrđen sadržaj. */
export function Footer({ note }: { note: string | null }) {
  const legal = publishedLegal();
  const info = [
    { href: '/o-nama/', label: 'O nama' },
    ...(hasContact() ? [{ href: '/kontakt/', label: 'Kontakt' }] : []),
    ...legal.map((p) => ({ href: `/${p.slug}/`, label: p.title })),
  ];
  return (
    <footer className="foot">
      <div className="fg">
        <div>
          <Link href="/" className="logo" aria-label="Camellia sinensis, početna">
            <img src="/brand/logo-okomiti.svg" alt="" width={80} height={84} loading="lazy" />
          </Link>
        </div>
        <nav aria-labelledby="f-shop">
          <h2 id="f-shop">Trgovina</h2>
          <Link href="/katalog/">Katalog</Link>
          <Link href="/katalog/puer/" prefetch={false}>Pu&apos;er</Link>
          <Link href="/katalog/pribor/" prefetch={false}>Pribor i knjige</Link>
          <Link href="/katalog/?namjena=poklon" prefetch={false}>Pokloni</Link>
        </nav>
        <nav aria-labelledby="f-info">
          <h2 id="f-info">Informacije</h2>
          {info.map((i) => (
            <Link key={i.href} href={i.href}>
              {i.label}
            </Link>
          ))}
        </nav>
        <div />
      </div>
      <div className="fb">
        <span>© 2026 Camellia sinensis</span>
        {note && <span data-testid="demo-note">{note}</span>}
        <span>Izrada: Perasma</span>
      </div>
    </footer>
  );
}
