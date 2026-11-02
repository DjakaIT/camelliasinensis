import { CartPage } from '@/components/cart/CartPage';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Košarica',
  description: 'Pregled košarice u trgovini Camellia sinensis prije plaćanja.',
  path: '/kosarica/',
  noindex: true,
});

export default function KosaricaPage() {
  return <CartPage />;
}
