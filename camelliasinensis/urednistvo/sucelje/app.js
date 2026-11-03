// Uredništvo Camellia sinensis — sučelje (jezgra preuzeta iz Septilliona) (bez okvira i bez vanjskih skripti; CSP dopušta samo datoteke s ove adrese).
// Sadržaj se nikad ne umeće kao HTML: sve ide kroz textContent / atribute.
import qrcode from './qrcode.mjs';

// ---------------- pomoćno ----------------
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const kopija = (x) => structuredClone(x);

/** h('div', { class: 'x', onclick: fn, 'aria-label': '…' }, 'tekst', dijete) */
function h(tag, props = {}, ...djeca) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const d of djeca.flat(Infinity)) if (d !== null && d !== undefined && d !== false) el.append(d instanceof Node ? d : document.createTextNode(String(d)));
  return el;
}

const IKONE = {
  rucka: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  gore: 'M12 19V5M5 12l7-7 7 7', dolje: 'M12 5v14M19 12l-7 7-7-7',
  brisi: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14', van: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  slika: 'M4 5h16v14H4zM4 15l4-4 5 5 3-3 4 4M15 9h.01', izbornik: 'M4 7h16M4 12h16M4 17h16',
  povijest: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3', kljuc: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z', odjava: 'M15 4h4v16h-4M10 16l4-4-4-4M14 12H4',
  korisnici: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  objava: 'M12 3v12M7 8l5-5 5 5M4 15v4h16v-4',
  zvijezda: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  odrzavanje: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
};
function ikona(ime) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', ime === 'rucka' ? '3' : '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', IKONE[ime]); svg.append(p);
  return svg;
}

const eur = (n) => (typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')} €` : '—');
const brojUTekst = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '');
/** "8,90" / "8.90" / "8" -> 8.9; null ako nije broj */
function uBroj(s) {
  const t = String(s ?? '').trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100) / 100;
}
const vrijeme = (iso) => (iso ? new Date(iso).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const sat = (iso) => (iso ? new Date(iso).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' }) : '');
const mnozina = (n, [a, b, c]) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);

// ---------------- stanje ----------------
const S = {
  csrf: null, ime: null, uloga: null,
  katalog: null, // { oznake, najviseNaPolici, sadrzaj }
  odabrana: null, // 'vrsta:<ključ>' | 'vrste' | 'izdvojeno'
  radni: null, // radna kopija cijelog kataloga
  novi: new Set(), // id-evi novih (još nespremljenih) proizvoda: njima se smije upisati šifra
  prljavo: false,
  otvoreno: new Set(), // id-evi otvorenih stavki
  greske: {}, // id -> { polje: poruka }
  sirovo: {}, // "id:polje" -> upisani tekst cijene
  objava: null,
  nakonPrijave: null,
};

// ---------------- obavijesti ----------------
function obavijest(tekst, { vrsta = 'uspjeh', akcija, trajanje = 5000 } = {}) {
  const el = h('div', { class: `obavijest ${vrsta}` }, h('p', {}, tekst));
  if (akcija) el.append(h('button', { class: 'gumb', type: 'button', onclick: () => { akcija.fn(); el.remove(); } }, akcija.tekst));
  $('#obavijesti').append(el);
  setTimeout(() => el.remove(), trajanje);
}

// ---------------- API ----------------
class ApiGreska extends Error { constructor(status, podaci) { super(podaci?.greska || `Greška ${status}`); this.status = status; this.podaci = podaci; } }
/** pozadina = automatska provjera (status objave): poslužitelj je ne broji kao aktivnost, pa ne produljuje prijavu */
async function api(metoda, put, tijelo, { sirovo = false, vrsta, pozadina = false } = {}) {
  const zag = {};
  if (S.csrf) zag['X-CSRF'] = S.csrf;
  if (pozadina) zag['X-Pozadina'] = '1';
  if (tijelo !== undefined) zag['Content-Type'] = vrsta || 'application/json';
  const res = await fetch(`/urednistvo/api${put}`, {
    method: metoda, headers: zag, credentials: 'same-origin', cache: 'no-store',
    body: tijelo === undefined ? undefined : sirovo ? tijelo : JSON.stringify(tijelo),
  });
  const podaci = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && S.csrf) { S.csrf = null; prijavaIstekla(podaci?.razlog); }
    throw new ApiGreska(res.status, podaci);
  }
  if (!pozadina) zadnjiDodir = Date.now();
  return podaci;
}

// Prijava traje dok radiš: tipkanje, klikovi i dodiri jave poslužitelju da si tu (najviše jednom u 4 min).
// Sama provjera statusa u pozadini to ne radi — nakon 30 min bez ikakve aktivnosti prijava istječe.
let zadnjiDodir = Date.now();
function aktivnost() {
  if (!S.csrf || Date.now() - zadnjiDodir < 4 * 60_000) return;
  zadnjiDodir = Date.now();
  api('GET', '/stanje').then((st) => { if (st.korak !== 'puno' && S.csrf) { S.csrf = null; prijavaIstekla(st.razlog); } }).catch(() => {});
}
for (const dogadaj of ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart']) addEventListener(dogadaj, aktivnost, { passive: true, capture: true });

const RAZLOZI = {
  neaktivnost: 'Prijava je istekla nakon 30 minuta bez aktivnosti.',
  trajanje: 'Prijava traje najviše 12 sati.',
  odjavljen: 'Odjavljen si: lozinka je promijenjena ili je račun ponovno postavljen.',
};
const porukaIsteka = (razlog) => `${RAZLOZI[razlog] ?? 'Prijava više ne vrijedi.'} Prijavi se ponovno`;

// ---------------- ekrani: prijava, pozivnica, dvostruka potvrda ----------------
function ekran(...sadrzaj) {
  app.replaceChildren(h('main', { class: 'ekran' }, h('div', { class: 'kartica' }, h('div', { class: 'znak' }, h('img', { src: '/urednistvo/static/ikona.svg', alt: '' }), 'Camellia sinensis · Uredništvo'), ...sadrzaj)));
  $('h1', app)?.setAttribute('tabindex', '-1');
  $('h1', app)?.focus();
}
const porukaGreske = (el, tekst) => { el.textContent = tekst || ''; el.hidden = !tekst; };

function zaslonPrijave(napomena) {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'kartica-forma', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const gumb = $('button[type=submit]', forma); gumb.disabled = true; porukaGreske(greska, '');
    try {
      const r = await api('POST', '/prijava', { ime: forma.ime.value, lozinka: forma.lozinka.value });
      if (r.korak === '2fa') zaslonKoda(); else zaslonPostavljanja2fa(r);
    } catch (err) { porukaGreske(greska, err.message); gumb.disabled = false; forma.lozinka.select(); }
  } },
  h('label', { class: 'polje' }, h('span', {}, 'Korisničko ime'), h('input', { name: 'ime', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true })),
  h('label', { class: 'polje' }, h('span', {}, 'Lozinka'), h('input', { name: 'lozinka', type: 'password', autocomplete: 'current-password', required: true })),
  greska,
  h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Prijava'));
  const dijelovi = [h('h1', {}, 'Prijava')];
  if (napomena) dijelovi.push(h('p', { class: 'poruka info' }, napomena));
  ekran(...dijelovi, forma, h('p', { class: 'uvod' }, 'Zaboravljena lozinka ili izgubljen mobitel? Javi se administratoru uredništva za novu pozivnicu.'));
  forma.ime.focus();
}

function zaslonKoda() {
  let rezervni = false;
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const unos = h('input', { name: 'kod', type: 'text', class: 'kod-unos', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '[0-9]*', required: true });
  const oznaka = h('span', {}, 'Šesteroznamenkasti kod iz aplikacije');
  const prebaci = h('button', { class: 'veza', type: 'button', onclick: () => {
    rezervni = !rezervni;
    oznaka.textContent = rezervni ? 'Rezervni kod (npr. ABCDE-FGHJK)' : 'Šesteroznamenkasti kod iz aplikacije';
    unos.className = rezervni ? '' : 'kod-unos'; unos.inputMode = rezervni ? 'text' : 'numeric'; unos.maxLength = rezervni ? 11 : 6; unos.value = ''; unos.focus();
    prebaci.textContent = rezervni ? 'Upotrijebi kod iz aplikacije' : 'Nemam mobitel — upotrijebi rezervni kod';
  } }, 'Nemam mobitel — upotrijebi rezervni kod');
  const forma = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const gumb = $('button[type=submit]', forma); gumb.disabled = true; porukaGreske(greska, '');
    try {
      const r = await api('POST', '/prijava/2fa', { kod: unos.value });
      prijavljen(r);
      if (r.preostaloRezervnih !== undefined) obavijest(`Iskoristio si rezervni kod. Preostalo: ${r.preostaloRezervnih}. Kad ih ostane malo, javi se developeru.`, { vrsta: 'greska', trajanje: 12000 });
    } catch (err) {
      porukaGreske(greska, err.message); gumb.disabled = false; unos.select();
      if (err.status === 401 || err.status === 429) setTimeout(() => zaslonPrijave(err.message), 1500);
    }
  } }, h('label', { class: 'polje' }, oznaka, unos), greska, h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Potvrdi'));
  ekran(h('h1', {}, 'Dvostruka potvrda'), h('p', { class: 'uvod' }, 'Otvori aplikaciju za potvrdu na mobitelu i upiši kod za Camellia sinensis.'), forma, prebaci);
  unos.focus();
}

function koraci(n) { return h('div', { class: 'koraci', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h('i', { class: i <= n ? 'da' : '' }))); }

