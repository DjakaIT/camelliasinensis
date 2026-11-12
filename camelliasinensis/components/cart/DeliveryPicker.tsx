'use client';

// Način dostave i GLS paketomat, prije odlaska na plaćanje (kao u drugim web trgovinama: paketomat se bira na stranici
// trgovine, ne upisuje se). Popis paketomata je statična datoteka s naše domene (/gls/paketomati.json), učitava se tek
// kad kupac odabere paketomat; "Najbliži meni" koristi lokaciju preglednika samo u pregledniku, nikamo se ne šalje.
// Backendu ide samo način i ID paketomata (lib/shop/shipping.ts → validDelivery); naziv i adresu backend uzima iz popisa.
import { useEffect, useId, useRef, useState } from 'react';
import { formatMoney } from '@/lib/format';
import {
  type Delivery,
  type Locker,
  type LockerRow,
  type ShippingMethodId,
  LOCKER_ID,
  LOCKERS_URL,
  lockerFromRow,
  nearestLockers,
  searchLockers,
  SHIPPING_METHODS,
  shippingMethod,
  shippingPrice,
} from '@/lib/shop/shipping';

export const DELIVERY_KEY = 'cs.delivery.v1';

export type DeliveryChoice = { method: ShippingMethodId; locker: Omit<Locker, 'lat' | 'lng'> | null };
const DEFAULT: DeliveryChoice = { method: 'gls-adresa', locker: null };

export function readDeliveryChoice(): DeliveryChoice {
  try {
    const d = JSON.parse(localStorage.getItem(DELIVERY_KEY) ?? 'null') as { v?: number } & Partial<DeliveryChoice>;
    if (d?.v !== 1 || !shippingMethod(d.method)) return DEFAULT;
    const l = d.locker;
    const okLocker =
      l && typeof l.id === 'string' && LOCKER_ID.test(l.id) && [l.name, l.street, l.postalCode, l.city].every((s) => typeof s === 'string' && s.length <= 120);
    return { method: d.method as ShippingMethodId, locker: okLocker ? { id: l.id, name: l.name, street: l.street, postalCode: l.postalCode, city: l.city } : null };
  } catch {
    return DEFAULT;
  }
}

function saveDeliveryChoice(c: DeliveryChoice) {
  try {
    localStorage.setItem(DELIVERY_KEY, JSON.stringify({ v: 1, ...c }));
  } catch {
    // privatni način: izbor vrijedi do zatvaranja stranice
  }
}

/** za startCheckout; null = paketomat još nije odabran */
export function toDelivery(c: DeliveryChoice): Delivery | null {
  if (c.method === 'gls-paketomat') return c.locker ? { method: c.method, lockerId: c.locker.id } : null;
  return { method: c.method };
}

let lockersPromise: Promise<Locker[]> | null = null;
function loadLockers(): Promise<Locker[]> {
  lockersPromise ??= fetch(LOCKERS_URL, { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { paketomati?: LockerRow[] }) => (Array.isArray(d.paketomati) ? d.paketomati.map(lockerFromRow) : []))
    .catch((e) => {
      lockersPromise = null;
      throw e;
    });
  return lockersPromise;
}

type Hit = Locker & { km?: number };

