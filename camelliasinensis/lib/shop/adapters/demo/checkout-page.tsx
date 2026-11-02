'use client';

// Stranica za plaćanje DEMO backenda (API-CONTRACT §3.6: "dolazi od backenda"). Postoji samo u demo buildu
// (app/blagajna/page.demo.tsx). U produkciji ovu ulogu ima Woo checkout ili Stripe Checkout.
// Ništa se ne naplaćuje; podaci forme se ne šalju nikamo i ne spremaju se (sprema se samo maskirani e-mail).
// Kartica prihvaća samo Stripeove testne brojeve, da nitko ne upiše stvarnu karticu.
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalogIndex } from '@/components/cart/CatalogIndex';
import { IconLock } from '@/components/Icons';
import { NoImage, Picture } from '@/components/Picture';
import { formatMoney } from '../../../format';
import { ShopError } from '../../errors';
import { FREE_SHIPPING_FROM, SHIPPING_METHODS, shippingMethod, shippingPrice, type ShippingMethodId } from '../../shipping';
import { demoControls } from './index';
import type { DemoOrder } from './state';

type Pay = 'card' | 'apple' | 'google';
type Form = {
  name: string;
  email: string;
  phone: string;
  shipping: ShippingMethodId;
  locker: string;
  street: string;
  postal: string;
  city: string;
  pay: Pay;
  cardNumber: string;
  cardExp: string;
  cardCvc: string;
  r1: boolean;
  company: string;
  oib: string;
  note: string;
  terms: boolean;
};

// DUMMY: popis paketomata; u pravoj trgovini paketomat se bira na GLS karti.
const LOCKERS = [
  'GLS paketomat, Zagreb – Trg bana Jelačića',
  'GLS paketomat, Zagreb – Maksimir',
  'GLS paketomat, Zagreb – Trešnjevka',
  'GLS paketomat, Zagreb – Novi Zagreb',
  'GLS paketomat, Split – Žnjan',
  'GLS paketomat, Rijeka – Centar',
  'GLS paketomat, Osijek – Centar',
];

const TEST_CARDS: Record<string, 'ok' | 'declined' | '3ds'> = {
  '4242424242424242': 'ok',
  '4000000000000002': 'declined',
  '4000002760003184': '3ds',
};

const digits = (s: string) => s.replace(/\D/g, '');

/** OIB: 11 znamenki i kontrolna znamenka (ISO 7064, MOD 11,10). */
export function validOib(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false;
  let a = 10;
  for (let i = 0; i < 10; i++) {
    a = (a + Number(oib[i])) % 10 || 10;
    a = (a * 2) % 11;
  }
  return (11 - a) % 10 === Number(oib[10]);
}

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.name.trim().length < 3) e.name = 'Upišite ime i prezime.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(f.email.trim())) e.email = 'Upišite ispravan e-mail.';
  const ph = digits(f.phone);
  if (f.shipping === 'gls-paketomat' && ph.length < 8) e.phone = 'Za paketomat je potreban mobitel (GLS šalje kod za preuzimanje).';
  else if (f.phone && ph.length < 8) e.phone = 'Upišite ispravan broj mobitela.';
  if (f.shipping === 'gls-paketomat' && !f.locker) e.locker = 'Odaberite paketomat.';
  if (f.shipping === 'gls-adresa') {
    if (f.street.trim().length < 3) e.street = 'Upišite ulicu i kućni broj.';
    if (!/^\d{5}$/.test(f.postal.trim())) e.postal = 'Poštanski broj ima 5 znamenki.';
    if (f.city.trim().length < 2) e.city = 'Upišite grad.';
  }
  if (f.pay === 'card') {
    const n = digits(f.cardNumber);
    if (!TEST_CARDS[n]) e.cardNumber = 'Testni način: upišite testnu karticu 4242 4242 4242 4242.';
    const m = f.cardExp.match(/^\s*(\d{2})\s*\/\s*(\d{2})\s*$/);
    const now = new Date();
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || new Date(2000 + Number(m[2]), Number(m[1])) <= now) {
      e.cardExp = 'Upišite budući datum u obliku MM / GG.';
    }
    if (!/^\d{3,4}$/.test(f.cardCvc)) e.cardCvc = 'CVC ima 3 ili 4 znamenke.';
  }
  if (f.r1) {
    if (f.company.trim().length < 2) e.company = 'Upišite naziv tvrtke.';
    if (!validOib(f.oib.trim())) e.oib = 'OIB nije ispravan.';
  }
  if (!f.terms) e.terms = 'Za narudžbu je potrebno prihvatiti uvjete kupnje.';
  return e;
}

