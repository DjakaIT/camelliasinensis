import Link from 'next/link';
import { hasContact } from '@/content/site';
import { getCards } from '@/lib/catalog-server';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'O nama',
  description: "Camellia sinensis je trgovina čaja i pribora za čaj u Zagrebu: bijeli, zeleni, oolong, crni, pu'er i biljni čajevi.",
  path: '/o-nama/',
});

export default async function ONamaPage() {
  const cards = await getCards();
  const teas = cards.filter((c) => c.type !== 'pribor').length;
  const puer = cards.filter((c) => c.type === 'puer').length;
  const countries = new Set(cards.map((c) => c.origin).filter((o) => o && o !== 'Mješavina')).size;

  return (
    <section className="x-page x-about">
      <div className="x-wrap">
        <div className="x-ab-grid">
          <div>
            <nav aria-label="Putanja">
              <ol className="x-crumbs">
                <li>
                  <Link href="/">Početna</Link>
                </li>
                <li>
                  <span aria-current="page">O nama</span>
                </li>
              </ol>
            </nav>
            <h1 className="x-h1">O nama</h1>
            <p className="x-lead">Camellia sinensis je trgovina čaja i pribora za čaj u Zagrebu.</p>
            <p className="x-ab-txt">
              U ponudi su bijeli, zeleni, oolong, crni i pu&apos;er čajevi, aromatizirane i biljne mješavine te pribor za pripremu. Uz
              svaki čaj navodimo podrijetlo, okus i način pripreme.
            </p>
            <div className="x-ab-acts">
              <Link href="/katalog/" className="x-btn">
                Pogledaj katalog
              </Link>
              {hasContact() && (
                <Link href="/kontakt/" className="x-btn x-ghost">
                  Kontakt
                </Link>
              )}
            </div>
          </div>
          <div className="x-ab-photo x-ab-soon">
            <p>Uskoro dolazi</p>
          </div>
        </div>
        <div className="x-ab3">
          <div>
            <b>{teas}</b>
            <span>čajeva i biljnih mješavina u ponudi</span>
          </div>
          <div>
            <b>{puer}</b>
            <span>pu&apos;era, rijetkosti u Hrvatskoj</span>
          </div>
          <div>
            <b>{countries}</b>
            <span>zemalja podrijetla</span>
          </div>
        </div>
      </div>
    </section>
  );
}
