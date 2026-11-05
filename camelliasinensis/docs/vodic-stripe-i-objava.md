# Stripe i objava stranice: vodič korak po korak

Stanje: 3. 11. 2026. Podaci o Stripeu, Hostingeru i fiskalizaciji provjereni su taj dan na službenim stranicama (izvori su na dnu).
Stripe i Hostinger povremeno mijenjaju nazive gumba. Ako neki naziv nije isti, traži najsličniji.

- **Dio A (Stripe):** dijelove A2–A6 radi Sara, uz Daniela.
- **Dio B (objava na Hostinger):** radi Daniel.
- **Dio C:** popis svega što treba za pravu prodaju.

---

## Kratki odgovor: kad dobivamo ključeve?

| Što | Kada |
| --- | --- |
| Testni (sandbox) ključevi | Odmah po otvaranju računa. |
| Live ključevi | Stripe ih stvara već pri otvaranju računa, ali za pravi novac račun mora biti aktiviran. Live način se u Dashboardu obično otvori tek kad Sara pošalje obrazac za aktivaciju. |
| Prave uplate | Čim Stripe uključi plaćanja nakon provjere. To može biti odmah ili za nekoliko dana, Stripe ne daje točan rok. |
| Prva isplata na IBAN | 7–14 dana nakon prve uplate kupca. Poslije ide po rasporedu isplata. |

**Zaključak: ne čekamo.** Sara otvori račun i pošalje aktivaciju, a backend se u međuvremenu radi i testira na testnom ključu. Live ključ Daniel napravi kad je backend spreman i račun aktivan. Za to Saru ne treba zvati (vidi A7).

---

## Dio A: Stripe

### A1. Odluke prije početka

| Odluka | Prijedlog |
| --- | --- |
| Vlasnik računa | Sara, odnosno njezin obrt ili tvrtka. Stripe primaju samo poslovni subjekti, uključujući obrte. |
| Email za prijavu | `info@camelliasinensis.eu`. Stripeovi mailovi (zahtjevi za dokumentima, prigovori kupaca) tako stižu i Danielu. |
| Dvostruka potvrda (2FA) | Na Sarin mobitel. |
| Daniel | Član tima s ulogom **Developer**: sam radi ključeve, webhook, postavke plaćanja, povrate i prigovore. Ne može mijenjati bankovni račun, raspored isplata ni članove tima. Administrator nije potreban. |
| Ključ za stranicu | Ograničeni ključ `rk_live_…`. Napravi ga Daniel (A9). |

### A2. Priprema (Sara, prije poziva)

- [ ] Računalo i mobitel.
- [ ] Na mobitelu **Google Authenticator** ili **Microsoft Authenticator**. Ista aplikacija služi i za uredništvo.
- [ ] Važeća **osobna iskaznica** ili **putovnica**.
- [ ] Podaci obrta ili tvrtke, **točno kako pišu u registru**:
  - naziv i adresa sjedišta;
  - OIB;
  - MBO (obrt) ili MBS (d.o.o.);
  - PDV broj (`HR` + OIB), samo ako je u sustavu PDV-a.
- [ ] **IBAN poslovnog računa** koji glasi na obrt ili tvrtku, ne osobni račun.
- [ ] Kontakt za kupce (smije biti javan): email, telefon, adresa trgovine.
- [ ] Za d.o.o.: ime, datum rođenja i kućna adresa svakog vlasnika s više od 25 % i direktora.
- [ ] Za svaki slučaj, kao PDF ili fotografija:
  - izvadak iz obrtnog ili sudskog registra;
  - račun za režije ili izvod banke s adresom, ne stariji od 3 mjeseca;
  - potvrda banke s IBAN-om.
- [ ] **Nije sigurna je li obrt ili d.o.o., ili je li u sustavu PDV-a? Pita knjigovođu prije početka.** Nakon aktivacije se zemlja poslovanja ne može promijeniti, a vrsta poslovanja mijenja se samo preko Stripeove podrške.

