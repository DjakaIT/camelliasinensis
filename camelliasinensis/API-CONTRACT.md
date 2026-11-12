# API-CONTRACT.md — ugovor između frontenda i bilo kojeg backenda

Stanje: 2.11.2026. Ovo je dokument koji omogućuje da se **cijeli frontend izgradi bez ikakvog stvarnog backenda**, a da se backend kasnije odabere (WooCommerce ili nešto drugo) bez prepisivanja sučelja.

Pravilo: **frontend poznaje samo ovaj ugovor.** Nikad Woo, Stripe, POS ni drugi backend izravno. Svaki backend je jedna implementacija sučelja `ShopBackend` (§3).

Oznaka **[ODLUKA]** = još nema odgovora, ne pogađaj.

---

## 1. Načela

1. **Košarica je u vlasništvu frontenda**: popis redaka `{ sku, qty }` u pregledniku (`localStorage`, ključ `cs.cart.v1`, s verzijom). Backend ne zna za košaricu dok kupac ne krene na plaćanje.
2. **Cijenu uvijek određuje backend.** Klijent nikad ne šalje cijenu, iznos ni popust. Šalje se samo `sku` i `qty`. Backend ponovno čita cijenu i zalihu iz svog kataloga i **ignorira** sve ostalo.
3. **SKU je jedini ključ** koji povezuje proizvod, košaricu, narudžbu i (kasnije) blagajnu. Jedinstven je, neprazan i nikad se ne mijenja.
4. **Novac je cijeli broj u centima** (`price.amount`), valuta `EUR`. Nikad decimalni brojevi. Prikaz: `11,90 €`. Cijena je **konačna za potrošača s PDV-om** (`taxIncluded: true`). **[ODLUKA]** ovisi o Sarinom PDV statusu: do odgovora frontend prikazuje cijenu bez dodatne poruke o porezu.
5. **Frontend nikad ne prikuplja podatke o kartici ni adresu dostave.** To radi stranica za plaćanje koju backend vrati (§3.6).
6. **Zaliha nije statična.** Svaki prikaz zalihe je privremen i mora biti ponovno provjeren pri dodavanju u košaricu i pri polasku na plaćanje.
7. **Sve greške imaju isti oblik** (§5) i hrvatsku poruku za kupca.
8. **Sadržaj stranice (naslovnica, o nama, pravne stranice) nije dio ovog ugovora** dok se ne odluči gdje živi (STACK §11). Do tada je u kodu, a pravni tekstovi se ne objavljuju bez Sarinih tekstova.

---

## 2. Model podataka

