# STACK.md — Camellia sinensis webshop

Tehnička specifikacija za izradu. Pišem je za ljude i za AI modele koji kodiraju.
Pravila rada, dizajn, testiranje i sigurnosni popis su u **GUIDE.md**. Pitanja za Saru i dobavljača blagajne su u **POS-PITANJA.md**. Pročitaj sve tri prije prve izmjene.

Stanje: 2.11.2026. Hosting je kupljen (Hostinger, paket **Unlimited**, domena **camelliasinensis.eu** registrirana kod Hostingera).
Oznaka **[PROVJERI]** znači da nije potvrđeno. Provjeri u hPanelu ili službenoj dokumentaciji prije nego što se osloniš na to.
Oznaka **[ODLUKA]** znači da odgovor još nema i da ga ne smiješ pogađati.

---

## 0. Što se promijenilo u odnosu na prethodne verzije (2.11.2026.)

1. **Frontend je Next.js (App Router) kao statični export** (`output: 'export'`), ne React Router. Obrazloženje, usporedba i scenariji promjene su u **FRONTEND-ODLUKA.md**. Poslužiteljski Next (SSR/ISR) se **ne** koristi dok ne nastupi jedan od okidača iz tog dokumenta.
2. **Backend nije konačno odabran.** WooCommerce je zadani kandidat (§5), ali frontend se gradi nad **API-CONTRACT.md** i ne poznaje nijedan backend. Do odluke koristi dva adaptera: `demo` (sve u pregledniku) i `devserver` (lokalni poslužitelj sa Stripe **test** načinom).
3. **Košarica je u vlasništvu frontenda** (`{sku, qty}` u pregledniku), a ne Woo košarica kroz Store API. Backend dobiva košaricu tek pri polasku na plaćanje i sam određuje cijenu (API-CONTRACT §1).
4. **Sloj za blagajnu (POS)** je i dalje dio arhitekture, neovisno o backendu (§8). Frontend ne zna ništa o blagajni.
5. Korijen repozitorija je Next projekt. Nema mape `frontend/`.

Dvije staze rada teku paralelno:
- **Staza A (sada): frontend** nad ugovorom i mockom, uključujući plaćanje u Stripe test načinu preko lokalnog `mock-server/`.
- **Staza B (usporedno): odluke o backendu i blagajni** (POS-PITANJA.md, odabir backenda, fiskalizacija). Spajaju se u zadnjem koraku: pišemo adapter i prolazimo test ugovora (API-CONTRACT §7, §8).

---

## 1. Arhitektura u jednoj slici

```
                    Kupac (preglednik)
                            │
          ┌─────────────────┴──────────────────┐
          │                                    │
 camelliasinensis.eu                  shop.camelliasinensis.eu
 (Next.js, statički export)        (WordPress + WooCommerce)
 - naslovnica, katalog, proizvod      - Store API (javni, bez ključeva)
 - o nama, kontakt                    - košarica (sesija u kolačiću)
 - prikaz košarice                    - BLAGAJNA (checkout), plaćanje (Stripe)
          │                           - narudžbe, zalihe, računi
          │  fetch (credentials)      - wp-admin za Saru
          └──────────► /wp-json/wc/store/v1/...
                                               │
        ┌──────────────────┬───────────────────┼─────────────────┬─ - - - - - - - ┐
      Stripe              GLS           fiskalizacija /          cs-pos-bridge
   (kartice, Apple/      (dostava)      izdavanje računa         (adapter, §8)
    Google Pay)                         [ODLUKA, §7]                  :
                                                             - - - ► POS (Thor ili drugi)
                                                                    [NEPOZNATO]

 GitHub repo ──push──► GitHub Actions ──build──► rsync preko SSH ──► Hostinger
 WooCommerce (izmjena proizvoda) ──repository_dispatch──► novi build frontenda
```

Načela:
1. **Backend je jedini izvor istine** za proizvode, cijene, zalihe i narudžbe (zadani kandidat: WooCommerce, do odluke o backendu i blagajni, §8.3). Frontend ništa ne naplaćuje i ne računa konačnu cijenu.
2. **Stranica za plaćanje (checkout) je uvijek na backendu** (kod Wooa: `shop.camelliasinensis.eu/blagajna/`, gdje rade dodaci za Stripe, GLS i fiskalizaciju; u razvoju: Stripe hosted Checkout u test načinu). U frontendu **ne gradimo** vlastiti checkout ni polja za karticu i adresu.
3. **Frontend je statičan** (izvezen pri buildu). Na serveru nema Node procesa. Cijene i zalihe se na stranici proizvoda i u košarici osvježavaju uživo preko `getLive`/`checkCart` (API-CONTRACT).
4. **Košarica je u pregledniku** (`{sku, qty}`), a backend je vidi tek pri polasku na plaćanje (API-CONTRACT §1 i §3.4). To izbjegava probleme s kolačićima između poddomena.
5. **Blagajna za fizičku trgovinu (POS) je odvojena stvar od Woo "blagajne" (checkouta).** U dokumentima uvijek pišemo "POS" za fizičku blagajnu i "checkout" za kupnju na webu.

