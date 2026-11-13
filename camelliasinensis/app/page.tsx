import Link from 'next/link';
import { Faq } from '@/components/home/Faq';
import { HERO_GRANA } from '@/components/home/heroGrana';
import { Shelf } from '@/components/home/Shelf';
import { TeinMeter } from '@/components/home/TeinMeter';
import { IconArrow, IconGlobe, IconHand, IconLeaf, IconTruck } from '@/components/Icons';
import { Picture } from '@/components/Picture';
import { FAQ } from '@/content/faq';
import { brandStory, FEATURED_SKUS, FREE_SHIPPING_FROM } from '@/content/site';
import { getCards } from '@/lib/catalog-server';
import { faqJsonLd } from '@/lib/jsonld';
import { formatMoney } from '@/lib/format';
import { isDarkType, typeColor } from '@/lib/labels';
import { getTypes } from '@/lib/shop/catalog';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  // ciljani upiti: trgovina čaja Zagreb, čajevi online, čaj Hrvatska (naslov do ~60 znakova, opis do ~155)
  title: 'Trgovina čaja u Zagrebu i čajevi online | Camellia sinensis',
  description:
    "Rastresiti čajevi i pribor iz trgovine čaja u Zagrebu: bijeli, zeleni, oolong, crni, pu'er i biljni. Dostava po cijeloj Hrvatskoj, besplatna od 50 €.",
  path: '/',
});

// riječi naslova; '|' je novi red, '*' ispred riječi = zlatna (Daniel, 13. 11. 2026.)
const H1 = ['Dobrodošli', 'u', '|', 'najunikatniju', '|', '*kuću', '*čaja', '*u', '|', '*Hrvatskoj.'];