```ts
type Money = { amount: number; currency: 'EUR' };   // amount u centima, cijeli broj ≥ 0

type StockStatus = 'instock' | 'low' | 'outofstock' | 'backorder';

type Stock = {
  status: StockStatus;
  quantity: number | null;       // null = backend ne otkriva broj; frontend ne smije pretpostaviti
  maxPerOrder: number;           // gornja granica po retku, backend određuje (npr. 20)
};

type Product = {
  id: string;                    // opaki ID backenda; frontend ga ne tumači
  sku: string;                   // JEDINSTVEN, neprazan, nepromjenjiv
  slug: string;                  // za URL /proizvod/<slug>/
  name: string;
  type: ProductType;             // 'bijeli' | 'zeleni' | 'oolong' | 'crni' | 'puer' | 'aroma' | 'biljni' | 'pribor'
  unitLabel: string;             // npr. "50 g", "kolač 100 g"
  price: Money;
  taxIncluded: true;
  descriptionHtml: string;       // SIROV HTML iz backenda; sanitizira se pri buildu (GUIDE §5)
  images: { src: string; alt: string; width: number; height: number }[];
  attributes: {
    origin?: string;             // npr. "Kina"
    caffeine?: 0 | 1 | 2 | 3;
    flavors: string[];           // ključevi: cvjetni, vocni, ...
    form?: 'rastresiti' | 'kolac' | 'prah' | 'pribor';
    moods: string[];             // jutro, fokus, opust, vecer, poklon
    badges: ('bio' | 'rijetko' | 'novo')[];
    brew?: { temp: string; time: string; dose: string };   // iz upute za kuhanje
  };
  stock: Stock;
  published: boolean;
  updatedAt: string;             // ISO 8601
};

type LiveInfo = { sku: string; price: Money; stock: Stock; available: boolean };   // lagana verzija za klijenta

type CartLine = { sku: string; qty: number };           // qty cijeli broj ≥ 1

type CartCheckLine =
  | { sku: string; qty: number; ok: true;  unitPrice: Money; lineTotal: Money; stock: Stock }
  | { sku: string; qty: number; ok: false; reason: 'UNKNOWN_SKU' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'UNPUBLISHED';
      availableQty: number | null; unitPrice?: Money };

type CartCheck = {
  lines: CartCheckLine[];
  subtotal: Money;               // samo zbroj redaka koji su ok; dostava i porezi se NE računaju ovdje
  priceChanged: boolean;         // true ako se neka cijena razlikuje od one koju je klijent zadnji put vidio
  checkedAt: string;
};

type CheckoutStart = { redirectUrl: string; orderToken: string };   // orderToken je neprozirni niz, vidi §3.7

type OrderStatus = {
  status: 'paid' | 'pending' | 'failed' | 'cancelled' | 'unknown';
  orderRef?: string;             // čitljiv broj za kupca, ako postoji
  email?: string;                // maskiran, npr. "m***@gmail.com"; samo ako backend dopušta
};
```

---

## 3. Sučelje `ShopBackend`

```ts
interface ShopBackend {
  // 3.1 BUILD (ne zovu se u pregledniku)
  listProducts(): Promise<Product[]>;                       // svi objavljeni, straničenje je interna stvar implementacije
  listTypes(): Promise<{ key: ProductType; name: string; description: string }[]>;

  // 3.2–3.5 KLIJENT (u pregledniku)
  getLive(skus: string[]): Promise<LiveInfo[]>;             // ≤ 50 SKU-ova, bez prijave, smije se keširati ≤ 30 s
  checkCart(lines: CartLine[]): Promise<CartCheck>;         // ne mijenja ništa na backendu
  startCheckout(lines: CartLine[], urls: { success: string; cancel: string }): Promise<CheckoutStart>;
  getOrderStatus(orderToken: string): Promise<OrderStatus>;
}
```

### 3.1 `listProducts`, `listTypes` (build)
Poziva se pri `next build` (i u dev modu). Mora vratiti **sve objavljene** proizvode. Redoslijed je stabilan (npr. po tipu pa po nazivu). Proizvod bez SKU-a, s duplikatom SKU-a ili s `price.amount ≤ 0` **ruši build** s jasnom porukom (ne preskače se tiho).

### 3.2 `getLive`
Frontend ga zove na stranici proizvoda (za jedan SKU), u košarici (za sve retke) i pri osvježavanju. Rezultat prepisuje podatke iz builda. Ako poziv ne uspije, frontend **prikazuje cijenu iz builda** s oznakom da će se cijena potvrditi pri plaćanju, a gumb "Dodaj u košaricu" ostaje omogućen.

### 3.3 `checkCart`
Poziva se: pri otvaranju košarice, pri promjeni količine i **neposredno prije** `startCheckout`. Ne rezervira zalihu. Ako je neki redak `ok:false`, frontend ne dopušta plaćanje dok kupac ne ispravi košaricu.

### 3.4 `startCheckout`
- Backend ponovno provjerava sve (kao `checkCart`) i **odbija** s greškom (§5) ako išta ne valja.
- Backend stvara narudžbu u stanju `pending` i vraća `redirectUrl` stranice za plaćanje i `orderToken`.
- Frontend sprema `orderToken` u `sessionStorage` i preusmjerava kupca na `redirectUrl`. **Košarica se ne briše** u ovom koraku.
- `urls.success` i `urls.cancel` su apsolutni URL-ovi na frontendu; backend ih smije koristiti samo ako pripadaju dopuštenom origin-u (allowlist).