/** obrazac za novu lozinku (prvo postavljanje i pozivnica); posalji(forma) vraća odgovor s korakom dvostruke potvrde */
function obrazacLozinke(polja, posalji) {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    if (forma.lozinka.value !== forma.ponovi.value) { porukaGreske(greska, 'Lozinke se ne podudaraju.'); return; }
    const gumb = $('button[type=submit]', forma); gumb.disabled = true;
    try { zaslonPostavljanja2fa(await posalji(forma)); } catch (err) { porukaGreske(greska, err.message); gumb.disabled = false; }
  } },
  ...polja,
  h('label', { class: 'polje' }, h('span', {}, 'Nova lozinka'), h('input', { name: 'lozinka', type: 'password', autocomplete: 'new-password', minlength: 12, required: true }),
    h('small', {}, 'Najmanje 12 znakova. Najlakše je nekoliko riječi, npr. "plava kaseta svira jazz".')),
  h('label', { class: 'polje' }, h('span', {}, 'Ponovi lozinku'), h('input', { name: 'ponovi', type: 'password', autocomplete: 'new-password', required: true })),
  greska, h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Dalje'));
  return forma;
}

/** prvi račun — izravno na /urednistvo; na serveru uz kod iz datoteke PRVO-POSTAVLJANJE.txt */
function zaslonPostavljanja({ kodPotreban }) {
  const forma = obrazacLozinke([
    kodPotreban ? h('label', { class: 'polje' }, h('span', {}, 'Kod za postavljanje'),
      h('input', { name: 'kod', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', required: true }),
      h('small', {}, 'U datoteci PRVO-POSTAVLJANJE.txt u mapi s podacima uredništva (cPanel → File Manager → camellia-podaci).')) : null,
    h('label', { class: 'polje' }, h('span', {}, 'Korisničko ime'), h('input', { name: 'ime', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true }), h('small', {}, 'Mala slova i brojke, npr. daniel')),
  ], (f) => api('POST', '/postavljanje', { kod: f.kod?.value, ime: f.ime.value, lozinka: f.lozinka.value }));
  ekran(koraci(1), h('h1', {}, 'Postavljanje uredništva'),
    h('p', { class: 'uvod' }, 'Ovo radiš samo jednom: odaberi korisničko ime i lozinku, zatim uključi dvostruku potvrdu na mobitelu. Ostale korisnike poslije pozivaš iz uredništva.'), forma);
  (forma.kod ?? forma.ime).focus();
}

async function zaslonPozivnice(token) {
  let info;
  try { info = await api('POST', '/pozivnica/provjeri', { token }); } catch (err) {
    ekran(h('h1', {}, 'Pozivnica ne vrijedi'), h('p', { class: 'poruka greska' }, err.message), h('p', { class: 'uvod' }, 'Zatraži novu pozivnicu od administratora uredništva.'),
      h('button', { class: 'gumb', type: 'button', onclick: () => zaslonPrijave() }, 'Na prijavu'));
    return;
  }
  const forma = obrazacLozinke([h('p', { class: 'poruka info' }, `Korisničko ime: ${info.ime}`)],
    (f) => api('POST', '/pozivnica', { token, lozinka: f.lozinka.value }));
  ekran(koraci(1), h('h1', {}, 'Dobrodošao u uredništvo'), h('p', { class: 'uvod' }, 'Prvo odaberi lozinku, zatim uključi dvostruku potvrdu na mobitelu. To radiš samo jednom.'), forma);
  forma.lozinka.focus();
}

function qrSlika(uri) {
  const q = qrcode(0, 'M');
  q.addData(uri);
  q.make();
  return q.createDataURL(5, 4);
}

function zaslonPostavljanja2fa({ uri, kljuc }) {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const unos = h('input', { name: 'kod', type: 'text', class: 'kod-unos', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, required: true });
  const forma = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    const gumb = $('button[type=submit]', forma); gumb.disabled = true;
    try { const r = await api('POST', '/2fa/potvrdi', { kod: unos.value }); zaslonRezervnihKodova(r); } catch (err) {
      porukaGreske(greska, err.message); gumb.disabled = false; unos.select();
      if (err.status === 401 || err.status === 429) setTimeout(() => zaslonPrijave(err.message), 1500);
    }
  } }, h('label', { class: 'polje' }, h('span', {}, '3. Upiši šesteroznamenkasti kod koji aplikacija prikazuje'), unos), greska, h('button', { class: 'gumb glavni cijela', type: 'submit' }, 'Uključi dvostruku potvrdu'));
  const kljucEl = h('details', {}, h('summary', { class: 'veza' }, 'Ne mogu skenirati — upiši ključ ručno'), h('p', { class: 'tajni-kljuc' }, kljuc));
  ekran(koraci(2), h('h1', {}, 'Dvostruka potvrda'),
    h('p', { class: 'uvod' }, '1. Na mobitel instaliraj aplikaciju za potvrdu (npr. Google Authenticator ili Microsoft Authenticator).'),
    h('p', { class: 'uvod' }, '2. U aplikaciji dodaj račun i skeniraj ovaj kod:'),
    h('div', { class: 'qr' }, h('img', { src: qrSlika(uri), alt: 'QR kod za aplikaciju za potvrdu', width: 220, height: 220 })), kljucEl, forma);
  $('.kartica', app).classList.add('siroka');
}

function zaslonRezervnihKodova(r) {
  const tekst = `Camellia sinensis uredništvo — rezervni kodovi (${r.ime})\nSvaki kod vrijedi jednom, ako nemaš mobitel.\n\n${r.rezervniKodovi.join('\n')}\n`;
  const nastavi = h('button', { class: 'gumb glavni cijela', type: 'button', disabled: true, onclick: () => prijavljen(r) }, 'Otvori uredništvo');
  ekran(koraci(3), h('h1', {}, 'Spremi rezervne kodove'),
    h('p', { class: 'uvod' }, 'Ako izgubiš mobitel, s ovim kodovima se i dalje možeš prijaviti (svaki jednom). Prikazuju se samo sada.'),
    h('ul', { class: 'rezervni' }, r.rezervniKodovi.map((k) => h('li', {}, k))),
    h('div', { class: 'dva' },
      h('button', { class: 'gumb', type: 'button', onclick: async (e) => { try { await navigator.clipboard.writeText(tekst); e.currentTarget.textContent = 'Kopirano ✓'; } catch { obavijest('Kopiranje nije uspjelo — preuzmi datoteku.', { vrsta: 'greska' }); } } }, 'Kopiraj'),
      h('button', { class: 'gumb', type: 'button', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([tekst], { type: 'text/plain' })), download: 'camellia-rezervni-kodovi.txt' }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } }, 'Preuzmi .txt')),
    h('label', { class: 'kvacica' }, h('input', { type: 'checkbox', onchange: (e) => { nastavi.disabled = !e.target.checked; } }), 'Spremio sam kodove na sigurno mjesto (ne na isti mobitel).'),
    nastavi);
  $('.kartica', app).classList.add('siroka');
}

function prijavljen({ ime, uloga, csrf }) {
  S.ime = ime; S.uloga = uloga; S.csrf = csrf; zadnjiDodir = Date.now();
  if (S.nakonPrijave) { const fn = S.nakonPrijave; S.nakonPrijave = null; fn(); return; }
  ucitajUrednik();
}
function prijavaIstekla(razlog) {
  const sacuvano = S.katalog && S.prljavo;
  if (sacuvano) S.nakonPrijave = () => { crtajUrednik(); obavijest('Prijavljen si ponovno. Promjene su sačuvane — sada ih spremi.'); };
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  zaslonPrijave(`${porukaIsteka(razlog)}${sacuvano ? ' — nespremljene promjene ostaju.' : '.'}`);
}

// ---------------- urednik kataloga ----------------
// Odjeljci (lijevo): Ponuda po vrsti čaja, Vrste čaja, Izdvojeno (polica na naslovnici).
// Radi se nad radnom kopijom cijelog kataloga; "Spremi i objavi" sprema sve odjednom (jedna verzija u povijesti).
async function ucitajUrednik() {
  app.replaceChildren(h('p', { class: 'ucitavanje', role: 'status' }, 'Učitavam katalog…'));
  S.katalog = await api('GET', '/katalog');
  S.radni = kopija(S.katalog.sadrzaj);
  S.prljavo = false; S.otvoreno.clear(); S.greske = {}; S.sirovo = {}; S.novi = new Set();
  if (!S.odabrana) S.odabrana = `vrsta:${S.radni.vrste[0].kljuc}`;
  crtajUrednik();
  osvjeziObjavu();
}

const OZ = () => S.katalog.oznake;
const vrsta = (k) => S.radni.vrste.find((v) => v.kljuc === k);
const proizvodiVrste = (k) => S.radni.proizvodi.filter((p) => p.vrsta === k);
const poId = (id) => S.radni.proizvodi.find((p) => p.id === id);

function odaberi(o) {
  S.odabrana = o; S.otvoreno.clear();
  crtajUrednik();
  $('.glava h1', app)?.focus();
}

function oznaciPromjenu() {
  if (!S.prljavo) { S.prljavo = true; crtajTrakuSpremanja(); }
}

function crtajUrednik() {
  const o = S.odabrana;
  const tijelo = o === 'vrste' ? crtajVrste() : o === 'izdvojeno' ? crtajIzdvojeno() : crtajPonudu(o.slice(6));
  app.replaceChildren(
    crtajVrh(),
    h('div', { class: 'radno' },
      crtajBocno(),
      h('main', { class: 'sadrzaj', id: 'sadrzaj' }, crtajOdabirMobitel(), ...tijelo)),
    h('div', { class: 'spremanje', id: 'spremanje', role: 'region', 'aria-label': 'Spremanje' }));
  crtajTrakuSpremanja();
}

