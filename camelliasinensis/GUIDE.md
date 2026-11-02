# GUIDE.md — kako se radi na ovom projektu

Za AI modele i ljude koji kodiraju webshop **Camellia sinensis** (Sarina trgovina čaja, Zagreb).
Arhitektura, verzije, deploy i POS sloj su u **STACK.md**. Sučelje prema backendu i razvojni poslužitelj su u **API-CONTRACT.md**. Zašto Next.js i što ako se nešto promijeni je u **FRONTEND-ODLUKA.md**. Pitanja za Saru i dobavljača blagajne su u **POS-PITANJA.md**. Ovaj dokument opisuje pravila rada, dizajn, testiranje i sigurnost.
Kad se STACK.md i GUIDE.md razilaze, vrijedi STACK.md. Proturječje prijavi u PR-u.

Stanje: 2.11.2026.

---

## 1. Pravila rada (obavezno)

1. **Prije koda pročitaj** STACK.md, API-CONTRACT.md, FRONTEND-ODLUKA.md, ovaj dokument, POS-PITANJA.md i `design-reference/` (zadnji HTML dizajna B).
2. **Jedan zadatak = jedna grana = jedan PR** prema `staging`. Grana: `feat/…`, `fix/…`, `chore/…`. Nikad izravan push na `main` ili `staging`.
3. **Ne izmišljaj sadržaj.** Bez lažnih recenzija, ocjena, broja kupaca, cijena, adresa, radnog vremena, certifikata, "bestseller" oznaka ili pravnih tekstova. Ako tekst nedostaje, ne stavljaj vidljivi placeholder ("Lorem ipsum", "TBD", "Tekst ovdje"). Sakrij sekciju i u PR-u zapiši što nedostaje i tko to daje.
4. **Jezik sučelja je hrvatski**, prirodan i bez kalkova ("Dodaj u košaricu", ne "Dodaj u kart"). Datumi `30. 10. 2026.`, cijene `11,90 €`.
5. **Bez novih ovisnosti i WP dodataka** bez odobrenja. U PR-u navedi zašto je potrebna, licenciju, održavanje (zadnji release) i veličinu. Popis odobrenih je u STACK.md §2.
6. **Ne diraj** WordPress jezgru, tuđe dodatke, `wp-config.php`, DNS, Stripe postavke ni produkcijsku bazu. To radi Daniel ručno.
7. **Ne kupuj, ne registriraj i ne šalji ništa** (e-mail, poruku, narudžbu) prema stvarnim sustavima. Stripe se koristi **isključivo u test načinu** (§8). Nikad ne stvaraj Stripe račun, ne traži ni ne zapisuj ključeve u kod ili chat, ne koristi `sk_live_`. **Nikad se ne spajaj na Sarinu stvarnu blagajnu (POS)** ni njezin API.
8. **Kad nisi siguran, stani i pitaj** u PR-u ili issueu. Ne pogađaj API, putanju na serveru, pravni zahtjev ni način rada blagajne.
9. **Ne pogađaj ništa o backendu ni blagajni.** Frontend poznaje samo API-CONTRACT.md; ne uvodi ovisnost o WooCommerceu ni o Stripeu izvan adaptera (`lib/shop/…`) i `mock-server/`.
10. **Ne pogađaj ništa o blagajni.** Sve što nije potvrđeno u STACK.md §8 i POS-PITANJA.md ostaje pitanje. Ne izmišljaj Thorov API, formate datoteka ni nazive endpointa.
11. Svaki PR ima: opis, popis promjena, snimke zaslona (desktop 1440 px i mobitel 390 px), rezultate testova i ispunjen **§5 sigurnosni popis** za dijelove koje je dirao.

### Definicija "gotovo"
- Prolaze `lint`, `typecheck`, unit testovi, E2E, axe i Lighthouse pragovi (§4).
- Vizualno odgovara zadnjem HTML-u dizajna B (§2).
- Nema novih upozorenja u konzoli preglednika.
- Sigurnosni popis (§5) je prođen.
- Daniel je pregledao PR.