---

## 2. Komponente i verzije

Verzije **pinaj točno** (bez `^` i `~`). Zadnje stabilne na dan 2.11.2026. (provjereno s `npm view`) navedene su kao polazište; **potvrdi peer ovisnosti** prije instalacije i zapiši konačne verzije ovdje.

| Sloj | Tehnologija | Napomena |
| --- | --- | --- |
| Framework | Next.js (16.x, App Router), `output: 'export'` | Node ≥ 20.9 (`.nvmrc`). Poslužiteljske značajke se ne koriste (FRONTEND-ODLUKA §6) |
| UI | React (19.x), TypeScript `strict` | TypeScript 7.x je izašao; ako ESLint/typescript-eslint ili drugi alat ne podržava 7, koristi zadnji podržani 5.x/6.x |
| Rute | Next App Router, `generateStaticParams` | Prerender je u frameworku, bez dodatnog paketa |
| Stil | CSS Modules ili čisti CSS s varijablama iz GUIDE.md §2 | Bez UI kitova koji nameću svoj izgled |
| Fontovi | `next/font` (self-host pri buildu) ili `@fontsource-variable/bricolage-grotesque` i `@fontsource-variable/inter-tight` | Bez učitavanja s Google CDN-a u pregledniku (GDPR) |
| Sanitizacija | `sanitize-html` | Opisi proizvoda iz Wooa su HTML |
| Obrada slika | `sharp` | Skripta u `scripts/`, ne u runtimeu |
| Testovi | `vitest`, `@playwright/test`, `@axe-core/playwright`, Lighthouse CI | GUIDE §4 |
| Razvojni poslužitelj | `mock-server/` (Node, Hono ili Express: odaberi najmanje, obrazloži), `stripe` (službeni Node paket, **samo tu**) | Samo razvoj, nikad deploy (API-CONTRACT §6). Odobrenje za ovisnosti je dano za ovaj paket |
| Statični poslužitelj za testove | `sirv-cli` (`sirv out --single 404.html`) | služi izvezeni `out/` |
| Backend (zadani kandidat, nije konačno) | WordPress + WooCommerce (zadnje stabilne), PHP najnoviji podržani na Hostingeru (8.2+) | Jezgra i dodaci se **ne** drže u gitu. Može se zamijeniti drugim backendom bez promjene frontenda (API-CONTRACT) |
| WP tema | Child tema od **Twenty Twenty-Five** (`camellia-checkout`) | Samo za checkout, račun i e-mailove |
| WP kod (vlastiti) | MU-plugin `cs-headless` (CORS, preusmjeravanja, rebuild, učvršćivanje) i plugin `cs-pos-bridge` (§8) | Jedini PHP koji pišemo |
| Plaćanje | WooCommerce Stripe Payment Gateway (službeni) | |
| Dostava | GLS dodatak | **[ODLUKA]** ovisi o Sarinom GLS ugovoru |
| Računi / fiskalizacija | **[ODLUKA, §7]** | blokira lansiranje |
| 2FA, SMTP, kopije | *Two Factor*, *WP Mail SMTP*, *UpdraftPlus* (ili ekvivalent) | |
| Red zadataka | **Action Scheduler** (dolazi s WooCommerceom) | za sve pozadinske integracije |
| CI/CD | GitHub Actions | §6 |

Zatvoren popis WP dodataka: WooCommerce, Stripe gateway, GLS, dodatak za račune/fiskalizaciju (kad se odluči), Two Factor, SMTP, backup. Svaki novi dodatak traži Danielovo odobrenje (GUIDE.md §1).

---

## 3. Domene, poddomene i DNS

Domena je registrirana kod Hostingera, pa se DNS uređuje u **hPanel → Domene → DNS**.

| Host | Svrha | Mapa na serveru |
| --- | --- | --- |
| `camelliasinensis.eu` | Frontend (produkcija) | `domains/camelliasinensis.eu/public_html/` **[PROVJERI točnu putanju]** |
| `www.camelliasinensis.eu` | 301 na `camelliasinensis.eu` | — |
| `shop.camelliasinensis.eu` | WordPress + WooCommerce | zasebna mapa poddomene, **izvan** `public_html` frontenda |
| `staging.camelliasinensis.eu` | Frontend staging (lozinka, `noindex`) | zasebna mapa |
| WP staging | Hostingerov alat za staging | prema hPanelu |

**Kritično:** mapa WordPressa ne smije biti unutar mape frontenda. Deploy frontenda koristi `rsync --delete` i obrisao bi WordPress.

