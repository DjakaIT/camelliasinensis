import Link from 'next/link';
import type { Contact } from '@/content/site';
import { MapOnClick } from './MapOnClick';

/** Kontakt samo s potvrđenim podacima. Kontakt forma iz prototipa je bila lažna i nije preuzeta. */
export function ContactView({ contact }: { contact: Contact }) {
  const a = contact.address;
  const q = a ? `${a.street}, ${a.postalCode} ${a.city}` : null;
  return (
    <section className="x-page x-contact">
      <div className="x-wrap">
        <nav aria-label="Putanja">
          <ol className="x-crumbs">
            <li>
              <Link href="/">Početna</Link>
            </li>
            <li>
              <span aria-current="page">Kontakt</span>
            </li>
          </ol>
        </nav>
        <h1 className="x-h1">Kontakt</h1>
        <div className="x-ct-grid">
          <div className="x-ct-info">
            {(a || contact.hours) && (
              <div className="x-ct-card">
                <h2>Trgovina</h2>
                {a && (
                  <address style={{ fontStyle: 'normal' }}>
                    {a.street}
                    <br />
                    {a.postalCode} {a.city}
                  </address>
                )}
                {contact.hours?.map((h) => (
                  <p key={h}>{h}</p>
                ))}
              </div>
            )}
            {(contact.email || contact.phone) && (
              <div className="x-ct-card">
                <h2>Javite se</h2>
                {contact.email && (
                  <p>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </p>
                )}
                {contact.phone && (
                  <p>
                    <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                  </p>
                )}
              </div>
            )}
          </div>
          {q && <MapOnClick query={q} />}
        </div>
      </div>
    </section>
  );
}
