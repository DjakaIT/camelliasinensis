// Sadržaj stranice koji NIJE dio ugovora s backendom (API-CONTRACT §1.8). Sve što Sara još nije potvrdila je null:
// takve sekcije se ne prikazuju i ne linkaju iz navigacije ni podnožja (START-PROMPT M7, GUIDE §1.3).

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://camelliasinensis.eu').replace(/\/+$/, '');
export const SHOP_NAME = 'Camellia sinensis';

export type Contact = {
  email: string | null;
  phone: string | null;
  /** Puna adresa trgovine; bez nje nema karte (GUIDE §2). */
  address: { street: string; postalCode: string; city: string } | null;
  hours: string[] | null;
};

/** [ČEKA SARU] e-mail, telefon, adresa i radno vrijeme. */
export const contact: Contact = {
  email: null,
  phone: null,
  address: null,
  hours: null,
};

export const hasContact = () => Boolean(contact.email || contact.phone || contact.address);

/** Pravni tekstovi: [ČEKA SARU / pravnika]. Stranica postoji tek kad je tekst potvrđen. */
export type LegalPage = { slug: string; title: string; description: string; html: string | null };

export const legalPages: LegalPage[] = [
  { slug: 'uvjeti-kupnje', title: 'Uvjeti kupnje', description: 'Uvjeti kupnje u web trgovini Camellia sinensis.', html: null },
  { slug: 'privatnost', title: 'Pravila privatnosti', description: 'Kako Camellia sinensis obrađuje osobne podatke.', html: null },
  { slug: 'povrat', title: 'Dostava i povrat', description: 'Dostava, povrat i reklamacije u trgovini Camellia sinensis.', html: null },
  { slug: 'kolacici', title: 'Kolačići', description: 'Koje kolačiće i lokalnu pohranu koristi stranica Camellia sinensis.', html: null },
];

export const publishedLegal = () => legalPages.filter((p) => p.html);
export const legalPage = (slug: string) => legalPages.find((p) => p.slug === slug && p.html) ?? null;

/** Istaknuto na polici naslovnice (redoslijed iz prototipa). */
export const FEATURED_SKUS = ['CSTVI-282', 'CSTV-237', 'CSTN-220', 'CSTW-1', 'CSTB-6', 'CSTP-88', 'CSTHJC-79', 'CSTN-97', 'CSTO-2'];
/** Proizvod u pločici "Pu'er" na naslovnici. */
export const PUER_SPOTLIGHT_SKU = 'CSTVI-282';