export default async function Home() {
  const [cards, types] = await Promise.all([getCards(), getTypes()]);
  // Polica pokazuje samo istaknute proizvode (bez opisa za pretragu, da payload bude manji).
  const featured = FEATURED_SKUS.map((s) => cards.find((c) => c.sku === s))
    .filter((c): c is (typeof cards)[number] => Boolean(c))
    .map((c) => ({ ...c, search: '' }));
  const meter = cards
    .filter((c) => c.caffeine != null)
    .map((c) => ({ slug: c.slug, name: c.name, caffeine: c.caffeine!, rare: c.rare, price: c.price }));

  // Istaknute stavke računamo iz kataloga, da su uvijek točne.
  const teas = cards.filter((c) => c.type !== 'pribor');
  const organic = teas.filter((c) => c.bio).length;
  const countries = new Set(teas.map((c) => c.origin).filter((o) => o && o !== 'Mješavina')).size;
  const freeFrom = formatMoney(FREE_SHIPPING_FROM).replace(',00', '');

  // Tri fotografije po vrsti čaja (rijetkosti i istaknuti proizvodi prvi).
  const photosFor = (key: string) =>
    cards
      .filter((c) => c.type === key && c.image)
      .sort(
        (a, b) =>
          Number(FEATURED_SKUS.includes(b.sku)) - Number(FEATURED_SKUS.includes(a.sku)) ||
          Number(b.rare) - Number(a.rare),
      )
      .slice(0, 3);

  let k = 0;
  return (
    <div className="shell">
      <section className="bento" aria-label="Uvod">
        <div className="tile t-main">
          <div className="hbg" aria-hidden="true">
            <div className="hgrana" dangerouslySetInnerHTML={{ __html: HERO_GRANA }} />
          </div>
          <div className="top">
            <span className="lbl">Camellia sinensis · Zagreb</span>
            <span className="lbl">Bijeli · Zeleni · Oolong · Crni · Pu&apos;er</span>
          </div>
          <h1 className="d">
            {H1.map((w, i) => {
              if (w === '|') return <br key={i} />;
              const delay = { animationDelay: `${0.1 + k++ * 0.06}s` };
              return (
                <span key={i}>
                  <span className={`w${w.startsWith('*') ? ' g' : ''}`} style={delay}>
                    {w.replace(/^\*/, '')}
                  </span>{' '}
                </span>
              );
            })}
          </h1>
          <div className="bottom">
            <blockquote className="hq">
              <p>
                „Ako vam je hladno, čaj će vas ugrijati. Ako je vruće, čaj će vas rashladiti. Ako ste depresivni, čaj će
                vas razveseliti. Ako ste uzbuđeni, čaj će vas smiriti.“
              </p>
              <footer>– William Gladstone</footer>
            </blockquote>
            <div className="btns">
              <Link href="/katalog/" className="pill gold">
                Otvori katalog <IconArrow />
              </Link>
            </div>
          </div>
        </div>
        <TeinMeter items={meter} />
      </section>

      <Shelf items={featured} />

      <section aria-labelledby="vrste-h">
        <div className="sh rv">
          <h2 className="d" id="vrste-h">
            Vrste
            <br />
            <span className="g">čaja.</span>
          </h2>
          <Link href="/katalog/" className="pill ink">
            Cijeli katalog
          </Link>
        </div>
        <div className="types">
          {types.map((t, i) => {
            const n = cards.filter((c) => c.type === t.key).length;
            const photos = photosFor(t.key);
            return (
              <Link
                key={t.key}
                className={`ty rv${isDarkType(t.key) ? ' dark' : ''}`}
                href={`/katalog/${t.key}/`}
                prefetch={false}
                style={{ background: typeColor(t.key), transitionDelay: `${i * 50}ms` }}
              >
                <span className="c" aria-label={`${n} proizvoda`}>
                  {n}
                </span>
                <h3>{t.name}</h3>
                <span className="ty-ph" aria-hidden="true">
                  {photos.map((p) => (
                    <span key={p.sku}>
                      <Picture src={p.image!.src} alt={p.name} sizes="110px" />
                    </span>
                  ))}
                </span>
                <p>{t.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="puer rv" aria-labelledby="puer-h">
        <div className="txt">
          <span className="lbl">Rijetkost u Hrvatskoj</span>
          <h2 className="d" id="puer-h">
            Pu&apos;er.
            <br />
            <span className="g">Prešan i odležan.</span>
          </h2>
          <p>
            Čaj iz kineske pokrajine Yunnan, prešan u kolače. Sheng s vremenom sazrijeva, a shou je spreman za pijenje
            odmah. U Hrvatskoj ga je teško naći, srećom - kod nas je odmah dostupan.
          </p>
          <div className="two">
            <div>
              <b>Sheng</b>svjež, živahan, s godinama dublji
            </div>
            <div>
              <b>Shou</b>zemljan, mekan, gotovo slatkast
            </div>
          </div>
          <div>
            <Link href="/katalog/puer/" className="pill gold">
              Pogledaj pu&apos;ere
            </Link>
          </div>
        </div>

        <div className="hl" aria-labelledby="hl-h">
          <svg className="hl-art" viewBox="0 0 400 400" aria-hidden="true">
            <circle cx="320" cy="80" r="150" />
            <circle cx="320" cy="80" r="105" />
            <circle cx="320" cy="80" r="60" />
            <path d="M60 360c10-120 90-200 230-210-10 130-90 200-230 210z" />
            <path d="M60 360c50-70 110-130 200-180" />
          </svg>
          <h2 className="d" id="hl-h">
            {brandStory.title.split(' ').slice(0, 3).join(' ')}
            <br />
            <span className="g">{brandStory.title.split(' ').slice(3).join(' ')}</span>
          </h2>
          <ul className="hl-grid">
            <li>
              <IconLeaf />
              <b>{organic} organskih</b>
              <span>čajeva s certifikatom</span>
            </li>
            <li>
              <IconGlobe />
              <b>{countries} zemalja</b>
              <span>od Japana do Kolumbije</span>
            </li>
            <li>
              <IconHand />
              <b>Imenovani proizvođači</b>
              <span>obiteljski vrtovi i majstori čaja</span>
            </li>
            <li>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M4 14c3-1 5-4 6-8 2 4 6 6 10 6-2 5-6 8-11 8a5 5 0 0 1-5-6z" />
              </svg>
              <b>Rastresiti listovi</b>
              <span>bez vrećica i punila</span>
            </li>
          </ul>
          <div className="hl-ship">
            <span className="hl-ring" aria-hidden="true">
              <IconTruck size={26} />
            </span>
            <span>
              <b>Besplatna dostava od {freeFrom}</b>
              uz platnenu torbu na poklon; GLS na adresu ili u paketomat, u cijeloj Hrvatskoj
            </span>
          </div>
        </div>
      </section>

      <Faq items={FAQ} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(FAQ) }} />
    </div>
  );
}
