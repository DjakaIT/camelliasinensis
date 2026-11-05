# Camellia sinensis: webshop (frontend)

Next.js (App Router) kao **statični export**, dizajn B. Frontend poznaje samo ugovor `ShopBackend` (API-CONTRACT.md). Backend i blagajna (Thor) još nisu spojeni.

Dokumentacija: [STACK.md](STACK.md), [GUIDE.md](GUIDE.md), [API-CONTRACT.md](API-CONTRACT.md), [FRONTEND-ODLUKA.md](FRONTEND-ODLUKA.md), [POS-PITANJA.md](POS-PITANJA.md), [docs/stripe-test-manual.md](docs/stripe-test-manual.md), [docs/csp.md](docs/csp.md).

## Brzi početak

```bash
nvm use                       # Node 24 (.nvmrc); minimalno 22.12 zbog vitest/sanitize-html
npm install
npm --prefix mock-server install
npx playwright install chromium

npm run dev                   # http://localhost:3000, adapter demo (sve u pregledniku)
```

## Adapteri (`NEXT_PUBLIC_BACKEND`)

| Adapter | Pokretanje | Plaćanje |
| --- | --- | --- |
| `demo` | `npm run dev` ili `npm run build:demo && npm run serve` | demo blagajna `/blagajna/` (kontakt, GLS dostava, testne kartice; postoji samo u demo buildu) |
| `devserver` | `npm run dev:mock` + `npm run dev:devserver` | FAKE stranica mock-servera, ili Stripe Checkout u test načinu ako je ključ u `mock-server/.env` |

U demo buildu se zaliha može mijenjati iz konzole: `__cs.setStock('CSTB-2', 0)`, `__cs.setPrice('CSTB-2', 1350)`, `__cs.reset()`. Na devserveru isto radi `POST http://127.0.0.1:4000/__dev/stock` (vidi docs/stripe-test-manual.md).

## Skripte

| Skripta | Što radi |
| --- | --- |
| `npm run assets` | `data.js` → `fixtures/products.json` + slike (AVIF/WebP) u `public/img/`; pokreće se prije `dev`/`build` |
| `npm run build` / `build:demo` / `build:devserver` | statični export u `out/` (devserver u `out-devserver/`) |
| `npm run lint` · `typecheck` · `test` · `test:contract` | ESLint (jsx-a11y), `tsc`, unit testovi, test ugovora nad `demo` i `devserver` |
| `npm run build:e2e && npm run test:e2e` | Playwright E2E nad oba adaptera i axe |
| `npm run check:bundle [-- mapa]` · `check:prerender` | nema tajni ni `.map` u `out/`; svaka ruta ima HTML s jedinstvenim title/description/canonical |
| `npm run woo:csv` | `woo/products-import.csv` za mogući WooCommerce (bez cijena; `-- --with-example-prices` za primjere) |
| `node scripts/snap-design.mjs` · `snap-app.mjs` | snimke dizajna (`docs/design-snapshots/`) i aplikacije (`docs/screenshots/`) na 1440 i 390 px |

## Struktura

```
app/                 rute (sve prerenderirane; /proizvod/<slug>/ ×71, /katalog/<vrsta>/ ×8)
components/          React komponente (dizajn B)
content/site.ts      sadržaj koji nije u ugovoru: kontakt, pravni tekstovi (null = sakriveno)
lib/shop/            ShopBackend, tipovi, ShopError, engine; adapters/demo, adapters/devserver
lib/cart/            košarica u localStorage (cs.cart.v1), polazak na plaćanje
fixtures/            GENERIRANO iz design-reference/src/data.js (cijene su primjeri!)
mock-server/         SAMO RAZVOJ, nikad deploy (Hono + Stripe test)
scripts/             fixture, slike, Woo CSV, postbuild (CSP), provjere
tests/unit, tests/contract, tests/e2e
```

Stari Vite scaffold je u `.scaffold-backup/` (samo lokalno, u `.gitignore`).

## Uredništvo (`/urednistvo`): ponuda, katalog, izdvojeno