function crtajBocno() {
  const gumb = (o, tekst, broj) => h('li', {}, h('button', { type: 'button', 'aria-current': o === S.odabrana ? 'true' : 'false', onclick: () => odaberi(o) },
    h('span', {}, tekst), broj !== undefined ? h('span', { class: 'broj' }, broj) : null));
  return h('nav', { class: 'bocno', 'aria-label': 'Odjeljci' },
    h('div', {}, h('h2', {}, 'Ponuda'), h('ul', {}, S.radni.vrste.map((v) => gumb(`vrsta:${v.kljuc}`, v.naziv, proizvodiVrste(v.kljuc).length)))),
    h('div', {}, h('h2', {}, 'Katalog'), h('ul', {}, gumb('vrste', 'Vrste čaja'))),
    h('div', {}, h('h2', {}, 'Izdvojeno'), h('ul', {}, gumb('izdvojeno', 'Polica na naslovnici', S.radni.izdvojeno.polica.length))));
}

function crtajOdabirMobitel() {
  const sel = h('select', { id: 'odabir-odjeljka', onchange: (e) => odaberi(e.target.value) },
    h('optgroup', { label: 'Ponuda' }, S.radni.vrste.map((v) => h('option', { value: `vrsta:${v.kljuc}`, selected: S.odabrana === `vrsta:${v.kljuc}` }, v.naziv))),
    h('optgroup', { label: 'Katalog' }, h('option', { value: 'vrste', selected: S.odabrana === 'vrste' }, 'Vrste čaja')),
    h('optgroup', { label: 'Izdvojeno' }, h('option', { value: 'izdvojeno', selected: S.odabrana === 'izdvojeno' }, 'Polica na naslovnici')));
  return h('label', { class: 'odabir-mobitel polje' }, h('span', {}, 'Odjeljak'), sel);
}

// ----- ponuda (proizvodi jedne vrste) -----
function crtajPonudu(k) {
  const lista = proizvodiVrste(k);
  return [
    h('div', { class: 'glava' },
      h('div', {}, h('p', {}, 'Ponuda'), h('h1', { tabindex: '-1' }, vrsta(k).naziv)),
      h('p', {}, `${lista.length} ${mnozina(lista.length, ['proizvod', 'proizvoda', 'proizvoda'])}`)),
    lista.length ? h('ul', { class: 'popis', id: 'popis' }, lista.map((p, i) => crtajProizvod(p, i, lista.length))) : h('p', { class: 'prazno' }, 'U ovoj vrsti još nema proizvoda.'),
    h('div', { class: 'dodaj' }, h('button', { class: 'gumb', type: 'button', onclick: () => dodajProizvod(k) }, ikona('plus'), 'Dodaj proizvod')),
  ];
}

function sazetakProizvoda(p) {
  const zaliha = p.zaliha === null ? 'zaliha se ne broji' : p.zaliha === 0 ? 'rasprodano' : `na zalihi ${p.zaliha}`;
  return { naziv: p.naziv || 'Novi proizvod (bez naziva)', novo: !p.naziv, opis: [p.sku, p.pakiranje, zaliha, p.objavljeno ? null : 'NIJE OBJAVLJENO'].filter(Boolean).join(' · ') };
}
const cijenaProizvoda = (p) => h('span', { class: 'cijena' }, eur(p.cijena));
const minijatura = (p) => (p.slika ? h('img', { class: 'minijatura', src: `/urednistvo/api/slike/${p.slika}`, alt: '', loading: 'lazy' }) : h('span', { class: 'minijatura prazna', 'aria-hidden': 'true' }, ikona('slika')));

function crtajProizvod(p, i, n) {
  const otvoreno = S.otvoreno.has(p.id);
  const g = S.greske[p.id] ?? {};
  const z = sazetakProizvoda(p);
  const sazetak = h('button', { class: 'sazetak', type: 'button', 'aria-expanded': String(otvoreno), 'aria-controls': `obrazac-${p.id}`, onclick: () => { if (otvoreno) S.otvoreno.delete(p.id); else S.otvoreno.add(p.id); crtajUrednik(); $(`#stavka-${p.id} .sazetak`)?.focus(); } },
    h('span', { class: `naziv${z.novo ? ' novo' : ''}` }, z.naziv), h('span', { class: 'opis' }, z.opis));
  const rucka = h('button', { class: 'rucka', type: 'button', 'aria-label': `Premjesti: ${z.naziv} (strelice gore/dolje)`, onkeydown: (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); pomakniProizvod(p.id, e.key === 'ArrowUp' ? -1 : 1, true); }
  } }, ikona('rucka'));
  vuci(rucka, p.id, (red) => posloziVrstu(p.vrsta, red));
  const red = h('div', { class: 'red' }, rucka, minijatura(p), sazetak, cijenaProizvoda(p),
    h('span', { class: 'akcije' },
      h('button', { class: 'gumb ikona tih gore-dolje', type: 'button', 'aria-label': 'Pomakni gore', disabled: i === 0, onclick: () => pomakniProizvod(p.id, -1) }, ikona('gore')),
      h('button', { class: 'gumb ikona tih gore-dolje', type: 'button', 'aria-label': 'Pomakni dolje', disabled: i === n - 1, onclick: () => pomakniProizvod(p.id, 1) }, ikona('dolje')),
      h('button', { class: 'gumb ikona tih opasno', type: 'button', 'aria-label': `Obriši: ${z.naziv}`, onclick: () => obrisiProizvod(p.id) }, ikona('brisi'))));
  const li = h('li', { class: `stavka${otvoreno ? ' otvorena' : ''}${Object.keys(g).length ? ' ima-gresku' : ''}`, id: `stavka-${p.id}`, dataset: { id: p.id } }, red);
  if (otvoreno) li.append(obrazacProizvoda(p));
  return li;
}

/** odabir iz skupa vrijednosti (okusi, namjene, oznake) kao kvačice */
function kvacice(p, kljuc, oznaka, mogucnosti) {
  return h('fieldset', { class: 'kvacice', 'data-putanja': `${p.id}:${kljuc}` }, h('legend', { class: 'oznaka' }, oznaka),
    Object.entries(mogucnosti).map(([v, l]) => h('label', { class: 'kvacica' },
      h('input', { type: 'checkbox', checked: p[kljuc].includes(v), onchange: (e) => {
        p[kljuc] = e.target.checked ? [...p[kljuc], v] : p[kljuc].filter((x) => x !== v);
        oznaciPromjenu(); ocistiGresku(`${p.id}:${kljuc}`);
      } }), l)));
}
function izbor(p, kljuc, oznaka, mogucnosti, { opis, uBroj = false } = {}) {
  const sel = h('select', { 'data-putanja': `${p.id}:${kljuc}`, onchange: (e) => {
    const v = e.target.value;
    p[kljuc] = uBroj ? (v === '' ? null : Number(v)) : v;
    oznaciPromjenu(); ocistiGresku(`${p.id}:${kljuc}`); osvjeziSazetak(p.id);
    if (kljuc === 'vrsta') { S.otvoreno.add(p.id); odaberi(`vrsta:${v}`); obavijest(`Proizvod je premješten u: ${vrsta(v).naziv}`); }
  } }, mogucnosti.map(([v, l]) => h('option', { value: v, selected: String(p[kljuc] ?? '') === String(v) }, l)));
  return h('label', { class: 'polje' }, h('span', {}, oznaka), sel, opis ? h('small', {}, opis) : null);
}

