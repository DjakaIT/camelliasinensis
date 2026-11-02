import { notFound } from 'next/navigation';
import { Catalog } from '@/components/catalog/Catalog';
import { CatalogHead } from '@/components/catalog/CatalogHead';
import { getCards } from '@/lib/catalog-server';
import { getType, getTypes } from '@/lib/shop/catalog';
import { pageMeta } from '@/lib/seo';

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getTypes()).map((t) => ({ vrsta: t.key }));
}

type Props = { params: Promise<{ vrsta: string }> };

export async function generateMetadata({ params }: Props) {
  const { vrsta } = await params;
  const t = await getType(vrsta);
  if (!t) return {};
  return pageMeta({
    title: `${t.name}: katalog`,
    description: `${t.name} u trgovini Camellia sinensis. ${t.description}`,
    path: `/katalog/${t.key}/`,
  });
}

export default async function VrstaPage({ params }: Props) {
  const { vrsta } = await params;
  const [t, cards, types] = await Promise.all([getType(vrsta), getCards(), getTypes()]);
  if (!t) notFound();
  const n = cards.filter((c) => c.type === t.key).length;
  return (
    <div className="shell">
      <CatalogHead
        title={t.name}
        sub={`${t.description} U ponudi: ${n}.`}
        crumbs={[{ href: '/', label: 'Početna' }, { href: '/katalog/', label: 'Katalog' }, { label: t.name }]}
      />
      <Catalog cards={cards} types={types} fixedType={t.key} />
    </div>
  );
}