Sara uređuje proizvode (cijene, zalihu, opise, fotografije), vrste čaja i policu na naslovnici. Upute za nju:
[docs/urednistvo-vodic.md](docs/urednistvo-vodic.md). Model i jezgra (prijava s 2FA, pozivnice, sesije, povijest verzija,
objava preko GitHuba) preuzeti su iz Septilliona; sadržaj je `podaci/katalog.json` (oblik i pravila: `urednistvo/katalog.mjs`).
Blagajna (Thor) i web su odvojeni: cijene i zaliha weba vode se samo ovdje.

| | lokalno (`npm run urednistvo`) | hosting (Hostinger, PHP) |
| --- | --- | --- |
| pozadina | Node (`urednistvo/posluzitelj.mjs`) | PHP (`urednistvo/php/`) |
| podaci | `podaci/` u projektu (nije u gitu) | `camellia-podaci/` pokraj `public_html` (izvan javne mape) |
| objava | demo build na računalu (~1 min), stranica na `http://localhost:3300` | katalog + nove fotografije → GitHub (grana `sadrzaj`) → Actions izgradi paket → uredništvo ga postavi u `public_html` |

Lokalno: `npm run urednistvo`, pa otvori `http://localhost:3300/urednistvo` i postavi svoj račun (lozinka, QR kod, rezervni kodovi).
Build stranice koristi katalog iz uredništva samo uz `UREDNISTVO_PODACI` (to postavljaju lokalna objava i GitHub Actions);
običan `npm run build` i testovi rade s početnim katalogom iz `data.js`.

### Postavljanje na Hostingeru (jednom, Daniel)

1. **PHP**: hPanel → *Napredno → PHP konfiguracija*: PHP 8.3 ili 8.4, proširenja `gd` (s WebP), `mbstring`, `curl`, `zip`, `fileinfo`.
2. **GitHub**: repozitorij `DjakaIT/camelliasinensis` → *Settings → Secrets and variables → Actions → Variables*:
   `OBJAVA_UKLJUCENA` = `da`. Bez toga workflow `.github/workflows/objava.yml` radi samo provjere i **ništa ne objavljuje**.
3. **Prva objava (ručno)**: GitHub → *Actions* → zadnja zelena "Objava" → *Artifacts* → **hosting**. hPanel → *File Manager* →
   `public_html` → *Upload* `hosting.zip` → *Extract*. (Ili lokalno: `npm run build:demo && npm run paket`.)
4. **Prvi račun**: otvori `https://camelliasinensis.eu/urednistvo`. Kod za postavljanje je u File Manageru u
   `camellia-podaci/PRVO-POSTAVLJANJE.txt` (pokraj `public_html`). Taj račun je administrator.
5. **Veza s GitHubom**: u uredništvu ☰ → *Objava stranice*: repozitorij `DjakaIT/camelliasinensis`, grana `sadrzaj`, token.
   Token: GitHub → *Settings → Developer settings → Fine-grained tokens*: samo ovaj repozitorij, **Contents: Read and write**,
   **Actions: Read-only**, najdulji rok (prije isteka upiši novi).
6. **Cron Job**: hPanel → *Napredno → Cron Jobs*, svakih 5 minuta:
   `curl -s https://camelliasinensis.eu/urednistvo/api/osvjezi` (postavlja promjene koda s `main`; bez `> /dev/null`,
   Hostinger u običnom unosu ne voli posebne znakove). Detaljno, sa Stripeom: [docs/vodic-stripe-i-objava.md](docs/vodic-stripe-i-objava.md).
7. **Sara**: ☰ → *Korisnici* → `sara` → *Napravi pozivnicu*, poveznicu pošalji osobno.

Dok se ne odabere stvarni backend za plaćanje, workflow gradi **demo trgovinu** (`build:demo`: noindex, probna blagajna).
Nemoj uključivati `OBJAVA_UKLJUCENA` na produkcijskoj domeni dok to nije odluka.

**Napomena:** PHP pozadina nije pokrenuta na ovom računalu (nema PHP-a); jezgra je ista kao u Septillionu (gdje je testirana),
a dijelovi za katalog (`sadrzaj.php`, `spremiste.php`, rute `GET/PUT /katalog`) prate Node inačicu. Provjeri na stagingu.
