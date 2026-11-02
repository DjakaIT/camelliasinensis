// Lagani oblik proizvoda za klijentske komponente (kartice, filtri), da se opisi ne šalju u bundle.
import type { Product, ProductImage, ProductType, Stock } from './shop/types';

export type CardProduct = {
  sku: string;
  slug: string;
  name: string;
  type: ProductType;
  typeName: string;
  unitLabel: string;
  price: number; // centi, iz builda (prikaz do potvrde getLive/checkCart)
  image: ProductImage | null;
  origin: string | null;
  caffeine: number | null;
  flavors: string[];
  moods: string[];
  form: string | null;
  bio: boolean;
  rare: boolean;
  isNew: boolean;
  brewTemp: string | null;
  stock: Stock;
  search: string;
};

export function toCard(p: Product, typeName: string, plainDescription = ''): CardProduct {
  const a = p.attributes;
  return {
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    type: p.type,
    typeName,
    unitLabel: p.unitLabel,
    price: p.price.amount,
    image: p.images[0] ?? null,
    origin: a.origin ?? null,
    caffeine: a.caffeine ?? null,
    flavors: a.flavors,
    moods: a.moods,
    form: a.form ?? null,
    bio: a.badges.includes('bio'),
    rare: a.badges.includes('rijetko'),
    isNew: a.badges.includes('novo'),
    brewTemp: a.brew?.temp ?? null,
    stock: p.stock,
    search: normalize([p.name, typeName, a.origin ?? '', plainDescription].join(' ')),
  };
}

/** Pretraga neosjetljiva na velika slova i dijakritike ("caj" nađe "čaj"). */
export function normalize(s: string): string {
  return s
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export const productHref = (slug: string) => `/proizvod/${slug}/`;