DNS zapisi:
- `A` / `AAAA` za `@`, `shop`, `staging` → IP hostinga (hPanel ih obično postavi sam).
- `CNAME www` → `camelliasinensis.eu`, plus 301 u `.htaccess`.
- E-pošta: `MX`, SPF (`TXT`), DKIM prema hPanelu.
- DMARC: `_dmarc TXT "v=DMARC1; p=none; rua=mailto:<adresa>"`. Nakon 2 do 4 tjedna urednih izvještaja prebaci na `p=quarantine`.
- `CAA`: `0 issue "letsencrypt.org"` **[PROVJERI koji CA Hostinger koristi]**.
- SSL: uključi za sve poddomene i prisilni HTTPS.
- Domena: zaključavanje i automatska obnova. Vlasnik mora biti Sara.

---

## 4. Frontend (Next.js, statični export)

Pravila odabira i granice (što je dopušteno u exportu, kada prijeći na poslužitelj) su u **FRONTEND-ODLUKA.md**. Sučelje prema backendu je u **API-CONTRACT.md**.

### Struktura repozitorija (korijen = Next projekt)

```
/
├─ camellia-repo-start/        # dokumentacija i referenca (STACK, GUIDE, API-CONTRACT, FRONTEND-ODLUKA, POS-PITANJA, START-PROMPT, design-reference/)
├─ app/                        # Next.js App Router (rute)
├─ components/
├─ lib/
│  ├─ shop/                    # sučelje ShopBackend + adapteri: demo, devserver, (woo kasnije)
│  ├─ cart/                    # košarica u pregledniku (localStorage, verzionirana)
│  ├─ sanitize.ts, format.ts
├─ styles/tokens.css
├─ fixtures/products.json      # GENERIRANO iz design-reference/src/data.js (71 proizvod, SKU obavezan)
├─ public/                     # slike (generirane), .htaccess, favicon
├─ mock-server/                # SAMO RAZVOJ (API-CONTRACT §6), vlastiti package.json, nikad se ne deploya
├─ scripts/
│  ├─ data-to-fixtures.mjs     # data.js → fixtures/products.json u obliku iz API-CONTRACT §2
│  ├─ data-to-woo-csv.mjs      # isti podaci → CSV za uvoz u WooCommerce (samo ako backend = Woo)
│  ├─ optimize-images.mjs
│  └─ check-*.mjs              # check:bundle, check:prerender
├─ tests/                      # unit, contract, e2e
├─ wordpress/                  # KASNIJE i samo ako backend = Woo (mu-plugins/cs-headless, plugins/cs-pos-bridge, themes/camellia-checkout)
├─ next.config.ts
└─ .github/workflows/
```

### `next.config.ts` (obavezno)
```ts
export default {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },       // slike optimizira scripts/optimize-images.mjs pri buildu
  productionBrowserSourceMaps: false,
};
```
Bez API ruta, Server Actions, `cookies()`/`headers()`, middleware/proxyja, ISR-a, Draft Modea i `dynamicParams: true`. Next u exportu sam javlja grešku za većinu toga; CI mora padati (FRONTEND-ODLUKA §6).

### Rute (zamjenjuju hash rute iz prototipa)

| Prototip | Nova ruta | Generiranje |
| --- | --- | --- |
| `#` | `/` | build |
| `#katalog` | `/katalog/` | build |
| `#katalog?vrsta=zeleni` | `/katalog/zeleni/` | build, po jedna stranica za svaku vrstu (`generateStaticParams`) |
| `#katalog?okus=…` | `/katalog/?okus=…` | filtriranje u pregledniku, `noindex` za kombinacije filtera |
| `#proizvod/ID` | `/proizvod/<slug>/` | build, `generateStaticParams` iz `listProducts()`, `dynamicParams = false` |
| `#blagajna` | **nema vlastite blagajne**: `/kosarica/` vodi na stranicu za plaćanje koju vrati backend | — |
| `#hvala` | `/narudzba/uspjeh/` (provjerava status, API-CONTRACT §3.5) i `/kosarica/?otkazano=1` | klijent |
| `#o-nama`, `#kontakt` | `/o-nama/`, `/kontakt/` | build |
| — | `/uvjeti-kupnje/`, `/privatnost/`, `/povrat/`, `/kolacici/` | build, ali **tekst daje Sara ili pravnik**; AI ga ne izmišlja |
| — | `/dev/checkout/` (samo `demo`) | lažna stranica za plaćanje, **ne postoji u produkcijskom buildu** |
| — | `404.html`, `sitemap.xml`, `robots.txt` | build |

