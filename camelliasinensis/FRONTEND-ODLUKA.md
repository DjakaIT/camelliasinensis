# FRONTEND-ODLUKA.md — koji frontend stack i što ako se nešto promijeni

Stanje: 2.11.2026. **Status: F2 (Next.js statični export) je usvojen kao zadano pri pokretanju razvoja; Daniel to može promijeniti prije nego što se dogradi više od M1.** Odgovara na pitanje "je li bolje Next.js?" i pokriva scenarije promjene. Ocjene su moje procjene, a činjenice imaju izvor (§9). Što nije provjereno, piše **[PROVJERI]**.

## 1. Kratki odgovor

**Da, za ovaj projekt preporučujem Next.js (App Router), pokrenut kao statički export (`output: 'export'`).** U tom načinu rada Next i React Router (prerender) mogu isto za ovu trgovinu, pa razlika nije u mogućnostima nego u tome što se događa kad se nešto promijeni:

- Next službeno opisuje put "počni statički, kasnije prijeđi na značajke koje traže poslužitelj" (dokumentacija, ažurirana 9.8.2026.), a Hostinger na Unlimited planu **ima Node.js hosting i izričito navodi Next.js (SSR, ISR, API rute)**. To znači da prijelaz s statičkog na poslužiteljski nije preseljenje na drugi sustav.
- Sustav je najpoznatiji alat modelima koji će kodirati i budućim developerima.
- Početni scaffold (Vite) je tek postavljen i ništa još nije izgrađeno na njemu, pa je trošak promjene gotovo nula. To neće vrijediti za tjedan dana.

Što to **ne** znači: ne preporučujem da od prvog dana pokrećemo Next poslužitelj (SSR/ISR) na Hostingeru. Razlozi su u §4 i §5.

Prijašnja tvrdnja u STACK.md da "na serveru nema Node procesa" bila je izbor, ne ograničenje. Plan koji je kupljen **podržava Node.js aplikacije** (§2).

## 2. Što smo provjerili

**Hostinger Unlimited (kupljeni plan), Node.js (izvor: Hostingerova stranica o Node.js limitima i stranica Next.js hostinga):**
- do 5 Node.js web-lokacija, limit procesa (NPROC) 120, "entry processes" 60;
- NPROC broji **sve procese i niti na planu**, ne samo Node.js, i dijele ga sve lokacije na planu. Jedna Next.js aplikacija koristi oko 10–11 niti, a `domena` i `www.domena` pokreću zasebne procese. Kad se limit dosegne, Node.js lokacije mogu vratiti **503**;
- zahtjev se prekida nakon **120 s**;
- nisu podržani: dolazni WebSocketi, stalno pokrenuti pozadinski workeri, Redis, Docker, vlastiti portovi;
- Hostinger navodi da SSR, ISR i API rute "rade kako se očekuje", a deploy ide preko GitHuba s automatskim prepoznavanjem frameworka;
- stranica **ne navodi** podršku za optimizaciju slika i kako radi cache za ISR na njihovom poslužitelju **[PROVJERI]**.

**RAM i build (izvor: neovisni blog s affiliate linkovima, koristi s oprezom):** vrhunac memorije je pri `next build`, ne pri radu. Za veće projekte preporučuje se build u CI-ju i deploy samo rezultata. To već radimo (GitHub Actions).

**Cloud Startup** (izvor: Hostingerova stranica): 7,99 $/mj. promo (383,52 $ za 48 mjeseci), obnova 25,99 $/mj.; 4 jezgre, 4 GB RAM-a, 10 web aplikacija. Bez PDV-a.

**Next.js static export (službena dokumentacija, ažurirana 9.8.2026.):**
- Podržano: Server Components koje se izvrše pri buildu, Client Components s dohvatom podataka u pregledniku, `next/image` s prilagođenim loaderom, GET Route Handleri koji se pretvore u statičke datoteke.
- **Nije podržano:** dinamičke rute s `dynamicParams: true` ili bez `generateStaticParams()`, Route Handleri koji čitaju zahtjev, `cookies()`, rewrites, redirects, headers, Proxy, **ISR**, zadani image loader, Draft Mode, **Server Actions**, intercepting routes.
- Korisno: pokušaj korištenja nepodržane značajke daje **grešku** u razvoju i buildu, pa se ograničenja provode sama.

**Sigurnost (Next.js, 3.12.2025.):** CVE-2025-66478 (React2Shell), ocjena CVSS 10.0, **udaljeno izvršavanje koda** u React Server Components protokolu; pogođeni su App Router na Next 15.x i 16.x (zakrpljeno u 15.0.5…15.5.7 i 16.0.7). Vercel je preporučio **rotaciju tajni** za aplikacije koje su bile online i nezakrpane. Ranjivost se odnosi na **poslužitelj koji obrađuje zahtjeve**. Statička izvedba nema takav poslužitelj (moj zaključak, ne tvrdnja iz izvora).