---

## 2. Dizajn: dizajn B kao izvor istine

**Referenca je zadnji HTML dizajna B** koji je u `camellia-repo-start/design-reference/` (datoteka `prototip-B.html`, ili novija `Camellia-B-trgovina.html` ako ju je Daniel dodao). Ako ih ima više, vrijedi **najnovija po datumu izmjene**, a u prvom izvješću napiši koju si koristio.

Postupak:
1. Otvori HTML u pregledniku (Playwright) i **snimi sve stranice** na 1440×900 i 390×844 (naslovnica, katalog, proizvod, o nama, kontakt, košarica/blagajna). Snimke spremi u `docs/design-snapshots/` i koristi kao referentne.
2. **Tokene (boje, razmake, radijuse, fontove, sjene) izvuci iz CSS-a samog HTML-a**, ne iz ovog dokumenta. Tablica niže je snimka stanja na 30.10.2026. Ako se razlikuje od HTML-a, **vrijedi HTML**; razlike zapiši u PR-u.
3. Izvorni kod prototipa (`design-reference/src/B3.html`, `engine.js`, `data.js`) služi samo za čitanje. **Ne kopiraj** `engine.js` (hash rute, `localStorage` košarica i simulirana blagajna moraju nestati). Napiši iznova kao React komponente.
4. Slike su u `design-reference/img/`, a hero fotografija `hero-tea.jpg`. Logotipi su u `design-reference/logo/` (SVG, boje zlatna, bijela, crna). Koristi SVG, ne PNG.

### Snimka tokena (30.10.2026., provjeri protiv HTML-a)
```css
:root{
  --olive:#3B432E;      /* hero podloga, glavne tamne plohe (u prototipu se zove --navy) */
  --olive-d:#262D1D;    /* navigacija (92 % + blur), podnožje */
  --ink:#272A20;        /* tekst, tamni gumbi */
  --mute:#6B5E50;       /* sekundarni tekst */
  --paper:#F6F0E4;      /* pozadina stranice */
  --line:#E6DCC8;       /* rubovi */
  --gold:#D4AF37;       /* logo, aktivna stavka izbornika, gumb košarice */
  --gold-d:#8A6D14;     /* zlatni tekst na svijetloj podlozi (kontrast) */
  --t-bijeli:#EFE7D3; --t-zeleni:#CFE0A6; --t-oolong:#EDC98C; --t-crni:#D98C68;
  --t-puer:#4A2E24;   --t-aroma:#F1CBC1;  --t-biljni:#DCDDB8; --t-pribor:#E6D8BF;
  --r:28px; --ease:cubic-bezier(.2,.8,.2,1);
  --f-display:'Bricolage Grotesque',system-ui,sans-serif;
  --f-body:'Inter Tight',system-ui,sans-serif;
}
```

### Pravila izgleda
- **Bez plave boje bilo gdje.** Sara je izričito odbila ("podsjeća na Lidl"). Bez hladnih sivih tonova.
- **Zlatno samo za akcente.** Zlatni tekst na svijetloj podlozi uvijek `--gold-d`, nikad `--gold` (pada na kontrastu).
- **Tipografija:** naslovi Bricolage Grotesque 700, tekst Inter Tight 400, 16 px, `line-height:1.55`. Fontovi se self-hostaju (STACK §2).
- **Navigacija, hero, gumbi, kartice, podnožje:** točno kao u HTML-u (plutajuća pilula, fotografija s tamnim gradijentom, gumbi 52 px, kartice u boji vrste čaja, podnožje bez velikog natpisa).
- **Hero fotografija:** AVIF/WebP s `srcset`, ≤ 200 KB, ne base64.
- **Uklonjeno iz prototipa, ne vraćati:** kartica "Bok, ja sam Sara", sekcija "Kako kuhati", prekidač pozadine, veliki natpis u podnožju.
- **O nama:** fotografija trgovine. Prototip koristi ilustraciju s Wikimedije (javna domena); zamijeni je Sarinom kad je dobiješ. Do tada ostavi ilustraciju s točnim potpisom.
- **Kontakt:** Google Maps iframe se učitava tek nakon klika ("Prikaži kartu"). Adresa još nije poznata (STACK §11), pa karta ne smije pokazivati lažnu lokaciju: ako nema adrese, sekciju sakrij.
- **Pristupačnost** ima prednost pred estetikom: kontrast AA (4,5:1 tekst, 3:1 veliki tekst i UI), vidljiv fokus (zlatni obrub 2 px s razmakom), `prefers-reduced-motion` gasi animacije, ciljevi dodira ≥ 44 px.
- **Dopuštene razlike od prototipa:** prave rute; Woo checkout (stiliziran child temom); stanja učitavanja, greške i "nema na zalihi"; promjena zalihe uživo.

