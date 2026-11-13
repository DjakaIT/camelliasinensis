// Sadržaj stranice koji NIJE dio ugovora s backendom (API-CONTRACT §1.8).
//
// Probni (DUMMY) podaci su uklonjeni 13. 11. 2026. kad je Daniel otvorio indeksiranje: adresa, telefon, radno vrijeme i Instagram
// nisu bili stvarni pa su maknuti, a ne zamijenjeni drugim izmišljenima. Kad Sara potvrdi podatke, upišu se u `contact` i `social`.
// Ako se ikad opet doda izmišljen sadržaj, upiši ga u DUMMY_CONTENT: build koji se smije indeksirati tada puca (app/layout.tsx).
import izdvojeno from '@/fixtures/izdvojeno.json';
import { FREE_SHIPPING_FROM, FREE_SHIPPING_GIFT, SHIPPING_METHODS } from '@/lib/shop/shipping';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://camelliasinensis.eu').replace(/\/+$/, '');
export const SHOP_NAME = 'Camellia sinensis';
export { FREE_SHIPPING_FROM, FREE_SHIPPING_GIFT };
/** Najniža cijena dostave, za prikaz "od 3,90 €" (obračun radi backend). */
export const SHIPPING_FROM_PRICE = Math.min(...SHIPPING_METHODS.map((m) => m.price));

/** Popis svega što je izmišljeno za demo. Prazan popis = smije se indeksirati. */
export const DUMMY_CONTENT: string[] = [];

export type Contact = {
  email: string | null;
  phone: string | null;
  /** Puna adresa trgovine; bez nje nema karte (GUIDE §2). */
  address: { street: string; postalCode: string; city: string } | null;
  hours: string[] | null;
};

/** Samo potvrđeno: e-mail na domeni trgovine. Adresa, telefon i radno vrijeme dodaju se kad ih Sara potvrdi. */
export const contact: Contact = {
  email: 'info@camelliasinensis.eu',
  phone: null,
  address: null,
  hours: null,
};

export const hasContact = () => Boolean(contact.email || contact.phone || contact.address);

/** Instagram se upisuje kad Sara potvrdi točan profil. */
export const social = { instagram: null as string | null };

/** Načini plaćanja koje nudi Stripe Checkout (kartice; Apple Pay i Google Pay ovisno o uređaju). */
export const PAYMENT_METHODS = ['Visa', 'Mastercard', 'Maestro', 'Apple Pay', 'Google Pay'];

/** Kratka priča brenda za naslovnicu (općenita, bez tvrdnji o podrijetlu koje trgovina nije potvrdila). */
export const brandStory = {
  title: 'Rastresiti čaj iz Zagreba.',
  text:
    'Camellia sinensis je zagrebačka trgovina čaja. U ponudi su rastresiti bijeli, zeleni, oolong, crni, pu’er i biljni čajevi ' +
    'te pribor za pripremu, s dostavom po cijeloj Hrvatskoj.',
};

export type LegalPage = { slug: string; title: string; description: string; html: string | null };

const shipFrom = `${FREE_SHIPPING_FROM / 100} €`;