function obrazacProizvoda(p) {
  const id = p.id;
  const novi = S.novi.has(id);
  const tekst = (k, oznaka, o = {}) => tekstPolje(p, k, oznaka, { id, putanja: `${id}:${k}`, ...o });
  const zaliha = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: p.zaliha ?? '', placeholder: 'prazno = ne broji se', 'data-putanja': `${id}:zaliha`,
    oninput: (e) => {
      const t = e.target.value.trim();
      p.zaliha = t === '' ? null : /^\d{1,6}$/.test(t) ? Number(t) : p.zaliha;
      S.sirovo[`${id}:zaliha`] = t; oznaciPromjenu(); ocistiGresku(`${id}:zaliha`); osvjeziSazetak(id);
    } });
  const priprema = p.priprema ?? { temp: '', vrijeme: '', kolicina: '' };
  const pripremaPolje = (k, oznaka, mjesto) => tekstPolje(priprema, k, oznaka, { id, putanja: `${id}:priprema`, mjesto });
  // priprema se sprema samo ako je upisano barem jedno polje
  const spremiPripremu = () => { p.priprema = priprema.temp || priprema.vrijeme || priprema.kolicina ? priprema : null; };
  const forma = h('div', { class: 'obrazac', id: `obrazac-${id}` },
    tekst('naziv', 'Naziv', { oninput: () => { if (novi) { p.slug = slug(p.naziv); const a = $(`[data-putanja="${id}:slug"]`); if (a) a.value = p.slug; } } }),
    h('div', { class: 'dva' },
      novi ? tekst('sku', 'Šifra (SKU)', { opis: 'Dobavljačeva šifra. Nakon spremanja se više ne mijenja.' })
        : h('label', { class: 'polje' }, h('span', {}, 'Šifra (SKU)'), h('input', { type: 'text', value: p.sku, readonly: true }), h('small', {}, 'Šifra se ne mijenja (veže košaricu i narudžbe).')),
      tekst('slug', 'Adresa na stranici', { opis: `camelliasinensis.eu/proizvod/${p.slug || '…'}/` })),
    h('div', { class: 'cijene' }, poljeCijene(p, 'cijena', 'Cijena (€)'), tekst('pakiranje', 'Pakiranje', { mjesto: 'npr. 50 g' })),
    h('div', { class: 'dva' },
      h('label', { class: 'polje' }, h('span', {}, 'Zaliha (komada)'), zaliha, h('small', {}, '0 = rasprodano, prazno = zaliha se ne broji')),
      h('label', { class: 'kvacica dno' }, h('input', { type: 'checkbox', checked: p.objavljeno, onchange: (e) => { p.objavljeno = e.target.checked; oznaciPromjenu(); osvjeziSazetak(id); } }), 'Objavljeno na stranici')),
    tekstPolje(p, 'opis', 'Opis', { visered: true, id, putanja: `${id}:opis`, opis: 'Prazan red = novi odlomak.' }),
    poljeSlike(p, 'slika', 'Fotografija', { id, ukloni: true, opis: 'Klikni ili dovuci fotografiju. Može ravno s mobitela: sama se smanji, a stranica radi manje verzije.' }),
    h('div', { class: 'dva' },
      izbor(p, 'vrsta', 'Vrsta', S.radni.vrste.map((v) => [v.kljuc, v.naziv])),
      izbor(p, 'oblik', 'Oblik', Object.entries(OZ().oblici))),
    h('div', { class: 'dva' },
      tekst('podrijetlo', 'Podrijetlo', { mjesto: 'npr. Kina' }),
      izbor(p, 'tein', 'Razina teina', [['', 'bez oznake (pribor)'], ...OZ().tein.map((t, i) => [i, t])], { uBroj: true })),
    kvacice(p, 'okusi', 'Okusi', OZ().okusi),
    kvacice(p, 'namjene', 'Namjena', OZ().namjene),
    kvacice(p, 'oznake', 'Oznake', OZ().oznake),
    h('fieldset', { class: 'priprema', oninput: spremiPripremu }, h('legend', { class: 'oznaka' }, 'Priprema (prazno = ne prikazuje se)'),
      h('div', { class: 'tri' }, pripremaPolje('temp', 'Temperatura', '85 °C'), pripremaPolje('vrijeme', 'Vrijeme', '3–4 min'), pripremaPolje('kolicina', 'Količina', '4 g / 250 ml'))),
    h('div', { class: 'dno-obrasca' }, h('button', { class: 'gumb', type: 'button', onclick: () => { S.otvoreno.delete(id); crtajUrednik(); } }, 'Zatvori')));
  pokaziGreske(forma, id);
  return forma;
}

function slug(s) {
  return String(s ?? '').replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function osvjeziSazetak(id) {
  const p = poId(id); const li = $(`#stavka-${id}`);
  if (!p || !li) return;
  const z = sazetakProizvoda(p);
  const n = $('.naziv', li); n.textContent = z.naziv; n.classList.toggle('novo', Boolean(z.novo));
  const o = $('.sazetak .opis', li); if (o) o.textContent = z.opis;
  $('.cijena', li)?.replaceWith(cijenaProizvoda(p));
  $('.minijatura', li)?.replaceWith(minijatura(p));
}

function noviId() { const b = new Uint8Array(6); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); }
function dodajProizvod(k) {
  const p = { id: noviId(), sku: '', slug: '', naziv: '', vrsta: k, podrijetlo: '', tein: k === 'pribor' ? null : 1, okusi: [], oblik: k === 'pribor' ? 'pribor' : 'rastresiti',
    cijena: null, pakiranje: k === 'pribor' ? 'kom' : '50 g', namjene: [], oznake: [], priprema: null, opis: '', zaliha: 0, objavljeno: false, slika: null };
  S.radni.proizvodi.push(p); S.novi.add(p.id); S.otvoreno.add(p.id); oznaciPromjenu(); crtajUrednik();
  const li = $(`#stavka-${p.id}`); li?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  $('input, textarea', li)?.focus();
  obavijest('Novi proizvod je skriven dok ne uključiš "Objavljeno na stranici".');
}
function obrisiProizvod(id) {
  const i = S.radni.proizvodi.findIndex((p) => p.id === id);
  const [p] = S.radni.proizvodi.splice(i, 1);
  const naPolici = S.radni.izdvojeno.polica.indexOf(p.sku);
  if (naPolici >= 0) S.radni.izdvojeno.polica.splice(naPolici, 1);
  S.otvoreno.delete(id); delete S.greske[id];
  oznaciPromjenu(); crtajUrednik();
  obavijest(`Obrisano: ${sazetakProizvoda(p).naziv}`, { trajanje: 8000, akcija: { tekst: 'Poništi', fn: () => {
    S.radni.proizvodi.splice(i, 0, p); if (naPolici >= 0) S.radni.izdvojeno.polica.splice(naPolici, 0, p.sku); crtajUrednik();
  } } });
}
/** novi redoslijed proizvoda jedne vrste (popis id-eva); ostali proizvodi ostaju na svojim mjestima */
function posloziVrstu(k, red) {
  const sorted = red.map(poId);
  let j = 0;
  S.radni.proizvodi = S.radni.proizvodi.map((p) => (p.vrsta === k ? sorted[j++] : p));
  oznaciPromjenu(); crtajUrednik();
}
function pomakniProizvod(id, d, fokus) {
  const k = poId(id).vrsta;
  const red = proizvodiVrste(k).map((p) => p.id);
  const i = red.indexOf(id); const j = i + d;
  if (j < 0 || j >= red.length) return;
  [red[i], red[j]] = [red[j], red[i]];
  posloziVrstu(k, red);
  if (fokus) $(`#stavka-${id} .rucka`)?.focus();
}

// ----- vrste čaja -----
function crtajVrste() {
  return [
    h('div', { class: 'glava' }, h('div', {}, h('p', {}, 'Katalog'), h('h1', { tabindex: '-1' }, 'Vrste čaja')),
      h('p', {}, 'Redoslijed vrijedi za naslovnicu, katalog i filtre.')),
    h('ul', { class: 'popis' }, S.radni.vrste.map((v, i) => {
      const id = `vrsta-${v.kljuc}`;
      const forma = h('div', { class: 'obrazac otvoren' },
        tekstPolje(v, 'naziv', 'Naziv', { id, putanja: `${id}:naziv` }),
        tekstPolje(v, 'opis', 'Kratki opis (pločica na naslovnici)', { visered: true, id, putanja: `${id}:opis` }));
      pokaziGreske(forma, id);
      const pomakni = (d) => { const st = S.radni.vrste; [st[i], st[i + d]] = [st[i + d], st[i]]; oznaciPromjenu(); crtajUrednik(); };
      return h('li', { class: `stavka otvorena${S.greske[id] ? ' ima-gresku' : ''}`, id: `stavka-${id}` },
        h('div', { class: 'red' }, h('span', { class: 'sazetak' }, h('span', { class: 'naziv' }, v.naziv || v.kljuc), h('span', { class: 'opis' }, `${proizvodiVrste(v.kljuc).length} proizvoda · adresa /katalog/${v.kljuc}/`)),
          h('span', { class: 'akcije' },
            h('button', { class: 'gumb ikona tih', type: 'button', 'aria-label': `Pomakni gore: ${v.naziv}`, disabled: i === 0, onclick: () => pomakni(-1) }, ikona('gore')),
            h('button', { class: 'gumb ikona tih', type: 'button', 'aria-label': `Pomakni dolje: ${v.naziv}`, disabled: i === S.radni.vrste.length - 1, onclick: () => pomakni(1) }, ikona('dolje')))),
        forma);
    })),
  ];
}

