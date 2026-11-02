import type { Metadata } from 'next';
import { SHOP_NAME, SITE_URL } from '@/content/site';

/** Jedinstven title, description, canonical i hreflang="hr" za svaku stranicu (GUIDE §6). */
export function pageMeta(opts: { title: string; description: string; path: string; image?: string; noindex?: boolean }): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  return {
    title: opts.title.includes(SHOP_NAME) ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: url, languages: { hr: url } },
    openGraph: {
      type: 'website',
      locale: 'hr_HR',
      siteName: SHOP_NAME,
      title: opts.title,
      description: opts.description,
      url,
      ...(opts.image ? { images: [{ url: opts.image }] } : {}),
    },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;
