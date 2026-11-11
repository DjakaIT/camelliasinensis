// Kontakt forma. Nije dio ShopBackend ugovora (API-CONTRACT §1.8); kad se odabere backend, ovdje ide njegov endpoint.
// demo: poruka se ne šalje nikamo (simulacija); devserver: POST /contact na mock-server (ne zapisuje osobne podatke).
import { ShopError } from '../shop/errors';

export type ContactMessage = { name: string; email: string; topic: string; message: string; consent: boolean };

import { CONTACT_TOPICS } from './topics';

export { CONTACT_TOPICS };

export function validateContact(m: ContactMessage): Record<string, string> {
  const e: Record<string, string> = {};
  if (m.name.trim().length < 2) e.name = 'Upišite ime.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(m.email.trim())) e.email = 'Upišite ispravan e-mail.';
  if (!CONTACT_TOPICS.includes(m.topic)) e.topic = 'Odaberite temu.';
  if (m.message.trim().length < 10) e.message = 'Poruka treba imati barem 10 znakova.';
  if (m.message.length > 3000) e.message = 'Poruka je preduga (najviše 3000 znakova).';
  if (!m.consent) e.consent = 'Potreban je pristanak za obradu podataka radi odgovora.';
  return e;
}

export async function sendContactMessage(m: ContactMessage): Promise<void> {
  const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'demo';
  if (backend === 'devserver' || backend === 'hosting') {
    // hosting: PHP na istoj domeni pošalje poruku na mail trgovine (urednistvo/php/lib/trgovina.php)
    const base =
      backend === 'hosting' ? '/urednistvo/api/trgovina' : (process.env.NEXT_PUBLIC_DEVSERVER_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
    let res: Response;
    try {
      res = await fetch(`${base}/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: m.name, email: m.email, topic: m.topic, message: m.message }),
        credentials: 'omit',
      });
    } catch {
      throw new ShopError('NETWORK');
    }
    if (!res.ok) throw new ShopError(res.status === 429 ? 'RATE_LIMITED' : res.status >= 500 ? 'UNKNOWN' : 'INVALID_REQUEST');
    return;
  }
  // demo: kratka odgoda da izgleda kao slanje; ništa ne izlazi iz preglednika
  await new Promise((r) => setTimeout(r, 600));
}