// ----- izdvojeno: polica na naslovnici -----
function crtajIzdvojeno() {
  const polica = S.radni.izdvojeno.polica;
  const najvise = S.katalog.najviseNaPolici;
  const poSku = (s) => S.radni.proizvodi.find((p) => p.sku === s);
  const pomakni = (i, d) => { [polica[i], polica[i + d]] = [polica[i + d], polica[i]]; oznaciPromjenu(); crtajUrednik(); };
  const ostali = S.radni.proizvodi.filter((p) => p.objavljeno && p.sku && !polica.includes(p.sku));
  const dodaj = h('select', { 'aria-label': 'Dodaj proizvod na policu', disabled: polica.length >= najvise, onchange: (e) => {
    if (!e.target.value) return; polica.push(e.target.value); oznaciPromjenu(); crtajUrednik();
  } }, h('option', { value: '' }, polica.length >= najvise ? `Polica je puna (najviše ${najvise})` : 'Dodaj proizvod na policu…'),
    S.radni.vrste.map((v) => h('optgroup', { label: v.naziv }, ostali.filter((p) => p.vrsta === v.kljuc).map((p) => h('option', { value: p.sku }, p.naziv)))));
  return [
    h('div', { class: 'glava' }, h('div', {}, h('p', {}, 'Izdvojeno'), h('h1', { tabindex: '-1' }, 'Polica na naslovnici')),
      h('p', {}, `${polica.length} od najviše ${najvise}`)),
    h('p', { class: 'uvod-odjeljka' }, '"Istaknuto s police" na naslovnici, ovim redom. Samo objavljeni proizvodi. Klikni na proizvod da ga urediš.'),
    polica.length ? h('ul', { class: 'popis' }, polica.map((s, i) => {
      const p = poSku(s);
      // klik na proizvod otvara isti obrazac kao u Ponudi (mijenja isti proizvod)
      const otvoreno = Boolean(p) && S.otvoreno.has(p.id);
      const z = p ? sazetakProizvoda(p) : { naziv: s, opis: 'proizvod više ne postoji' };
      const sazetak = p
        ? h('button', { class: 'sazetak', type: 'button', 'aria-expanded': String(otvoreno), 'aria-controls': `obrazac-${p.id}`, onclick: () => { if (otvoreno) S.otvoreno.delete(p.id); else S.otvoreno.add(p.id); crtajUrednik(); $(`#stavka-${p.id} .sazetak`)?.focus(); } },
          h('span', { class: 'naziv' }, z.naziv), h('span', { class: 'opis' }, z.opis))
        : h('span', { class: 'sazetak' }, h('span', { class: 'naziv' }, z.naziv), h('span', { class: 'opis' }, z.opis));
      const li = h('li', { class: `stavka${otvoreno ? ' otvorena' : ''}${S.greske.polica?.[i] || (p && S.greske[p.id]) ? ' ima-gresku' : ''}`, id: p ? `stavka-${p.id}` : undefined }, h('div', { class: 'red' },
        p ? minijatura(p) : null, sazetak, p ? cijenaProizvoda(p) : null,
        h('span', { class: 'akcije' },
          h('button', { class: 'gumb ikona tih', type: 'button', 'aria-label': 'Pomakni gore', disabled: i === 0, onclick: () => pomakni(i, -1) }, ikona('gore')),
          h('button', { class: 'gumb ikona tih', type: 'button', 'aria-label': 'Pomakni dolje', disabled: i === polica.length - 1, onclick: () => pomakni(i, 1) }, ikona('dolje')),
          h('button', { class: 'gumb ikona tih opasno', type: 'button', 'aria-label': `Makni s police: ${z.naziv}`, onclick: () => { polica.splice(i, 1); oznaciPromjenu(); crtajUrednik(); } }, ikona('brisi')))));
      if (otvoreno) li.append(obrazacProizvoda(p));
      return li;
    })) : h('p', { class: 'prazno' }, 'Polica je prazna.'),
    h('div', { class: 'dodaj' }, h('label', { class: 'polje' }, dodaj)),
  ];
}

// ----- provjera i spremanje -----
function provjeriRadni() {
  const g = {};
  const dodajG = (id, polje, poruka) => { (g[id] ??= {})[polje] = poruka; };
  const skus = new Map(); const slugs = new Map();
  for (const p of S.radni.proizvodi) {
    if (!p.naziv.trim()) dodajG(p.id, 'naziv', 'Upiši naziv');
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(p.sku)) dodajG(p.id, 'sku', 'Šifra: slova, brojke, točka i crtica');
    else if (skus.has(p.sku)) dodajG(p.id, 'sku', 'Ta šifra već postoji'); else skus.set(p.sku, p.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) dodajG(p.id, 'slug', 'Adresa: mala slova, brojke i crtice');
    else if (slugs.has(p.slug)) dodajG(p.id, 'slug', 'Ta adresa već postoji'); else slugs.set(p.slug, p.id);
    const c = S.sirovo[`${p.id}:cijena`];
    if (c !== undefined ? uBroj(c) === null || !(uBroj(c) > 0) : !(p.cijena > 0)) dodajG(p.id, 'cijena', 'Upiši cijenu, npr. 11,90');
    const z = S.sirovo[`${p.id}:zaliha`];
    if (z !== undefined && z !== '' && !/^\d{1,6}$/.test(z)) dodajG(p.id, 'zaliha', 'Zaliha je cijeli broj');
    if (!p.pakiranje.trim()) dodajG(p.id, 'pakiranje', 'Upiši pakiranje, npr. 50 g');
    if (!p.opis.trim()) dodajG(p.id, 'opis', 'Upiši opis');
  }
  S.radni.vrste.forEach((v) => { if (!v.naziv.trim()) dodajG(`vrsta-${v.kljuc}`, 'naziv', 'Upiši naziv vrste'); });
  return g;
}

function crtajTrakuSpremanja() {
  const traka = $('#spremanje');
  if (!traka) return;
  traka.replaceChildren(
    h('p', {}, 'Imaš nespremljene promjene'),
    h('button', { class: 'gumb tih', type: 'button', onclick: () => { if (confirm('Odbaciti sve nespremljene promjene?')) ucitajUrednik(); } }, 'Odbaci'),
    h('button', { class: 'gumb glavni', type: 'button', id: 'spremi', onclick: spremi }, 'Spremi i objavi'));
  traka.classList.toggle('vidljivo', S.prljavo);
  traka.inert = !S.prljavo;
}

/** opis verzije za povijest: što se mijenjalo */
function opisPromjene() {
  const st = S.katalog.sadrzaj;
  const dijelovi = [];
  const prije = new Map(st.proizvodi.map((p) => [p.id, JSON.stringify(p)]));
  const sada = new Map(S.radni.proizvodi.map((p) => [p.id, p]));
  const promijenjeni = S.radni.proizvodi.filter((p) => prije.has(p.id) && prije.get(p.id) !== JSON.stringify(p)).map((p) => p.naziv);
  const novi = S.radni.proizvodi.filter((p) => !prije.has(p.id)).map((p) => p.naziv);
  const obrisani = st.proizvodi.filter((p) => !sada.has(p.id)).map((p) => p.naziv);
  if (novi.length) dijelovi.push(`novo: ${novi.join(', ')}`);
  if (promijenjeni.length) dijelovi.push(promijenjeni.length > 3 ? `${promijenjeni.length} proizvoda` : promijenjeni.join(', '));
  if (obrisani.length) dijelovi.push(`obrisano: ${obrisani.join(', ')}`);
  if (JSON.stringify(st.vrste) !== JSON.stringify(S.radni.vrste)) dijelovi.push('vrste čaja');
  if (JSON.stringify(st.izdvojeno) !== JSON.stringify(S.radni.izdvojeno)) dijelovi.push('polica');
  return dijelovi.join('; ').slice(0, 120) || 'Promjena kataloga';
}

async function spremi() {
  S.greske = provjeriRadni();
  if (Object.keys(S.greske).length) { pokaziPrvuGresku(); return; }
  const gumb = $('#spremi'); if (gumb) { gumb.disabled = true; gumb.textContent = 'Spremam…'; }
  try {
    const r = await api('PUT', '/katalog', { verzija: S.katalog.sadrzaj.verzija, katalog: S.radni, opis: opisPromjene() });
    S.katalog.sadrzaj = r.sadrzaj; S.radni = kopija(r.sadrzaj);
    S.prljavo = false; S.sirovo = {}; S.greske = {}; S.novi = new Set();
    crtajUrednik();
    obavijest('Spremljeno. Promjene su na stranici za 1–2 minute.', { trajanje: 8000 });
    pratiObjavu(true);
  } catch (err) {
    if (err.status === 409) obavijest('Netko je u međuvremenu spremio promjene. Osvježi stranicu (tvoje promjene treba ponoviti).', { vrsta: 'greska', trajanje: 15000, akcija: { tekst: 'Osvježi', fn: () => location.reload() } });
    else if (err.status === 422 && err.podaci?.greske) {
      for (const g of err.podaci.greske) {
        const [dio, i, polje] = g.putanja;
        if (dio === 'proizvodi' && typeof i === 'number' && S.radni.proizvodi[i]) (S.greske[S.radni.proizvodi[i].id] ??= {})[polje ?? 'naziv'] = g.poruka;
        else if (dio === 'vrste' && typeof i === 'number') (S.greske[`vrsta-${S.radni.vrste[i].kljuc}`] ??= {})[polje ?? 'naziv'] = g.poruka;
        else if (dio === 'izdvojeno') { (S.greske.polica ??= {})[g.putanja[2] ?? 0] = g.poruka; obavijest(`Polica: ${g.poruka}`, { vrsta: 'greska', trajanje: 10000 }); }
        else obavijest(g.poruka, { vrsta: 'greska', trajanje: 10000 });
      }
      pokaziPrvuGresku();
    } else if (err.status !== 401) obavijest(err.message, { vrsta: 'greska', trajanje: 10000 });
    const g2 = $('#spremi'); if (g2) { g2.disabled = false; g2.textContent = 'Spremi i objavi'; }
  }
}

/** otvori odjeljak s prvom greškom, otvori proizvode s greškama i skoči na prvo polje */
function pokaziPrvuGresku() {
  const idevi = Object.keys(S.greske).filter((k) => k !== 'polica');
  const prviProizvod = idevi.map(poId).find(Boolean);
  for (const id of idevi) if (poId(id)) S.otvoreno.add(id);
  if (prviProizvod) S.odabrana = `vrsta:${prviProizvod.vrsta}`;
  else if (idevi.some((k) => k.startsWith('vrsta-'))) S.odabrana = 'vrste';
  else if (S.greske.polica) S.odabrana = 'izdvojeno';
  crtajUrednik();
  const prva = $('.ima-gresku input, .ima-gresku textarea, .ima-gresku select, .greska-polja');
  prva?.scrollIntoView({ block: 'center' }); if (prva?.focus) prva.focus();
  obavijest('Provjeri označena polja.', { vrsta: 'greska' });
}


