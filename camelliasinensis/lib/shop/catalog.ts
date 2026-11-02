// Katalog pri buildu (Server Components, generateStaticParams). Ne uvozi se u klijentski kod.
import { sanitizeDescription } from '../sanitize';
import { getShop } from './index';
import type { Product, ProductType, ProductTypeInfo } from './types';
import { assertValidCatalog } from './validate';

type CatalogData = { products: Product[]; types: ProductTypeInfo[] };
let cache: Promise<CatalogData> | null = null;

async function load(): Promise<CatalogData> {
  const shop = getShop();
  const [raw, types] = await Promise.all([shop.listProducts(), shop.listTypes()]);
  const published = raw.filter((p) => p.published);
  assertValidCatalog(published);
  const products = published.map((p) => ({ ...p, descriptionHtml: sanitizeDescription(p.descriptionHtml) }));
  return { products, types };
}

export function getCatalog(): Promise<CatalogData> {
  cache ??= load();
  return cache;
}

export async function getProducts() {
  return (await getCatalog()).products;
}

export async function getTypes() {
  return (await getCatalog()).types;
}

export async function getProductBySlug(slug: string) {
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}

export async function getType(key: string): Promise<ProductTypeInfo | null> {
  return (await getTypes()).find((t) => t.key === (key as ProductType)) ?? null;
}
