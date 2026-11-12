// Popis GLS paketomata u Hrvatskoj → public/gls/paketomati.json (kompaktno, samo paketomati).
// Izvor je javni popis koji koristi i GLS karta (map.gls-croatia.com). Pokreće se prije svake gradnje u CI-ju; ako GLS
// nije dostupan, ostaje zadnja spremljena kopija iz repozitorija (gradnja ne pada). Kupac bira paketomat u košarici,
// a uredništvo (PHP) pri plaćanju provjerava ID po istoj datoteci, pa naziv i adresa nikad ne dolaze iz preglednika.
// Oblik: { azurirano, paketomati: [[id, naziv, ulica, postanski, grad, lat, lng], …] }
import { mkdirSync, writeFileSync } from 'node:fs';

const IZVOR = 'https://map.gls-croatia.com/data/deliveryPoints/hr.json';
const IZLAZ = new URL('../public/gls/paketomati.json', import.meta.url);
const ID = /^[A-Za-z0-9-]{3,40}$/;
const tekst = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

try {
  const r = await fetch(IZVOR, { signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const { items } = await r.json();
  const paketomati = (Array.isArray(items) ? items : [])
    .filter((p) => p?.type === 'parcel-locker' && ID.test(p.id ?? '') && Array.isArray(p.location) && (p.contact?.countryCode ?? 'HR') === 'HR')
    .map((p) => [
      p.id,
      tekst(p.name, 80),
      tekst(p.contact?.address, 80),
      tekst(p.contact?.postalCode, 10),
      tekst(p.contact?.city, 40),
      Math.round(Number(p.location[0]) * 1e5) / 1e5,
      Math.round(Number(p.location[1]) * 1e5) / 1e5,
    ])
    .filter((p) => p[1] && p[4] && Number.isFinite(p[5]) && Number.isFinite(p[6]))
    .sort((a, b) => a[4].localeCompare(b[4], 'hr') || a[2].localeCompare(b[2], 'hr'));
  if (paketomati.length < 100) throw new Error(`premalo paketomata (${paketomati.length})`);
  mkdirSync(new URL('.', IZLAZ), { recursive: true });
  writeFileSync(IZLAZ, JSON.stringify({ azurirano: new Date().toISOString().slice(0, 10), paketomati }) + '\n');
  console.log(`gls-paketomati: ${paketomati.length} paketomata → public/gls/paketomati.json`);
} catch (e) {
  console.warn(`gls-paketomati: GLS popis nije dohvaćen (${e.message}); ostaje spremljena kopija`);
}