function crtajVrh() {
  const zatvori = () => {
    popis.hidden = true; gumb.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', vani); document.removeEventListener('keydown', esc);
  };
  const vani = (e) => { if (!popis.contains(e.target) && !gumb.contains(e.target)) zatvori(); };
  const esc = (e) => { if (e.key === 'Escape') { zatvori(); gumb.focus(); } };
  const stavka = (ik, tekst, fn) => h('button', { type: 'button', onclick: () => { zatvori(); fn(); } }, ikona(ik), tekst);
  const popis = h('div', { class: 'izbornik-popis', hidden: true, id: 'izbornik' },
    h('p', { class: 'ime' }, `Prijavljen: ${S.ime}${S.uloga === 'admin' ? ' (administrator)' : ''}`),
    stavka('povijest', 'Povijest promjena', dijalogPovijesti),
    S.uloga === 'admin' ? stavka('korisnici', 'Korisnici', dijalogKorisnika) : null,
    S.uloga === 'admin' ? stavka('objava', 'Objava stranice', dijalogObjave) : null,
    S.uloga === 'admin' ? stavka('odrzavanje', 'Održavanje stranice', dijalogOdrzavanja) : null,
    stavka('kljuc', 'Promijeni lozinku', dijalogLozinke),
    stavka('odjava', 'Odjava', odjava));
  const gumb = h('button', { class: 'gumb ikona tih', type: 'button', 'aria-label': 'Izbornik', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'izbornik', onclick: () => {
    if (!popis.hidden) { zatvori(); return; }
    popis.hidden = false; gumb.setAttribute('aria-expanded', 'true'); $('button', popis).focus();
    document.addEventListener('click', vani); document.addEventListener('keydown', esc);
  } }, ikona('izbornik'));
  return h('header', { class: 'vrh' },
    h('div', { class: 'znak' }, h('img', { src: '/urednistvo/static/ikona.svg', alt: '' }), h('span', {}, 'Uredništvo', h('small', {}, 'Camellia sinensis'))),
    h('span', { class: 'status', id: 'status', role: 'status' }, h('span', { class: 'status-tekst' }, 'Objavljeno')),
    // dok je održavanje uključeno, to se stalno vidi (da se ne zaboravi isključiti)
    S.uloga === 'admin'
      ? h('button', { class: 'oznaka-odrzavanja', id: 'odrzavanje', type: 'button', hidden: !S.objava?.odrzavanje, onclick: dijalogOdrzavanja }, ikona('odrzavanje'), h('span', {}, 'Održavanje'))
      : h('span', { class: 'oznaka-odrzavanja', id: 'odrzavanje', hidden: !S.objava?.odrzavanje, title: 'Posjetitelji vide poruku o održavanju; isključuje ga administrator.' }, ikona('odrzavanje'), h('span', {}, 'Održavanje')),
    h('a', { class: 'gumb tih', href: '/', target: '_blank', rel: 'noopener noreferrer' }, ikona('van'), h('span', { class: 'pogledaj-tekst' }, 'Stranica')),
    h('div', { class: 'izbornik' }, gumb, popis));
}

// ----- polja obrasca -----
function tekstPolje(obj, kljuc, oznaka, { visered = false, id, putanja, opis, mjesto, oninput } = {}) {
  const el = h(visered ? 'textarea' : 'input', {
    ...(visered ? { rows: 3 } : { type: 'text' }), value: obj[kljuc] ?? '', placeholder: mjesto,
    'data-putanja': putanja, oninput: (e) => { obj[kljuc] = e.target.value; oznaciPromjenu(); ocistiGresku(putanja); oninput?.(); osvjeziSazetak(id); },
  });
  return h('label', { class: 'polje' }, h('span', {}, oznaka), el, opis ? h('small', {}, opis) : null);
}
function poljeCijene(s, kljuc, oznaka, { obavezno = true } = {}) {
  const k = `${s.id}:${kljuc}`;
  const vrijednost = S.sirovo[k] ?? brojUTekst(s[kljuc]);
  const el = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: vrijednost, placeholder: obavezno ? '0,00' : 'prazno = nema', 'data-putanja': k,
    oninput: (e) => {
      S.sirovo[k] = e.target.value;
      const t = e.target.value.trim();
      s[kljuc] = t === '' && !obavezno ? null : uBroj(t) ?? s[kljuc];
      oznaciPromjenu(); ocistiGresku(k); osvjeziSazetak(s.id);
    } });
  return h('label', { class: 'polje' }, h('span', {}, oznaka), h('span', { class: 'unos-cijene' }, el));
}
/**
 * Fotografija s mobitela (4000+ px, 5–20 MB) smanji se već u pregledniku na najviše 2400 px: slanje je brzo i na
 * mobilnim podacima, a poslužitelj (i hosting s ograničenom memorijom) dobiva malu datoteku. Poslužitelj je svejedno
 * iznova kodira i uklanja EXIF. Formate koje preglednik ne zna otvoriti (npr. HEIC) šalje kakve jesu.
 */
async function pripremiFotografiju(f) {
  const NAJVISE = 2400;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || typeof createImageBitmap !== 'function') return f;
  let bmp;
  try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { return f; }
  const omjer = Math.min(1, NAJVISE / Math.max(bmp.width, bmp.height));
  if (omjer === 1 && f.size <= 3 * 1024 * 1024) { bmp.close(); return f; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * omjer); c.height = Math.round(bmp.height * omjer);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // prozirni PNG ne smije postati crn
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
  return blob ?? f;
}

function poljeSlike(obj, kljuc, oznaka, { id, opis, ukloni = false } = {}) {
  const unos = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', hidden: true });
  const prikaz = () => (obj[kljuc] ? h('img', { src: `/urednistvo/api/slike/${obj[kljuc]}`, alt: '' }) : h('span', { class: 'prazna-slika' }, 'Nema fotografije', h('small', {}, 'klikni ili dovuci')));
  let slikaEl = prikaz();
  const tekst = h('span', {}, obj[kljuc] ? 'Promijeni fotografiju' : 'Dodaj fotografiju');
  const gumb = h('button', { class: 'gumb', type: 'button', 'data-putanja': `${id}:${kljuc}`, 'aria-label': `${tekst.textContent}: ${oznaka}`, onclick: () => unos.click() }, ikona('slika'), tekst);
  // fotografija proizvoda nije obavezna i smije se maknuti
  const makni = ukloni ? h('button', { class: 'gumb tih', type: 'button', hidden: !obj[kljuc], 'aria-label': `Ukloni fotografiju: ${oznaka}`, onclick: () => {
    obj[kljuc] = null; oznaciPromjenu();
    const novo = prikaz(); slikaEl.replaceWith(novo); slikaEl = novo;
    tekst.textContent = 'Dodaj fotografiju'; gumb.setAttribute('aria-label', `${tekst.textContent}: ${oznaka}`); makni.hidden = true;
    osvjeziSazetak(id); gumb.focus();
    obavijest('Fotografija uklonjena. Ne zaboravi spremiti.');
  } }, ikona('brisi'), 'Ukloni') : null;
  async function ucitaj(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { obavijest('To nije fotografija (JPG, PNG, WebP).', { vrsta: 'greska' }); return; }
    gumb.disabled = true; tekst.textContent = 'Učitavam…'; okvir.classList.add('ucitava');
    try {
      const datoteka = await pripremiFotografiju(f);
      if (datoteka.size > 15 * 1024 * 1024) throw new Error('Fotografija je veća od 15 MB.');
      const r = await api('POST', '/slike', datoteka, { sirovo: true, vrsta: datoteka.type || 'application/octet-stream' });
      obj[kljuc] = r.kljuc; oznaciPromjenu();
      const novo = prikaz(); slikaEl.replaceWith(novo); slikaEl = novo;
      if (makni) makni.hidden = false;
      ocistiGresku(`${id}:${kljuc}`); osvjeziSazetak(id);
      obavijest('Fotografija učitana. Ne zaboravi spremiti.');
    } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska', trajanje: 8000 }); }
    finally {
      gumb.disabled = false; okvir.classList.remove('ucitava');
      tekst.textContent = obj[kljuc] ? 'Promijeni fotografiju' : 'Dodaj fotografiju'; gumb.setAttribute('aria-label', `${tekst.textContent}: ${oznaka}`);
    }
  }
  unos.addEventListener('change', () => { const f = unos.files?.[0]; unos.value = ''; ucitaj(f); });
  // fotografija se može i dovući mišem (s računala ili iz druge kartice) na okvir, ili odabrati klikom na sliku
  const okvir = h('div', { class: 'fotografija',
    ondragover: (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); okvir.classList.add('povlaci'); } },
    ondragleave: () => okvir.classList.remove('povlaci'),
    ondrop: (e) => { e.preventDefault(); okvir.classList.remove('povlaci'); ucitaj(e.dataTransfer?.files?.[0]); },
    onclick: (e) => { if (e.target === slikaEl || slikaEl.contains(e.target)) unos.click(); },
  }, slikaEl, gumb, makni, unos);
  return h('div', { class: 'polje' }, h('span', { class: 'oznaka' }, oznaka), okvir, opis ? h('small', {}, opis) : null);
}

