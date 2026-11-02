// JSON-LD `Product` samo iz stvarnih podataka (GUIDE §6): bez aggregateRating i review.
import { SHOP_NAME } from '@/content/site';
import { htmlToText } from './sanitize';
import { absoluteUrl } from './seo';
import type { Product } from './shop/types';

const AVAILABILITY: Record<Product['stock']['status'], string> = {
  instock: 'https://schema.org/InStock',
  low: 'https://schema.org/LimitedAvailability',
  outofstock: 'https://schema.org/OutOfStock',
  backorder: 'https://schema.org/BackOrder',
};

export function productJsonLd(p: Product, typeName: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    description: htmlToText(p.descriptionHtml),
    category: typeName,
    url: absoluteUrl(`/proizvod/${p.slug}/`),
    ...(p.images.length ? { image: p.images.map((i) => absoluteUrl(i.src)) } : {}),
    offers: {
      '@type': 'Offer',
      seller: { '@type': 'Organization', name: SHOP_NAME },
      price: (p.price.amount / 100).toFixed(2),
      priceCurrency: p.price.currency,
      availability: AVAILABILITY[p.stock.status],
      url: absoluteUrl(`/proizvod/${p.slug}/`),
    },
  };
  // </script> unutar JSON-a se ne smije pojaviti
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
