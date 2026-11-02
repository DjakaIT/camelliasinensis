// Dostava (strana backenda): koristi je demo backend i mock-server pri obračunu narudžbe.
// Frontend je samo PRIKAZUJE (prag besplatne dostave), nikad je ne šalje backendu (GUIDE §5).
// Erasable TypeScript: mock-server ga uvozi izravno.

export type ShippingMethodId = 'gls-paketomat' | 'gls-adresa';
export type ShippingMethod = { id: ShippingMethodId; name: string; description: string; price: number };

/** Besplatna dostava za narudžbe od 50 € (Daniel, 2. 11. 2026.). Cijene dostave su PRIMJERI iz prototipa [ODLUKA: GLS ugovor]. */
export const FREE_SHIPPING_FROM = 5000;

export const SHIPPING_METHODS: readonly ShippingMethod[] = [
  { id: 'gls-paketomat', name: 'GLS paketomat', description: 'Preuzimanje u odabranom paketomatu, 1–2 radna dana', price: 390 },
  { id: 'gls-adresa', name: 'GLS na adresu', description: 'Dostava na kućnu ili poslovnu adresu, 1–3 radna dana', price: 490 },
];

export function shippingMethod(id: unknown): ShippingMethod | null {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? null;
}

/** Cijena dostave u centima za zadani međuzbroj (centi). */
export function shippingPrice(method: ShippingMethod, subtotal: number): number {
  return subtotal >= FREE_SHIPPING_FROM ? 0 : method.price;
}