const omotPolja = (el) => el.closest('.polje, fieldset') ?? el.parentElement;
function pokaziGreske(forma, id) {
  for (const [polje, poruka] of Object.entries(S.greske[id] ?? {})) {
    const el = $(`[data-putanja="${id}:${polje}"]`, forma) ?? $(`[data-putanja^="${id}:${polje}"]`, forma);
    const omot = el ? omotPolja(el) : forma;
    omot.classList.add('ima-gresku');
    if (el?.matches('input, textarea')) el.setAttribute('aria-invalid', 'true');
    omot.append(h('span', { class: 'greska-polja', role: 'alert' }, poruka));
  }
}
/** ispravljeno polje odmah gubi poruku (a stavka crveni okvir kad više nema grešaka) */
function ocistiGresku(putanja) {
  if (!putanja) return;
  const i = putanja.indexOf(':'); const id = putanja.slice(0, i); const polje = putanja.slice(i + 1);
  const g = S.greske[id]; if (!g) return;
  const kljucevi = Object.keys(g).filter((k) => polje === k || polje.startsWith(`${k}.`));
  if (!kljucevi.length) return;
  for (const k of kljucevi) delete g[k];
  const el = $(`[data-putanja="${putanja}"]`);
  if (el) { const omot = omotPolja(el); omot.classList.remove('ima-gresku'); $('.greska-polja', omot)?.remove(); el.removeAttribute('aria-invalid'); }
  if (!Object.keys(g).length) { delete S.greske[id]; $(`#stavka-${id}`)?.classList.remove('ima-gresku'); }
}

/** povlačenje za ručku (miš i prst) */
function vuci(rucka, id, naKraju) {
  rucka.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    const popis = $('#popis'); const li = $(`#stavka-${id}`);
    if (!popis || !li) return;
    rucka.setPointerCapture(e.pointerId); li.classList.add('vuce');
    let pomaknuto = false;
    const pomak = (ev) => {
      const ostali = [...popis.children].filter((x) => x !== li);
      const iza = ostali.find((x) => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      if (iza ? li.nextElementSibling !== iza : popis.lastElementChild !== li) { popis.insertBefore(li, iza ?? null); pomaknuto = true; }
    };
    const kraj = () => {
      rucka.removeEventListener('pointermove', pomak); li.classList.remove('vuce');
      if (pomaknuto) {
        naKraju([...popis.children].map((x) => x.dataset.id));
      }
    };
    rucka.addEventListener('pointermove', pomak);
    rucka.addEventListener('pointerup', kraj, { once: true });
    rucka.addEventListener('pointercancel', kraj, { once: true });
  });
}


// ----- objava -----
function crtajStatus() {
  const el = $('#status'); if (!el || !S.objava) return;
  const o = S.objava;
  const odr = $('#odrzavanje'); if (odr) odr.hidden = !o.odrzavanje;
  const problem = o.stanje === 'greska' || o.stanje === 'nije-postavljeno';
  el.className = `status${o.stanje === 'u-tijeku' ? ' u-tijeku' : problem ? ' greska' : ''}`;
  el.title = o.stanje === 'greska' ? `Objava nije uspjela: ${o.poruka ?? ''}` : o.stanje === 'nije-postavljeno' ? 'Katalog se sprema, ali objava na stranicu još nije postavljena (izbornik → Objava stranice).' : '';
  $('.status-tekst', el).textContent = o.stanje === 'u-tijeku' ? 'Objavljujem…' : o.stanje === 'greska' ? 'Objava nije uspjela' : o.stanje === 'nije-postavljeno' ? 'Objava nije postavljena' : `Objavljeno ${sat(o.objavljeno)}`;
}
async function osvjeziObjavu() { try { S.objava = await api('GET', '/objava', undefined, { pozadina: true }); crtajStatus(); } catch { /* status nije bitan za rad */ } }
let pracenje = null;
function pratiObjavu(obavijesti) {
  clearTimeout(pracenje);
  // poslužitelj je objavu već pokrenuo — pokaži to odmah, ne tek nakon prve provjere
  S.objava = { ...S.objava, stanje: 'u-tijeku' }; crtajStatus();
  const pocetak = Date.now();
  // lokalno je objava gotova za nekoliko sekundi, na hostingu (GitHub Actions) za 1–2 minute: kasnije se pita rjeđe
  const korak = async () => {
    await osvjeziObjavu();
    if (S.objava?.stanje === 'u-tijeku' && Date.now() - pocetak < 10 * 60_000) { pracenje = setTimeout(korak, Date.now() - pocetak < 20_000 ? 1500 : 5000); return; }
    pracenje = null;
    if (!obavijesti) return;
    if (S.objava?.stanje === 'nije-postavljeno') obavijest('Katalog je spremljen, ali objava na stranicu još nije postavljena. Javi administratoru uredništva.', { vrsta: 'greska', trajanje: 12000 });
    else if (S.objava?.stanje === 'spremno') obavijest('Objavljeno — promjene su na stranici.', { akcija: { tekst: 'Pogledaj', fn: () => window.open('/', '_blank', 'noopener,noreferrer') }, trajanje: 8000 });
    else obavijest('Objava nije uspjela; stranica ostaje kakva je bila. Pokušaj spremiti ponovno ili javi administratoru.', { vrsta: 'greska', trajanje: 15000 });
  };
  pracenje = setTimeout(korak, 1500);
}
setInterval(() => { if (S.csrf && document.visibilityState === 'visible' && S.objava?.stanje !== 'u-tijeku') osvjeziObjavu(); }, 30_000);

// ----- dijalozi -----
function dijalog(...sadrzaj) {
  const d = h('dialog', {}, h('div', { class: 'dijalog' }, ...sadrzaj));
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal();
  return d;
}
async function dijalogPovijesti() {
  let popis;
  try { popis = await api('GET', '/povijest'); } catch (err) { obavijest(err.message, { vrsta: 'greska' }); return; }
  const d = dijalog(h('h2', {}, 'Povijest promjena'), h('p', {}, 'Svako spremanje je jedna verzija. Vraćanje stare verzije sprema je kao novu (ništa se ne gubi).'),
    h('ul', { class: 'povijest' }, popis.map((v) => h('li', { class: v.verzija === S.katalog.sadrzaj.verzija ? 'trenutna' : '' },
      h('div', {}, h('strong', {}, v.opis || `Verzija ${v.verzija}`), h('span', {}, `${vrijeme(v.azurirano)} · ${v.azurirao} · verzija ${v.verzija}`)),
      v.verzija === S.katalog.sadrzaj.verzija ? h('span', {}, 'trenutna') : h('button', { class: 'gumb', type: 'button', onclick: async () => {
        if (!confirm(`Vratiti katalog na verziju ${v.verzija} (${vrijeme(v.azurirano)})?`)) return;
        try {
          await api('POST', '/povijest/vrati', { verzija: v.verzija, trenutna: S.katalog.sadrzaj.verzija });
          d.close(); S.prljavo = false; await ucitajUrednik(); obavijest(`Vraćena verzija ${v.verzija}. Stranica se osvježava…`); pratiObjavu(true);
        } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
      } }, 'Vrati')))),
    h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori'));
}
async function dijalogKorisnika() {
  let popis;
  try { popis = await api('GET', '/korisnici'); } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska' }); return; }
  const rezultat = h('div', { class: 'poveznica', hidden: true });
  const pokaziPoveznicu = ({ ime, poveznica }) => {
    rezultat.replaceChildren(
      h('p', {}, h('strong', {}, `Pozivnica za ${ime}`), ' — vrijedi 72 sata i jednom. Pošalji je osobno (npr. porukom):'),
      h('input', { type: 'text', readonly: true, value: poveznica, 'aria-label': `Poveznica za ${ime}`, onfocus: (e) => e.target.select() }),
      h('button', { class: 'gumb', type: 'button', onclick: async (e) => {
        try { await navigator.clipboard.writeText(poveznica); e.currentTarget.textContent = 'Kopirano ✓'; } catch { obavijest('Kopiranje nije uspjelo — označi poveznicu i kopiraj.', { vrsta: 'greska' }); }
      } }, 'Kopiraj poveznicu'));
    rezultat.hidden = false; $('input', rezultat).focus();
  };
  const lista = h('ul', { class: 'povijest' });
  const osvjezi = async () => { try { popis = await api('GET', '/korisnici'); crtaj(); } catch { /* ostaje zadnji popis */ } };
  const radnja = (tekst, potvrda, fn, opasno) => h('button', { class: `gumb${opasno ? ' opasno' : ''}`, type: 'button', onclick: async () => {
    if (!confirm(potvrda)) return;
    try { await fn(); osvjezi(); } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
  } }, tekst);
  function crtaj() {
    lista.replaceChildren(...popis.map((k) => h('li', {},
      h('div', {}, h('strong', {}, k.ime, k.uloga === 'admin' ? ' · administrator' : ''),
        h('span', {}, `${k.stanje} · zadnja prijava ${vrijeme(k.zadnjaPrijava)}${k.stanje === 'aktivan' ? ` · rezervnih kodova: ${k.rezervnih}` : ''}`)),
      k.ime === S.ime ? h('span', {}, 'ti') : h('span', { class: 'radnje' },
        radnja('Nova pozivnica', `Nova pozivnica za ${k.ime}? Dosadašnja lozinka i dvostruka potvrda prestaju vrijediti, a ${k.ime} se odjavljuje (npr. kad je izgubio mobitel).`,
          async () => pokaziPoveznicu(await api('POST', '/korisnici/pozivnica', { ime: k.ime, resetiraj: true }))),
        radnja('Ukloni', `Ukloniti korisnika ${k.ime}? Odmah gubi pristup uredništvu.`,
          async () => { await api('POST', '/korisnici/obrisi', { ime: k.ime }); obavijest(`Korisnik ${k.ime} je uklonjen.`); }, true)))));
  }
  crtaj();
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'pozovi', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    try { pokaziPoveznicu(await api('POST', '/korisnici/pozivnica', { ime: forma.ime.value })); forma.reset(); osvjezi(); } catch (err) { porukaGreske(greska, err.message); }
  } },
  h('label', { class: 'polje' }, h('span', {}, 'Pozovi novog korisnika'), h('input', { name: 'ime', type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'korisničko ime, npr. sara', required: true })),
  h('button', { class: 'gumb glavni', type: 'submit' }, 'Napravi pozivnicu'));
  const d = dijalog(h('h2', {}, 'Korisnici'),
    h('p', {}, 'Svatko se prijavljuje svojom lozinkom i kodom s mobitela. Pozivnica je poveznica kojom novi korisnik sam odabere lozinku i jednom skenira QR kod.'),
    lista, forma, greska, rezultat, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori'));
}