### Podaci
- **Pri buildu:** `listProducts()` i `listTypes()` iz aktivnog adaptera. S `demo`/`devserver` to čita `fixtures/products.json` izravno, bez pokrenutog poslužitelja. S `woo` to je Store API (javan, bez ključeva).
- **U pregledniku:** `getLive`, `checkCart`, `startCheckout`, `getOrderStatus` (API-CONTRACT §3). Kad `getLive` padne, prikaži cijenu iz builda i napomenu da se potvrđuje pri plaćanju.
- **Zaliha nije statična.** UI pokriva: na zalihi, malo, nema na zalihi, grešku zalihe pri dodavanju, osvježavanje košarice (GUIDE §2).
- **Metapodaci** (podrijetlo, kofein, okusi, namjene, oblik, upute za kuhanje) dio su `Product.attributes`, nikad hardkodirani u komponentama.
- Opisi: `sanitize-html` pri buildu s uskom listom (`p, br, strong, em, ul, ol, li, a[href]`).

### Košarica i prijelaz na plaćanje
1. Košarica je `{sku, qty}[]` u `localStorage` (`cs.cart.v1`, s verzijom i migracijom). Frontend ne sprema cijenu u košaricu, samo prikazuje ono što vrati `getLive`/`checkCart`.
2. "Na blagajnu": `checkCart` pa `startCheckout` pa preusmjeravanje na `redirectUrl`. Košarica se briše tek kad `getOrderStatus` vrati `paid`.
3. Kad backend bude Woo: `startCheckout` zove naš endpoint koji napuni Woo košaricu na `shop.` strani i preusmjeri na Woo checkout (§5).

### Ponovni build
- **Demo / razvoj:** nije potreban.
- **Woo:** MU-plugin na `save_post_product` (samo ručno spremanje, ne promjena zalihe, ne uvoz iz POS-a) zakaže `wp_schedule_single_event` za 2 minute (debounce) koji šalje `POST https://api.github.com/repos/<owner>/<repo>/dispatches` s `{"event_type":"shop-products-changed"}`. Token je fine-grained PAT ograničen na taj repozitorij, s najmanjim dopuštenjem za `repository_dispatch` **[PROVJERI u GitHub dokumentaciji]**, rok 1 godina, u `wp-config.php`. Promjena zalihe ne traži rebuild; promjena cijene ili opisa traži.

### SEO za demo build
Demo build (`NEXT_PUBLIC_DEMO=1`) uvijek ima `noindex` i **nikad se ne objavljuje na produkcijskoj domeni**.

---

## 5. Backend (zadani kandidat: WordPress + WooCommerce)

> **Nije konačno odabran.** Frontend ga ne poznaje (API-CONTRACT.md). Ovaj odjeljak vrijedi ako se odabere Woo. Ako se odabere drugi backend, zamjenjuju se §5, `wordpress/` i dio §6/§7/§8, a frontend, SKU, POS-PITANJA i kontrolne liste ostaju.

### Postavke WooCommercea
- Država: Hrvatska, valuta EUR, jezik hrvatski. Slugovi: `/kosarica/`, `/blagajna/`, `/moj-racun/`.
- Porezi: **[ODLUKA]** ovisi o tome je li Sara u sustavu PDV-a i treba li OSS. Do odgovora ne uključuj obračun poreza "na slijepo".
- Gost kupnja dopuštena, račun neobavezan.
- Zalihe uključene, prag upozorenja 2 komada.
- **SKU je obavezan na svakom proizvodu** (ključ za POS, §8). Nikad se ne mijenja nakon uvoza.
- Svi proizvodi uvezeni iz prototipa idu kao **skice (draft)** dok Sara ne potvrdi cijenu.

### MU-plugin `cs-headless`
1. **CORS** samo za `https://camelliasinensis.eu` i `https://staging.camelliasinensis.eu` na `/wp-json/wc/store/*`: `Access-Control-Allow-Credentials: true`, `Allow-Headers: Content-Type, Nonce, Cart-Token`, `Expose-Headers: Nonce, Cart-Token`. Nikad `*`.
2. **Preusmjeravanja:** javne WP/Woo stranice osim checkouta, košarice, "moj račun", narudžbe i `wp-admin`/`wp-login` dobivaju 301 na rutu frontenda.
3. **`noindex`** (meta i `X-Robots-Tag`) za cijeli `shop.` host.
4. **Okidač rebuilda** (§4).
5. **Učvršćivanje:** isključen XML-RPC, blokirani `/wp-json/wp/v2/users` i `?author=N` za neprijavljene, `DISALLOW_FILE_EDIT`, uklonjena oznaka verzije WP-a, Application Passwords isključene ako se ne koriste.
6. Gumb "Natrag u trgovinu" na checkoutu vodi na `https://camelliasinensis.eu/`.

Kodni standard: WordPress Coding Standards, prefiks `cs_`, escaping na svakom ispisu, `sanitize_*` i `current_user_can` na svakom ulazu.

### `wp-config.php` (izvan gita, uređuje se ručno)
```php
define('DISALLOW_FILE_EDIT', true);
define('WP_AUTO_UPDATE_CORE', 'minor');
define('FORCE_SSL_ADMIN', true);
define('WP_DEBUG', false);
define('CS_GITHUB_DISPATCH_TOKEN', '...');
define('CS_GITHUB_REPO', 'owner/repo');
// POS most (§8), samo kad se odabere blagajna:
// define('CS_POS_HMAC_SECRET', '...');
// define('CS_POS_API_BASE', '...'); define('CS_POS_API_KEY', '...');
```