export function DeliveryPicker({ subtotal, value, onChange }: { subtotal: number; value: DeliveryChoice; onChange: (c: DeliveryChoice) => void }) {
  const uid = useId();
  const [lockers, setLockers] = useState<Locker[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tries, setTries] = useState(0);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState('');
  const [searching, setSearching] = useState(!value.locker);
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (c: DeliveryChoice) => {
    saveDeliveryChoice(c);
    onChange(c);
  };

  const wantLockers = value.method === 'gls-paketomat';
  useEffect(() => {
    if (!wantLockers || lockers) return;
    let live = true;
    loadLockers()
      .then((l) => live && (setLockers(l), setLoadError(false)))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, [wantLockers, lockers, tries]);

  function search(q: string) {
    setQuery(q);
    if (!lockers) return;
    const r = q.trim().length >= 2 ? searchLockers(lockers, q) : [];
    setHits(r);
    setStatus(q.trim().length >= 2 && !r.length ? 'Nema paketomata za taj upit. Probajte s nazivom grada ili poštanskim brojem.' : '');
  }

  function choose(l: Locker) {
    set({ method: 'gls-paketomat', locker: { id: l.id, name: l.name, street: l.street, postalCode: l.postalCode, city: l.city } });
    setSearching(false);
    setStatus('');
  }

  function nearest() {
    if (!lockers) return;
    if (!('geolocation' in navigator)) {
      setStatus('Preglednik ne daje lokaciju. Upišite grad ili poštanski broj.');
      return;
    }
    setLocating(true);
    setStatus('Tražimo paketomate u blizini…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const r = nearestLockers(lockers, { lat: p.coords.latitude, lng: p.coords.longitude });
        setHits(r);
        setQuery('');
        if (r[0]) choose(r[0]);
        setSearching(true); // ostaje popis najbližih, da kupac može odabrati drugi
        setStatus(r[0] ? `Odabran je najbliži paketomat (${km(r[0].km)}). Možete odabrati i neki drugi u blizini.` : '');
      },
      () => {
        setLocating(false);
        setStatus('Lokacija nije dostupna. Upišite grad ili poštanski broj.');
        inputRef.current?.focus();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  const free = (id: ShippingMethodId) => shippingPrice(shippingMethod(id)!, subtotal) === 0;

  return (
    <fieldset className="x-dlv">
      <legend>Dostava</legend>
      <div className="x-radios">
        {[...SHIPPING_METHODS].reverse().map((m) => (
          <label key={m.id} className="x-radio">
            <input
              type="radio"
              name={`${uid}-dostava`}
              value={m.id}
              checked={value.method === m.id}
              onChange={() => {
                set({ ...value, method: m.id });
                if (m.id === 'gls-paketomat' && !value.locker) setSearching(true);
              }}
            />
            <span>
              <b>{m.name}</b>
              <small>{m.description}</small>
            </span>
            <em>{free(m.id) ? 'Besplatno' : formatMoney(m.price)}</em>
          </label>
        ))}
      </div>

      {value.method === 'gls-paketomat' && (
        <div className="x-lock" data-testid="paketomat">
          {value.locker && (
            <div className="x-lock-sel">
              <span>
                <small>Paket stiže u</small>
                <b>{value.locker.name}</b>
                <span>
                  {value.locker.street}, {value.locker.postalCode} {value.locker.city}
                </span>
              </span>
              {!searching && (
                <button type="button" className="x-link" onClick={() => (setSearching(true), setTimeout(() => inputRef.current?.focus(), 0))}>
                  Promijeni
                </button>
              )}
            </div>
          )}
          {searching && (
            <>
              <div className="x-lock-q">
                <label className="sr" htmlFor={`${uid}-q`}>
                  Traži paketomat po gradu, poštanskom broju ili ulici
                </label>
                <input
                  ref={inputRef}
                  id={`${uid}-q`}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  maxLength={60}
                  placeholder="Grad, poštanski broj ili ulica"
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  disabled={!lockers}
                />
                <button type="button" className="x-near" onClick={nearest} disabled={!lockers || locating}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="9.5" r="2.5" fill="currentColor" />
                  </svg>
                  Najbliži meni
                </button>
              </div>
              {loadError && (
                <p className="x-small" role="alert">
                  Popis paketomata trenutno nije dostupan.{' '}
                  <button type="button" className="x-link" onClick={() => (setLoadError(false), setTries((t) => t + 1))}>
                    Pokušaj ponovno
                  </button>
                </p>
              )}
              {hits.length > 0 && (
                <ul className="x-lock-list" aria-label="Paketomati">
                  {hits.map((l) => (
                    <li key={l.id}>
                      <button type="button" aria-pressed={value.locker?.id === l.id} onClick={() => choose(l)}>
                        <span>
                          <b>{l.name}</b>
                          <span>
                            {l.street}, {l.postalCode} {l.city}
                          </span>
                        </span>
                        {l.km != null && <em>{km(l.km)}</em>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="x-small" role="status">
                {status || (!value.locker && lockers ? 'GLS vam SMS-om javi kad paket stigne i pošalje kod za otvaranje.' : '')}
              </p>
              {value.locker && (
                <button type="button" className="x-link x-lock-done" onClick={() => (setSearching(false), setHits([]), setQuery(''), setStatus(''))}>
                  Gotovo
                </button>
              )}
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

const km = (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1).replace('.', ',')} km`);