### 3.5 `getOrderStatus`
Zove se na stranici `/narudzba/uspjeh/` s tokenom. **Posjet stranici nije dokaz plaćanja**: frontend prikazuje poruku "plaćanje potvrđeno" samo ako je `status === 'paid'`. Za `pending` prikazuje "Plaćanje se obrađuje" i ponovno provjerava (do 30 s, interval 3 s), a zatim daje upute kupcu. Košarica se briše **tek kad je `paid`**.

### 3.6 Stranica za plaćanje
Dolazi od backenda (hosted checkout). Frontend je ne gradi. Prikuplja adresu dostave, e-mail i podatke kartice. Frontend zna samo da je kupac otišao na `redirectUrl` i da će se vratiti na `success` ili `cancel`.

### 3.7 `orderToken`
Neprozirni, nepogodiv niz (≥ 128 bita slučajnosti), vezan uz jednu narudžbu, vrijedi najviše 24 sata. Služi samo za `getOrderStatus`. Ne sadrži podatke o kupcu.

---

## 4. Implementacije (adapteri)

| Adapter | Namjena | Kako radi | Plaćanje |
| --- | --- | --- | --- |
| `demo` | Razvoj, testovi, demo za Saru | Sve u pregledniku nad `fixtures/products.json`, bez poslužitelja. Zalihu je moguće mijenjati iz konzole (`window.__cs.setStock(sku, qty)`) samo kad `NEXT_PUBLIC_DEMO=1` | **Lažna stranica za plaćanje** na `/dev/checkout/` s jasnom oznakom da je test; nema stvarnog plaćanja |
| `devserver` | Razvoj plaćanja sa Stripe test načinom | Lokalni Node poslužitelj u `mock-server/` (§6) | **Stripe Checkout, test način** |
| `hosting` | **Produkcija na Hostingeru** (11. 11. 2026.) | Ponuda iz `fixtures/` (katalog uredništva); `getLive`/`checkCart` u pregledniku nad `zivo.json` (piše ga uredništvo pri spremanju i prodaji) istim pravilima kao `engine.ts`; `startCheckout` (s odabranom dostavom: način i ID GLS paketomata iz `/gls/paketomati.json`)/`getOrderStatus` na PHP preko javnog puta `/api/trgovina/*` (`public/.htaccess` → `urednistvo/index.php`, samo rute trgovine; stari `/urednistvo/api/trgovina/*` i dalje radi) koji sve ponovno provjerava (`urednistvo/php/lib/trgovina.php`) | **Stripe Checkout** (live ili test, prema ključu u uredništvu); webhook `/urednistvo/api/stripe/webhook` s provjerom potpisa |
| `woo` | Kad se odabere WooCommerce (STACK §5) | Store API za proizvode i `getLive`; `checkCart` i `startCheckout` preko našeg endpointa u MU-pluginu `cs-headless`, koji napuni Woo košaricu **na `shop.` strani** pa preusmjeri na Woo checkout | Woo checkout + Stripe dodatak |
| *drugi backend* | Ako se WooCommerce napusti | Nova implementacija istog sučelja. **Nije istraženo**, pa ne pretpostavljamo kako bi se mapirala | Ovisi o backendu |

Odabir adaptera: `NEXT_PUBLIC_BACKEND=demo|devserver|hosting` (`npm run build:hosting` gradi `hosting`). Nijedna komponenta ne smije pitati koji je adapter aktivan.

**Zašto košarica u pregledniku i prijenos na plaćanje, a ne Woo košarica kroz API:** frontend i backend su na različitim hostovima. Woo kolačić sesije preko poddomena traži `SameSite` i ITP pažnju (Safari na iPhoneu). Ako se Woo košarica puni tek kad kupac već stoji na `shop.` stranici (kao prva, a ne treća strana), problem nestaje. To je ujedno način koji je neovisan o Wooa.