---

## 6. Deploy (git → server)

Grane: `main` → produkcija, `staging` → staging, ostalo → samo testovi. `main` je zaštićen: samo PR, obavezni zeleni testovi.

Deploy frontenda (`out/`) vrijedi za svaki backend. Korak "WordPress kod" u workflowu i sve vezano uz `wordpress/` **vrijede samo ako se odabere Woo**; `mock-server/` se **nikad** ne deploya. Zašto GitHub Actions + rsync: Hostingerov Git povlači repozitorij u mapu i ne pokreće `next build` **[PROVJERI postoji li build korak u hPanelu]**. Build radi Actions, a na server se šalje samo `out/`.

GitHub Secrets (environment `production` s obaveznim odobrenjem): `SSH_HOST`, `SSH_PORT` (Hostinger obično 65002, **[PROVJERI]**), `SSH_USER`, `SSH_KEY` (ed25519, samo za deploy), `SSH_KNOWN_HOSTS` (pinano, nikad `StrictHostKeyChecking=no`), `PROD_FRONT_PATH`, `PROD_WP_PATH`, `STAGING_FRONT_PATH`, `STAGING_WP_PATH`, `STAGING_BASIC_AUTH`.

`.github/workflows/deploy.yml` (polazište, prilagodi prije upotrebe):
```yaml
name: build-and-deploy
on:
  push: { branches: [main, staging] }
  pull_request:
  repository_dispatch: { types: [shop-products-changed] }
permissions: { contents: read }
concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: false }

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # pinaj na commit SHA
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run typecheck && npm run test
      - run: npm audit --omit=dev --audit-level=high
      - run: npm run build
        env:
          NEXT_PUBLIC_BACKEND: woo
          NEXT_PUBLIC_API_BASE: https://shop.camelliasinensis.eu
      - run: npm run check:bundle          # GUIDE §4.5
      - run: npx playwright install --with-deps chromium && npm run test:e2e:static
      - uses: actions/upload-artifact@v4
        with: { name: out, path: out, retention-days: 3 }

  deploy:
    needs: test
    if: github.event_name != 'pull_request' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging')
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { name: out, path: out }
      - name: SSH
        run: |
          install -m 700 -d ~/.ssh
          echo "${{ secrets.SSH_KEY }}" > ~/.ssh/id_ed25519 && chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.SSH_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
      - name: Frontend
        env:
          DEST: ${{ github.ref == 'refs/heads/main' && secrets.PROD_FRONT_PATH || secrets.STAGING_FRONT_PATH }}
        run: |
          test -n "$DEST" && [[ "$DEST" == *public_html* ]]   # zaštita od krive putanje
          rsync -az --delete --exclude='.well-known/' -e "ssh -p ${{ secrets.SSH_PORT }}" \
            out/ "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:$DEST/"
      - name: WordPress kod (samo naši dijelovi)
        if: github.event_name == 'push'
        env:
          WP: ${{ github.ref == 'refs/heads/main' && secrets.PROD_WP_PATH || secrets.STAGING_WP_PATH }}
        run: |
          test -n "$WP"
          R="ssh -p ${{ secrets.SSH_PORT }}"
          T="${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:$WP/wp-content"
          rsync -az --delete -e "$R" wordpress/mu-plugins/cs-headless/ "$T/mu-plugins/cs-headless/"
          rsync -az --delete -e "$R" wordpress/plugins/cs-pos-bridge/ "$T/plugins/cs-pos-bridge/"
          rsync -az --delete -e "$R" wordpress/themes/camellia-checkout/ "$T/themes/camellia-checkout/"
      - name: Smoke test
        env:
          URL: ${{ github.ref == 'refs/heads/main' && 'https://camelliasinensis.eu' || 'https://staging.camelliasinensis.eu' }}
          BASIC: ${{ secrets.STAGING_BASIC_AUTH }}
        run: |
          ARGS=(-fsS -o /dev/null)
          [ -n "$BASIC" ] && ARGS+=(-u "$BASIC")
          curl "${ARGS[@]}" "$URL/" && curl "${ARGS[@]}" "$URL/katalog/"
```
Napomene:
- `--delete` samo na točno navedenim mapama. Nikad na `wp-content/` ili šire.
- Uz `mu-plugins/cs-headless/` treba i loader `mu-plugins/cs-headless.php` (MU-pluginovi se ne učitavaju iz podmapa). Deploya se zasebno, bez `--delete`.
- Plugin `cs-pos-bridge` se u wp-adminu aktivira ručno i **ostaje neaktivan dok se POS ne odabere**.
- Sve `uses:` akcije pinaj na puni commit SHA.
- Rollback: `workflow_dispatch` s ulazom `ref` koji ponovno deploya zadnji zeleni commit. Dodaj to.
- `repository_dispatch` uvijek vuče `main`; to je željeno ponašanje za osvježenje kataloga na produkciji.

