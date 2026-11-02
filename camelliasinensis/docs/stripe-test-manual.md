# Ručni test plaćanja sa Stripeom (test način)

Za: Daniela. Lokalno, na vlastitom računalu. Nije dio CI-ja (GUIDE §8.7).

Ovaj test provjerava stvarni Stripe hosted Checkout u **test načinu** preko lokalnog `mock-server/`. Kartice se ne naplaćuju. Bez ključeva sve i dalje radi s FAKE plaćanjem (tako rade i automatski testovi).

## Sigurnosna pravila prije početka

- Koristi **samo test ključeve** (`sk_test_…` ili `rk_test_…`). Mock-server odbija start s `sk_live_`/`rk_live_` i s bilo kojim drugim ključem.
- Ključeve upisuj **samo** u `mock-server/.env`. Ta datoteka je u `.gitignore`. Ne lijepi ih u kod, chat, issue ni commit.
- Mock-server sluša samo na `127.0.0.1` i nikad se ne deploya.
- Mock-server ne zapisuje e-mail, adresu ni podatke o kartici. U logu su samo putanje, statusi i interni ID narudžbe.

## 1. Jednokratna priprema

1. **Stripe račun u test načinu.** U Stripe Dashboardu uključi *Test mode*. Zatim *Developers → API keys* i kopiraj *Secret key* (`sk_test_…`). Umjesto njega možeš napraviti *restricted key* (`rk_test_…`) s pravom **Write** za *Checkout Sessions*.
2. **Stripe CLI.** Instaliraj ga prema službenim uputama (<https://docs.stripe.com/stripe-cli>) i prijavi se naredbom `stripe login`.
3. **Ovisnosti** (u korijenu projekta):
   ```bash
   npm install
   npm --prefix mock-server install
   npx playwright install chromium   # samo za automatske testove
   ```
4. **`.env` za mock-server:**
   ```bash
   cp mock-server/.env.example mock-server/.env
   ```
   U `mock-server/.env` upiši `STRIPE_SECRET_KEY=sk_test_…`. `STRIPE_WEBHOOK_SECRET` dolazi u koraku 2.2.

## 2. Pokretanje (tri terminala)

**2.1 Webhookovi (terminal A)**
```bash
stripe listen --forward-to 127.0.0.1:4000/webhooks/stripe \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
```
Naredba ispiše `Your webhook signing secret is whsec_…`.

**2.2** Upiši tu vrijednost u `mock-server/.env` kao `STRIPE_WEBHOOK_SECRET=whsec_…`. Vrijedi dok ne prekineš `stripe listen`. Novi `stripe listen` može dati novu tajnu, pa je tada ponovno upiši.

**2.3 Mock-server (terminal B)**
```bash
npm run dev:mock
```
Očekivano: `[mock-server] http://127.0.0.1:4000 · plaćanje: Stripe TEST · webhook: uključen · CORS: http://localhost:3000, http://127.0.0.1:3000`.
Ako piše `FAKE (bez ključeva)`, ključ nije učitan. Ako se poslužitelj ugasi s porukom "Odbijeno", ključ nije test ključ.

**2.4 Frontend (terminal C).** Odaberi jedno:
- brže, razvojni način: `npm run dev:devserver`, pa otvori <http://localhost:3000>;
- kao produkcija (statični export): `npm run build:devserver` (koristi već pokrenuti mock-server), zatim `npm run serve:devserver`, pa otvori <http://127.0.0.1:3000>.

## 3. Testni slučajevi

Test kartice su iz Stripeove dokumentacije za testiranje (<https://docs.stripe.com/testing>). **[PROVJERI]** da su i dalje iste. Za sve kartice vrijedi bilo koji budući datum isteka, bilo koji CVC i bilo koje ime. Adresa dostave može biti izmišljena hrvatska adresa.

Prije svakog slučaja: dodaj 1 do 2 proizvoda u košaricu, otvori košaricu i klikni **Na blagajnu**.

| # | Slučaj | Koraci | Očekivano |
| --- | --- | --- | --- |
| 1 | **Uspjeh** | Kartica `4242 4242 4242 4242`, pa *Plati* | Stripe stranica je na hrvatskom. Ima jednu opciju dostave "Dostava (TESTNI PRIMJER, nije stvarna cijena)". Nakon plaćanja ide povratak na `/narudzba/uspjeh/?narudzba=…`, kratko piše "Plaćanje se obrađuje", pa "Hvala na narudžbi!" s brojem `TEST-000n`. Košarica je prazna. U terminalu A je `checkout.session.completed` s `[200]`. Zaliha je umanjena: `curl "http://127.0.0.1:4000/live?skus=CSTB-2"` pokazuje manji `quantity`. |
| 2 | **Odbijena kartica** | Kartica `4000 0000 0000 0002` | Stripe na svojoj stranici prikaže da je kartica odbijena. Nema preusmjeravanja i ništa nije naplaćeno. Pokušaj zatim s `4242…` (slučaj 1) ili klikni strelicu natrag (slučaj 4). |
| 3 | **3D Secure** | Kartica `4000 0027 6000 3184` | Otvori se testni prozor za autentifikaciju. *Complete*: isto kao slučaj 1. *Fail*: Stripe prikaže grešku i ostaje na stranici za plaćanje. |
| 4 | **Otkazivanje** | Na Stripe stranici klikni strelicu natrag / naziv trgovine | Povratak na `/kosarica/?otkazano=1`. Piše "Plaćanje je otkazano. Ništa nije naplaćeno…", a košarica je **netaknuta**. Narudžba ostaje `pending`; Stripe sesija ističe sama (`checkout.session.expired` → `cancelled`). |
| 5 | **Kasni webhook** | Prekini `stripe listen` (Ctrl+C) u terminalu A. Plati s `4242…` | Stranica uspjeha ipak dođe do "Hvala na narudžbi!": `getOrderStatus` pita Stripe izravno (server prema serveru) i vidi da je sesija plaćena. Zatim ponovno pokreni `stripe listen` (provjeri je li `whsec_` isti) i pošalji događaj: `stripe events resend <evt_id>` (ID je u Dashboardu → Developers → Events). Odgovor je `200 {"received":true}` ili `{"duplicate":true}`. **Zaliha se ne umanjuje drugi put.** |
| 6 | **Ponovljeni webhook** | Nakon slučaja 1: `stripe events resend <evt_id>` | `200 {"received":true,"duplicate":true}`; zaliha se ne mijenja. |
| 7 | **Krivi potpis** | `curl -i -X POST http://127.0.0.1:4000/webhooks/stripe -H "stripe-signature: t=1,v1=krivo" -d "{}"` | `400`. |
| 8 | **Klijent ne diktira cijenu** | `curl -s -X POST http://127.0.0.1:4000/checkout/start -H "content-type: application/json" -d "{\"lines\":[{\"sku\":\"CSTB-2\",\"qty\":1,\"amount\":1,\"price_data\":{\"unit_amount\":1}}],\"urls\":{\"success\":\"http://localhost:3000/narudzba/uspjeh/\",\"cancel\":\"http://localhost:3000/kosarica/?otkazano=1\"}}"` pa otvori vraćeni `redirectUrl` | Na Stripe stranici je **11,90 €**, ne 0,01 €. |
| 9 | **Zaliha se mijenja tijekom kupnje** | Dodaj proizvod u košaricu, pa `curl -X POST http://127.0.0.1:4000/__dev/stock -H "content-type: application/json" -d "{\"sku\":\"CSTB-2\",\"qty\":0}"`. Otvori košaricu | Redak je označen "Ovaj artikl je upravo rasprodan.", a *Na blagajnu* je onemogućen. |

Nakon testova: `curl -X POST http://127.0.0.1:4000/__dev/reset` vraća zalihu i cijene iz fixture i briše narudžbe iz memorije.

## 4. Što javiti natrag

Za svaki slučaj: prošao / nije prošao. Ako nije, priloži snimku zaslona i ispis iz terminala B. Ispis je bez osobnih podataka, ali ga svejedno pregledaj prije slanja.

## 5. Što ovaj test NE dokazuje

- Da će raditi produkcijski backend (Woo checkout ili drugi), fiskalizacija, računi, GLS i e-mailovi (API-CONTRACT §8).
- Ponašanje uz Thor blagajnu (POS). Dvostruka prodaja zadnjeg komada ovdje se ne može dogoditi jer mock drži zalihu u memoriji.
- Stvarne cijene dostave i države isporuke ([ODLUKA], GLS ugovor), PDV ([ODLUKA]) ni stvarne cijene proizvoda: u fixturi su primjeri iz prototipa.
- Apple Pay / Google Pay. Stripe ih u Checkoutu prikazuje ovisno o uređaju, pregledniku i postavkama računa.