async function dijalogObjave() {
  let o;
  try { o = await api('GET', '/objava/postavke'); } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska' }); return; }
  const ponovi = h('button', { class: 'gumb', type: 'button', onclick: async () => {
    try { await api('POST', '/objava/ponovi', {}); d.close(); obavijest('Objava je pokrenuta.'); pratiObjavu(true); } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
  } }, 'Objavi ponovno');
  if (o.vrsta === 'lokalno') {
    const d = dijalog(h('h2', {}, 'Objava stranice'),
      h('p', {}, 'Lokalno se stranica nakon svakog spremanja izgradi na ovom računalu i odmah je na adresi poslužitelja (npm start).'),
      h('div', { class: 'dva' }, ponovi, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori')));
    return;
  }
  // hosting: spremanje šalje katalog na GitHub (grana sa sadržajem), a GitHub Actions izgradi stranicu i prenese je na hosting
  const istjece = o.tokenIstjece ? new Date(o.tokenIstjece) : null;
  const dana = istjece ? Math.floor((istjece - Date.now()) / 86_400_000) : null;
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'dijalog-forma', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    const gumb = $('button[type=submit]', forma); gumb.disabled = true;
    try {
      await api('POST', '/objava/postavke', { repo: forma.repo.value, grana: forma.grana.value, token: forma.token.value });
      d.close(); obavijest('Postavke objave su spremljene i veza s GitHubom radi.');
    } catch (err) { porukaGreske(greska, err.message); gumb.disabled = false; }
  } },
  h('label', { class: 'polje' }, h('span', {}, 'GitHub repozitorij'), h('input', { name: 'repo', type: 'text', value: o.repo ?? '', placeholder: 'vlasnik/repozitorij', autocomplete: 'off', spellcheck: 'false' })),
  h('label', { class: 'polje' }, h('span', {}, 'Grana za sadržaj'), h('input', { name: 'grana', type: 'text', value: o.grana ?? 'sadrzaj', autocomplete: 'off', spellcheck: 'false' })),
  h('label', { class: 'polje' }, h('span', {}, 'GitHub token'), h('input', { name: 'token', type: 'password', autocomplete: 'off', placeholder: o.tokenPostavljen ? 'postavljen — upiši samo za zamjenu' : 'github_pat_…' }),
    h('small', {}, 'Fine-grained token samo za ovaj repozitorij: Contents (read and write), Actions (read). Sprema se samo na poslužitelju i više se ne prikazuje.')),
  greska,
  h('button', { class: 'gumb glavni', type: 'submit' }, 'Spremi i provjeri vezu'));
  const d = dijalog(h('h2', {}, 'Objava stranice'),
    h('p', {}, 'Nakon spremanja katalog ide na GitHub, a GitHub Actions za 1–2 minute izgradi stranicu i prenese je na hosting.'),
    o.tokenPostavljen && dana !== null ? h('p', { class: `poruka ${dana < 30 ? 'greska' : 'info'}` },
      dana < 0 ? 'GitHub token je istekao — objava ne radi dok ne upišeš novi.' : `GitHub token vrijedi do ${istjece.toLocaleDateString('hr-HR')} (još ${dana} ${mnozina(dana, ['dan', 'dana', 'dana'])}).`) : null,
    forma,
    h('div', { class: 'dva' }, ponovi, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori')));
}

// posjetitelji vide "Uskoro se vraćamo" (503), uredništvo radi normalno; administratorov preglednik može i dalje vidjeti stranicu
async function dijalogOdrzavanja() {
  let o;
  try { o = await api('GET', '/odrzavanje'); } catch (err) { if (err.status !== 401) obavijest(err.message, { vrsta: 'greska' }); return; }
  const postavi = async (tijelo, poruka) => {
    try {
      o = await api('POST', '/odrzavanje', tijelo);
      S.objava = { ...S.objava, odrzavanje: o.ukljuceno }; crtajStatus();
      d.close(); obavijest(poruka, { trajanje: 7000 });
    } catch (err) { obavijest(err.message, { vrsta: 'greska' }); }
  };
  const zatvori = h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Zatvori');
  const d = o.ukljuceno
    ? dijalog(h('h2', {}, 'Održavanje stranice'),
      h('p', { class: 'poruka upozorenje' }, `Održavanje je uključeno${o.od ? ` od ${vrijeme(o.od)}` : ''}${o.ime ? ` (${o.ime})` : ''}. Posjetitelji umjesto stranice vide poruku „Uskoro se vraćamo”.`),
      h('p', {}, o.pregled ? 'Na ovom uređaju i dalje vidiš pravu stranicu, da možeš provjeriti promjene prije nego što je otvoriš svima.' : 'Na ovom uređaju vidiš isto što i posjetitelji.'),
      h('div', { class: 'dva' },
        h('button', { class: 'gumb', type: 'button', onclick: () => postavi({ ukljuceno: true, pregled: !o.pregled }, o.pregled ? 'Sada na ovom uređaju vidiš poruku kao posjetitelji.' : 'Na ovom uređaju opet vidiš stranicu.') },
          o.pregled ? 'Pokaži mi poruku' : 'Pokaži mi stranicu'),
        h('button', { class: 'gumb glavni', type: 'button', onclick: () => postavi({ ukljuceno: false }, 'Održavanje je isključeno — stranica je opet vidljiva svima.') }, 'Isključi održavanje')),
      zatvori)
    : dijalog(h('h2', {}, 'Održavanje stranice'),
      h('p', {}, 'Dok je održavanje uključeno, posjetitelji umjesto stranice vide poruku „Uskoro se vraćamo” s adresama, Woltom i telefonom. Tražilice dobiju znak da je to privremeno.'),
      h('p', {}, 'Uredništvo radi normalno i spremanja se i dalje objavljuju — svima se pokažu kad isključiš održavanje. I ti ćeš vidjeti poruku; pravu stranicu na ovom uređaju možeš otvoriti gumbom „Pokaži mi stranicu”.'),
      h('div', { class: 'dva' }, zatvori,
        h('button', { class: 'gumb glavni', type: 'button', onclick: () => postavi({ ukljuceno: true }, 'Održavanje je uključeno — posjetitelji vide poruku „Uskoro se vraćamo”.') }, 'Uključi održavanje')));
}

function dijalogLozinke() {
  const greska = h('p', { class: 'poruka greska', role: 'alert', hidden: true });
  const forma = h('form', { class: 'dijalog', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); porukaGreske(greska, '');
    if (forma.nova.value !== forma.ponovi.value) { porukaGreske(greska, 'Nove lozinke se ne podudaraju.'); return; }
    try { await api('POST', '/lozinka', { stara: forma.stara.value, nova: forma.nova.value }); d.close(); obavijest('Lozinka promijenjena. Ostali uređaji su odjavljeni.'); } catch (err) { porukaGreske(greska, err.message); }
  } },
  h('h2', {}, 'Promijeni lozinku'),
  h('label', { class: 'polje' }, h('span', {}, 'Trenutna lozinka'), h('input', { name: 'stara', type: 'password', autocomplete: 'current-password', required: true })),
  h('label', { class: 'polje' }, h('span', {}, 'Nova lozinka'), h('input', { name: 'nova', type: 'password', autocomplete: 'new-password', minlength: 12, required: true }), h('small', {}, 'Najmanje 12 znakova.')),
  h('label', { class: 'polje' }, h('span', {}, 'Ponovi novu lozinku'), h('input', { name: 'ponovi', type: 'password', autocomplete: 'new-password', required: true })),
  greska,
  h('div', { class: 'dva' }, h('button', { class: 'gumb', type: 'button', onclick: () => d.close() }, 'Odustani'), h('button', { class: 'gumb glavni', type: 'submit' }, 'Spremi')));
  const d = h('dialog', {}, forma); d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal();
}
async function odjava() {
  if (S.prljavo && !confirm('Imaš nespremljene promjene. Odjaviti se svejedno?')) return;
  try { await api('POST', '/odjava', {}); } catch { /* svejedno */ }
  Object.assign(S, { csrf: null, ime: null, katalog: null, radni: null, prljavo: false });
  zaslonPrijave('Odjavljen si.');
}
addEventListener('beforeunload', (e) => { if (S.prljavo) { e.preventDefault(); e.returnValue = ''; } });

// ---------------- pokretanje ----------------
(async function start() {
  const m = /^#pozivnica=([A-Za-z0-9_-]{20,100})$/.exec(location.hash);
  if (m) { history.replaceState(null, '', location.pathname); zaslonPozivnice(m[1]); return; } // token ne ostaje u adresi
  try {
    const st = await api('GET', '/stanje');
    if (st.korak === 'puno') prijavljen(st);
    else if (st.korak === '2fa') zaslonKoda();
    else if (st.prvoPostavljanje) zaslonPostavljanja(st);
    else zaslonPrijave(st.razlog ? `${porukaIsteka(st.razlog)}.` : undefined);
  } catch { ekran(h('h1', {}, 'Uredništvo nije dostupno'), h('p', { class: 'uvod' }, 'Poslužitelj ne odgovara. Pokušaj ponovno za minutu.')); }
})();