---

## 7. Plaćanje, dostava, računi i fiskalizacija

- **Stripe:** Sarin Stripe račun. Na stagingu samo **test ključevi**. Ključevi se unose u postavke dodatka u wp-adminu, **ne** u git i **ne** u frontend. Narudžba se smatra plaćenom **samo** na temelju potpisanog webhooka. Apple Pay i Google Pay idu kroz isti dodatak; potrebna verifikacija domene `shop.camelliasinensis.eu` u Stripeu.
- **GLS:** **[ODLUKA]** dodatak i tarife ovise o ugovoru. Do tada fiksna cijena dostave koju Sara odredi.
- **Fiskalizacija i izdavanje računa: [ODLUKA], blokira lansiranje.**

Što smo pronašli (izvor: Fiskalopedija, provjereno 2.11.2026.; članak sam upozorava da tekst i komentari nisu posve usklađeni i da treba provjeriti kod Porezne uprave, FINA-e ili knjigovođe):
- WooCommerce sam ne izdaje zakonski valjan račun. Treba program ili dodatak za izdavanje računa.
- Za B2C kupce svi računi se fiskaliziraju (F1) bez obzira na način plaćanja (Stripe, kartica, uplata na račun), a za B2B se izdaju eRačuni. Račun mora imati ZKI, JIR i QR kod.
- Načini povezivanja: dodatak za Woo koji šalje plaćene narudžbe programu za račune, ugrađeni Woo webhook, CSV izvoz, ili ručno izdavanje jednom dnevno. Fiskalopedija za početak preporučuje ručno ili dodatak, a automatizaciju kad obujam naraste.
- Primjeri postojećih dodataka: **KigoKasa** (v1.7.4, testiran s WordPress 6.9 i WooCommerce 10.9.4, podržava Fiskal1 od 1.1.2026., povezuje artikle po SKU, **ne opisuje sinkronizaciju zaliha**); **eBlagajna Webshop** (§8.2, zastario). To su primjeri, **ne preporuka**.

**Pravilo koje vrijedi neovisno o odabiru: za svaku web narudžbu postoji točno jedan sustav koji izdaje fiskalni račun.** Ako POS kasnije dobije web narudžbu zbog zalihe, ona u POS-u ne smije generirati drugi fiskalni račun (§8.4).

Pravni tekstovi, pravo na jednostrani raskid (14 dana), podaci o trgovcu (naziv obrta, OIB, adresa) u podnožju i na računu: **daje Sara ili pravnik**.

---

## 8. Povezivanje s blagajnom (POS)

### 8.1 Što je poznato (provjereno 2.11.2026.)

Sara je rekla da koristi ili razmatra **Thor** i da joj je u opticaju još jedan, noviji POS. **Njegovo ime i dobavljača ne znamo.**

**Thor** (razvija ga Monri Payments; izvori: monri.hr stranica proizvoda, članak "Thor i Elektronički računi", Progressive, Algor informatika):
- trgovački sustav za malo- i veleprodaju s robno-materijalnim knjigovodstvom, instalira se na Windows opremu, ima backoffice za praćenje zaliha na udaljenim lokacijama, mobilnu aplikaciju za inventuru (Android/iOS) i podršku za rad bez interneta (naknadna fiskalizacija);
- navedene integracije: eRačuni (Synesis, Moj e-račun, Fina), banke, SinglePOS kartični terminali, vage, FIS, napojnica, e-porezna;
- Monrijev opis kaže da se Thor "povezuje s vanjskim sustavima (e-commerce, B2B, FIS…)", **ali nigdje nismo našli** opis web shop integracije, javni API, WooCommerce ni format uvoza/izvoza artikala i zaliha. Stranice Algor informatike (distributer) to također ne spominju.
- eposlovanje.hr navodi da se Thor povezuje s njihovom uslugom e-računa preko API ključa. To je veza za e-račune, ne za web shop.

**Zaključak:** da Thor može razmjenjivati artikle, zalihe i narudžbe s web shopom **nije potvrđeno**. Treba pitati Monri ili Sarinog zastupnika (POS-PITANJA.md).

### 8.2 Postojeći WooCommerce dodaci za blagajne (ne temeljimo na njima)
- **eBlagajna Webshop** (wordpress.org): dvosmjerno povezivanje s uslugom eBlagajna, uvozi inventar u webshop, šalje narudžbe eBlagajna REST API-ju. Zadnje ažuriranje prije oko 2 godine, manje od 10 aktivnih instalacija, testiran do WordPressa 6.2. Nije za Thor. **Ne koristimo.**
- **KigoKasa** (§7): račun i fiskalizacija, ne zalihe.
- Opći zaključak: za hrvatski POS tržišno standardno rješenje za zalihe ne postoji, pa računaj na vlastiti adapter ili CSV.