### A3. Otvaranje računa

1. Otvori **https://dashboard.stripe.com/register** (ili stripe.com → **Start now**).
2. Upiši:
   - email `info@camelliasinensis.eu`;
   - ime i prezime;
   - za državu **Croatia**;
   - novu, dugu lozinku koja se ne koristi nigdje drugdje.
3. Klikni **Create account**.
4. Stripe pošalje mail na `info@`. Klikni **Verify email address**.
   - **Ako mail ne stigne:** pogledaj Spam, u Stripeu klikni **Resend**, i provjeri je li `info@` sanduče stvarno napravljeno u Hostingeru (B5).
5. Ako Stripe pita što želiš koristiti, odaberi primanje plaćanja na webu (Payments ili Online payments). Možeš i kliknuti **Skip**, ništa od toga ne obvezuje.
6. Oznaka **Sandbox** ili **Test mode** na vrhu znači probni način. Ne smeta.

**Ako Sara već ima Stripe račun:**
- Ako je za nešto drugo, nemoj otvarati novu prijavu. Klikni naziv računa gore lijevo → **New account** (ili **Create account**) i nastavi od A4.
- Ako je to stari račun istog obrta, može se koristiti. Javi Danielu prije bilo kakve promjene.

### A4. Zaštita računa (obavezno)