### Stranica za plaćanje
Frontend **ne gradi** stranicu za plaćanje (API-CONTRACT §3.6). Dok je backend Stripe test, to je Stripeova stranica s našim nazivom trgovine; kad bude Woo, to je Woo checkout stiliziran child temom (isti tokeni, logo i podnožje, M10). Do tada izgled te stranice nije naša briga, ali **prije i poslije** nje (košarica, povratne stranice) mora izgledati kao dizajn B.

### Stanja zalihe (važno zbog POS-a, STACK §8)
UI mora pokriti: na zalihi; malo (npr. "zadnjih 2 komada" kad Store API to javi); nema na zalihi (gumb onemogućen, tekst jasan); greška pri dodavanju ("Nažalost, nema dovoljno komada"); košarica se osvježava ako se zaliha promijenila. Nikad ne pretpostavljaj da je broj komada isti kao pri buildu.

---

## 3. Redoslijed izrade (milestonei)

Svaki milestone je zaseban PR (ili nekoliko). **Prvi veliki zadatak je frontend M0 do M8**, nad `demo` i `devserver` adapterom, bez ikakvog stvarnog backenda. M9 do M12 dolaze kad se odabere backend i blagajna (STACK §0, staza B).

| # | Sadržaj | Gotovo kad |
| --- | --- | --- |
| M0 | Postojeći Vite scaffold **premjesti u `.scaffold-backup/`** (u `.gitignore`) i postavi **Next.js** projekt u korijen (TypeScript strict, `output:'export'`, `trailingSlash`, `images.unoptimized`), ESLint s `jsx-a11y`, Prettier, vitest, Playwright, skripte (`lint`, `typecheck`, `test`, `test:contract`, `test:e2e`, `build`, `check:bundle`, `check:prerender`, `dev:mock`), `.nvmrc`, `.env.example`, `.gitignore` | CI zelen na praznoj aplikaciji, `out/` sadrži HTML |
| M1 | Tokeni, fontovi (self-host), layout, navigacija, podnožje, 404 | Vizualna usporedba s HTML-om (§4.3) |
| M2 | `scripts/data-to-fixtures.mjs` → `fixtures/products.json` u obliku iz API-CONTRACT §2 (71 proizvod, **SKU obavezan i jedinstven**); `scripts/optimize-images.mjs`; `scripts/data-to-woo-csv.mjs` (priprema za moguće Woo) | Fixture prolazi tipove; build pada na duplikat SKU-a ili cijenu ≤ 0 |
| M3 | `lib/shop` (sučelje `ShopBackend`, tipovi, greške), adapter `demo`, `lib/cart` (localStorage, verzionirano), test ugovora | Unit i contract testovi zeleni |
| M4 | Naslovnica, katalog s filterima (vrsta, okus, namjena, pretraga), `/katalog/<vrsta>/`, stranica proizvoda; prerender svih ruta | E2E, svaka ruta ima statički HTML |
| M5 | Košarica (drawer i stranica), `getLive`/`checkCart`, stanja zalihe, **lažna stranica za plaćanje** `/dev/checkout/`, `/narudzba/uspjeh/` i otkazivanje | E2E: dodaj, promijeni, ukloni, osvježi, promijeni zalihu tijekom sesije, plati (lažno), otkaži |
| M6 | `mock-server/` + adapter `devserver` + **Stripe test**: `startCheckout`, webhook, `getOrderStatus`, umanjenje zalihe (API-CONTRACT §6); `docs/stripe-test-manual.md` | Test ugovora prolazi i nad `devserver`; ručni Stripe test prođen (Daniel) |
| M7 | O nama, kontakt, pravne stranice (tekst od Sare). Kontakt forma iz prototipa ne smije biti lažna: ili je ukloni i ostavi potvrđeni e-mail/telefon, ili je spoji na backend kad postoji | Sadržaj potvrđen |
| M8 | SEO (metadata, JSON-LD, sitemap, robots), performanse, pristupačnost, `.htaccess`, sve provjere iz §4 | Svi pragovi zeleni |
| M9 | *(kasnije)* adapter za odabrani backend + prolaz kroz test ugovora + E2E na stagingu | API-CONTRACT §8 ispunjen |
| M10 | *(kasnije, samo ako Woo)* `wordpress/`: `cs-headless`, `cs-pos-bridge` (NullAdapter), child tema checkouta, okidač rebuilda | PHPCS zelen, sigurnosni testovi §4.5 |
| M11 | *(kad se zna POS)* konkretni adapter u `cs-pos-bridge` | Odluka po STACK §8 provedena i testirana na stagingu |
| M12 | Checklist STACK §10 | Daniel odobrio |

