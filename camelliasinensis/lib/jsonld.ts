// Strukturirani podaci (schema.org, JSON-LD) samo iz stvarnih podataka stranice (GUIDE §6) i u skladu s vidljivim
// tekstom (Google: "make sure structured data matches the visible content"). Bez aggregateRating i review.
// Dostava i povrat prema Googleovim zahtjevima za merchant listing (OfferShippingDetails, MerchantReturnPolicy).
import { contact, FREE_SHIPPING_FROM, hasContact, SHOP_NAME, SITE_URL, social } from '@/content/site';
import { SHIPPING_METHODS } from './shop/shipping';
import { htmlToText } from './sanitize';
import { absoluteUrl } from './seo';
import type { Product } from './shop/types';

const AVAILABILITY: Record<Product['stock']['status'], string> = {
  instock: 'https://schema.org/InStock',
  low: 'https://schema.org/LimitedAvailability',
  outofstock: 'https://schema.org/OutOfStock',
  backorder: 'https://schema.org/BackOrder',
};

export const STORE_ID = `${SITE_URL}/#trgovina`;
const eur = (cents: number) => (cents / 100).toFixed(2);

/** JSON za <script type="application/ld+json">: "</script>" unutar JSON-a se ne smije pojaviti */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/**
 * Trgovina (Store je LocalBusiness: fizička trgovina u Zagrebu i web trgovina) i web stranica, na svakoj stranici.
 * Adresa, telefon i e-mail su iz content/site.ts (kontakt), pa se mijenjaju zajedno s vidljivim podacima.
 */
export function storeJsonLd(): string {
  const a = hasContact() ? contact.address : null;
  const store = {
    '@type': ['Store', 'Organization'],
    '@id': STORE_ID,
    name: SHOP_NAME,
    url: `${SITE_URL}/`,
    logo: absoluteUrl('/apple-touch-icon.png'),
    image: absoluteUrl('/img/hero/hero-tea.jpg'),
    description:
      "Trgovina čaja u Zagrebu: rastresiti bijeli, zeleni, oolong, crni, pu'er, aromatizirani i biljni čajevi te pribor za pripremu, s dostavom po cijeloj Hrvatskoj.",
    ...(hasContact() && contact.email ? { email: contact.email } : {}),
    ...(hasContact() && contact.phone ? { telephone: contact.phone } : {}),
    ...(a
      ? { address: { '@type': 'PostalAddress', streetAddress: a.street, postalCode: a.postalCode, addressLocality: a.city, addressCountry: 'HR' } }
      : {}),
    areaServed: { '@type': 'Country', name: 'Hrvatska' },
    currenciesAccepted: 'EUR',
    paymentAccepted: 'Visa, Mastercard, Maestro, Apple Pay, Google Pay',
    ...(social.instagram ? { sameAs: [social.instagram] } : {}),
  };
  const site = { '@type': 'WebSite', '@id': `${SITE_URL}/#web`, url: `${SITE_URL}/`, name: SHOP_NAME, inLanguage: 'hr', publisher: { '@id': STORE_ID } };
  return ldJson({ '@context': 'https://schema.org', '@graph': [store, site] });
}

/** Putanja (BreadcrumbList), ista kao vidljiva navigacija "Početna › Katalog › …" */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): string {
  return ldJson({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  });
}

/** Česta pitanja (FAQPage) iz istog teksta koji je vidljiv na stranici */
export function faqJsonLd(faq: { q: string; a: string }[]): string {
  return ldJson({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  });
}

/** dostava za jedan komad proizvoda: najjeftiniji GLS način, besplatno ako je cijena već iznad praga */
function shippingDetails(price: number) {
  const free = price >= FREE_SHIPPING_FROM;
  return SHIPPING_METHODS.map((m) => ({
    '@type': 'OfferShippingDetails',
    shippingLabel: m.name,
    shippingRate: { '@type': 'MonetaryAmount', value: free ? '0' : eur(m.price), currency: 'EUR' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'HR' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: m.id === 'gls-adresa' ? 3 : 2, unitCode: 'DAY' },
    },
  }));
}

/** zakonsko pravo na odustanak od 14 dana (kupnja na daljinu u EU), povrat poštom */
const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'HR',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
};

export function productJsonLd(p: Product, typeName: string): string {
  const url = absoluteUrl(`/proizvod/${p.slug}/`);
  return ldJson({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    description: htmlToText(p.descriptionHtml),
    category: typeName,
    url,
    ...(p.images.length ? { image: p.images.map((i) => absoluteUrl(i.src)) } : {}),
    offers: {
      '@type': 'Offer',
      seller: { '@id': STORE_ID, '@type': 'Organization', name: SHOP_NAME },
      price: eur(p.price.amount),
      priceCurrency: p.price.currency,
      availability: AVAILABILITY[p.stock.status],
      itemCondition: 'https://schema.org/NewCondition',
      url,
      shippingDetails: shippingDetails(p.price.amount),
      hasMerchantReturnPolicy: RETURN_POLICY,
    },
  });
}
