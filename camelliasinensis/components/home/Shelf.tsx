'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { IconArrow, IconBack } from '@/components/Icons';
import { ProductCard } from '@/components/ProductCard';
import type { CardProduct } from '@/lib/catalog-view';
import { MOODS_SHORT } from '@/lib/labels';

/** "Istaknuto s police": vodoravna polica s odabirom namjene (prototip). */
export function Shelf({ featured, all }: { featured: string[]; all: CardProduct[] }) {
  const bySku = new Map(all.map((p) => [p.sku, p]));
  const [mood, setMood] = useState('sve');
  const shelf = useRef<HTMLDivElement>(null);
  const list =
    mood === 'sve'
      ? featured
      : all
          .filter((p) => p.moods.includes(mood))
          .sort((a, b) => Number(b.rare) - Number(a.rare))
          .slice(0, 10)
          .map((p) => p.sku);

  const pick = (m: string) => {
    setMood(m);
    shelf.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };
  const scroll = (dx: number) => shelf.current?.scrollBy({ left: dx, behavior: 'smooth' });

  return (
    <section aria-labelledby="polica-h">
      <div className="sh rv">
        <h2 className="d" id="polica-h">
          Istaknuto
          <br />
          <span className="g">s police.</span>
        </h2>
        <div className="sh-r">
          <div className="moods" role="group" aria-label="Namjena">
            {MOODS_SHORT.map(([k, l]) => (
              <button key={k} type="button" className={`mood${mood === k ? ' on' : ''}`} aria-pressed={mood === k} onClick={() => pick(k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="navs">
            <button type="button" aria-label="Prethodni proizvodi" onClick={() => scroll(-320)}>
              <IconBack />
            </button>
            <button type="button" aria-label="Sljedeći proizvodi" onClick={() => scroll(320)}>
              <IconArrow />
            </button>
          </div>
        </div>
      </div>
      <div className="shelf" ref={shelf}>
        {list.map((sku) => {
          const p = bySku.get(sku);
          return p ? <ProductCard key={sku} p={p} /> : null;
        })}
        <Link className="more" href={mood === 'sve' ? '/katalog/' : `/katalog/?namjena=${mood}`}>
          <span className="lbl" style={{ color: 'var(--gold)' }}>
            Sve na jednom mjestu
          </span>
          <h3>
            Cijeli
            <br />
            katalog
          </h3>
          <span className="arr" aria-hidden="true">
            <IconArrow size={26} />
          </span>
        </Link>
      </div>
    </section>
  );
}