---

## 4. Testiranje

Sve se pokreće lokalno i u CI-ju. PR s crvenim testom se ne spaja.

### 4.1 Statičke provjere
- `npm run lint` (ESLint s `jsx-a11y`), `npm run typecheck` (`tsc --noEmit`).
- `npm audit --omit=dev --audit-level=high` u CI-ju.
- PHP (kad dođe): `phpcs --standard=WordPress wordpress/` i `php -l` za svaku datoteku.

### 4.2 Unit (Vitest)
- Podatkovni sloj: oba izvora vraćaju isti oblik; straničenje; prazna polja; proizvod bez slike; rasprodan proizvod; **zaliha se promijenila između učitavanja i dodavanja u košaricu**.
- `sanitize.ts`: `<script>`, `onerror=`, `javascript:` URL-ovi i `<iframe>` moraju biti uklonjeni.
- Formatiranje cijena (`11,90 €`) i količina.
- **Fixture:** svaki proizvod ima jedinstven neprazan `sku`; nema duplikata.

### 4.2b Test ugovora (`tests/contract/`)
Isti skup testova se izvodi nad **svakim** adapterom (`demo`, `devserver`, kasnije odabrani backend). Popis u API-CONTRACT §7. Novi adapter smije se spojiti samo ako prolazi cijeli skup.

### 4.3 Vizualna usporedba (Playwright)
- Snimke na 1440×900 i 390×844 za svaku stranicu iz §2. Prvi put usporedi **ručno s HTML-om dizajna** i priloži obje snimke u PR. Nakon Danielova odobrenja postaju bazne (`toHaveScreenshot`, prag 0,2 %).

