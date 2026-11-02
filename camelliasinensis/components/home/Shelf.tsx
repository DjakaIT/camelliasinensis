'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconArrow, IconBack } from '@/components/Icons';
import { ProductCard } from '@/components/ProductCard';
import type { CardProduct } from '@/lib/catalog-view';

/**
 * "Istaknuto s police": samo istaknuti proizvodi, bez filtara (to je posao kataloga).
 * Pomiče se strelicama, dodirom, trackpadom i povlačenjem mišem; traka ispod pokazuje položaj.
 */
export function Shelf({ items }: { items: CardProduct[] }) {
  const shelf = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ atStart: true, atEnd: false, ratio: 0, visible: 1 });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const el = shelf.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({
      atStart: el.scrollLeft <= 2,
      atEnd: el.scrollLeft >= max - 2,
      ratio: max > 0 ? el.scrollLeft / max : 0,
      visible: el.scrollWidth ? el.clientWidth / el.scrollWidth : 1,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const step = () => (shelf.current?.querySelector<HTMLElement>('.pc')?.offsetWidth ?? 300) + 14;
  const scroll = (dir: 1 | -1) => shelf.current?.scrollBy({ left: dir * step(), behavior: 'smooth' });

  // Povlačenje mišem (dodir i trackpad rade sami od sebe).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !shelf.current) return;
    drag.current = { x: e.clientX, left: shelf.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = shelf.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = (e: React.PointerEvent) => {
    const el = shelf.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el?.classList.remove('dragging');
    // nakon povlačenja klik ne smije otvoriti proizvod
    if (drag.current?.moved) window.addEventListener('click', (ev) => ev.preventDefault(), { capture: true, once: true });
    drag.current = null;
  };

  return (
    <section aria-labelledby="polica-h">
      <div className="sh rv">
        <h2 className="d" id="polica-h">
          Istaknuto
          <br />
          <span className="g">s police.</span>
        </h2>
        <div className="navs">
          <button type="button" aria-label="Prethodni proizvodi" onClick={() => scroll(-1)} disabled={pos.atStart}>
            <IconBack />
          </button>
          <button type="button" aria-label="Sljedeći proizvodi" onClick={() => scroll(1)} disabled={pos.atEnd}>
            <IconArrow />
          </button>
        </div>
      </div>
      <div
        className="shelf"
        ref={shelf}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(e) => e.preventDefault()}
      >
        {items.map((p) => (
          <ProductCard key={p.sku} p={p} />
        ))}
        <Link className="more" href="/katalog/">
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
      <div className="shelf-track" aria-hidden="true">
        <i style={{ width: `${Math.max(8, pos.visible * 100)}%`, left: `${pos.ratio * (100 - Math.max(8, pos.visible * 100))}%` }} />
      </div>
    </section>
  );
}
