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
| `demo` | `npm run dev` ili `npm run build:demo && npm run serve` | lažna stranica `/dev/checkout/` (postoji samo u demo buildu) |
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
