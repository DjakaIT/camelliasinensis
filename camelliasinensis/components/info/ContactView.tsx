import Link from 'next/link';
import { IconClock, IconInstagram, IconMail, IconPhone, IconPin } from '@/components/Icons';
import { social, type Contact } from '@/content/site';
import { ContactForm } from './ContactForm';
import { MapOnClick } from './MapOnClick';

/** Kontakt po dizajnu B: forma lijevo, podaci i karta (na klik) desno. */
export function ContactView({ contact, demo }: { contact: Contact; demo: boolean }) {
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
          <ContactForm demo={demo} />
          <div className="x-ct-info">
            {(a || contact.hours) && (
              <div className="x-ct-card">
                <h2>Sjedište</h2>
                {a && (
                  <div className="ci">
                    <IconPin />
                    <address style={{ fontStyle: 'normal' }}>
                      {a.street}
                      <br />
                      {a.postalCode} {a.city}
                    </address>
                  </div>
                )}
                {contact.hours && (
                  <div className="ci">
                    <IconClock size={20} />
                    <span>
                      {contact.hours.map((h) => (
                        <span key={h} style={{ display: 'block' }}>
                          {h}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="x-ct-card">
              <h2>Javite se</h2>
              {contact.email && (
                <div className="ci">
                  <IconMail />
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </div>
              )}
              {contact.phone && (
                <div className="ci">
                  <IconPhone />
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
                </div>
              )}
              {social.instagram && (
                <div className="ci">
                  <IconInstagram size={20} />
                  <a href={social.instagram} rel="noopener noreferrer" target="_blank">
                    Instagram
                  </a>
                </div>
              )}
              <p className="x-small">Odgovaramo na e-mail, obično isti ili sljedeći radni dan.</p>
            </div>
            {q && <MapOnClick query={q} />}
          </div>
        </div>
      </div>
    </section>
  );
}
