'use client';

// Cijena na kartici: iz gradnje, a čim stignu živi podaci iz uredništva (zivo.json) njihova, pa promjena cijene vrijedi
// odmah, bez nove gradnje. Jedan zahtjev za sve kartice na stranici (lib/shop/zivo.ts).
import { useEffect, useState } from 'react';
import { BasePrice } from '@/components/BasePrice';
import { formatMoney } from '@/lib/format';
import type { BasePrice as Base } from '@/lib/shop/types';
import { loadZivo } from '@/lib/shop/zivo';

export function CardPrice({ sku, price, unitLabel, base }: { sku: string; price: number; unitLabel: string; base?: Base | null }) {
  const [amount, setAmount] = useState(price);
  useEffect(() => {
    let active = true;
    loadZivo().then((z) => {
      const s = z?.skus.get(sku);
      if (active && s) setAmount(s.price.amount);
    });
    return () => {
      active = false;
    };
  }, [sku]);
  return (
    <span className="price">
      {formatMoney(amount)} <small>/ {unitLabel}</small>
      <BasePrice base={base} />
    </span>
  );
}