### 4.4 Funkcionalni E2E (Playwright, nad `out/` serviranim preko `sirv-cli`, uz `mock-server` s `FAKE` plaćanjem koji pokreće `webServer` u Playwrightu; poslije i na stagingu)
1. Naslovnica se učita bez grešaka u konzoli; svi linkovi u navigaciji vode na 200.
2. Katalog: filter po vrsti i okusu sužava popis; URL se ažurira; "Očisti" vraća sve; direktno otvaranje `/katalog/zeleni` radi.
3. Proizvod: prikazuje cijenu i zalihu; rasprodan proizvod ima onemogućen gumb; direktno otvaranje `/proizvod/<slug>` radi i bez JavaScripta ima sadržaj u HTML-u (`curl`).
4. Košarica: dodaj 2 proizvoda, promijeni količinu, ukloni jedan; nakon osvježavanja stranice košarica ostaje.
5. Zaliha: simuliraj promjenu zalihe (mock): dodavanje u košaricu vraća grešku i UI je lijepo prikazuje.
6. "Na blagajnu": `checkCart` pa `startCheckout` pa preusmjeravanje; otkazivanje vraća na `/kosarica/?otkazano=1` s netaknutom košaricom; uspjeh na `/narudzba/uspjeh/` briše košaricu **tek kad je status `paid`**; posjet `/narudzba/uspjeh/` bez valjanog tokena ne prikazuje potvrdu.
7. Nepoznata putanja vraća aplikaciju s 404 stranicom.
8. Mobitel 390 px: donja navigacija, hero čitljiv, gumbi ≥ 44 px.
9. Na stagingu (kad bude Woo): checkout sa Stripe test karticom `4242 4242 4242 4242`; odbijena kartica `4000 0000 0000 0002` daje jasnu poruku; 3D Secure test prolazi; narudžba je u wp-adminu u statusu "U obradi"; `add-item` s `quantity: -1`, `9999` i nepostojećim ID-jem vraća grešku.

### 4.5 Sigurnosni testovi (automatski)
- Zaglavlja na `/`: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- CORS (kad bude Woo): `Origin: https://evil.example` **ne dobiva** `Access-Control-Allow-Origin`; `Origin: https://camelliasinensis.eu` dobiva točno tu vrijednost i `Allow-Credentials: true`.
- `shop.…/xmlrpc.php` → 403/404; `shop.…/wp-json/wp/v2/users` → 401/404 bez prijave; `?author=1` ne otkriva korisničko ime.
- `shop.…` vraća `X-Robots-Tag: noindex`; `staging.…` traži lozinku i ima `noindex`.
- `npm run check:bundle`: `out/` ne smije sadržavati Woo REST ključeve (`ck_` ili `cs_` + 40 hex znakova), `sk_live`, `sk_test`, `whsec_`, `ghp_`, `github_pat_`, `BEGIN PRIVATE KEY`, vrijednosti iz `.env` ni `.map` datoteke.
- POS most (kad postoji): neovjereni zahtjev na ulazni endpoint → 401; ponovljeni zahtjev (isti nonce) → odbijen; krivi potpis → 401; zahtjev stariji od 5 minuta → odbijen.
- HTTP → HTTPS preusmjerenje i `www` → apex (301).

### 4.6 Pristupačnost i performanse
- `@axe-core/playwright` na svim stranicama iz 4.3: 0 kršenja razine *serious* ili *critical*.
- Ručno: cijeli tijek kupnje samo tipkovnicom; čitač zaslona najavljuje promjenu košarice (`aria-live="polite"`).
- Lighthouse CI (mobitel): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. LCP < 2,5 s, CLS < 0,1.

### 4.7 Prerender provjera
- Za svaku rutu iz STACK §4 postoji `build/client/<ruta>/index.html` s jedinstvenim `<title>`, `meta description`, `canonical` i JSON-LD-om gdje treba. Provjera je dio `check:bundle` ili zasebna skripta `check:prerender`.
- Broj stranica proizvoda = broj objavljenih proizvoda u izvoru podataka.

### 4.8 Ručno prije svakog izdanja na produkciju
- Probna narudžba na stagingu cijelim tijekom; e-mail potvrde ne smije završiti u spamu; račun (kad bude dostupan).
- Pregled u Safariju (iOS) i Chromeu (Android).

---

## 5. Sigurnost: što modeli najčešće pogriješe (i kako ispravno)

Svaka stavka je **zabrana**. U PR-u potvrdi da je nisi prekršio.