### 8.3 Načela dizajna (vrijede za bilo koju blagajnu)

1. **SKU je ključ.** Svaki proizvod ima SKU (prototip koristi dobavljačeve šifre, npr. `CSTB-2`). Isti kod mora postojati u POS-u kao šifra artikla ili barkod. Ako POS koristi drugu šifru ili EAN, pohranjuje se uz proizvod kao dodatno polje (WooCommerce ima polje za GTIN/EAN **[PROVJERI u verziji koju koristimo]**).
2. **Jedan izvor istine za zalihu i cijenu.** Odlučuje se kad znamo POS:
   - **W (Woo je master):** cijena i zaliha se uređuju u Woou, a POS ih ili ne zna ili ih čita. Rizik: dvostruka prodaja istog komada.
   - **P (POS je master):** POS šalje zalihu i cijene Woou, a web ih samo prikazuje.
   - **N (bez integracije):** ručni uvoz/izvoz CSV-a.
   Do odluke vrijedi **N + zaštitna rezerva** (u Woou prikazuješ manje komada nego što ima, npr. broj koji Sara odredi po artiklu).
3. **Jedan izdavatelj fiskalnog računa po narudžbi** (§7).
4. **Integracija živi samo u WordPressu**, u zasebnom pluginu `cs-pos-bridge` s adapterima. Frontend, MU-plugin `cs-headless` i mock **ništa ne znaju o POS-u**.
5. **Sve ide kroz Action Scheduler** (red s ponavljanjem, ne u zahtjevu kupca): idempotentni ključ po događaju, dnevnik u `wc-logs`, e-mail Sari/Danielu pri trajnoj grešci. Pad POS-a nikad ne smije srušiti ili usporiti checkout.
6. **Autentikacija:** ulazne pozive POS-a (ako postoje) provjerava HMAC-SHA256 potpis s vremenskom oznakom i nonceom, posebni korisnik s najmanjim pravima, ograničenje broja zahtjeva. Izlazne pozive prema POS-u autorizira ključ iz `wp-config.php`. **Nikad Woo admin račun za POS.**
7. **Najmanja količina osobnih podataka:** u POS ide samo ono što knjigovodstvo traži; ne ide u logove.

### 8.4 Putevi integracije (od najjednostavnijeg)

| Razina | Opis | Kad ima smisla |
| --- | --- | --- |
| 0 | Bez integracije. Woo je master za web, POS za dućan; zaštitna rezerva, tjedni ručni usklad zalihe | početak; uvijek moguće |
| 1 | CSV / SFTP: POS izvozi artikle i zalihe, a adapter ih periodički uvozi po SKU; narudžbe izlaze CSV-om | POS ima izvoz i uvoz datoteka |
| 2 | API: adapter povlači zalihu i cijene te šalje narudžbe | POS ima dokumentirani API |
| 3 | Posrednik: aplikacija za račune s Woo dodatkom, POS samo čita | POS nema API, ali ima povezivanje s tom aplikacijom |

Sučelje adaptera (pseudokod, `wordpress/plugins/cs-pos-bridge/src/`):
```php
interface CS_POS_Adapter {
    public function id(): string;                         // 'null', 'csv', 'thor', ...
    public function pull_stock(?string $since): iterable;  // [sku => ['qty'=>int,'price'=>?string]]
    public function push_order(WC_Order $order): CS_POS_Result; // idempotentno po order ID
    public function health(): CS_POS_Health;
}
```
Prvi adapter je **`NullAdapter`** (ne radi ništa, ali potvrđuje da pozivi ne ruše trgovinu). Konkretni adapter se piše **tek kad je POS poznat** i potvrđen način povezivanja.

Kad POS ima narudžbu s weba: ako je izdavatelj računa nešto drugo, POS dobiva **nefiskalni dokument** (izlaz robe) kako bi se skinula zaliha. Ako je POS izdavatelj računa, sam fiskalizira. Nikad oba.

### 8.5 Što se radi odmah, a što se samo ostavlja otvorenim
- **Odmah (frontend):** SKU u mock fixturi i tipovima; UI za "zadnji komad", "nema na zalihi" i grešku zalihe; zaliha se nikad ne pretpostavlja statičnom.
- **Odmah (skripta za uvoz):** `data-to-woo-csv.mjs` uvijek postavlja SKU.
- **Kasnije (WP, M10):** `cs-pos-bridge` s `NullAdapter`, neaktivan.
- **Čeka odluku:** adapter za stvarni POS, odabir razine (0 do 3), master zalihe i cijene (W, P ili N), izdavatelj računa.

---

## 9. Sigurnosne kopije, nadzor, oporavak

