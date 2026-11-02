import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconArrow, IconCard, IconClock, IconReturn, IconScale, IconThermo, IconTruck } from '@/components/Icons';
import { FREE_SHIPPING_FROM, legalPage } from '@/content/site';
import { formatMoney } from '@/lib/format';
import { NoImage, Picture } from '@/components/Picture';
import { ProductCard } from '@/components/ProductCard';
import { BuyRow, LivePrice } from '@/components/product/BuyBox';
import { getCards } from '@/lib/catalog-server';
import { CAFFEINE, FLAVORS, FORMS, typeColor } from '@/lib/labels';
import { htmlToText } from '@/lib/sanitize';
import { absoluteUrl, pageMeta } from '@/lib/seo';
import { getProductBySlug, getProducts, getType } from '@/lib/shop/catalog';
import { productJsonLd } from '@/lib/jsonld';

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const t = await getType(p.type);
  const text = htmlToText(p.descriptionHtml);
  return pageMeta({
    title: `${p.name} (${t?.name ?? p.type}, ${p.unitLabel})`,
    description: text.length > 155 ? `${text.slice(0, 152).replace(/\s+\S*$/, '')}…` : text,
    path: `/proizvod/${p.slug}/`,
    image: p.images[0] ? absoluteUrl(p.images[0].src) : undefined,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const [t, cards] = await Promise.all([getType(p.type), getCards()]);
  const typeName = t?.name ?? p.type;
  const a = p.attributes;
  const related = cards.filter((c) => c.type === p.type && c.sku !== p.sku).slice(0, 4);
  const flags = [a.badges.includes('bio') && 'Organski', a.badges.includes('rijetko') && 'Rijetkost', a.badges.includes('novo') && 'Novo'].filter(
    Boolean,
  ) as string[];
  const img = p.images[0];
  const jsonLd = productJsonLd(p, typeName);

  return (
    <section className="x-prod">
      <div className="x-wrap">
        <nav aria-label="Putanja">
          <ol className="x-crumbs">
            <li>
              <Link href="/">Početna</Link>
            </li>
            <li>
              <Link href="/katalog/">Katalog</Link>
            </li>
            <li>
              <Link href={`/katalog/${p.type}/`}>{typeName}</Link>
            </li>
            <li>
              <span aria-current="page">{p.name}</span>
            </li>
          </ol>
        </nav>
        <div className="x-pgrid">
          <div className="x-pimg" style={{ ['--pc' as string]: typeColor(p.type) }}>
            {img ? <Picture src={img.src} alt={img.alt || p.name} sizes="(max-width: 820px) 78vw, 40vw" priority /> : <NoImage />}
            {flags.length > 0 && (
              <div className="x-flags">
                {flags.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            )}
          </div>
          <div className="x-pinfo">
            <p className="x-kind">
              {typeName}
              {a.origin ? ` · ${a.origin}` : ''}
            </p>
            <h1 className="x-ptitle">{p.name}</h1>
            <LivePrice
              sku={p.sku}
              unitLabel={p.unitLabel}
              buildPrice={p.price.amount}
              caffeine={a.caffeine != null ? CAFFEINE[a.caffeine] : null}
              caffeineLevel={a.caffeine ?? null}
            />
            {/* Opis je sanitiziran pri buildu (lib/sanitize.ts); ovo je jedino mjesto gdje se renderira HTML. */}
            <div className="x-pdesc" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
            {a.flavors.length > 0 && (
              <div className="x-pflav" aria-label="Okusi">
                {a.flavors.map((f) => (
                  <Link key={f} href={`/katalog/?okus=${f}`}>
                    {FLAVORS[f] ?? f}
                  </Link>
                ))}
              </div>
            )}
            <BuyRow sku={p.sku} name={p.name} buildPrice={p.price.amount} />
            <ul className="x-perks">
              <li>
                <IconTruck />
                Dostava GLS-om, besplatno od {formatMoney(FREE_SHIPPING_FROM)}
              </li>
              <li>
                <IconCard />
                Kartica, Apple Pay ili Google Pay
              </li>
              <li>
                <IconReturn />
                {legalPage('povrat') ? <Link href="/povrat/">Povrat u 14 dana</Link> : 'Povrat u 14 dana'}
              </li>
            </ul>
            {a.brew && (
              <div className="x-brew">
                <h2>Priprema</h2>
                <div className="x-brew3">
                  <div>
                    <IconThermo />
                    <b>{a.brew.temp}</b>
                    <span>temperatura vode</span>
                  </div>
                  <div>
                    <IconClock />
                    <b>{a.brew.time}</b>
                    <span>vrijeme</span>
                  </div>
                  <div>
                    <IconScale />
                    <b>{a.brew.dose}</b>
                    <span>količina</span>
                  </div>
                </div>
                <p className="x-small">Opće smjernice za ovu vrstu čaja, prilagodite ukusu.</p>
              </div>
            )}
            <dl className="x-specs">
              <div>
                <dt>Vrsta</dt>
                <dd>{typeName}</dd>
              </div>
              {a.origin && (
                <div>
                  <dt>Podrijetlo</dt>
                  <dd>{a.origin}</dd>
                </div>
              )}
              {a.form && (
                <div>
                  <dt>Oblik</dt>
                  <dd>{FORMS[a.form]}</dd>
                </div>
              )}
              <div>
                <dt>Pakiranje</dt>
                <dd>{p.unitLabel}</dd>
              </div>
              <div>
                <dt>Šifra</dt>
                <dd>{p.sku}</dd>
              </div>
            </dl>
          </div>
        </div>
        {related.length > 0 && (
          <>
            <div className="x-relhead">
              <h2 className="x-h2">Iz iste obitelji</h2>
              <Link href={`/katalog/${p.type}/`} className="x-link">
                Sve: {typeName} <IconArrow />
              </Link>
            </div>
            <div className="x-grid x-rel">
              {related.map((c) => (
                <ProductCard key={c.sku} p={c} sizes="(max-width: 820px) 120px, 200px" />
              ))}
            </div>
          </>
        )}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </section>
  );
}
