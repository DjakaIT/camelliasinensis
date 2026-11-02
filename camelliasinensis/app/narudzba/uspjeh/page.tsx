import { OrderResult } from '@/components/cart/OrderResult';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Status narudžbe',
  description: 'Potvrda plaćanja narudžbe u trgovini Camellia sinensis.',
  path: '/narudzba/uspjeh/',
  noindex: true,
});

export default function UspjehPage() {
  return <OrderResult />;
}