---

## 5. Greške

```ts
type ShopError = {
  code: 'UNKNOWN_SKU' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED' | 'UNPUBLISHED'
      | 'INVALID_REQUEST' | 'CHECKOUT_UNAVAILABLE' | 'RATE_LIMITED' | 'NETWORK' | 'UNKNOWN';
  message: string;               // hrvatski, spreman za prikaz
  details?: { sku?: string; availableQty?: number | null; retryAfterSec?: number };
};
```

| Kod | Što korisnik vidi |
| --- | --- |
| `INSUFFICIENT_STOCK` | "Nažalost, od ovog artikla imamo još samo {n}." Količina u košarici se ograniči, a kupac to jasno vidi |
| `OUT_OF_STOCK` | "Ovaj artikl je upravo rasprodan." Redak je označen i ne ide na plaćanje |
| `PRICE_CHANGED` | Prikaže se nova cijena i traži potvrda prije plaćanja |
| `CHECKOUT_UNAVAILABLE` | "Plaćanje trenutno nije dostupno. Pokušajte ponovno za nekoliko minuta." |
| `RATE_LIMITED` | "Previše pokušaja, pokušajte ponovno za {n} s." |
| `NETWORK` | "Nema veze s trgovinom. Provjerite internet i pokušajte ponovno." |

Frontend nikad ne prikazuje sirove poruke backenda, stack tragove ni identifikatore.

---

## 6. Razvojni poslužitelj `mock-server/` (samo za razvoj)

**Svrha:** omogućiti da se plaćanje isproba sa stvarnim **Stripe test načinom** bez ikakvog pravog backenda. Cijena i zaliha dolaze iz `fixtures/products.json`, a narudžbe se drže u memoriji.

**Obavezna ograničenja (sigurnosna pravila):**
1. **Nikad se ne deploya.** Ni na Hostinger, ni bilo gdje. Sluša samo na `127.0.0.1`. `mock-server/` je izvan `out/` i izvan svakog deploy workflowa.
2. **Samo Stripe test ključevi.** Pri pokretanju poslužitelj **odbija startati** ako `STRIPE_SECRET_KEY` ne počinje s `sk_test_` (ili `rk_test_`); posebno odbija `sk_live_`/`rk_live_`. Ključ je u `mock-server/.env` (u `.gitignore`), nikad u kodu, nikad u frontendu, nikad u logu.
3. **Bez Stripe ključeva sve i dalje radi** s `FAKE` pružateljem plaćanja (isti kao u `demo`). Testovi i CI nikad ne trebaju Stripe ključeve.
4. **Cijena samo s poslužitelja.** Zahtjev za plaćanje prihvaća samo `{ sku, qty }`. `amount`, `priceId`, `price_data` i sve ostalo iz klijenta se ignorira. Količina se provjerava (cijeli broj, 1 do `maxPerOrder`), najviše 50 redaka, ostalo `INVALID_REQUEST`. (Opravdanje: Stripe sam ne zna što je ispravna cijena, pa ono što pošalje poslužitelj mora biti ispravno.)
5. **CORS** samo za `http://localhost:3000` i `http://127.0.0.1:3000` (konfigurabilno), nikad `*`.
6. **Webhook** potpis se uvijek provjerava (`STRIPE_WEBHOOK_SECRET`). Odgovor je 400 za krivi potpis. Obrada je **idempotentna** po ID-u događaja.
7. **`/__dev/*` endpointi** (promjena zalihe, reset) rade samo kad `NODE_ENV !== 'production'`.
8. Poslužitelj ne sprema podatke o kartici ni adresi; vidi samo ono što Stripe vrati u sesiji, i to ne zapisuje u log.