1. Otvori ikonu profila → **Personal details** / user settings (https://dashboard.stripe.com/settings/user) → **Two-step authentication**.
2. Odaberi način:
   - **Passkey** ili sigurnosni ključ: Stripe ih preporučuje, jer su otporni na lažne stranice;
   - **Authenticator app:** u redu;
   - **SMS:** samo ako ništa drugo ne ide (Stripe ga smatra najslabijim).
3. Stripe prikaže **backup code**. **Zapiši ga na papir** i spremi odvojeno od mobitela.

**Ako se izgubi mobitel**, prijava ide s backup codeom. Bez njega oporavak preko Stripeove podrške traje danima.

### A5. Aktivacija (Verify your business)

Na početnoj stranici klikni **Activate payments**, **Verify your business** ili **Complete your account** (izravna poveznica: https://dashboard.stripe.com/account/onboarding).

**1. Vrsta poslovanja** (*Type of business*)
- Lokacija: **Croatia**.
- **Obrt:** opcija za samostalnog poduzetnika (**Individual** / **Sole proprietorship**).
- **d.o.o. ili j.d.o.o.:** **Company** → **Private company** (ili **Limited liability company**).

**2. Podaci o poslovanju** (*Business details*)
- Službeni naziv: točno iz registra.
- **Registration number:** MBO (obrt) ili MBS (d.o.o.). Ako traži porezni broj (*Tax ID*), upiši **OIB**.
- **VAT number:** `HR` + OIB, samo ako je u sustavu PDV-a. Inače ostavi prazno ili označi da nije registrirana.
- Adresa sjedišta i poslovni telefon.
- **Industry:** maloprodaja hrane ili pića (Retail / Food & drink, npr. Grocery ili Specialty food). Ako točno toga nema, odaberi najsličnije. **Ne birati Digital goods.**
- **Website:** `https://camelliasinensis.eu`.
- **Opis proizvoda**, ako ga traži: "Prodajemo čaj, pribor za pripremu čaja i knjige o čaju u trgovini u Zagrebu i preko web trgovine. Kupci plaćaju na webu, a robu šaljemo GLS-om po Hrvatskoj."

**3. Osobni podaci** (*Representative*)
- Ime i prezime točno kao na osobnoj, datum rođenja, **kućna** adresa, mobitel i email.
- **Title:** Owner (vlasnica) ili Director (direktorica).
- Ako traži osobni porezni broj, upiši njezin OIB.
- **d.o.o.:**
  - kod **Owners** upiši svakoga s više od 25 %;
  - kod **Directors** upiši direktore iz izvatka;
  - ako je Sara jedina vlasnica i direktorica, označi oboje (*I own 25% or more*, *I am a director*).

**4. Provjera identiteta**
1. Stripe traži sliku osobne (prednja i stražnja strana) ili putovnice, a ponekad i selfie.
2. Na računalu odaberi **Continue on phone**, skeniraj QR kod mobitelom i slikaj.
3. Za dobru sliku:
   - dnevno svjetlo, bez bljeskalice i odsjaja;
   - sva četiri kuta dokumenta vidljiva;
   - slika oštra;
   - dokument važeći.

**Ako Stripe odbije sliku**, ponovi. Ako opet ne prođe, pokušaj s putovnicom.

**5. Račun za isplate**
- IBAN poslovnog računa (`HR` + 19 znamenki). Vlasnik računa je naziv obrta ili tvrtke. Valuta **EUR**.
- Ako traži potvrdu, priloži potvrdu ili izvod banke na kojem se vide IBAN i naziv.

**6. Podaci koje vide kupci** (*Public details*). Mogu se mijenjati i poslije, u postavkama računa.
- **Statement descriptor** (tekst na izvodu kartice kupca): `CAMELLIA SINENSIS`. Pravila Stripea:
  - samo latinična slova;
  - 5–22 znaka;
  - barem jedno slovo;
  - bez znakova `< > \ ' " *`.
- **Shortened descriptor**, ako traži: `CAMELLIA` (2–10 znakova).
- **Support email, telefon i adresa:** kontakt trgovine.
- **Website:** `https://camelliasinensis.eu`.

**7. Dodaci** (Stripe Tax, Climate i sl.): **Skip** ili **Not now**.

**8. Pregled:** provjeri sve podatke, pa klikni **Agree and submit** (ili **Submit**).

### A6. Nakon slanja: moguća stanja

| Stanje | Što napraviti |
| --- | --- |
| Plaćanja uključena (*Payments enabled*, račun aktivan) | Gotovo. Ide A7. |
| *Under review* / *Pending* | Čekati, Stripe se javlja mailom na `info@`. |
| *Action required* / *Information needed* | Klikni i pošalji što traže. Najčešće je to dokument s adresom (ne stariji od 3 mjeseca), izvadak iz registra ili nova slika osobne. Daniel vidi zahtjev u mailu i Sari pošalje jednu konkretnu poruku. |
| Isplate pauzirane | Normalno dok provjera ne završi. Prva isplata stiže 7–14 dana nakon prve uplate. |
| Stripe pita nešto o web stranici | Odgovara Daniel. |
| Račun odbijen (rijetko za čaj) | Odgovoriti Stripeovoj podršci. **Ne otvarati novi račun na silu.** |

**Lažni mailovi:** Stripe nikad ne traži lozinku ni ključeve, a prave stranice su samo na domeni `stripe.com`. U Dashboard se ulazi upisivanjem `dashboard.stripe.com`, ne preko poveznice iz sumnjivog maila.

### A7. Daniel u tim (Sara, 2 minute, na kraju poziva)

1. **Sara:** **Settings** (zupčanik) → **Team and security** → **Team** → **Add member** (ili **+ New member**).
2. **Sara:** upiše Danielov email, odabere ulogu **Developer** i klikne **Send invite**.
3. **Daniel:** odmah prihvati pozivnicu iz maila i postavi svoju prijavu s 2FA.
4. **Daniel, dok je Sara još u pozivu:** provjeri da vidi stranicu **API keys** (https://dashboard.stripe.com/apikeys) i gumb **Create restricted key**.

**Što Developer može** (prema Stripeovoj službenoj tablici uloga):
- stvarati i brisati API ključeve;
- gledati događaje i zapise;
- rješavati prigovore (*disputes*);
- raditi povrate novca;
- mijenjati kontakt podatke i gotovo sve postavke plaćanja.

**Što Developer ne može:**
- mijenjati bankovni račun;
- mijenjati raspored isplata;
- dodavati članove tima.

**Kad suradnja završi:** Sara ide u Team → Daniel → **Remove**. Daniel prije toga zamijeni ključ (**Rotate key**, A9).

### A8. Postavke (Daniel ili Sara, jednom)

- **Branding** (Settings → Branding): da stranica za plaćanje izgleda kao naša, a ne Stripeova plavo-ljubičasta.
  - ikona: logo trgovine kao PNG 512 × 512;
  - pozadina / *brand color*: `#f6f0e4`;
  - gumbi / *accent color*: `#3b432e`.
- **Payment methods:** ostavi zadano (kartice, Apple Pay, Google Pay). Ne uključuj odgođeno plaćanje ni bankovne prijenose bez dogovora, jer za njih vrijede drukčija pravila o računima.
- **Customer emails** (Stripeove potvrde kupcu): po želji. **Stripeova potvrda nije fiskalni račun** (vidi C).
- **Payouts:** zadani raspored je u redu. IBAN mijenja samo Sara.

### A9. Ključ za stranicu (Daniel, kad backend bude spreman)

Stripe preporučuje ograničeni ključ umjesto punog tajnog. Prvo se napravi i isproba u sandboxu, zatim isti takav u live načinu.

1. Na https://dashboard.stripe.com/apikeys prebaci na **live** način.
2. Klikni **Create restricted key** i odaberi da kreneš od nula dozvola.
3. **Key name:** `camelliasinensis.eu web`.
4. Dozvole (zadano je sve **None**):
   - **Checkout Sessions:** Write. Stranica pravi i provjerava plaćanje.
   - **Webhook Endpoints:** Write. Stranica sama napravi webhook.
   - Ako Stripe pri testu javi da nedostaje dozvola za cijene ili dostavu: **Products**, **Prices** i **Shipping Rates** na Write.
   - Konačan popis bit će potvrđen testom u sandboxu prije izrade live ključa.
5. Klikni **Create key** i potvrdi kodom iz 2FA.
6. Klikni vrijednost ključa da je kopiraš. **Ključ se prikazuje samo jednom.**
7. U polje **Add a note** upiši gdje je ključ spremljen (npr. "uredništvo, camellia-podaci na Hostingeru") i klikni **Done**.
8. Ključ odmah upiši u uredništvo (☰ → Plaćanje, dolazi s backendom). Na hostingu se sprema izvan `public_html`.
   - **Ne ide** u git, na GitHub, u mail ni u chat.
9. **Webhook:** stranica ga pri spremanju ključa napravi sama. Ako ga ipak treba napraviti ručno:
   1. Workbench → **Webhooks** → **Create an event destination** → **Your account** → format **Snapshot**.
   2. Događaji: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` i `checkout.session.expired`.
   3. **Continue** → **Webhook endpoint** → upiši adresu (dolazi s backendom).
   4. **Reveal secret** → kopiraj `whsec_…` i upiši u uredništvo.

**Ako zatreba druga dozvola:** API keys → ⋯ kod ključa → **Edit key**. Ključ ostaje isti, i za to ne treba Sara.

**Ako se ključ izgubi ili procuri:** API keys → ⋯ → **Rotate key**. Stari ključ može raditi do 7 dana dok se novi ne upiše. Pregled zahtjeva po ključu: ⋯ → **View request logs**.

### A10. Ako Sara ipak sama radi ključ (bez Daniela u timu)

Isti koraci kao u A9, ali na Sarinom ekranu, i **uživo** ključ odmah zalijepite u uredništvo. Ne šalje se WhatsAppom, mailom ni porukom, jer Stripe izričito savjetuje da se ključevi ne dijele nešifriranim kanalima.

Mana ovog puta: svaka promjena dozvola, novi ključ ili ručni webhook opet traže Saru. Zato je preporuka A7.

### A11. Svakodnevni rad

- **Povrat novca:**
  1. Dashboard → **Payments** → odaberi plaćanje → **Refund**.
  2. Naknada Stripea se ne vraća.
  3. Za povrat treba i storno računa (dogovor s knjigovođom).
- **Prigovor kupca** (*dispute*, kupac osporava uplatu kod banke):
  1. Stripe javi mailom na `info@`, a odgovor ima rok.
  2. Dashboard → **Disputes** → pošalji dokaze: račun, potvrdu slanja GLS-om, prepisku s kupcem.
- **Isplate:** Dashboard → **Balances** / **Payouts**. Ondje piše procijenjeni datum isplate.

### A12. Naknade (stripe.com/hr/pricing, 3. 11. 2026.)

| Kartica | Naknada po uspješnoj uplati |
| --- | --- |
| Standardne kartice iz EGP-a | 1,5 % + 0,25 € |
| Premium kartice iz EGP-a | 2,8 % + 0,25 € |
| Kartice iz UK-a | 2,5 % + 0,25 € |
| Međunarodne kartice | 3,15 % + 0,25 € |
| Konverzija valute | + 2 % |

Nema mjesečne naknade ni naknade za otvaranje i zatvaranje računa.

---

## Dio B: objava stranice na Hostinger

### B0. Kako sustav radi

- **Kod:** `main` na GitHubu → Actions "Objava" izgradi paket **hosting** → uredništvo na Hostingeru ga preuzme i postavi u `public_html`.
- **Sadržaj (ponuda, vrste čaja, polica):** Sara spremi u uredništvu → katalog ide na granu `sadrzaj` → Actions izgradi paket → uredništvo ga odmah postavi.
- **Promjene koda:** Cron svakih 5 minuta pita uredništvo ima li novi paket s `main`.
- **Podaci uredništva** (korisnici, katalog, fotografije, ključ za Stripe) su u `camellia-podaci/`, **pokraj** `public_html`. Objava ih nikad ne dira.
- Dok nema backenda za plaćanje, gradi se **demo trgovina**: ne pojavljuje se na Googleu, blagajna je probna, a u podnožju piše "Demo trgovina".

### B1. Potvrda domene (Sara, do 14. 11. 2026.)

1. Sara u Gmailu (`tepsasarah9@…`) otvori mail od Hostingera o potvrdi domene camelliasinensis.eu i klikne poveznicu. Neka pogleda i Spam i Promocije.
2. U hPanelu → Domains → camelliasinensis.eu: ako maila nema, klikni **Resend email**, a nakon klika **Check status**.
3. Bez potvrde se .eu domena gasi. Nameservere (`atlas` / `hyperion.dns-parking.com`) ne diraj, to su Hostingerovi.

### B2. Je li to hosting s PHP-om?

hPanel → **Websites** → camelliasinensis.eu → **Dashboard**.
- U izborniku moraju postojati **File Manager** i **PHP Configuration** (može se naći i tražilicom u izborniku).
- Ako se otvara uređivač Website Buildera, to nije dovoljno: Hostinger kaže da PHP postavke ne vrijede za Website Builder. Treba paket Web Hosting (Premium ili Business).

### B3. SSL

1. hPanel → **Websites** → **Install SSL** (ili **Security** → **SSL**).
   - Ako gumba nema, certifikat je vjerojatno već instaliran.
   - Domena mora pokazivati na Hostinger (jest, nameserveri su njihovi).
2. Pričekaj da piše **Active**. Pokrivene su adrese s `www` i bez njega.
3. **Force HTTPS** može ostati uključen. Naš `.htaccess` ionako preusmjerava na `https://camelliasinensis.eu`.
4. **Bez aktivnog SSL-a stranica ne radi:** preusmjeravanje vodi na https koji još ne postoji.

### B4. PHP

1. Websites → Dashboard → **PHP Configuration**. Prvo **PHP version**: **8.3** (najmanje 8.1).
2. Zatim kartica **PHP extensions**:
   - `gd` (s WebP-om);
   - `mbstring`;
   - `zip`;
   - `json`;
   - `fileinfo`;
   - `curl`.
3. Klikni **Save** na dnu.
   - Popis ekstenzija ovisi o verziji PHP-a, zato se verzija mijenja prva.

**Ako nešto nedostaje**, `/urednistvo` sam ispiše poruku s točnim popisom ("Sada: PHP …, nedostaje: …").

### B5. Poslovni email

hPanel → **Emails** → **Claim** / **Create** → `info@camelliasinensis.eu`.
- Koristi se za Stripe (A3), kontakt kupaca i potvrde narudžbi.
- Lozinku i pristup ima Daniel. Ako i Sara želi čitati poštu, dobije svoju prijavu.

### B6. GitHub

1. **Repozitorij** `DjakaIT/camelliasinensis` → **Settings** → **General** → visibility **Private** (preporuka). Ključevi ionako nisu u repozitoriju.
2. **Settings** → **Secrets and variables** → **Actions** → kartica **Variables** → **New repository variable**: ime `OBJAVA_UKLJUCENA`, vrijednost `da`.
   - Bez nje workflow radi samo provjere i ništa ne objavljuje.
3. **Kod u `main`:**
   ```
   cd C:\Users\Daniel\Desktop\Code\CamelliaSinensis
   git checkout main
   git merge --ff-only feat/frontend
   git push origin main
   ```
4. **Actions** → pokretanje "Objava koda …" → oba posla moraju biti zelena (provjere oko 5 minuta, objava oko 3–5 minuta).
   - **Ako je crveno:** otvori korak koji je pao i pošalji log.
5. **Za ručno pokretanje bez novog koda:** Actions → **Objava** → **Run workflow**.

### B7. Prvi upload (samo prvi put ručno)

1. Actions → zadnje zeleno pokretanje "Objava" → dolje **Artifacts** → **hosting**. Preuzme se zip.
   - **Alternativa lokalno:** `npm run build:demo` pa `npm run paket` → `camelliasinensis/hosting.zip`.
2. hPanel → **File Manager** → `public_html`: obriši Hostingerovu početnu datoteku (`default.php` ili `index.html`).
3. **Upload** zipa → desni klik → **Extract** u **trenutnu** mapu (`public_html`).
4. Provjeri:
   - u `public_html` su izravno `index.html`, `.htaccess`, `_next/`, `urednistvo/`;
   - u postavkama File Managera uključi prikaz skrivenih datoteka da vidiš `.htaccess`;
   - sve nije završilo u podmapi.
5. Obriši zip iz `public_html`.

Poslije prve instalacije **ne uploadaj ručno**: uredništvo samo postavlja nove pakete i prepisalo bi ručne promjene.

### B8. Prvi račun u uredništvu (Daniel)

1. Otvori `https://camelliasinensis.eu/urednistvo`. Traži kod za postavljanje.
2. U File Manageru idi **jednu mapu iznad** `public_html` (`domains/camelliasinensis.eu/`) → `camellia-podaci/PRVO-POSTAVLJANJE.txt`. Kopiraj kod.
3. Postavi korisničko ime, lozinku (barem 12 znakova), 2FA i spremi rezervne kodove. Taj račun je administrator.

### B9. Veza s GitHubom

1. GitHub → tvoj profil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
   - **Expiration:** najdulji rok koji GitHub nudi. **Datum isteka zapiši u kalendar**, jer kad token istekne, objava staje.
   - **Repository access:** *Only select repositories* → `camelliasinensis`.
   - **Permissions** → Repository:
     - **Contents:** Read and write (spremanje kataloga na granu `sadrzaj` i pokretanje objave);
     - **Actions:** Read-only (preuzimanje paketa);
     - *Metadata: Read* doda se sam.
2. U uredništvu ☰ → **Objava stranice**:
   - repozitorij `DjakaIT/camelliasinensis`;
   - grana `sadrzaj` (napravi se sama pri prvom spremanju);
   - token → **Spremi**.
3. **Prije isteka tokena** napravi novi i upiši ga na isto mjesto.

### B10. Cron (promjene koda same dolaze na stranicu)

1. Websites → Dashboard → **Advanced** → **Cron Jobs** → tip **Custom**.
2. Naredba (bez `> /dev/null`, jer Hostinger u običnom unosu ne voli posebne znakove):
   ```
   curl -s https://camelliasinensis.eu/urednistvo/api/osvjezi
   ```
3. Raspored: svakih 5 minuta (`*/5 * * * *`) → **Save**. Hostinger vrijeme računa po UTC-u, što ovdje nije važno.
4. Za provjeru u **List of Cron Jobs** klikni **View output**. Mora biti kratak JSON, a ne poruka o grešci.

### B11. Pozivnica Sari

1. Uredništvo ☰ → **Korisnici** → `sara` → **Napravi pozivnicu**.
2. Poveznicu pošalji osobno. Vrijedi 72 sata i samo jednom.
3. Sara postavlja lozinku i 2FA u istoj aplikaciji kao za Stripe. Upute za nju: [urednistvo-vodic.md](urednistvo-vodic.md).

### B12. Završna provjera

- [ ] `http://camelliasinensis.eu` i `https://www.camelliasinensis.eu` preusmjeravaju na `https://camelliasinensis.eu`.
- [ ] Naslovnica, katalog, proizvod, košarica i probna blagajna rade. U podnožju piše "Demo trgovina".
- [ ] Prijava u `/urednistvo` radi.
- [ ] Spremi sitnu promjenu (npr. zalihu jednog proizvoda):
  - [ ] na GitHubu se pojavi pokretanje "Objava …";
  - [ ] nakon 3–5 minuta promjena je na stranici;
  - [ ] u uredništvu gore piše **Objavljeno**.
- [ ] Cron output je bez grešaka.

### B13. Kad nešto ne radi

| Što se vidi | Uzrok i rješenje |
| --- | --- |
| Hostingerova parkirana ili početna stranica | Početna datoteka nije obrisana ili su datoteke raspakirane u podmapu (B7). |
| *ERR_TOO_MANY_REDIRECTS* ili greška certifikata | SSL još nije aktivan (B3). Pričekaj i obriši predmemoriju preglednika. |
| Naslovnica radi, ostale stranice daju 404 | Nedostaje `.htaccess` ili su datoteke na krivom mjestu (B7). |
| `/urednistvo` javlja PHP verziju ili "nedostaje: …" | B4. |
| U uredništvu "Objava nije uspjela" | Token je istekao ili nema dozvole (B9), ili je Actions crven (pogledaj log). Stranica ostaje kakva je bila. |
| Na GitHubu se ništa ne pokreće | Nema varijable `OBJAVA_UKLJUCENA = da` ili workflow nije na `main` (B6). |
| Promjena koda nije na stranici | Pričekaj do 5 minuta. Provjeri Cron output (B10) i je li Actions zelen. |
| Sara je zaboravila lozinku ili izgubila mobitel | Administrator joj napravi novu pozivnicu (B11). |

---

## Dio C: što još treba za pravu prodaju

| # | Što | Tko |
| --- | --- | --- |
| 1 | Backend za narudžbe na Hostingeru (PHP): Stripe Checkout, webhook, skidanje zalihe, mailovi kupcu i trgovini, polje za Stripe ključ u uredništvu | Daniel (s Claudeom) |
| 2 | Stripe aktiviran (A3–A6), Daniel u timu (A7), live ključ (A9) | Sara pa Daniel |
| 3 | Pravi kontakt podaci, Instagram i priča brenda umjesto probnih. Build za Google se ruši dok je ijedan probni podatak uključen. | Sara daje podatke, Daniel mijenja |
| 4 | Pravni tekstovi (uvjeti kupnje, privatnost, dostava i povrat, kolačići). Pravnik ih napiše ili Sara odobri nacrt. | Sara |
| 5 | **Fiskalizacija:** od 1. 1. 2026. svaki račun krajnjem kupcu fiskalizira se neovisno o načinu plaćanja, pa tako i plaćanje karticom preko Stripea. Stripe sam ne fiskalizira. Tri načina: (a) ručno u Thoru za svaku plaćenu narudžbu; (b) automatski preko Thorovog API-ja, ako ga Thor ima (pitati Thor); (c) automatski preko zasebne aplikacije za račune (Stripe navodi Solo, Webracun i Minimax kao preporuke korisnika, ali ih nije sam provjerio). | Sara s knjigovođom, Daniel pita Thor |
| 6 | GLS: ugovor, cijene dostave (sada 3,90 € paketomat, 4,90 € adresa, besplatno od 50 €) i tko pakira | Sara |
| 7 | Prave cijene i zalihe svih proizvoda u uredništvu (ili uvoz iz Thora) | Sara |
| 8 | Probna kupnja pravom karticom pa povrat novca (A11), prije otvaranja | Daniel |
| 9 | Prebacivanje na pravu verziju stranice (vidljiva na Googleu, prava blagajna). Dolazi s backendom. | Daniel |

---

## Izvori (provjereno 3. 11. 2026.)

Stripe:
- [API keys](https://docs.stripe.com/keys): live ključ se prikaže samo jednom, ključevi se ne dijele mailom ni chatom, rotacija s rokom do 7 dana, pravila pristupa.
- [Restricted API keys](https://docs.stripe.com/keys/restricted-api-keys): izrada ograničenog ključa, dozvole None / Read / Write, Edit key, prvo sandbox pa live.
- [Send your first API request](https://stripe.com/gb/docs/development/get-started): testni i live ključevi stvaraju se pri otvaranju računa, za pravi novac treba aktivacija.
- [Set up your account](https://docs.stripe.com/get-started/account/activate): aktivacija, javni podaci, 2FA (preporuka: passkey), zemlja se ne može promijeniti nakon aktivacije.
- [User roles](https://docs.stripe.com/get-started/account/teams/roles): što smiju Administrator i Developer.
- [Statement descriptors](https://docs.stripe.com/get-started/account/statement-descriptors): pravila za tekst na izvodu.
- [Webhooks](https://docs.stripe.com/webhooks): Workbench → Webhooks → Create an event destination, `whsec_` tajna, ponovni pokušaji do 3 dana.
- [Cijene za Hrvatsku](https://stripe.com/hr/pricing).
- [Waiting for your first payout](https://support.stripe.com/questions/waiting-period-for-first-payout-on-stripe?locale=en-GB) i [Receive payouts](https://docs.stripe.com/payouts): prva isplata 7–14 dana nakon prve uplate.
- [Stripe Services Agreement, Croatia](https://stripe.com/en-es/legal/ssa/hr): račun mogu otvoriti poslovni subjekti u Hrvatskoj, uključujući obrte.

Hostinger:
- [PHP extensions and options](https://www.hostinger.com/support/4667515-how-to-manage-php-extensions-and-options/)
- [Cron job](https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/) i [cron s posebnim znakovima](https://www.hostinger.com/support/5646919-how-to-set-up-a-cron-job-with-special-characters-at-hostinger/)
- [SSL](https://docs.hostinger.com/websites/ssl)

GitHub (dozvole tokena):
- [repository-dispatch, issue #208](https://github.com/peter-evans/repository-dispatch/issues/208) i [dispatch-workflow](https://github.com/step-security/dispatch-workflow): pokretanje objave traži Contents: write.

Fiskalizacija:
- [Invoice fiscalization in Croatia (Stripe)](https://support.stripe.com/questions/invoice-fiscalization-in-croatia): Stripe ne fiskalizira, kartice potpadaju pod fiskalizaciju.
- [Fiskalizacija webshopa (Fiskalopedija)](https://fiskalopedija.hr/baza-znanja/fiskalizacija-webshopa)
- [Vodič kroz Fiskalizaciju 2.0 (Porezna uprava)](https://porezna-uprava.gov.hr/hr/Kategorija/8151)
- [Implementacija Fiskalizacije 1.0 i 2.0 (RRiF)](https://www.rrif.hr/implementacija_fiskalizacije_1_0_i_fiskalizacije_2-4178-misljenje/)