/** Nacrti pravnih tekstova. Sara ih prije pravog poslovanja pregledava s pravnikom i dopunjuje podacima tvrtke (naziv, OIB, adresa). */
export const legalPages: LegalPage[] = [
  {
    slug: 'uvjeti-kupnje',
    title: 'Uvjeti kupnje',
    description: 'Uvjeti kupnje u web trgovini Camellia sinensis: narudžba, cijene, plaćanje, dostava i pravo na odustanak.',
    html: `
<h2>1. Prodavatelj</h2>
<p>Web trgovinu camelliasinensis.eu vodi Camellia sinensis, Zagreb. Kontakt: info@camelliasinensis.eu.</p>
<h2>2. Narudžba</h2>
<p>Narudžba je zaprimljena kad plaćanje bude potvrđeno. Potvrdu narudžbe šaljemo na e-mail adresu koju ste upisali pri plaćanju.</p>
<h2>3. Cijene</h2>
<p>Sve cijene su u eurima i uključuju PDV. Trošak dostave prikazuje se prije plaćanja.</p>
<h2>4. Plaćanje</h2>
<p>Plaćanje karticom (Visa, Mastercard, Maestro), Apple Payem ili Google Payem obrađuje Stripe. Podatke o kartici ne vidimo i ne spremamo.</p>
<h2>5. Dostava</h2>
<p>Narudžbe šaljemo GLS-om na adresu ili u paketomat diljem Hrvatske. Za narudžbe od ${shipFrom} dostava je besplatna, uz poklon (${FREE_SHIPPING_GIFT}). Detalji su na stranici <a href="/povrat/">Dostava i povrat</a>.</p>
<h2>6. Pravo na odustanak</h2>
<p>Od kupnje možete odustati u roku od 14 dana od primitka pošiljke, bez navođenja razloga. Neotvorene proizvode vratite u originalnom pakiranju.</p>
<h2>7. Reklamacije</h2>
<p>Reklamaciju možete poslati na info@camelliasinensis.eu. Odgovorit ćemo u roku od 15 dana.</p>`,
  },
  {
    slug: 'privatnost',
    title: 'Pravila privatnosti',
    description: 'Kako Camellia sinensis prikuplja, koristi i štiti osobne podatke kupaca.',
    html: `
<h2>Koje podatke prikupljamo</h2>
<p>Pri narudžbi: ime i prezime, e-mail, adresu dostave i broj mobitela (za obavijest GLS-a). Podatke o kartici obrađuje Stripe i mi ih ne vidimo.</p>
<h2>Zašto</h2>
<p>Isključivo za izvršenje narudžbe, dostavu, izdavanje računa i odgovor na vaše upite. Ne šaljemo promotivne poruke bez vašeg pristanka.</p>
<h2>S kim ih dijelimo</h2>
<p>Sa Stripeom (plaćanje) i GLS-om (dostava), samo u mjeri potrebnoj za njihovu uslugu.</p>
<h2>Koliko dugo</h2>
<p>Podatke o narudžbama čuvamo onoliko koliko propisuju porezni i računovodstveni propisi.</p>
<h2>Vaša prava</h2>
<p>Imate pravo na uvid, ispravak i brisanje podataka te pravo na prigovor Agenciji za zaštitu osobnih podataka (AZOP). Pišite nam na info@camelliasinensis.eu.</p>`,
  },
  {
    slug: 'povrat',
    title: 'Dostava i povrat',
    description: 'Dostava GLS-om na adresu ili u paketomat, besplatna dostava i platnena torba na poklon od 50 €, povrat u 14 dana.',
    html: `
<h2>Dostava</h2>
<ul>
<li>GLS paketomat: 3,90 €, obično 1–2 radna dana.</li>
<li>GLS na adresu: 4,90 €, obično 1–3 radna dana.</li>
<li><strong>Besplatna dostava za narudžbe od ${shipFrom}, uz poklon (${FREE_SHIPPING_GIFT}).</strong></li>
</ul>
<p>Narudžbe zaprimljene radnim danom do 13 h šaljemo isti dan. Kad GLS preuzme paket, dobit ćete poruku s poveznicom za praćenje.</p>
<h2>Povrat</h2>
<p>U roku od 14 dana od primitka možete odustati od kupnje. Javite nam se na info@camelliasinensis.eu, a neotvorene proizvode pošaljite u originalnom pakiranju. Novac vraćamo istim načinom plaćanja najkasnije 14 dana nakon što primimo povrat.</p>
<h2>Oštećena pošiljka</h2>
<p>Ako pošiljka stigne oštećena, fotografirajte je i javite nam se u roku od 3 dana. Poslat ćemo novu ili vratiti novac.</p>`,
  },
  {
    slug: 'kolacici',
    title: 'Kolačići',
    description: 'Koje kolačiće i lokalnu pohranu koristi stranica Camellia sinensis.',
    // Ovo je točno za sadašnji kod: nema analitike ni kolačića trećih strana.
    html: `
<p>Stranica ne koristi kolačiće za praćenje ni analitiku. U vašem pregledniku sprema samo ono što je potrebno za kupnju:</p>
<ul>
<li><strong>cs.cart.v1</strong> (lokalna pohrana): sadržaj košarice, samo šifre proizvoda i količine.</li>
<li><strong>cs.prices.v1</strong> (lokalna pohrana): cijene koje ste zadnje vidjeli, da vas upozorimo ako se promijene.</li>
<li><strong>cs.delivery.v1</strong> (lokalna pohrana): odabrani način dostave i GLS paketomat. Lokaciju za "Najbliži meni" preglednik koristi samo za izračun udaljenosti i nikamo je ne šalje.</li>
<li><strong>cs.order.token</strong> (pohrana sesije): oznaka narudžbe dok se plaćanje potvrđuje. Briše se zatvaranjem kartice.</li>
<li><strong>cs.demo.v1</strong> (lokalna pohrana, samo u demo verziji): probna zaliha i narudžbe.</li>
</ul>
<p>Karta na stranici Kontakt (Google Maps) učitava se tek kad kliknete "Prikaži kartu". Tada Google može postaviti svoje kolačiće.</p>
<p>Stranica za plaćanje (Stripe) koristi vlastite kolačiće nužne za sigurnost plaćanja.</p>`,
  },
];

export const publishedLegal = () => legalPages.filter((p) => p.html);
export const legalPage = (slug: string) => legalPages.find((p) => p.slug === slug && p.html) ?? null;

/** Istaknuto na polici naslovnice: uređuje se u uredništvu (Izdvojeno), stiže kroz fixtures/izdvojeno.json. */
export const FEATURED_SKUS: string[] = izdvojeno.polica;
