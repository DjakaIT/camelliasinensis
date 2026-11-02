// Postoji samo u demo buildu (next.config.ts: pageExtensions). Lažna stranica za plaćanje adaptera `demo`.
import { DemoCheckoutPage } from '@/lib/shop/adapters/demo/checkout-page';

export const metadata = {
  title: 'Testno plaćanje',
  description: 'Testna stranica za plaćanje demo trgovine. Ništa se ne naplaćuje.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DemoCheckoutPage />;
}
