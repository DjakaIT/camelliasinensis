'use client';

// "Nema na zalihi" preko fotografije proizvoda (Daniel, 13. 11. 2026.): kad urednik u uredništvu označi da proizvoda
// nema na zalihi (zaliha 0), mijenja se samo slika. Stanje iz gradnje zamijeni živo iz uredništva (zivo.json), pa oznaka
// dođe i nestane odmah nakon spremanja, bez nove gradnje. Jedan zahtjev za sve kartice (lib/shop/zivo.ts).
import { useEffect, useState } from 'react';
import { loadZivo } from '@/lib/shop/zivo';
import type { StockStatus } from '@/lib/shop/types';

export function SoldOutMark({ sku, status, className = '' }: { sku: string; status: StockStatus; className?: string }) {
  const [out, setOut] = useState(status === 'outofstock');
  useEffect(() => {
    let active = true;
    loadZivo().then((z) => {
      const s = z?.skus.get(sku);
      if (active && s) setOut(s.stock.status === 'outofstock');
    });
    return () => {
      active = false;
    };
  }, [sku]);
  if (!out) return null;
  return (
    <span className={`x-soldout ${className}`.trim()} data-testid="sold-out">
      Nema na zalihi
    </span>
  );
}
