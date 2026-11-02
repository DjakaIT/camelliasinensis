'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconArrow, IconDone } from '@/components/Icons';
import { CONTACT_TOPICS, sendContactMessage, validateContact, type ContactMessage } from '@/lib/contact';
import { ShopError } from '@/lib/shop';

export function ContactForm({ demo }: { demo: boolean }) {
  const [m, setM] = useState<ContactMessage>({ name: '', email: '', topic: CONTACT_TOPICS[0]!, message: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [fail, setFail] = useState('');
  const [sentTo, setSentTo] = useState('');

  const set = <K extends keyof ContactMessage>(k: K, v: ContactMessage[K]) => {
    setM((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };
  const p = (k: keyof ContactMessage) => ({
    id: `ct-${k}`,
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? `ct-${k}-err` : undefined,
  });

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFail('');
    const e = validateContact(m);
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      document.getElementById(`ct-${first}`)?.focus();
      return;
    }
    setState('sending');
    try {
      await sendContactMessage(m);
      setSentTo(m.email.trim());
      setState('sent');
    } catch (err) {
      setState('idle');
      const e = ShopError.from(err);
      setFail(
        e.code === 'NETWORK'
          ? e.message
          : 'Poruku trenutno nije moguće poslati. Pokušajte ponovno ili nam pišite izravno na e-mail.',
      );
    }
  }

  if (state === 'sent') {
    return (
      <div className="x-ctok" role="status" data-testid="contact-sent">
        <IconDone size={60} />
        <h2>Hvala, poruka je poslana.</h2>
        <p>
          Javit ćemo se na <b>{sentTo}</b>, obično isti ili sljedeći radni dan.
        </p>
        {demo && <p className="x-small">Demo verzija: poruka se ne šalje nikamo.</p>}
      </div>
    );
  }

  const Err = ({ k }: { k: string }) =>
    errors[k] ? (
      <span className="x-ferr" id={`ct-${k}-err`}>
        {errors[k]}
      </span>
    ) : null;

  return (
    <form className="x-ctform" onSubmit={submit} noValidate aria-labelledby="ct-form-h">
      <h2 id="ct-form-h" className="sr">
        Pošaljite poruku
      </h2>
      <div className="x-f2">
        <div className="x-field">
          <label htmlFor="ct-name">Ime</label>
          <input {...p('name')} autoComplete="name" value={m.name} onChange={(e) => set('name', e.target.value)} />
          <Err k="name" />
        </div>
        <div className="x-field">
          <label htmlFor="ct-email">E-mail</label>
          <input {...p('email')} type="email" autoComplete="email" value={m.email} onChange={(e) => set('email', e.target.value)} />
          <Err k="email" />
        </div>
      </div>
      <div className="x-field">
        <label htmlFor="ct-topic">Tema</label>
        <select {...p('topic')} value={m.topic} onChange={(e) => set('topic', e.target.value)}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Err k="topic" />
      </div>
      <div className="x-field">
        <label htmlFor="ct-message">Poruka</label>
        <textarea
          {...p('message')}
          rows={6}
          maxLength={3000}
          placeholder="Npr. inače pijem zeleni čaj ujutro, tražim nešto blaže za večer…"
          value={m.message}
          onChange={(e) => set('message', e.target.value)}
        />
        <Err k="message" />
      </div>
      <div>
        <label className="x-check" style={{ margin: 0 }}>
          <input {...p('consent')} type="checkbox" checked={m.consent} onChange={(e) => set('consent', e.target.checked)} />
          <span>
            Slažem se da se moji podaci koriste samo za odgovor na upit (
            <Link href="/privatnost/">pravila privatnosti</Link>).
          </span>
        </label>
        <Err k="consent" />
      </div>
      {fail && (
        <p className="x-note err" role="alert">
          {fail}
        </p>
      )}
      <button className="x-btn" type="submit" disabled={state === 'sending'} aria-busy={state === 'sending'}>
        {state === 'sending' ? 'Šaljemo…' : 'Pošalji poruku'} <IconArrow />
      </button>
    </form>
  );
}
