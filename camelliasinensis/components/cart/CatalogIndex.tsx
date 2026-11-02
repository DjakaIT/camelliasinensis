'use client';

import { createContext, useContext } from 'react';
import type { CardProduct } from '@/lib/catalog-view';

/** Mali indeks proizvoda (iz builda) da košarica zna nazive i slike za SKU-ove u pregledniku. */
export type IndexEntry = Pick<CardProduct, 'sku' | 'slug' | 'name' | 'unitLabel' | 'price' | 'image' | 'type' | 'typeName'>;

const Ctx = createContext<Record<string, IndexEntry>>({});

export function CatalogIndexProvider({ index, children }: { index: Record<string, IndexEntry>; children: React.ReactNode }) {
  return <Ctx.Provider value={index}>{children}</Ctx.Provider>;
}

export const useCatalogIndex = () => useContext(Ctx);