const LABELS: Record<string, string> = {
  name: 'ime i prezime',
  email: 'e-mail',
  phone: 'mobitel',
  locker: 'paketomat',
  street: 'adresa',
  postal: 'poštanski broj',
  city: 'grad',
  cardNumber: 'broj kartice',
  cardExp: 'datum isteka',
  cardCvc: 'CVC',
  company: 'naziv tvrtke',
  oib: 'OIB',
  terms: 'uvjeti kupnje',
};

export function DemoCheckoutPage() {
  const index = useCatalogIndex();
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<DemoOrder | null | undefined>(undefined);
  const [f, setF] = useState<Form>({
    name: '',
    email: '',
    phone: '',
    shipping: 'gls-paketomat',
    locker: '',
    street: '',
    postal: '',
    city: '',
    pay: 'card',
    cardNumber: '',
    cardExp: '',
    cardCvc: '',
    r1: false,
    company: '',
    oib: '',
    note: '',
    terms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'idle' | 'processing' | '3ds'>('idle');
  const [payError, setPayError] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  const payBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t');
    setToken(t);
    setOrder(t ? demoControls.getOrder(t) : null);
  }, []);

  const method = shippingMethod(f.shipping)!;
  const subtotal = order?.total.amount ?? 0;
  const ship = shippingPrice(method, subtotal);
  const total = subtotal + ship;
  const missing = Math.max(0, FREE_SHIPPING_FROM - subtotal);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k]: '' }));
  };
  const err = (k: string) => errors[k] || '';
  const fieldProps = (k: keyof Form) => ({
    id: `co-${k}`,
    'aria-invalid': err(k) ? (true as const) : undefined,
    'aria-describedby': err(k) ? `co-${k}-err` : undefined,
  });
  const errorList = useMemo(() => Object.entries(errors).filter(([, v]) => v), [errors]);

  if (order === undefined) return <section className="x-co" />;
  if (!order || !token || order.status !== 'pending') {
    return (
      <section className="x-done">
        <div className="x-wrap x-narrow">
          <h1 className="x-h2">{order?.status === 'paid' ? 'Ova narudžba je već plaćena' : 'Narudžba nije pronađena'}</h1>
          <p>Poveznica za plaćanje ne vrijedi ili je istekla. Vratite se u košaricu i pokušajte ponovno.</p>
          <div className="x-donebtns">
            <Link href="/kosarica/" className="x-btn">
              Natrag u košaricu
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const finish = () => {
    try {
      const paid = demoControls.pay(token, { shipping: f.shipping, email: f.email });
      window.location.assign(paid.successUrl);
    } catch (e) {
      setPhase('idle');
      setPayError(ShopError.from(e).message);
    }
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setPayError('');
    const e = validate(f);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      document.getElementById(`co-${first}`)?.focus();
      return;
    }
    setPhase('processing');
    const outcome = f.pay === 'card' ? TEST_CARDS[digits(f.cardNumber)] : 'ok';
    setTimeout(() => {
      if (outcome === 'declined') {
        setPhase('idle');
        setPayError('Kartica je odbijena. Provjerite podatke ili pokušajte drugom karticom.');
      } else if (outcome === '3ds') setPhase('3ds');
      else finish();
    }, 900);
  };

  const cancel = () => {
    const o = demoControls.cancel(token);
    window.location.assign(o.cancelUrl);
  };

  const payLabel =
    f.pay === 'apple' ? `Plati s Apple Pay · ${formatMoney(total)}` : f.pay === 'google' ? `Plati s Google Pay · ${formatMoney(total)}` : `Plati karticom · ${formatMoney(total)}`;

  return (
    <section className="x-co" data-testid="demo-checkout">
      <div className="x-wrap">
        <nav aria-label="Putanja">
          <ol className="x-crumbs">
            <li>
              <Link href="/">Početna</Link>
            </li>
            <li>
              <button type="button" className="x-link" style={{ border: 0, fontWeight: 500 }} onClick={cancel}>
                Košarica
              </button>
            </li>
            <li>
              <span aria-current="page">Blagajna</span>
            </li>
          </ol>
        </nav>
        <h1 className="x-h1">Blagajna</h1>
        <div className="x-cogrid">
          <form className="x-coform" onSubmit={submit} noValidate aria-describedby="co-test">
            <p className="x-note warn" id="co-test">
              <span>
                <span className="x-testtag lbl">Testni način</span> Ništa se ne naplaćuje. Kartica: 4242 4242 4242 4242, bilo koji
                budući datum i CVC.
              </span>
            </p>
            {errorList.length > 0 && (
              <div className="x-note err" role="alert">
                <span>Molimo ispravite: {errorList.map(([k]) => LABELS[k] ?? k).join(', ')}.</span>
              </div>
            )}

            <div className="x-express">
              <p className="x-small">Brzo plaćanje</p>
              <div className="x-exp2">
                <button
                  type="button"
                  className="x-pay apple"
                  onClick={() => {
                    set('pay', 'apple');
                    payBtn.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  Apple Pay
                </button>
                <button
                  type="button"
                  className="x-pay google"
                  onClick={() => {
                    set('pay', 'google');
                    payBtn.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  Google Pay
                </button>
              </div>
              <div className="x-or">
                <span>ili ispunite podatke</span>
              </div>
            </div>

            <fieldset>
              <legend>
                <span aria-hidden="true">1</span>Kontakt
              </legend>
              <div className="x-f2">
                <Field label="Ime i prezime" err={err('name')} id="name">
                  <input {...fieldProps('name')} autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="E-mail (za potvrdu i račun)" err={err('email')} id="email">
                  <input {...fieldProps('email')} type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
                </Field>
              </div>
              <Field label="Mobitel (za obavijest GLS-a)" err={err('phone')} id="phone">
                <input {...fieldProps('phone')} type="tel" autoComplete="tel" inputMode="tel" placeholder="091 234 5678" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </fieldset>

            <fieldset>
              <legend>
                <span aria-hidden="true">2</span>Dostava GLS
              </legend>
              <div className="x-radios" role="radiogroup" aria-label="Način dostave">
                {SHIPPING_METHODS.map((m) => {
                  const price = shippingPrice(m, subtotal);
                  return (
                    <label key={m.id} className="x-radio">
                      <input type="radio" name="shipping" value={m.id} checked={f.shipping === m.id} onChange={() => set('shipping', m.id)} />
                      <span>
                        <b>{m.name}</b>
                        <small>{m.description}</small>
                      </span>
                      <em>{price ? formatMoney(price) : 'Besplatno'}</em>
                    </label>
                  );
                })}
              </div>
              {f.shipping === 'gls-paketomat' ? (
                <Field label="Paketomat" err={err('locker')} id="locker" hint="U pravoj trgovini paketomat birate na GLS karti.">
                  <select {...fieldProps('locker')} value={f.locker} onChange={(e) => set('locker', e.target.value)}>
                    <option value="">Odaberite paketomat…</option>
                    {LOCKERS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Ulica i kućni broj" err={err('street')} id="street">
                    <input {...fieldProps('street')} autoComplete="street-address" value={f.street} onChange={(e) => set('street', e.target.value)} />
                  </Field>
                  <div className="x-f2">
                    <Field label="Poštanski broj" err={err('postal')} id="postal">
                      <input {...fieldProps('postal')} inputMode="numeric" autoComplete="postal-code" maxLength={5} value={f.postal} onChange={(e) => set('postal', digits(e.target.value))} />
                    </Field>
                    <Field label="Grad" err={err('city')} id="city">
                      <input {...fieldProps('city')} autoComplete="address-level2" value={f.city} onChange={(e) => set('city', e.target.value)} />
                    </Field>
                  </div>
                  <p className="x-small">Država: Hrvatska</p>
                </>
              )}
            </fieldset>

            <fieldset>
              <legend>
                <span aria-hidden="true">3</span>Plaćanje
              </legend>
              <div className="x-radios" role="radiogroup" aria-label="Način plaćanja">
                {(
                  [
                    ['card', 'Kartica', 'Visa, Mastercard, Maestro'],
                    ['apple', 'Apple Pay', 'Brzo plaćanje s iPhonea ili Maca'],
                    ['google', 'Google Pay', 'Brzo plaćanje s Androida ili Chromea'],
                  ] as [Pay, string, string][]
                ).map(([k, l, d]) => (
                  // tekst oznake dolazi iz varijable (l, d), pravilo ga ne vidi statički
                  // eslint-disable-next-line jsx-a11y/label-has-associated-control
                  <label key={k} className="x-radio">
                    <input type="radio" name="pay" value={k} checked={f.pay === k} onChange={() => set('pay', k)} />
                    <span>
                      <b>{l}</b>
                      <small>{d}</small>
                    </span>
                  </label>
                ))}
              </div>
              {f.pay === 'card' && (
                <div className="x-cardf">
                  <Field label="Broj kartice" err={err('cardNumber')} id="cardNumber">
                    <input
                      {...fieldProps('cardNumber')}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="4242 4242 4242 4242"
                      value={f.cardNumber}
                      onChange={(e) => set('cardNumber', digits(e.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '))}
                    />
                  </Field>
                  <div className="x-f2">
                    <Field label="Vrijedi do" err={err('cardExp')} id="cardExp">
                      <input {...fieldProps('cardExp')} autoComplete="off" placeholder="MM / GG" maxLength={7} value={f.cardExp} onChange={(e) => set('cardExp', e.target.value)} />
                    </Field>
                    <Field label="CVC" err={err('cardCvc')} id="cardCvc">
                      <input {...fieldProps('cardCvc')} inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} value={f.cardCvc} onChange={(e) => set('cardCvc', digits(e.target.value))} />
                    </Field>
                  </div>
                  <p className="x-small">U pravoj trgovini ovo je sigurni obrazac pružatelja plaćanja (Stripe). Podatke o kartici nikad ne vidimo.</p>
                </div>
              )}
              <label className="x-check">
                <input type="checkbox" checked={f.r1} onChange={(e) => set('r1', e.target.checked)} />
                <span>Trebam R1 račun (za tvrtku)</span>
              </label>
              {f.r1 && (
                <div className="x-f2">
                  <Field label="Naziv tvrtke" err={err('company')} id="company">
                    <input {...fieldProps('company')} autoComplete="organization" value={f.company} onChange={(e) => set('company', e.target.value)} />
                  </Field>
                  <Field label="OIB" err={err('oib')} id="oib">
                    <input {...fieldProps('oib')} inputMode="numeric" maxLength={11} value={f.oib} onChange={(e) => set('oib', digits(e.target.value))} />
                  </Field>
                </div>
              )}
              <Field label="Napomena uz narudžbu (neobavezno)" id="note">
                <textarea id="co-note" rows={3} value={f.note} onChange={(e) => set('note', e.target.value)} />
              </Field>
            </fieldset>

            <div className="x-terms">
              <label className="x-check" style={{ margin: 0 }}>
                <input {...fieldProps('terms')} type="checkbox" checked={f.terms} onChange={(e) => set('terms', e.target.checked)} />
                <span>
                  Prihvaćam{' '}
                  <Link href="/uvjeti-kupnje/" target="_blank">
                    uvjete kupnje
                  </Link>{' '}
                  i{' '}
                  <Link href="/privatnost/" target="_blank">
                    pravila privatnosti
                  </Link>
                  .
                </span>
              </label>
              {err('terms') && (
                <p className="x-ferr" id="co-terms-err">
                  {err('terms')}
                </p>
              )}
            </div>

            {payError && (
              <p className="x-note err" role="alert" data-testid="pay-error">
                {payError}
              </p>
            )}
            <button ref={payBtn} className="x-btn x-wide x-paybtn" type="submit" disabled={phase !== 'idle'} aria-busy={phase === 'processing'}>
              {phase === 'processing' ? 'Obrađujemo plaćanje…' : payLabel}
            </button>
            <p className="x-small x-center x-secure">
              <IconLock /> Plaćanje je zaštićeno. Potvrdu narudžbe šaljemo na e-mail.
            </p>
            <p className="x-center">
              <button type="button" className="x-link" onClick={cancel}>
                Natrag u košaricu
              </button>
            </p>
          </form>

          <aside className="x-sum" aria-labelledby="co-sum-h" ref={summaryRef}>
            <h2 id="co-sum-h">Vaša narudžba</h2>
            <div>
              {order.lines.map((l) => {
                const p = index[l.sku];
                return (
                  <div className="x-si" key={l.sku}>
                    <span className="x-simg">
                      <span>{p?.image ? <Picture src={p.image.src} alt="" sizes="56px" /> : <NoImage />}</span>
                      <em aria-label={`količina ${l.qty}`}>{l.qty}</em>
                    </span>
                    <span>
                      <b>{l.name}</b>
                      <small>
                        {p?.unitLabel} · {formatMoney(l.unitPrice)}
                      </small>
                    </span>
                    <b>{formatMoney(l.lineTotal)}</b>
                  </div>
                );
              })}
            </div>
            <div className="x-row">
              <span>Međuzbroj</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="x-row">
              <span>Dostava ({method.name})</span>
              <span data-testid="co-shipping">{ship ? formatMoney(ship) : 'Besplatno'}</span>
            </div>
            {missing > 0 && (
              <div className="x-ship">
                <p>
                  Još <b>{formatMoney(missing)}</b> do besplatne dostave.
                </p>
                <div className="x-bar">
                  <i style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_FROM) * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="x-row x-tot">
              <span>Ukupno</span>
              <b data-testid="co-total">{formatMoney(total)}</b>
            </div>
          </aside>
        </div>
      </div>

      {phase === '3ds' && (
        <div className="x-scrim on" style={{ display: 'grid', placeItems: 'center', zIndex: 120 }}>
          <div className="x-ctok" role="dialog" aria-modal="true" aria-labelledby="tds-h" style={{ maxWidth: 420, margin: 16 }}>
            <IconLock size={40} />
            <h2 id="tds-h">Potvrda banke (test)</h2>
            <p>Vaša banka traži potvrdu plaćanja od {formatMoney(total)}. U pravoj kupnji ovo se otvara u aplikaciji banke.</p>
            <div className="x-donebtns">
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <button type="button" className="x-btn" autoFocus onClick={finish}>
                Potvrdi
              </button>
              <button
                type="button"
                className="x-btn x-ghost"
                onClick={() => {
                  setPhase('idle');
                  setPayError('Potvrda banke nije uspjela. Plaćanje nije izvršeno.');
                }}
              >
                Odbij
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, err, id, hint, children }: { label: string; err?: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="x-field">
      <label htmlFor={`co-${id}`}>{label}</label>
      {children}
      {hint && <span className="x-fhint">{hint}</span>}
      {err && (
        <span className="x-ferr" id={`co-${id}-err`}>
          {err}
        </span>
      )}
    </div>
  );
}
