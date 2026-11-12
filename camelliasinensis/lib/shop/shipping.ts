// Dostava: cijene i prag obračunava backend (demo, mock-server, PHP); frontend ih samo prikazuje. Kupac u košarici bira
// NAČIN dostave i paketomat (samo ID, backend ga provjerava po public/gls/paketomati.json), nikad cijenu.
// Erasable TypeScript: mock-server ga uvozi izravno.

export type ShippingMethodId = 'gls-paketomat' | 'gls-adresa';
export type ShippingMethod = { id: ShippingMethodId; name: string; description: string; price: number };

/** Besplatna dostava za narudžbe od 50 € (Daniel, 2. 11. 2026.). Cijene dostave su PRIMJERI iz prototipa [ODLUKA: GLS ugovor]. */
export const FREE_SHIPPING_FROM = 5000;

/** Uz besplatnu dostavu (od FREE_SHIPPING_FROM) ide i poklon (Daniel, 12. 11. 2026.). Naziv vidi kupac na stranici, u Stripeu i u mailu. */
export const FREE_SHIPPING_GIFT = 'platnena torba Camellia sinensis';

export const SHIPPING_METHODS: readonly ShippingMethod[] = [
  { id: 'gls-paketomat', name: 'GLS paketomat', description: 'U paketomat po izboru, 1–2 radna dana', price: 390 },
  { id: 'gls-adresa', name: 'GLS na adresu', description: 'Na kućnu ili poslovnu adresu, 1–3 radna dana', price: 490 },
];

export function shippingMethod(id: unknown): ShippingMethod | null {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? null;
}

/** Cijena dostave u centima za zadani međuzbroj (centi). */
export function shippingPrice(method: ShippingMethod, subtotal: number): number {
  return subtotal >= FREE_SHIPPING_FROM ? 0 : method.price;
}

/** Odabir kupca u košarici: način dostave i, za paketomat, GLS ID paketomata (ne naziv ni adresa). */
export type Delivery = { method: ShippingMethodId; lockerId?: string };

export const LOCKER_ID = /^[A-Za-z0-9-]{3,40}$/;

export function validDelivery(d: unknown): Delivery | null {
  if (!d || typeof d !== 'object') return null;
  const { method, lockerId } = d as Record<string, unknown>;
  if (!shippingMethod(method)) return null;
  if (method === 'gls-paketomat') return typeof lockerId === 'string' && LOCKER_ID.test(lockerId) ? { method, lockerId } : null;
  return { method: method as ShippingMethodId };
}

/** Paketomat iz public/gls/paketomati.json (scripts/gls-paketomati.mjs) */
export type Locker = { id: string; name: string; street: string; postalCode: string; city: string; lat: number; lng: number };
export type LockerRow = [string, string, string, string, string, number, number];
export const LOCKERS_URL = '/gls/paketomati.json';

export const lockerFromRow = ([id, name, street, postalCode, city, lat, lng]: LockerRow): Locker => ({ id, name, street, postalCode, city, lat, lng });
export const lockerLabel = (l: Pick<Locker, 'name' | 'street' | 'postalCode' | 'city'>) => `${l.name}, ${l.street}, ${l.postalCode} ${l.city}`;

/** udaljenost u km (haversine) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const fold = (s: string) => s.toLocaleLowerCase('hr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

/** pretraga po gradu, poštanskom broju, ulici ili nazivu; sve riječi moraju se naći (bez obzira na kvačice) */
export function searchLockers(all: Locker[], query: string, limit = 6): Locker[] {
  const words = fold(query).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const hay = (l: Locker) => fold(`${l.city} ${l.postalCode} ${l.street} ${l.name}`);
  const hits = all.filter((l) => words.every((w) => hay(l).includes(w)));
  const first = words[0] ?? '';
  return hits.sort((a, b) => Number(!fold(a.city).startsWith(first) && !a.postalCode.startsWith(first)) - Number(!fold(b.city).startsWith(first) && !b.postalCode.startsWith(first))).slice(0, limit);
}

export function nearestLockers(all: Locker[], from: { lat: number; lng: number }, limit = 5): (Locker & { km: number })[] {
  return all
    .map((l) => ({ ...l, km: distanceKm(from, l) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