### Tajne
- ❌ Woo REST ključevi (`ck_…`/`cs_…`), Stripe tajni ključ (`sk_…`) ili webhook tajna (`whsec_…`), GitHub token, SSH ključ, **POS API ključ** u kodu, `.env` u gitu, `NEXT_PUBLIC_*` s tajnom (sve `NEXT_PUBLIC_*` varijable završe u javnom bundleu).
  ✅ Frontend koristi **samo javni Store API**. Tajne žive u wp-adminu, `wp-config.php` ili GitHub Secrets. `.env*` je u `.gitignore`, a `.env.example` sadrži samo imena varijabli.
- ❌ Ispis tajni u CI logu (`echo $SECRET`, `set -x`).
- ❌ `StrictHostKeyChecking=no` ili `curl -k`. ✅ Pinani `known_hosts`, provjera TLS-a uvijek uključena.

### Novac i narudžbe
- ❌ Cijena, popust, dostava ili ukupni iznos izračunat na klijentu i poslan serveru.
  ✅ Server (Woo) računa sve, a frontend samo prikazuje ono što Store API vrati.
- ❌ Narudžba označena plaćenom na temelju povratka kupca na stranicu. ✅ Samo potpisani Stripe webhook.
- ❌ Vlastita forma za kartične podatke. ✅ Samo Stripe Payment Element na Woo checkoutu.
- ❌ Kuponi ili "test" načini plaćanja ostavljeni uključeni na produkciji.
- ❌ Klijent koji šalje `amount`, `price`, `priceId` ili popust (API-CONTRACT §1.2). ✅ Šalje se samo `{sku, qty}`.
- ❌ Prikaz "plaćanje uspjelo" samo zato što je kupac otvorio `/narudzba/uspjeh/`. ✅ Samo `status === 'paid'` iz `getOrderStatus`.
- ❌ Brisanje košarice pri polasku na plaćanje. ✅ Tek kad je `paid`.

### Ulaz i ispis
- ❌ `dangerouslySetInnerHTML` s nesanitiziranim opisom proizvoda. ✅ `sanitize-html` s uskom listom pri buildu, i to je jedino mjesto gdje se HTML renderira.
- ❌ PHP ispis bez escapinga. ✅ `esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`; ulaz kroz `sanitize_text_field`, `absint`; provjera `current_user_can` i nonce na svakoj radnji.
- ❌ SQL s lijepljenjem stringova. ✅ `$wpdb->prepare` ili WP/Woo API.
- ❌ `eval`, `new Function`, dinamički `import()` s URL-om iz podataka.

### WordPress (samo ako se odabere Woo)
- ❌ CORS `*` ili `Allow-Credentials` uz zrcaljenje bilo kojeg `Origin`. ✅ Točna lista od dva origina (STACK §5).
- ❌ Novi REST endpoint bez `permission_callback`. ✅ Uvijek eksplicitan; `__return_true` samo za stvarno javne podatke uz obrazloženje u PR-u.
- ❌ Uređivanje tuđih dodataka ili jezgre, "nulled" dodaci, dodaci izvan zatvorene liste.
- ❌ `WP_DEBUG_DISPLAY` na produkciji ili `phpinfo()` na serveru.
- ❌ Admin račun za Saru. ✅ Uloga *Shop manager* + 2FA.

