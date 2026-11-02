// Postoji samo u demo buildu (next.config.ts: pageExtensions). Stranica za plaćanje demo backenda.
import { DemoCheckoutPage } from '@/lib/shop/adapters/demo/checkout-page';

export const metadata = {
  title: 'Blagajna',
  description: 'Blagajna demo trgovine Camellia sinensis: kontakt, GLS dostava i plaćanje. Ništa se ne naplaćuje.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DemoCheckoutPage />;
}
