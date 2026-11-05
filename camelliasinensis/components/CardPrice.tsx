'use client';

// Cijena na kartici: iz gradnje, a čim stignu živi podaci iz uredništva (zivo.json) njihova, pa promjena cijene vrijedi
// odmah, bez nove gradnje. Jedan zahtjev za sve kartice na stranici (lib/shop/zivo.ts).
import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/format';
import { loadZivo } from '@/lib/shop/zivo';

export function CardPrice({ sku, price, unitLabel }: { sku: string; price: number; unitLabel: string }) {
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
    </span>
  );
}