**React Router 8.5 (službena dokumentacija):** prerender radi s `ssr:false`; isti framework ima `ssr:true` s poslužiteljem (`@react-router/serve`). Hostinger ga ne navodi kao izričito podržan framework **[PROVJERI]**.

**Verzije (`npm view`, 2.11.2026.):** next 16.4.3 (Node ≥ 20.9), react-router 8.5.1 (Node ≥ 22.22).

## 3. Opcije

| Oznaka | Opis |
| --- | --- |
| **F1** | Vite + React Router 8, prerender, statično |
| **F2** | Next.js App Router, `output: 'export'`, statično (preporuka) |
| **F3** | Next.js ili React Router s poslužiteljem (SSR/ISR) na Hostingerovom Node.js hostingu |
| **F4** | Bez headlessa: WooCommerce s vlastitom temom (dizajn B kao WP tema) |
| **F5** | Statični frontend (F1 ili F2) na drugom hostingu (npr. Cloudflare Pages), WP ostaje na Hostingeru |

Backend je u svim opcijama WooCommerce (STACK §5) i POS sloj `cs-pos-bridge` (STACK §8). Frontend opcije se razlikuju samo u prikazu.

## 4. Usporedba (težine iz izvještaja o arhitekturi; ocjene 1 do 5, moje procjene)

| Kriterij | Težina | F1 | F2 | F3 | F4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pouzdanost | 25 % | 5 | 5 | 3 | 4 |
| Ukupni trošak | 20 % | 5 | 5 | 4 | 5 |
| Jednostavnost održavanja | 20 % | 3 | 3 | 2 | 4 |
| Performanse | 15 % | 5 | 5 | 4 | 3 |
| Sigurnost i oporavak | 10 % | 5 | 5 | 3 | 3 |
| Skalabilnost | 10 % | 4 | 4 | 3 | 3 |
| **Zbroj** | | **4,50** | **4,50** | **3,15** | **3,85** |

Kako čitati:
- **F1 i F2 su izjednačeni po tablici.** To je pošteno stanje: u statičkom načinu rada obje daju iste datoteke. Odluka između njih nije u ovoj tablici nego u §5 (što ako se promijeni) i §6.
- **F3 gubi na pouzdanosti i sigurnosti:** poslužiteljski proces dijeli ograničenja s PHP-om od WooCommercea (NPROC 120, 503 pri prekoračenju, 120 s), a u slučaju bilo kojeg SSR-a pojavljuje se klasa ranjivosti iz §2.
- **F4 je najbolji "plan B", ne najbolji plan.** Tablica **ne uključuje trošak rada**: headless traži više razvoja (frontend, build pipeline, sinkronizaciju stanja) nego WP tema. Zato je F4 sigurna opcija ako se pokaže da headless nije vrijedan truda (§5, scenarij 12).

Trošak infrastrukture: F1, F2 i F4 ne dodaju trošak (sve na kupljenom planu). F3 možda traži Cloud Startup (7,99 $/mj. promo, obnova 25,99 $/mj., bez PDV-a) ako se pokaže da Unlimited ne drži opterećenje. F5 je besplatan za statične datoteke (Cloudflare Pages, STACK izvještaj o hostingu).

## 5. Scenariji: što ako se promijeni

