# Content-Security-Policy: zašto je podijeljen

**Problem.** Next.js u svaku izvezenu stranicu ubacuje 3 do 6 inline `<script>` blokova (RSC payload, `self.__next_f.push(…)`). Sadržaj im se razlikuje po stranici. GUIDE §5 traži `script-src 'self'` i zabranjuje `'unsafe-inline'`. S globalnim CSP-om iz `.htaccess` u kojem je samo `'self'`, stranica ne bi radila.

**Rješenje (bez popuštanja).** `scripts/postbuild.mjs` nakon svakog builda:
1. izračuna SHA-256 svakog inline izvršnog `<script>` u svakoj HTML datoteci (`application/ld+json` se preskače jer se ne izvršava);
2. upiše u tu stranicu `<meta http-equiv="Content-Security-Policy">` s `default-src 'self'; script-src 'self' 'sha256-…'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' [mock-server samo za devserver]; frame-src https://www.google.com; object-src 'none'; base-uri 'self'`.

`public/.htaccess` šalje samo direktive koje `<meta>` ne podržava ili koje ne ovise o stranici: `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action …`. Uz to šalje HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` i `X-Frame-Options`.

Preglednik primjenjuje **obje** politike (presjek). Zato `.htaccess` **ne smije** imati `default-src` ni `script-src`: blokirali bi hashirane skripte.

**Provjera.** E2E test "bez grešaka u konzoli (uključujući CSP)" obiđe sve vrste stranica i klijentsku navigaciju. `check:prerender` pada ako neka stranica nema CSP.

**Odstupanje od GUIDE §5 (traži Danielovu potvrdu).** CSP iz GUIDE-a je jedno zaglavlje u `.htaccess`. Ovdje je podijeljen na zaglavlje i `<meta>`. Politika nije slabija (nema `'unsafe-inline'` za skripte). Razlika je da `<meta>` CSP ne podržava `frame-ancestors`, `report-uri` ni `sandbox`, pa su prve dvije u zaglavlju. Alternativa bi bila nonce, ali on traži poslužitelj koji generira HTML (F3), što nije statični export.

**Kad se odabere backend:** u `postbuild.mjs` (`connect-src`) i `.htaccess` (`form-action`) dodaj adresu backenda.
