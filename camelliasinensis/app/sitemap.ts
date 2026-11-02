import type { MetadataRoute } from 'next';
import { hasContact, publishedLegal, SITE_URL } from '@/content/site';
import { getProducts, getTypes } from '@/lib/shop/catalog';

export const dynamic = 'force-static';

/** Sve javne rute (GUIDE §6). Košarica, povratne stranice i /dev/ nisu ovdje. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, types] = await Promise.all([getProducts(), getTypes()]);
  const u = (path: string) => `${SITE_URL}${path}`;
  return [
    { url: u('/') },
    { url: u('/katalog/') },
    ...types.map((t) => ({ url: u(`/katalog/${t.key}/`) })),
    ...products.map((p) => ({ url: u(`/proizvod/${p.slug}/`), lastModified: p.updatedAt })),
    { url: u('/o-nama/') },
    ...(hasContact() ? [{ url: u('/kontakt/') }] : []),
    ...publishedLegal().map((p) => ({ url: u(`/${p.slug}/`) })),
  ];
}
