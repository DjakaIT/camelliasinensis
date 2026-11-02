import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content/site';
import { isIndexable } from '@/lib/shop';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    // Demo i probne izvedbe se ne indeksiraju (uz to svaka stranica ima noindex).
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // filtri s parametrima, košarica i povratne stranice (GUIDE §6)
        disallow: ['/*?*', '/kosarica/', '/narudzba/', '/dev/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