- Hostinger dnevne kopije (uključene u paket). Trajanje čuvanja **[PROVJERI]**.
- Tjedna vanjska kopija baze i `wp-content/uploads` na udaljenu pohranu (Sarin Google Drive ili slično), šifrirana, čuvanje 8 tjedana.
- Frontend je u gitu, pa se ne kopira posebno.
- Probno vraćanje na staging jednom prije lansiranja, zatim jednom godišnje. Rezultat u `docs/restore-log.md`.
- Nadzor dostupnosti: besplatni servis (npr. UptimeRobot) na `/`, `shop.…/blagajna/` i `shop.…/wp-json/wc/store/v1/products?per_page=1`, obavijest e-mailom.
- Cilj oporavka (naš, ne ugovorni): trgovina radi unutar 1 radnog dana, gubitak najviše 24 h podataka.
- Kad je POS spojen: pregled dnevnika sinkronizacije jednom tjedno i upozorenje ako zadnja uspješna sinkronizacija starija od 24 h.

---

## 10. Uvjeti za produkciju (checklist)

- [ ] Stvarne cijene, zalihe i fotografije za sve objavljene proizvode (Sara)
- [ ] Odluka o računima i fiskalizaciji (§7) provedena i radi na probnoj narudžbi
- [ ] Odluka o razini integracije s POS-om (§8.4) i izvoru istine (§8.3) zapisana; ako razina 0, postoji dogovoren ručni proces
- [ ] Stripe live: probna stvarna narudžba i povrat novca
- [ ] GLS: probna pošiljka ili potvrđen ručni proces
- [ ] Pravni tekstovi i podaci o trgovcu objavljeni
- [ ] Svi testovi iz GUIDE.md §4 zeleni na stagingu
- [ ] Sigurnosni popis iz GUIDE.md §5 prođen i potpisan
- [ ] Probno vraćanje iz kopije uspjelo
- [ ] 2FA za sve administratore, Sarin račun s ulogom *Shop manager*
- [ ] DMARC, SPF, DKIM prolaze
- [ ] Search Console: domena potvrđena, sitemap poslan
- [ ] Daniel je odobrio lansiranje

## 11. Otvorene odluke

| # | Pitanje | Tko |
| --- | --- | --- |
| 1 | Koji su točno POS sustavi (Thor + koji drugi), koja verzija, tko ih održava | Sara |
| 2 | Podržava li POS izvoz/uvoz artikala i zaliha, API ili web shop modul (POS-PITANJA.md) | Sara + dobavljač POS-a |
| 3 | Master zalihe i cijene (W, P ili N) | Sara + Daniel |
| 4 | Aplikacija za račune i fiskalizacija web narudžbi; Fina certifikat | Sara + knjigovođa |
| 5 | Sustav PDV-a / OSS | Sara + knjigovođa |
| 6 | GLS ugovor, dodatak, cijene | Sara |
| 7 | Stvarne cijene i broj proizvoda (prototip ima 71) | Sara |
| 8 | Pravni tekstovi | Sara / pravnik |
| 9 | Stvarna adresa trgovine za kartu i podnožje | Sara |
| 10 | Provjera žiga "Camellia Sinensis" (montrealska kuća čaja) | Daniel / pravnik |
| 11 | Hoće li se uz .eu uzeti i .hr (preusmjeravanje) | Daniel + Sara |

## 12. Izvori (provjereno 2.11.2026.)

- Monri Payments, Thor: https://monri.hr/proizvodi/thor/
- Monri, Thor i elektronički računi: https://monri.hr/thor-i-elektronicki-racuni-digitalizirajte-poslovanje-uz-nove-integracije-2023/
- Algor informatika, Thor: https://algor-informatika.hr/THOR.html
- Progressive, Thor i Thor.fin: https://progressive.com.hr/?p=26496
- eposlovanje, povezivanje s Thorom: https://eposlovanje.hr/ufaqs/koristim-thor-trgovacku-blagajnu-monri-payments-d-o-o-kako-cu-se-povezati-sa-vasom-uslugom/
- Fiskalopedija, fiskalizacija webshopa: https://fiskalopedija.hr/baza-znanja/fiskalizacija-webshopa
- Fiskalopedija, WooCommerce i izdavanje računa: https://fiskalopedija.hr/baza-znanja/woocommerce-fiskalizacija-izdavanje-racuna
- eBlagajna Webshop (wordpress.org): https://bs.wordpress.org/plugins/eblagajna-webshop/
- KigoKasa za WooCommerce (readme): https://cdn.jsdelivr.net/wp/plugins/kigokasa-api-for-woocommerce/trunk/README.md
- React Router 8.5, pre-rendering (alternativa, FRONTEND-ODLUKA): https://reactrouter.com/8.5.0/how-to/pre-rendering.md
- Next.js, static exports: https://nextjs.org/docs/app/guides/static-exports
- Stripe, Create a Checkout Session: https://docs.stripe.com/api/checkout/sessions/create
- Verzije paketa: `npm view`, 2.11.2026.