| # | Promjena | Što se događa s F2 (preporuka) | Eskalacija / trošak |
| --- | --- | --- | --- |
| 1 | POS često mijenja zalihu i cijene | Zaliha i cijena se na stranici proizvoda i u košarici čitaju **uživo** iz Store API-ja, pa nema potrebe za ponovnim buildom. Samo novi proizvodi i promjene opisa traže build (okidač u STACK §4) | Ako uživo nije dovoljno (SEO tekstovi s cijenama u HTML-u moraju biti svježi): F3 s ISR-om ili češći rebuild. Mali trošak |
| 2 | Katalog naraste (stotine ili tisuće proizvoda) | Build raste s brojem stranica; na 71 proizvodu je zanemariv. Memorijski vrh pri buildu je u CI-ju, ne na Hostingeru | Preko nekoliko stotina stranica: ISR (F3) ili postupno generiranje. Srednji trošak |
| 3 | Sara želi račune kupaca, povijest narudžbi | "Moj račun" ostaje na `shop.` poddomeni (Woo), isto kao checkout. Nema potrebe za SSR-om | Ako treba prijava u samom frontendu s tokenima: F3 (poslužiteljska sesija). Veći trošak i sigurnosni rizik, ne preporučuje se |
| 4 | Dodatni jezici (EN, DE) | Rute po jeziku (`/en/…`) s `generateStaticParams`; radi u exportu. Woo mora imati prijevod proizvoda (dodatak, **[ODLUKA]**) | Mali do srednji trošak. Prevoditelj dodatak za Woo je pitanje backenda, ne frontenda |
| 5 | Sara napušta Hostinger | F2 se preseli bez promjene koda na bilo koji statički host. Woo treba PHP host, to je zasebno | F3 traži Node host (Cloud Startup, VPS, Vercel…) pa se selidba komplicira |
| 6 | Napuštamo WooCommerce (npr. Shopify, Medusa) | Frontend ostaje, mijenja se samo sloj `src/lib/shop` (jedno sučelje, dvije implementacije: `mock` i `woo`; treća bi bila novi backend). Košarica i checkout se mijenjaju | Srednji trošak: novi adapter, novi checkout prijelaz. UI se ne dira |
| 7 | POS treba primati webhookove ili javno HTTP odredište | **To je u WordPressu** (`cs-pos-bridge`, STACK §8), ne u frontendu. Zato **nije** razlog za Next | Ako WP ne može ispuniti POS uvjete: mala serverless funkcija (npr. Cloudflare Worker, 0 do 5 $/mj.) ili F3. Nije potrebno unaprijed |
| 8 | Kampanja, nagli promet | Statični HTML preko CDN-a podnosi vršak. **Usko grlo je Woo checkout (PHP na dijeljenom hostingu)**, ne frontend | Cache za Woo, ograničenje broja istodobnih checkouta, ili Cloud Startup. F3 bi **pogoršao** stvar jer troši isti NPROC |
| 9 | Preuzima drugi developer ili model | Next je najrašireniji, najviše dokumentacije i primjera | — |
| 10 | Novi major framework ili sigurnosna zakrpa | Pinane verzije, mjesečno ažuriranje (Dependabot/Renovate), CI. U exportu nema poslužitelja koji bi bio izložen, ali **alati za build** i dalje trebaju zakrpe. Isti rizik ima i React Router (v7 pa v8 u kratkom roku) | Redovito ažuriranje je trošak vremena, ne novca |
| 11 | Treba pregled neobjavljenih proizvoda (Draft Mode) | **Nije podržano u exportu.** Rješenje: staging WP + staging build (već planirano) | Ako postane obavezno: F3 |
| 12 | Headless se pokaže preskupim za održavanje ili Sara ne može sama uređivati sadržaj | **Prijelaz na F4:** dizajn B postaje WP tema. SKU, uvoz CSV-a, POS sloj, Stripe, GLS, računi i domena **ostaju isti**. Gubimo samo React frontend | Srednji trošak rada, ne infrastrukture. Zato od prvog dana držimo sav "posao oko trgovine" u WordPressu, a ne u frontendu |
| 13 | Sara želi sama mijenjati tekstove (naslovnica, o nama, pravne stranice) | U headlessu su ti tekstovi u kodu, pa svaka izmjena traži developera i deploy | Odluka (**[ODLUKA]**): dohvat stranica iz WP-a pri buildu (WP REST `pages`) ili zasebno polje u Woou. Treba riješiti prije M7; inače je F4 pametniji |
| 14 | Cart i checkout između dviju poddomena na iOS Safariju (kolačići) | Riješeno dizajnom: košarica je u pregledniku, a Woo košaricu puni naš endpoint tek kad kupac stoji na `shop.` strani (API-CONTRACT §4). Ipak **testirati** na pravom iPhoneu u M9 | Ako i to zakaže: prijelaz na F4 za cart/checkout |

## 6. Preporuka i zašto, poštenim redom

Preporučujem **F2: Next.js, statični export, s `export-safe` podskupom**. Razlozi i protuargumenti:

**Za F2 nasuprot F1**
- Put prema F3 je dokumentiran i podržan na kupljenom hostingu. U F1 isti prijelaz (`ssr:true`) postoji, ali Hostinger ga ne navodi kao podržan framework **[PROVJERI]**.
- Najveća baza znanja za modele i ljude. Manje je izgleda da će se model "izgubiti" u dokumentaciji.
- Ugrađeni SEO alati (metadata, sitemap, robots) i `next/font` koji self-hostira fontove pri buildu (nema zahtjeva prema Googleu u pregledniku).
- Trošak promjene je sada najmanji.

**Protiv F2 (iskreno)**
- Veća složenost: Server Components, `'use client'` granice i pravila keširanja traže disciplinu. U exportu većina toga nije potrebna, ali model ih može koristiti.
- Česte velike verzije i kritične zakrpe (§2). Pod izvršavanjem na poslužitelju to je ozbiljan rizik; zato **ne pokrećemo poslužitelj** bez potrebe.
- Veći build od React Routera; vrhunac memorije je u CI-ju, ne na Hostingeru.
- React Router je jednostavniji i brži za razumjeti. Ako Daniel cijeni jednostavnost više od ekosustava, **F1 je jednako opravdan izbor**, a ovaj dokument ga ne obara.

