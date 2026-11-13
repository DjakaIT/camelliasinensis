import Link from 'next/link';
import { productHref, type CardProduct } from '@/lib/catalog-view';
import { FORMS, isDarkType, typeColor } from '@/lib/labels';
import { AddButton } from './AddButton';
import { CardPrice } from './CardPrice';
import { CaffeineBars } from './Icons';
import { NoImage, Picture } from './Picture';
import { SoldOutMark } from './SoldOutMark';

/** Kartica u boji vrste čaja (dizajn B). Cijena iz builda, zamijeni je živa iz uredništva; potvrđuje se u košarici. */
export function ProductCard({
  p,
  sizes = '200px',
  headingLevel = 3,
  priority = false,
}: {
  p: CardProduct;
  sizes?: string;
  headingLevel?: 2 | 3;
  priority?: boolean;
}) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  const href = productHref(p.slug);
  const flag = p.rare ? 'Rijetko' : p.isNew ? 'Novo' : null;
  return (
    <article className={`pc${isDarkType(p.type) ? ' dark' : ''}`} style={{ background: typeColor(p.type) }} data-sku={p.sku}>
      <div className="top">
        <span className="tag lbl">{p.typeName}</span>
        {flag && <span className="rare lbl">{flag}</span>}
      </div>
      <Link className="phl" href={href} tabIndex={-1} aria-hidden="true" prefetch={false}>
        <span className="ph">
          {p.image ? <Picture src={p.image.src} alt={`${p.name} (${p.typeName})`} sizes={sizes} priority={priority} /> : <NoImage />}
          <SoldOutMark sku={p.sku} status={p.stock.status} />
        </span>
      </Link>
      <div>
        <Link className="nm" href={href} prefetch={false}>
          <H>{p.name}</H>
        </Link>
        <div className="from">
          {p.origin || (p.form ? FORMS[p.form] : '')}
          {p.bio ? ' · organski' : ''}
        </div>
      </div>
      {p.caffeine != null && (
        <div className="specs">
          {p.brewTemp && <span>{p.brewTemp}</span>}
          <span>
            Tein <CaffeineBars level={p.caffeine} />
            <span className="sr">{['bez', 'malo', 'srednje', 'puno'][p.caffeine]}</span>
          </span>
        </div>
      )}
      <div className="buy">
        <CardPrice sku={p.sku} price={p.price} unitLabel={p.unitLabel} />
        {/* Zaliha iz builda je zastarjela (GUIDE §2), pa gumb ostaje aktivan; dodavanje provjerava zalihu uživo. */}
        <AddButton sku={p.sku} name={p.name} price={p.price} />
      </div>
    </article>
  );
}
