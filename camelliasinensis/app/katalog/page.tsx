import { Catalog } from '@/components/catalog/Catalog';
import { CatalogHead } from '@/components/catalog/CatalogHead';
import { getCards } from '@/lib/catalog-server';
import { getTypes } from '@/lib/shop/catalog';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Katalog čaja i pribora',
  description:
    "Katalog trgovine Camellia sinensis: bijeli, zeleni, oolong, crni, pu'er, aromatizirani i biljni čajevi te pribor. Filtrirajte po vrsti, okusu, teinu i namjeni.",
  path: '/katalog/',
});

export default async function KatalogPage() {
  const [cards, types] = await Promise.all([getCards(), getTypes()]);
  return (
    <div className="shell">
      <CatalogHead
        title="Katalog"
        sub={`${cards.length} čajeva i pribora. Filtrirajte po vrsti, okusu, teinu ili namjeni.`}
        crumbs={[{ href: '/', label: 'Početna' }, { label: 'Katalog' }]}
      />
      <Catalog cards={cards} types={types} />
    </div>
  );
}
