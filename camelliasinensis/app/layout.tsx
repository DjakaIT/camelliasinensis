import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/inter-tight/wght.css';
import '@/styles/tokens.css';
import '@/styles/app.css';
import '@/styles/extra.css';
import type { Metadata, Viewport } from 'next';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartProvider } from '@/components/cart/CartContext';
import { CatalogIndexProvider, type IndexEntry } from '@/components/cart/CatalogIndex';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/Reveal';
import { DUMMY_CONTENT, hasContact, SHOP_NAME, SITE_URL } from '@/content/site';
import { getCards } from '@/lib/catalog-server';
import { isDemoBuild, isIndexable } from '@/lib/shop';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SHOP_NAME} | Čaj i pribor za čaj online, Zagreb`, template: `%s | ${SHOP_NAME}` },
  applicationName: SHOP_NAME,
  // Demo build se nikad ne indeksira (START-PROMPT M8).
  robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }], apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: '#262D1D', width: 'device-width', initialScale: 1 };

const NAV = [
  { href: '/', label: 'Početna' },
  { href: '/katalog/', label: 'Katalog' },
  { href: '/o-nama/', label: 'O nama' },
  ...(hasContact() ? [{ href: '/kontakt/', label: 'Kontakt' }] : []),
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Izmišljeni sadržaj (content/site.ts) ne smije u javnu, indeksiranu izvedbu.
  if (isIndexable() && DUMMY_CONTENT.length) {
    throw new Error(`Build za produkciju odbijen, u content/site.ts je još DUMMY sadržaj: ${DUMMY_CONTENT.join('; ')}`);
  }
  const cards = await getCards();
  const index: Record<string, IndexEntry> = Object.fromEntries(
    cards.map((c) => [
      c.sku,
      { sku: c.sku, slug: c.slug, name: c.name, unitLabel: c.unitLabel, price: c.price, image: c.image, type: c.type, typeName: c.typeName },
    ]),
  );
  return (
    <html lang="hr">
      <body>
        <a href="#sadrzaj" className="skip">
          Preskoči na sadržaj
        </a>
        <CatalogIndexProvider index={index}>
          <CartProvider>
            <Header nav={NAV} />
            <main id="sadrzaj" tabIndex={-1}>
              {children}
            </main>
            <Footer note={isIndexable() ? null : `${isDemoBuild() ? 'Demo trgovina' : 'Probna trgovina'} · cijene su primjeri`} />
            <CartDrawer />
          </CartProvider>
        </CatalogIndexProvider>
        <Reveal />
      </body>
    </html>
  );
}