**Stripe pozivi (hosted Checkout, API prema službenoj dokumentaciji 2.11.2026.):**
- `POST /v1/checkout/sessions` s `mode: 'payment'`, `ui_mode: 'hosted_page'` (zadano), `line_items` iz `price_data` (valuta `eur`, `unit_amount` u centima, `product_data.name` = naziv proizvoda), `locale: 'hr'`, `client_reference_id` = interni ID narudžbe, `metadata` (npr. `orderId`, popis SKU-ova), `shipping_address_collection.allowed_countries` i `shipping_options` s **jednom testnom stavkom** označenom kao primjer, `success_url` s našim `orderToken`-om (ne s ID-jem Stripe sesije) i `cancel_url`.
- Dostava i države su **primjeri za test**; stvarne vrijednosti ovise o GLS ugovoru **[ODLUKA]**.
- Status narudžbe: webhook `checkout.session.completed` (i, ako se uvedu odgođene metode, `checkout.session.async_payment_succeeded` / `…_failed`) označava narudžbu plaćenom i **jednom** umanjuje zalihu u memoriji. `getOrderStatus` dodatno provjerava stanje sesije na Stripeu (server prema serveru).
- Lokalni webhooks: `stripe listen --forward-to localhost:4000/webhooks/stripe` (Stripe CLI, instalira Daniel). `whsec_` koji ispiše je `STRIPE_WEBHOOK_SECRET`.
- Test kartice (Stripe test dokumentacija, **[PROVJERI]** prije upotrebe): `4242 4242 4242 4242` uspjeh; `4000 0000 0000 0002` odbijena; `4000 0027 6000 3184` traži 3D Secure. Bilo koji budući datum isteka i bilo koji CVC.

**Endpointi (oblik, model odlučuje točan):** `GET /live?skus=…`, `POST /cart/check`, `POST /checkout/start`, `GET /orders/:token`, `POST /webhooks/stripe`, `POST /__dev/stock`, `POST /__dev/reset`.

**Što ovo NE dokazuje:** ne dokazuje da će produkcijska arhitektura raditi (Woo checkout, fiskalizacija, GLS, POS, Stripe dodatak za Woo). To su zasebne provjere kad se backend odabere (§8).

---

## 7. Ispitivanje ugovora

1. **Test ugovora** (`tests/contract/`): isti skup testova se izvodi nad **svakim** adapterom (`demo`, `devserver`, kasnije `woo`). Pokriva: nepoznat SKU, količina 0, −1, 9999, nepodnošljiva zaliha, promjena cijene, `startCheckout` s ispravnom i neispravnom košaricom, `getOrderStatus` za nepoznat token. Kad se doda novi adapter, mora proći isti skup.
2. **Provjera "klijent ne diktira cijenu"**: zahtjev s dodatnim poljem `amount: 1` ne smije promijeniti ukupni iznos.
3. **E2E** (Playwright) nad `demo` i `devserver` s `FAKE` plaćanjem: dodaj, promijeni, ukloni, osvježi stranicu, promijeni zalihu tijekom sesije, otkaži plaćanje (košarica ostaje), uspješno plaćanje (košarica se briše tek nakon `paid`).
4. **Ručni test sa Stripeom** (Daniel, lokalno): vidi `docs/stripe-test-manual.md` (model ga napiše): uspjeh, odbijena kartica, 3D Secure, otkazivanje, kasni webhook.

---

## 8. Što se mora ponovno provjeriti kad se odabere backend

| Što | Zašto |
| --- | --- |
| Adapter prolazi test ugovora (§7) | Dokaz da je zamjenjiv |
| `startCheckout` na stvarnom backendu | Porezi, dostava, fiskalizacija i račun su računi backenda, ne frontenda |
| Kolačići i preusmjeravanje na iPhone Safariju | ITP, SameSite |
| Latencija `getLive`/`checkCart` | Dijeljeni hosting može biti sporiji od mocka; cilj < 1 s |
| Stripe webhook i status narudžbe na stvarnoj konfiguraciji | Idempotentnost i kašnjenja |
| Zaliha uz POS (STACK §8) | Dvostruka prodaja zadnjeg komada |
| Nedostaje u mocku | Računi i fiskalizacija (STACK §7), e-mailovi, povrati, rezervacija zalihe, kuponi |
