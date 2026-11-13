import Link from 'next/link';
import { contact, hasContact, PAYMENT_METHODS, publishedLegal, social } from '@/content/site';
import { IconInstagram } from './Icons';

/** Podnožje bez velikog natpisa (GUIDE §2). Linkovi samo na stranice koje postoje. */
export function Footer({ note }: { note: string | null }) {
  const legal = publishedLegal();
  const info = [
    { href: '/o-nama/', label: 'O nama' },
    ...(hasContact() ? [{ href: '/kontakt/', label: 'Kontakt' }] : []),
    ...legal.map((p) => ({ href: `/${p.slug}/`, label: p.title })),
  ];
  const a = contact.address;
  return (
    <footer className="foot">
      <div className="fg">
        <div>
          <Link href="/" className="logo" aria-label="Camellia sinensis, početna">
            <img src="/brand/logo-okomiti.svg" alt="Camellia sinensis" width={80} height={84} loading="lazy" />
          </Link>
        </div>
        <nav aria-labelledby="f-shop">
          <h2 id="f-shop">Trgovina</h2>
          <Link href="/katalog/">Katalog</Link>
          <Link href="/katalog/puer/" prefetch={false}>
            Pu&apos;er
          </Link>
          <Link href="/katalog/pribor/" prefetch={false}>
            Pribor i knjige
          </Link>
          <Link href="/katalog/?namjena=poklon" prefetch={false}>
            Pokloni
          </Link>
        </nav>
        <nav aria-labelledby="f-info">
          <h2 id="f-info">Informacije</h2>
          {info.map((i) => (
            <Link key={i.href} href={i.href} prefetch={false}>
              {i.label}
            </Link>
          ))}
        </nav>
        {(a || contact.email || social.instagram) && (
          <div>
            <h2>Zagreb</h2>
            {a && (
              <address className="f-addr">
                {a.street}, {a.city}
                {contact.hours?.[0] && (
                  <>
                    <br />
                    {contact.hours[0]}
                  </>
                )}
              </address>
            )}
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            {social.instagram && (
              <a href={social.instagram} className="f-ig" rel="noopener noreferrer" target="_blank">
                <IconInstagram /> Instagram
              </a>
            )}
          </div>
        )}
      </div>
      <div className="fb">
        <span>© 2026 Camellia sinensis</span>
        <span>{PAYMENT_METHODS.join(' · ')}</span>
        {note && <span data-testid="demo-note">{note}</span>}
        <span>Izrada: Perasma</span>
      </div>
    </footer>
  );
}
