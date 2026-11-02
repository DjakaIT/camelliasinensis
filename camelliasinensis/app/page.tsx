import Link from 'next/link';
import { AddButton } from '@/components/AddButton';
import { CaffeineMeter } from '@/components/home/CaffeineMeter';
import { Shelf } from '@/components/home/Shelf';
import { IconArrow } from '@/components/Icons';
import { NoImage, Picture } from '@/components/Picture';
import { FEATURED_SKUS, PUER_SPOTLIGHT_SKU } from '@/content/site';
import { getCards } from '@/lib/catalog-server';
import { productHref } from '@/lib/catalog-view';
import { formatMoney } from '@/lib/format';
import { isDarkType, typeColor } from '@/lib/labels';
import { getTypes } from '@/lib/shop/catalog';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Camellia sinensis | Čaj i pribor za čaj online, Zagreb',
  description:
    "Camellia sinensis, trgovina čaja u Zagrebu: bijeli, zeleni, oolong, crni, pu'er i biljni čajevi te pribor za pripremu.",
  path: '/',
});

const H1 = ['Dobro', 'došli.', '|', 'Izaberite', 'čaj', '|', 'po', 'trenutku', 'dana.'];

export default async function Home() {
  const [cards, types] = await Promise.all([getCards(), getTypes()]);
  const light = cards.map((c) => ({ ...c, search: '' }));
  const featured = FEATURED_SKUS.filter((s) => cards.some((c) => c.sku === s));
  const meter = cards
    .filter((c) => c.caffeine != null)
    .map((c) => ({ slug: c.slug, name: c.name, caffeine: c.caffeine!, rare: c.rare, price: c.price }));
  const pu = cards.find((c) => c.sku === PUER_SPOTLIGHT_SKU);

  let k = 0;
  return (
    <div className="shell">
      <section className="bento" aria-label="Uvod">
        <div className="tile t-main">
          <div className="hbg" aria-hidden="true">
            <picture>
              <source type="image/avif" srcSet="/img/hero/hero-tea-640.avif 640w, /img/hero/hero-tea-1124.avif 1124w" sizes="(max-width: 760px) 100vw, 145vw" />
              <source type="image/webp" srcSet="/img/hero/hero-tea-640.webp 640w, /img/hero/hero-tea-1124.webp 1124w" sizes="(max-width: 760px) 100vw, 145vw" />
              <img src="/img/hero/hero-tea-1124.webp" alt="" width={1124} height={750} fetchPriority="high" decoding="async" />
            </picture>
          </div>
          <div className="top">
            <span className="lbl">Camellia sinensis · Zagreb</span>
            <span className="lbl">Bijeli · Zeleni · Oolong · Crni · Pu&apos;er</span>
          </div>
          <h1 className="d">
            {H1.map((w, i) => {
              if (w === '|') return <br key={i} />;
              const delay = { animationDelay: `${0.1 + k++ * 0.06}s` };
              const gold = i >= 6;
              return (
                <span key={i}>
                  <span className={`w${gold ? ' g' : ''}`} style={delay}>
                    {w}
                  </span>{' '}
                </span>
              );
            })}
          </h1>
          <div className="bottom">
            <p>Bijeli, zeleni, oolong, crni, pu&apos;er i biljni čajevi te pribor za pripremu.</p>
            <div className="btns">
              <Link href="/katalog/" className="pill gold">
                Otvori katalog <IconArrow />
              </Link>
            </div>
          </div>
        </div>
        <CaffeineMeter items={meter} />
      </section>

      <Shelf featured={featured} all={light} />

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
          {types.map((t, i) => (
            <Link
              key={t.key}
              className={`ty rv${isDarkType(t.key) ? ' dark' : ''}`}
              href={`/katalog/${t.key}/`}
              style={{ background: typeColor(t.key), transitionDelay: `${i * 50}ms` }}
            >
              <span className="c" aria-label={`${cards.filter((c) => c.type === t.key).length} proizvoda`}>
                {cards.filter((c) => c.type === t.key).length}
              </span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
            </Link>
          ))}
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
            Čaj iz kineske pokrajine Yunnan, prešan u kolače. Sheng s vremenom sazrijeva, a shou je spreman za pijenje odmah. U
            Hrvatskoj ga je teško naći.
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
        <div className="img">
          <Picture src="/img/foto/puer-caj.jpg" alt="Glineni čajnik i šalica na drvenom stolu" sizes="(max-width: 820px) 100vw, 50vw" />
          {pu && (
            <div className="pmini">
              <Link href={productHref(pu.slug)} className="pimg" tabIndex={-1} aria-hidden="true">
                {pu.image ? <Picture src={pu.image.src} alt="" sizes="76px" /> : <NoImage />}
              </Link>
              <Link href={productHref(pu.slug)}>
                <b>{pu.name}</b>
                <span>
                  {formatMoney(pu.price)} / {pu.unitLabel}
                </span>
              </Link>
              <AddButton sku={pu.sku} name={pu.name} price={pu.price} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