### Pravila "export-safe" (da prijelaz ne zahtijeva prepisivanje)
1. `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true` ili prilagođeni loader (slike optimizira `scripts/optimize-images.mjs` pri buildu).
2. **Bez** API ruta, Server Actions, `cookies()`/`headers()`, middleware/proxyja, ISR-a, Draft Modea i `dynamicParams: true`. To je i tehnički isključeno u exportu; CI mora padati ako netko pokuša.
3. Sav podatkovni pristup preko `src/lib/shop/` (jedno sučelje). Komponente ne zovu `fetch` same.
4. Zaliha, cijena i košarica se čitaju **iz preglednika** (Client Components). Ništa osjetljivo i ništa vezano uz korisnika ne ide u build.
5. `generateStaticParams` za sve dinamičke rute (proizvod, vrsta čaja), uz `dynamicParams = false`.
6. Redirecti, zaglavlja i fallback rade u `.htaccess`, ne u `next.config` (ne rade u exportu).
7. Pinane verzije, `npm audit` i mjesečno ažuriranje u CI-ju.

### Okidači za prelazak na F3 (ne prije)
Prijeđi na poslužiteljski način samo kad **jedan** od uvjeta postane stvaran, a ne zbog "možda":
- SEO tekst na stranicama treba biti svjež u roku od minute nakon promjene u POS-u, a rebuild od 2 do 5 minuta ne zadovoljava;
- katalog preraste granicu na kojoj je build predug;
- potrebna je prijava korisnika u frontendu s poslužiteljskom sesijom;
- potreban je Draft Mode ili slična značajka.

Prije prijelaza provjeri: NPROC i 503 na Hostingeru (§2), plan Cloud Startup, zakrpu za CVE iz §2, i da PHP od Wooa neće biti ugrožen.

## 7. Što se mijenja u dokumentima ako Daniel potvrdi Next (F2)

| Dokument | Promjena |
| --- | --- |
| `STACK.md` *(učinjeno 2.11.2026.)* | §0 i §2: Next.js 16 (App Router, `output:'export'`) umjesto React Router prerendera; §4: ruta po `app/`, `generateStaticParams`, `next/font`, `build` izlaz je `out/`; §6: CI i rsync na `out/`; Node ≥ 20.9; uvodi se `FRONTEND-ODLUKA.md` kao referenca; `src/lib/woo` preimenovan u `src/lib/shop` |
| `GUIDE.md` | §3 M0: Next scaffold umjesto React Routera; §4: provjera da export prolazi; §5: pravila "export-safe"; ostalo (dizajn, POS, sigurnost) ostaje |
| `START-PROMPT.md` | Stack i M0 prema gore; mapa projekta se mijenja: postojeći Vite scaffold se **zamjenjuje**, pa model prvo javlja što je našao i traži odobrenje za brisanje |
| `POS-PITANJA.md` | Bez promjene |

Dizajn, katalog, SKU, POS sloj, WP strana i fiskalizacija **ne ovise** o izboru F1 ili F2.

## 8. Što nije provjereno

- Radi li ISR cache u Next poslužitelju na Hostingerovom dijeljenom hostingu, i koliko RAM-a/CPU-a Unlimited stvarno daje Node aplikaciji (RAM u blogu je 3 GB za Business, ne iz Hostingerove stranice) **[PROVJERI]**.
- Radi li `.htaccess` s preusmjeravanjem i `ErrorDocument 404` na Hostingerovom poslužitelju (STACK §4) **[PROVJERI na stagingu]**.
- Ponašanje Woo kolačića između poddomena na iOS Safariju (scenarij 14) **[testirati]**.
- Je li Next 16 `output: 'export'` s `trailingSlash` na LiteSpeed/Apache potpuno kompatibilan s našim `.htaccess` pravilima **[testirati u M0]**.
- Hostingerova izričita podrška za React Router SSR **[PROVJERI]**.

## 9. Izvori (provjereno 2.11.2026.)

- Hostinger, Node.js limiti: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/
- Hostinger, Next.js hosting: https://www.hostinger.com/web-apps-hosting/nextjs-hosting
- Next.js, static exports (App Router, ažurirano 9.8.2026.): https://nextjs.org/docs/app/guides/static-exports
- Next.js, sigurnosna obavijest CVE-2025-66478: https://nextjs.org/blog/CVE-2025-66478
- React Router 8.5, pre-rendering: https://reactrouter.com/8.5.0/how-to/pre-rendering.md
- Blog o planovima za Next na Hostingeru (neovisni izvor s affiliate linkovima): https://wacrm.tech/blog/hostinger-plan-for-nextjs
- Verzije paketa: `npm view`, 2.11.2026.
