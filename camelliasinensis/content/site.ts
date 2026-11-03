// Sadržaj stranice koji NIJE dio ugovora s backendom (API-CONTRACT §1.8).
//
// DUMMY: Daniel je 2. 11. 2026. tražio uvjerljive probne podatke (kontakt, Instagram, pravni tekstovi, priča brenda)
// da demo izgleda kao gotova stranica. Sve što je označeno s DUMMY treba zamijeniti Sarinim podacima.
// Build koji se smije indeksirati (produkcija) RUŠI SE dok je ijedan DUMMY uključen (scripts/postbuild.mjs).
import izdvojeno from '@/fixtures/izdvojeno.json';
import { FREE_SHIPPING_FROM, SHIPPING_METHODS } from '@/lib/shop/shipping';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://camelliasinensis.eu').replace(/\/+$/, '');
export const SHOP_NAME = 'Camellia sinensis';
export { FREE_SHIPPING_FROM };
/** Najniža cijena dostave, za prikaz "od 3,90 €" (obračun radi backend). */
export const SHIPPING_FROM_PRICE = Math.min(...SHIPPING_METHODS.map((m) => m.price));

/** Popis svega što je izmišljeno za demo. Prazan popis = spremno za produkciju. */
export const DUMMY_CONTENT: string[] = [
  'kontakt: adresa, telefon, e-mail, radno vrijeme',
  'instagram profil',
  'pravni tekstovi (uvjeti kupnje, privatnost, dostava i povrat, kolačići)',
  'priča brenda na naslovnici',
  'cijene dostave GLS (prag 50 € je potvrđen)',
  'popis GLS paketomata na demo blagajni',
];

export type Contact = {
  email: string | null;
  phone: string | null;
  /** Puna adresa trgovine; bez nje nema karte (GUIDE §2). */
  address: { street: string; postalCode: string; city: string } | null;
  hours: string[] | null;
};

/** DUMMY */
export const contact: Contact = {
  email: 'info@camelliasinensis.eu',
  phone: '+385 1 4567 890',
  address: { street: 'Tkalčićeva ulica 18', postalCode: '10000', city: 'Zagreb' },
  hours: ['Ponedjeljak – petak: 10 – 20 h', 'Subota: 9 – 14 h', 'Nedjeljom i blagdanima zatvoreno'],
};

export const hasContact = () => Boolean(contact.email || contact.phone || contact.address);

/** DUMMY: Sara potvrđuje točan profil. */
export const social = { instagram: 'https://www.instagram.com/camelliasinensis.zagreb/' as string | null };

/** Načini plaćanja koje nudi Stripe Checkout (kartice; Apple Pay i Google Pay ovisno o uređaju). */
export const PAYMENT_METHODS = ['Visa', 'Mastercard', 'Maestro', 'Apple Pay', 'Google Pay'];

/** DUMMY: kratka priča brenda za naslovnicu. */
export const brandStory = {
  title: 'Čaj s imenom i podrijetlom.',
  text:
    'Camellia sinensis je mala zagrebačka trgovina čaja. Biramo čajeve čiji znamo vrt, berbu i proizvođača: od obiteljskih ' +
    'vrtova u Darjeelingu do majstora bijelog čaja u Fujianu. Rastresiti listovi, bez vrećica i bez punila.',
};

export type LegalPage = { slug: string; title: string; description: string; html: string | null };

const shipFrom = `${FREE_SHIPPING_FROM / 100} €`;

/** DUMMY nacrti pravnih tekstova. Konačne tekstove priprema Sara s pravnikom prije otvaranja. */
export const legalPages: LegalPage[] = [
  {
    slug: 'uvjeti-kupnje',
    title: 'Uvjeti kupnje',
    description: 'Uvjeti kupnje u web trgovini Camellia sinensis: narudžba, cijene, plaćanje, dostava i pravo na odustanak.',
    html: `
<h2>1. Prodavatelj</h2>
<p>Web trgovinu camelliasinensis.eu vodi Camellia sinensis, Tkalčićeva ulica 18, 10000 Zagreb. Kontakt: info@camelliasinensis.eu.</p>
<h2>2. Narudžba</h2>
<p>Narudžba je zaprimljena kad plaćanje bude potvrđeno. Potvrdu narudžbe šaljemo na e-mail adresu koju ste upisali pri plaćanju.</p>
<h2>3. Cijene</h2>
<p>Sve cijene su u eurima i uključuju PDV. Trošak dostave prikazuje se prije plaćanja.</p>
<h2>4. Plaćanje</h2>
<p>Plaćanje karticom (Visa, Mastercard, Maestro), Apple Payem ili Google Payem obrađuje Stripe. Podatke o kartici ne vidimo i ne spremamo.</p>
<h2>5. Dostava</h2>
<p>Narudžbe šaljemo GLS-om na adresu ili u paketomat diljem Hrvatske. Za narudžbe od ${shipFrom} dostava je besplatna. Detalji su na stranici <a href="/povrat/">Dostava i povrat</a>.</p>
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
    description: 'Dostava GLS-om na adresu ili u paketomat, besplatna dostava od 50 €, povrat u 14 dana.',
    html: `
<h2>Dostava</h2>
<ul>
<li>GLS paketomat: 3,90 €, obično 1–2 radna dana.</li>
<li>GLS na adresu: 4,90 €, obično 1–3 radna dana.</li>
<li><strong>Besplatna dostava za narudžbe od ${shipFrom}.</strong></li>
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