### POS most (`cs-pos-bridge`)
- ❌ Spajanje na Sarin stvarni POS iz razvojnog ili testnog okruženja. ✅ Samo `NullAdapter`, a stvarni adapter se piše uz Sarin i Danielov izričit pristanak i testira prvo na kopiji podataka.
- ❌ Ulazni endpoint bez potpisa. ✅ HMAC-SHA256 (tajna u `wp-config.php`), vremenska oznaka (najviše 5 minuta stara), nonce (pamti se dok ne istekne), usporedba potpisa funkcijom `hash_equals`.
- ❌ Woo admin račun ili lozinka dani POS-u. ✅ Posebni korisnik s najmanjim pravima ili potpisani pozivi.
- ❌ Sinkronizacija u zahtjevu kupca (usporava ili ruši checkout). ✅ Action Scheduler, ponavljanje s razmakom, idempotentni ključ.
- ❌ Beskonačno ponavljanje ili tihi pad. ✅ Najviše N pokušaja, zatim zapis u dnevnik i e-mail upozorenje.
- ❌ Slijepo prepisivanje cijena i zalihe iz POS-a. ✅ Provjera valjanosti (cijena > 0, zaliha ≥ 0 i cijeli broj, SKU postoji); nepoznati SKU se **ne** stvara automatski, nego se bilježi.
- ❌ Dva sustava koja fiskaliziraju istu narudžbu (STACK §7).
- ❌ Osobni podaci kupca u logovima ili u e-mailu upozorenja.

### Deploy i server
- ❌ `rsync --delete` na mapu koja nije točno navedena u STACK §6, ili na putanju iz neprovjerene varijable.
- ❌ Deploy na produkciju iz PR-a ili s grane koja nije `main`.
- ❌ GitHub akcije na tagu ili grani (`@main`). ✅ Pinane na commit SHA; `permissions: contents: read`.
- ❌ Source mape (`.map`) ili `.git` na serveru. ✅ `build.sourcemap: false`, a `.htaccess` blokira putanje koje počinju točkom.
- ❌ Staging bez lozinke ili s indeksiranjem.

### Privatnost (GDPR)
- ❌ Google Fonts, Google Maps, analitika ili pikseli koji se učitavaju prije pristanka. ✅ Fontovi self-host, karta na klik, analitika samo uz pristanak (i samo ako je Daniel odobri).
- ❌ Logiranje e-maila, adrese ili telefona kupca u konzolu, CI ili vanjske servise.
- ❌ Osobni podaci u URL parametrima.

### Sigurnosna zaglavlja (`public/.htaccess`, polazište)
```apache
Options -Indexes
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://camelliasinensis.eu%{REQUEST_URI} [L,R=301]
RewriteCond %{HTTP_HOST} ^www\. [NC]
RewriteRule ^ https://camelliasinensis.eu%{REQUEST_URI} [L,R=301]
RewriteRule (^|/)\. - [F]
ErrorDocument 404 /404.html

<IfModule mod_headers.c>
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://shop.camelliasinensis.eu https://upload.wikimedia.org; font-src 'self'; connect-src 'self' https://shop.camelliasinensis.eu; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://shop.camelliasinensis.eu"
</IfModule>
<FilesMatch "\.(html|data)$">
Header set Cache-Control "no-cache"
</FilesMatch>
<FilesMatch "\.(js|css|woff2|avif|webp|jpg|png|svg)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
```
Napomene:
- Next.js ubacuje inline skripte za hidrataciju, pa `script-src 'self'` može zahtijevati hashove ili nonce. Provjeri u konzoli i dodaj samo potrebne `sha256-…` hashove, **nikad** `'unsafe-inline'` ni `'unsafe-eval'` za skripte. Ako to nije izvedivo sa statičkim HTML-om, zapiši problem i pitaj prije bilo kakvog popuštanja.
- `connect-src` i `form-action` prilagodi adresi odabranog backenda (kad se odabere).
- `includeSubDomains` uključi tek kad sve poddomene imaju HTTPS. `preload` se ne dodaje bez Danielove odluke.
- `upload.wikimedia.org` makni iz CSP-a čim se ilustracija zamijeni Sarinom fotografijom.
- `ErrorDocument 404` i `trailingSlash` moraju raditi na Hostingerovom poslužitelju: **[PROVJERI]** na stagingu.

---

## 6. SEO (Perasmina usluga, ne preskakati)

- Svaka stranica ima jedinstven `<title>` i `meta description` na hrvatskom, `lang="hr"`, kanonski URL na `https://camelliasinensis.eu/…` (oblik s ili bez završne kose crte po odluci iz STACK §4).
- Proizvod: JSON-LD `Product` s `offers` (cijena, `priceCurrency: EUR`, `availability`) **samo iz stvarnih podataka**. Bez `aggregateRating` i `review` dok ne postoje stvarne recenzije. Mock cijene (primjeri) ne smiju završiti u produkcijskom JSON-LD-u: prije lansiranja treba provjeriti da svi objavljeni proizvodi imaju cijenu koju je Sara potvrdila.
- `Organization`/`Store` JSON-LD tek kad Sara potvrdi naziv, adresu i radno vrijeme.
- `sitemap.xml` (sve javne rute), `robots.txt` (`Disallow` za filtere s parametrima), Open Graph slike po proizvodu.
- Semantičke oznake (`h1` jedan po stranici, `nav`, `main`, `footer`), opisni `alt` na fotografijama.
- `.eu` ne daje automatski lokalni signal: hrvatski jezik, `hreflang="hr"` i hrvatska adresa u podnožju (kad je dobijemo) moraju biti tu.

---

## 7. Predložak PR-a (`.github/pull_request_template.md`)

```markdown
## Što i zašto
## Promjene
## Snimke (1440 i 390), uz referentne iz HTML-a dizajna
## Testovi
- [ ] lint / typecheck / unit
- [ ] E2E
- [ ] axe 0 serious/critical
- [ ] Lighthouse pragovi
- [ ] prerender provjera
## Sigurnosni popis (GUIDE §5) — dirani dijelovi
- [ ] nema tajni u kodu ni u `out/`
- [ ] cijene i iznosi samo sa servera
- [ ] ulaz sanitiziran, ispis escapiran
- [ ] nema novih ovisnosti/dodataka (ili: odobreno u #…)
- [ ] ništa se ne spaja na stvarni POS
## Što nedostaje / tko to daje
## Pretpostavke koje sam napravio
```

---

## 8. Stripe test i razvojni poslužitelj (`mock-server/`)

Pravila vrijede uz API-CONTRACT §6.

1. **Samo test načina.** Ključevi se uzimaju iz Danielovog Stripe računa u test načinu i stavljaju u `mock-server/.env` (u `.gitignore`). Model **ne traži, ne vidi i ne zapisuje** ključeve, ne stvara Stripe račun i ne pokreće Stripe CLI umjesto Daniela. Kod mora raditi i bez ključeva (`FAKE` plaćanje).
2. **Zaštite pri pokretanju:** poslužitelj odbija startati ako ključ ne počinje s `sk_test_`/`rk_test_`, ako sluša na adresi različitoj od `127.0.0.1`, ili ako je `NODE_ENV=production`. Za to postoji test.
3. **Nikad na server.** `mock-server/` nije u `out/`, nije u nijednom deploy workflowu, nije u rsync popisu. CI provjerava da deploy artefakt ne sadrži `mock-server`.
4. **Cijena samo s poslužitelja** (API-CONTRACT §6.4). Test: zahtjev s `amount: 1` ne smije promijeniti iznos.
5. **Webhook:** potpis se provjerava, obrada je idempotentna po ID-u događaja, krivi potpis daje 400. Test s ispravnim i neispravnim potpisom (Stripe biblioteka ima pomoćnu funkciju za generiranje potpisanih zaglavlja u testovima).
6. **Ništa osjetljivo u logu:** bez podataka o kartici, adresi i e-mailu kupca.
7. **Ručni test (Daniel):** model piše `docs/stripe-test-manual.md` s koracima (instalacija Stripe CLI-ja, `stripe listen`, postavljanje `.env`, test kartice, očekivani rezultati za uspjeh, odbijanje, 3D Secure, otkazivanje, kasni webhook). Taj test nije dio CI-ja.
8. **Što taj test ne dokazuje:** da će produkcijski backend raditi (API-CONTRACT §8). Model to piše u izvješću.
