<?php
// Uredništvo na hostingu: sučelje i API (/urednistvo/api/*). Isti ugovor kao Node inačica (urednistvo/lib/api.mjs).
// Pravila za svaki zahtjev koji nešto mijenja:
//  - Origin mora biti naša stranica (+ Sec-Fetch-Site same-origin) — zaštita od CSRF-a
//  - tijelo je JSON (ili slika) s ograničenom veličinom
//  - prijavljeni zahtjevi nose CSRF token iz sesije (zaglavlje X-CSRF) i provjerava se je li sesija i dalje valjana
//  - poruke o neuspjeloj prijavi ne otkrivaju postoji li korisnik
declare(strict_types=1);

const KRIVA_PRIJAVA = 'Pogrešno korisničko ime ili lozinka.';
const LOKALNE_ADRESE = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

final class Urednistvo
{
    private Konfiguracija $konf;
    private Korisnici $korisnici;
    private Sesije $sesije;
    private Spremiste $spremiste;
    private Slike $slike;
    private Objava $objava;
    private Ogranicenja $ogranicenja;
    private Postavljanje $postavljanje;
    private Odrzavanje $odrzavanje;
    private Zivo $zivo;
    private Prodaja $prodaja;
    private Narudzbe $narudzbe;
    private Placanje $placanje;
    private Trgovina $trgovina;
    private bool $produkcija;

    /** @param array{podaci:string, konfiguracija:string, sucelje:string, javno:string, lokalno:bool, githubApi:string, osvjeziMs?:int} $p */
    public function __construct(private array $p)
    {
        $this->produkcija = !$p['lokalno'];
        $this->konf = new Konfiguracija($p['konfiguracija']);
        if (!is_dir($p['podaci'])) @mkdir($p['podaci'], 0700, true);
        $this->korisnici = new Korisnici($p['podaci']);
        $this->sesije = new Sesije($p['podaci'] . '/sesije', $this->produkcija);
        $this->slike = new Slike($p['podaci'], $this->konf);
        $this->spremiste = new Spremiste($p['podaci'], $this->konf, fn ($k) => $this->slike->postoji($k));
        $this->objava = new Objava($p['podaci'], $this->slike, $p['githubApi'], new Instalacija($p['podaci'], $p['javno']), $p['osvjeziMs'] ?? 60_000);
        // 'ukupno': krive prijave sa svih adresa zajedno — napad s puno IP adresa ne može zagušiti hosting (svaka provjera
        // lozinke namjerno troši ~20 MB i desetke ms); kad se prijeđe, prijava se odbija bez provjere lozinke do 15 min
        $this->ogranicenja = new Ogranicenja($p['podaci'], ['ip' => ['prozorMs' => 15 * 60_000, 'najvise' => 20], 'korisnik' => ['prozorMs' => 15 * 60_000, 'najvise' => 5],
            'ukupno' => ['prozorMs' => 15 * 60_000, 'najvise' => 200],
            // trgovina: pokretanje plaćanja i kontakt obrazac (zaštita od zlouporabe, ne od kupaca)
            'narudzba' => ['prozorMs' => 10 * 60_000, 'najvise' => 30], 'narudzbaUkupno' => ['prozorMs' => 10 * 60_000, 'najvise' => 400],
            'kontakt' => ['prozorMs' => 15 * 60_000, 'najvise' => 5], 'kontaktUkupno' => ['prozorMs' => 15 * 60_000, 'najvise' => 60]]);
        $this->postavljanje = new Postavljanje($p['podaci'], $this->konf->origin);
        $this->odrzavanje = new Odrzavanje($p['javno']);
        $this->zivo = new Zivo($p['javno']);
        $this->prodaja = new Prodaja($p['podaci']);
        $this->narudzbe = new Narudzbe($p['podaci']);
        $this->placanje = new Placanje($p['podaci'], $this->konf->origin, (bool) $p['lokalno']);
        $this->trgovina = new Trgovina($this->spremiste, $this->prodaja, $this->narudzbe, $this->placanje, $this->zivo, $this->konf->trgovina, $this->konf->origin);
    }

    // ---------------- zahtjev i odgovor ----------------
    public static function zaglavlja(bool $produkcija): array
    {
        return [
            'Content-Security-Policy' => "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'no-referrer',
            'Cache-Control' => 'no-store',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            'Cross-Origin-Opener-Policy' => 'same-origin',
            'Cross-Origin-Resource-Policy' => 'same-origin',
            'Permissions-Policy' => 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        ] + ($produkcija ? ['Strict-Transport-Security' => 'max-age=31536000'] : []); // includeSubDomains tek kad sve poddomene imaju HTTPS (kao public/.htaccess)
    }

    private function posalji(int $status, string $tijelo, string $vrsta, array $dodatno = []): void
    {
        http_response_code($status);
        foreach ([...self::zaglavlja($this->produkcija), ...$dodatno, 'Content-Type' => $vrsta] as $k => $v) header("$k: $v");
        header('Content-Length: ' . strlen($tijelo));
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $tijelo;
    }
    private function json(int $status, mixed $tijelo, array $dodatno = []): void
    {
        $this->posalji($status, u_json($tijelo), 'application/json; charset=utf-8', $dodatno);
    }

    private static function zaglavlje(string $ime): ?string
    {
        $k = 'HTTP_' . strtoupper(str_replace('-', '_', $ime));
        return isset($_SERVER[$k]) ? (string) $_SERVER[$k] : null;
    }
    private static function ip(): string { return (string) ($_SERVER['REMOTE_ADDR'] ?? '?'); }
    private function pozadina(): bool { return self::zaglavlje('X-Pozadina') === '1'; }
    /** prvo postavljanje bez koda samo lokalno (testovi) i sa ovog računala */
    private function kodPotreban(): bool { return $this->produkcija || !in_array(self::ip(), LOKALNE_ADRESE, true); }

    /** dopušteni hostovi: javna adresa (i www.), lokalno i localhost/127.0.0.1 */
    private function dopustenHost(?string $host): bool
    {
        if (!$host) return false;
        $javni = parse_url($this->konf->origin, PHP_URL_HOST);
        $h = strtolower(preg_replace('/:\d+$/', '', $host));
        if ($h === $javni || $h === "www.$javni") return true;
        return !$this->produkcija && in_array($h, ['localhost', '127.0.0.1'], true);
    }
    private function istiIzvor(): bool
    {
        $o = self::zaglavlje('Origin');
        $sfs = self::zaglavlje('Sec-Fetch-Site');
        if (!$o || ($sfs !== null && $sfs !== 'same-origin')) return false;
        $u = parse_url($o);
        if (!$u || empty($u['host']) || empty($u['scheme'])) return false;
        if ($this->produkcija) return $u['scheme'] === 'https' && $this->dopustenHost($u['host']) && !isset($u['port']);
        $hostOrigina = $u['host'] . (isset($u['port']) ? ":{$u['port']}" : '');
        return $this->dopustenHost($u['host']) && strtolower($hostOrigina) === strtolower((string) self::zaglavlje('Host'));
    }

    private function tijelo(int $granica): string
    {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $granica) throw new Greska(413, 'Zahtjev je prevelik');
        $s = (string) file_get_contents('php://input', false, null, 0, $granica + 1);
        if (strlen($s) > $granica) throw new Greska(413, 'Zahtjev je prevelik');
        return $s;
    }
    private function jsonTijelo(int $granica = 2 * 1024 * 1024): array
    {
        if (!preg_match('#^application/json\b#', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))) throw new Greska(415, 'Očekuje se JSON');
        $s = $this->tijelo($granica);
        if ($s === '') return [];
        try { $j = iz_json($s); } catch (JsonException) { throw new Greska(400, 'Neispravan JSON'); }
        return is_array($j) ? $j : [];
    }

    private static function istekla(?string $razlog): Greska { return new Greska(401, 'Prijava je istekla', ['razlog' => $razlog ?? 'nema']); }

    /** prijavljeni korisnik (sesija 'puno', korisnik postoji, verzija sesije ista) */
    private function prijavljen(bool $csrf, bool $admin = false): array
    {
        $ses = $this->sesije->procitaj($this->pozadina());
        if (!$ses || ($ses['s']['korak'] ?? '') !== 'puno') throw self::istekla($this->sesije->razlogIsteka);
        $k = $this->korisnici->pronadji($ses['s']['ime']);
        if (!$k || ($k['sesijaVerzija'] ?? 1) !== ($ses['s']['sesijaVerzija'] ?? null)) { $this->sesije->obrisi($ses['id'], false); throw self::istekla('odjavljen'); }
        if ($csrf && !jednako((string) self::zaglavlje('X-CSRF'), $ses['s']['csrf'])) throw new Greska(403, 'Neispravan zahtjev (CSRF)');
        if ($admin && ($k['uloga'] ?? 'urednik') !== 'admin') throw new Greska(403, 'Samo administrator uredništva.');
        return [$ses, $k];
    }

    /** @param array<array{0:string, 1:string}> $kljucevi [vrsta, ključ] */
    private function zakljucano(array $kljucevi): void
    {
        $s = max(array_map(fn ($x) => $this->ogranicenja->cekaj($x[0], $x[1]), $kljucevi));
        if ($s > 0) throw new Greska(429, 'Previše pokušaja. Pokušaj ponovno za ' . max(1, (int) ceil($s / 60)) . ' min.', ['cekaj' => $s]);
    }

    private function zapocni2fa(string $ime, ?string $staraId): array
    {
        $tajna = nova_totp_tajna();
        $this->sesije->stvori(['ime' => $ime, 'korak' => 'postavljanje-2fa', 'totpTajna' => $tajna, 'pokusaji' => 0], $staraId);
        return ['korak' => 'postavljanje-2fa', 'uri' => otpauth_uri($tajna, $ime), 'kljuc' => trim(chunk_split($tajna, 4, ' '))];
    }
    private function prijaviPuno(array $k, ?string $staraId): array
    {
        $s = $this->sesije->stvori(['ime' => $k['ime'], 'korak' => 'puno', 'sesijaVerzija' => $k['sesijaVerzija'] ?? 1], $staraId);
        return ['ime' => $k['ime'], 'uloga' => $k['uloga'] ?? 'urednik', 'csrf' => $s['csrf']];
    }
    private function postaviLozinku(string $ime, string $hash): void
    {
        $this->korisnici->promijeni($ime, fn ($k) => array_merge($k, ['lozinka' => $hash, 'pozivnica' => null, 'totp' => null, 'rezervni' => [], 'zadnjiKorak' => -1,
            'sesijaVerzija' => ($k['sesijaVerzija'] ?? 1) + 1]));
        $this->sesije->odjaviKorisnika($ime);
    }
    private function dnevnik(string $ime, string $radnja, array $dodatno = []): void
    {
        $this->spremiste->dnevnik(['ime' => $ime, 'ip' => self::ip(), 'radnja' => $radnja, ...$dodatno]);
    }

    // ---------------- rute ----------------
    private function ruta(string $metoda, string $put): void
    {
        switch ("$metoda $put") {
            case 'GET /stanje': {
                $ses = $this->sesije->procitaj($this->pozadina());
                $k = ($ses['s']['korak'] ?? '') === 'puno' ? $this->korisnici->pronadji($ses['s']['ime']) : null;
                $puno = $k && ($k['sesijaVerzija'] ?? 1) === ($ses['s']['sesijaVerzija'] ?? null);
                $razlog = $ses ? null : $this->sesije->razlogIsteka;
                if ($ses && $ses['s']['korak'] === 'puno' && !$puno) { $this->sesije->obrisi($ses['id']); $razlog = 'odjavljen'; }
                $prvo = $this->korisnici->broj() === 0;
                if ($prvo && $this->kodPotreban()) $this->postavljanje->kod(); // datoteka s kodom postoji čim se uredništvo otvori
                $this->json(200, [
                    'korak' => $puno ? 'puno' : ($ses && $ses['s']['korak'] !== 'puno' ? $ses['s']['korak'] : null),
                    'ime' => $puno ? $k['ime'] : null, 'uloga' => $puno ? ($k['uloga'] ?? 'urednik') : null, 'csrf' => $puno ? $ses['s']['csrf'] : null,
                    'razlog' => $razlog, 'prvoPostavljanje' => $prvo,
                ] + ($prvo ? ['kodPotreban' => $this->kodPotreban()] : []));
                return;
            }

            case 'POST /postavljanje': {
                $this->zakljucano([['ip', self::ip()]]);
                $b = $this->jsonTijelo(8192);
                if ($this->korisnici->broj() > 0) throw new Greska(409, 'Uredništvo je već postavljeno. Prijavi se.');
                if ($this->kodPotreban() && !$this->postavljanje->provjeri($b['kod'] ?? '')) {
                    $this->ogranicenja->zabiljezi('ip', self::ip());
                    $this->dnevnik('-', 'pogrešan kod za postavljanje');
                    throw new Greska(403, 'Kod za postavljanje nije ispravan.');
                }
                $n = normaliziraj_ime($b['ime'] ?? '');
                if (!ispravno_ime($n)) throw new Greska(422, PORUKA_IME);
                if ($losa = provjeri_novu_lozinku($b['lozinka'] ?? null, $n)) throw new Greska(422, $losa);
                $hash = hash_lozinke($b['lozinka']);
                $this->korisnici->stvoriPrvog($n);
                $this->postaviLozinku($n, $hash);
                $this->postavljanje->ukloni();
                $this->dnevnik($n, 'prvo postavljanje: lozinka postavljena');
                $this->json(200, $this->zapocni2fa($n, $this->sesije->procitaj()['id'] ?? null));
                return;
            }

            case 'POST /pozivnica/provjeri': {
                $this->zakljucano([['ip', self::ip()]]);
                $k = $this->korisnici->poPozivnici($this->jsonTijelo(4096)['token'] ?? null);
                if (!$k) { $this->ogranicenja->zabiljezi('ip', self::ip()); throw new Greska(404, 'Pozivnica ne vrijedi ili je istekla.'); }
                $this->json(200, ['ime' => $k['ime']]);
                return;
            }

            case 'POST /pozivnica': {
                $this->zakljucano([['ip', self::ip()]]);
                $b = $this->jsonTijelo(8192);
                $k = $this->korisnici->poPozivnici($b['token'] ?? null);
                if (!$k) { $this->ogranicenja->zabiljezi('ip', self::ip()); throw new Greska(404, 'Pozivnica ne vrijedi ili je istekla.'); }
                if ($losa = provjeri_novu_lozinku($b['lozinka'] ?? null, $k['ime'])) throw new Greska(422, $losa);
                $this->postaviLozinku($k['ime'], hash_lozinke($b['lozinka']));
                $this->dnevnik($k['ime'], 'pozivnica: lozinka postavljena');
                $this->json(200, $this->zapocni2fa($k['ime'], $this->sesije->procitaj()['id'] ?? null));
                return;
            }

            case 'POST /2fa/potvrdi': {
                $ses = $this->sesije->procitaj();
                if (!$ses || $ses['s']['korak'] !== 'postavljanje-2fa') throw new Greska(401, 'Postavljanje je isteklo, prijavi se ponovno.', ['razlog' => $this->sesije->razlogIsteka ?? 'nema']);
                $kod = $this->jsonTijelo(1024)['kod'] ?? null;
                $korak = provjeri_totp($ses['s']['totpTajna'], $kod);
                if ($korak === null) {
                    if (++$ses['s']['pokusaji'] >= 5) { $this->sesije->obrisi($ses['id']); throw new Greska(429, 'Previše pogrešnih kodova. Prijavi se ponovno.'); }
                    $this->sesije->spremi($ses);
                    throw new Greska(400, 'Kod nije ispravan. Upiši šesteroznamenkasti kod iz aplikacije.');
                }
                ['kodovi' => $kodovi, 'hashevi' => $hashevi] = novi_rezervni_kodovi();
                $tajna = $ses['s']['totpTajna'];
                $k = $this->korisnici->promijeni($ses['s']['ime'], fn ($x) => array_merge($x, ['totp' => ['tajna' => $tajna], 'zadnjiKorak' => $korak, 'rezervni' => $hashevi, 'zadnjaPrijava' => iso_vrijeme()]));
                $this->dnevnik($k['ime'], 'dvostruka potvrda uključena');
                $this->json(200, [...$this->prijaviPuno($k, $ses['id']), 'rezervniKodovi' => $kodovi]);
                return;
            }

            case 'POST /prijava': {
                $b = $this->jsonTijelo(4096);
                $n = mb_substr(normaliziraj_ime($b['ime'] ?? ''), 0, 64);
                $this->zakljucano([['ip', self::ip()], ['korisnik', $n], ['ukupno', 'sve']]);
                $k = $this->korisnici->pronadji($n);
                $lozinka = mb_substr(is_string($b['lozinka'] ?? null) ? $b['lozinka'] : '', 0, 200);
                $ok = provjeri_lozinku($lozinka, $k['lozinka'] ?? lazni_zapis()) && !empty($k['lozinka']);
                if (!$ok) {
                    $this->ogranicenja->zabiljezi('ip', self::ip()); $this->ogranicenja->zabiljezi('korisnik', $n); $this->ogranicenja->zabiljezi('ukupno', 'sve');
                    $this->dnevnik($n, 'neuspjela prijava');
                    throw new Greska(401, KRIVA_PRIJAVA);
                }
                $staraId = $this->sesije->procitaj()['id'] ?? null;
                if (empty($k['totp'])) { $this->json(200, $this->zapocni2fa($k['ime'], $staraId)); return; }
                $this->sesije->stvori(['ime' => $k['ime'], 'korak' => '2fa', 'pokusaji' => 0], $staraId);
                $this->json(200, ['korak' => '2fa']);
                return;
            }

            case 'POST /prijava/2fa': {
                $ses = $this->sesije->procitaj();
                if (!$ses || $ses['s']['korak'] !== '2fa') throw new Greska(401, 'Prijava je istekla, upiši lozinku ponovno.', ['razlog' => $this->sesije->razlogIsteka ?? 'nema']);
                $ime = $ses['s']['ime'];
                $this->zakljucano([['korisnik', $ime]]);
                $kod = $this->jsonTijelo(1024)['kod'] ?? null;
                $k = $this->korisnici->pronadji($ime);
                $rezervni = -1;
                $korak = !empty($k['totp']) ? provjeri_totp($k['totp']['tajna'], $kod, $k['zadnjiKorak'] ?? -1) : null;
                if ($korak === null && $k) $rezervni = pronadji_rezervni($kod, $k['rezervni'] ?? []);
                if (!$k || ($korak === null && $rezervni < 0)) {
                    $this->ogranicenja->zabiljezi('korisnik', $ime);
                    $this->dnevnik($ime, 'pogrešan kod dvostruke potvrde');
                    if (++$ses['s']['pokusaji'] >= 5) { $this->sesije->obrisi($ses['id']); throw new Greska(429, 'Previše pogrešnih kodova. Prijavi se ponovno.'); }
                    $this->sesije->spremi($ses);
                    throw new Greska(400, 'Kod nije ispravan.');
                }
                $nk = $this->korisnici->promijeni($k['ime'], function ($x) use ($korak, $rezervni) {
                    if ($korak !== null) $x['zadnjiKorak'] = $korak;
                    else $x['rezervni'] = array_values(array_filter($x['rezervni'], fn ($_, $i) => $i !== $rezervni, ARRAY_FILTER_USE_BOTH));
                    $x['zadnjaPrijava'] = iso_vrijeme();
                    return $x;
                });
                $this->ogranicenja->ponisti('korisnik', $k['ime']);
                $this->dnevnik($k['ime'], $korak !== null ? 'prijava' : 'prijava rezervnim kodom');
                $this->json(200, [...$this->prijaviPuno($nk, $ses['id']), ...($rezervni >= 0 ? ['preostaloRezervnih' => count($nk['rezervni'])] : [])]);
                return;
            }

            case 'POST /odjava': {
                $ses = $this->sesije->procitaj();
                if ($ses) $this->dnevnik($ses['s']['ime'], 'odjava');
                $this->sesije->obrisi($ses['id'] ?? null);
                $this->json(200, ['ok' => true]);
                return;
            }

            case 'GET /katalog': {
                $this->prijavljen(false);
                // zaliha u uredniku je stvarna (nakon prodaja); prodajaSeq kaže do koje prodaje je uračunata
                [$s, $seq] = $this->prodaja->sBravom(fn () => [$this->trgovina->katalog(), $this->prodaja->seq()]);
                if (!$this->zivo->postoji()) $this->zivo->zapisi($s); // prvi put nakon postavljanja
                $this->json(200, ['oznake' => $this->konf->oznake, 'najviseNaPolici' => $this->konf->najviseNaPolici, 'sadrzaj' => $s, 'prodajaSeq' => $seq]);
                return;
            }

            case 'PUT /katalog': {
                [, $k] = $this->prijavljen(true);
                $b = $this->jsonTijelo(4 * 1024 * 1024);
                $verzija = is_int($b['verzija'] ?? null) ? $b['verzija'] : -1;
                $opis = is_string($b['opis'] ?? null) ? $b['opis'] : '';
                $odSeq = is_int($b['prodajaSeq'] ?? null) ? $b['prodajaSeq'] : null;
                // prodaje dok je urednik uređivao oduzmu se od zalihe koju je upisao; zatim su sve prodaje u katalogu
                [$s, $seq] = $this->prodaja->sBravom(function () use ($b, $verzija, $k, $opis, $odSeq) {
                    $katalog = $b['katalog'] ?? null;
                    if (is_array($katalog) && is_array($katalog['proizvodi'] ?? null)) $katalog = $this->prodaja->primijeni($katalog, $odSeq ?? $this->prodaja->seq());
                    $s = $this->spremiste->spremiKatalog($katalog, $verzija, $k['ime'], $opis);
                    $this->prodaja->isprazni();
                    return [$s, $this->prodaja->seq()];
                });
                $this->zivo->zapisi($s); // cijena i zaliha na stranici odmah, gradnja samo za ostalo
                $this->json(200, ['sadrzaj' => $s, 'prodajaSeq' => $seq]);
                $this->nakonOdgovora(fn () => $this->objava->zatrazi($s, $opis !== '' ? $opis : 'Promjena kataloga'));
                return;
            }

            case 'POST /slike': {
                [, $k] = $this->prijavljen(true);
                if (!preg_match('#^image/(jpeg|png|webp|avif|heic|heif)$#', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))) throw new Greska(415, 'Podržani formati: JPG, PNG, WebP, AVIF');
                $r = $this->slike->obradi($this->tijelo(NAJVECA_DATOTEKA));
                $this->dnevnik($k['ime'], 'fotografija učitana', ['kljuc' => $r['kljuc']]);
                $this->json(201, $r);
                return;
            }

            // cPanel Cron Job (svakih 5 min): postavi novu izgradnju s GitHuba (promjene koda, zatvoren preglednik); bez prijave
            case 'GET /osvjezi': {
                $this->json(200, $this->objava->osvjezi());
                return;
            }

            case 'GET /objava': {
                $this->prijavljen(false);
                $this->json(200, [...$this->objava->stanje(), 'odrzavanje' => $this->odrzavanje->ukljuceno()]);
                return;
            }
            case 'GET /objava/postavke': {
                $this->prijavljen(false, true);
                $this->json(200, $this->objava->javnePostavke());
                return;
            }
            case 'POST /objava/postavke': {
                [, $k] = $this->prijavljen(true, true);
                $b = $this->jsonTijelo(4096);
                $this->objava->spremiPostavke($b['repo'] ?? null, $b['grana'] ?? null, $b['token'] ?? null);
                $this->dnevnik($k['ime'], 'postavke objave promijenjene');
                $this->json(200, $this->objava->javnePostavke());
                return;
            }
            case 'POST /objava/ponovi': {
                [, $k] = $this->prijavljen(true, true);
                $s = $this->spremiste->ucitaj();
                $this->trgovina->osvjeziZivo();
                $this->dnevnik($k['ime'], 'ponovna objava');
                $this->json(200, ['ok' => true]);
                $this->nakonOdgovora(fn () => $this->objava->zatrazi($s, 'ponovna objava'));
                return;
            }

            // ----- održavanje stranice (samo administrator): posjetitelji vide poruku, uredništvo radi normalno -----
            case 'GET /odrzavanje': {
                $this->prijavljen(false, true);
                $this->json(200, [...$this->odrzavanje->stanje(), 'pregled' => Odrzavanje::imaPregled()]);
                return;
            }
            case 'POST /odrzavanje': {
                [, $k] = $this->prijavljen(true, true);
                $b = $this->jsonTijelo(1024);
                if (!is_bool($b['ukljuceno'] ?? null)) throw new Greska(422, 'Neispravan zahtjev.');
                $prije = $this->odrzavanje->ukljuceno();
                $st = $this->odrzavanje->postavi($b['ukljuceno'], $k['ime']);
                // i administrator vidi poruku kao posjetitelji; pravu stranicu samo ako to izričito odabere ("Pokaži mi stranicu")
                $vidi = $b['ukljuceno'] && ($b['pregled'] ?? false) === true;
                Odrzavanje::kolacic($vidi, $this->produkcija);
                if ($prije !== $b['ukljuceno']) $this->dnevnik($k['ime'], $b['ukljuceno'] ? 'održavanje uključeno' : 'održavanje isključeno');
                $this->json(200, [...$st, 'pregled' => $vidi]);
                return;
            }

            case 'GET /povijest': {
                $this->prijavljen(false);
                $this->json(200, $this->spremiste->povijest());
                return;
            }
            case 'POST /povijest/vrati': {
                [, $k] = $this->prijavljen(true);
                $b = $this->jsonTijelo(1024);
                $s = $this->spremiste->vrati($b['verzija'] ?? null, $b['trenutna'] ?? null, $k['ime']);
                $this->trgovina->osvjeziZivo(); // vraćena zaliha − prodaje od zadnjeg spremanja
                $this->json(200, ['verzija' => $s['verzija']]);
                $this->nakonOdgovora(fn () => $this->objava->zatrazi($s, 'vraćena verzija ' . $b['verzija']));
                return;
            }

            case 'POST /lozinka': {
                [$ses, $k] = $this->prijavljen(true);
                $this->zakljucano([['korisnik', $k['ime']]]);
                $b = $this->jsonTijelo(4096);
                if (!provjeri_lozinku(mb_substr(is_string($b['stara'] ?? null) ? $b['stara'] : '', 0, 200), $k['lozinka'])) {
                    $this->ogranicenja->zabiljezi('korisnik', $k['ime']);
                    throw new Greska(400, 'Trenutna lozinka nije ispravna.');
                }
                if ($losa = provjeri_novu_lozinku($b['nova'] ?? null, $k['ime'])) throw new Greska(422, $losa);
                $hash = hash_lozinke($b['nova']);
                $nk = $this->korisnici->promijeni($k['ime'], fn ($x) => array_merge($x, ['lozinka' => $hash, 'sesijaVerzija' => ($x['sesijaVerzija'] ?? 1) + 1]));
                $this->sesije->odjaviKorisnika($k['ime'], $ses['id']); // ostali uređaji se odjavljuju
                $ses['s']['sesijaVerzija'] = $nk['sesijaVerzija'];
                $this->sesije->spremi($ses);
                $this->dnevnik($k['ime'], 'lozinka promijenjena');
                $this->json(200, ['ok' => true]);
                return;
            }

            // ----- korisnici (samo administrator) -----
            case 'GET /korisnici': {
                $this->prijavljen(false, true);
                $this->json(200, array_map(fn ($x) => ['ime' => $x['ime'], 'uloga' => $x['uloga'] ?? 'urednik', 'stanje' => stanje_racuna($x),
                    'zadnjaPrijava' => $x['zadnjaPrijava'] ?? null, 'rezervnih' => count($x['rezervni'] ?? [])], $this->korisnici->sve()['korisnici']));
                return;
            }
            case 'POST /korisnici/pozivnica': {
                [, $k] = $this->prijavljen(true, true);
                $b = $this->jsonTijelo(1024);
                $n = normaliziraj_ime($b['ime'] ?? '');
                $resetiraj = ($b['resetiraj'] ?? false) === true;
                if (!ispravno_ime($n)) throw new Greska(422, PORUKA_IME);
                if ($n === $k['ime']) throw new Greska(422, 'Za svoj račun upotrijebi "Promijeni lozinku".');
                $postoji = $this->korisnici->pronadji($n);
                $token = $this->korisnici->pozivnica($n, $resetiraj);
                if ($resetiraj) $this->sesije->odjaviKorisnika($n);
                $this->dnevnik($k['ime'], ($resetiraj && $postoji ? 'nova pozivnica (reset): ' : 'pozivnica: ') . $n);
                $this->json(200, ['ime' => $n, 'poveznica' => $this->adresa() . "/urednistvo/#pozivnica=$token"]);
                return;
            }
            case 'POST /korisnici/obrisi': {
                [, $k] = $this->prijavljen(true, true);
                $n = normaliziraj_ime($this->jsonTijelo(1024)['ime'] ?? '');
                if ($n === $k['ime']) throw new Greska(422, 'Ne možeš ukloniti svoj račun.');
                $this->korisnici->obrisi($n);
                $this->sesije->odjaviKorisnika($n);
                $this->dnevnik($k['ime'], "korisnik uklonjen: $n");
                $this->json(200, ['ok' => true]);
                return;
            }

            // ----- plaćanje (Stripe) i narudžbe -----
            case 'GET /placanje': {
                $this->prijavljen(false, true);
                $this->json(200, $this->placanje->javno());
                return;
            }
            case 'POST /placanje': {
                [, $k] = $this->prijavljen(true, true);
                $b = $this->jsonTijelo(4096);
                $nov = is_string($b['kljuc'] ?? null) && trim($b['kljuc']) !== '';
                $r = ($b['ukloni'] ?? false) === true ? $this->placanje->ukloni() : $this->placanje->spremi($b);
                $this->dnevnik($k['ime'], ($b['ukloni'] ?? false) === true ? 'plaćanje isključeno' : ($nov ? "Stripe ključ postavljen ({$r['nacin']})" : 'postavke plaćanja promijenjene'));
                $this->json(200, $r);
                return;
            }
            case 'GET /narudzbe': {
                $this->prijavljen(false);
                $this->json(200, ['narudzbe' => $this->narudzbe->popis(), 'placanje' => ['ukljuceno' => $this->placanje->javno()['ukljuceno'], 'nacin' => $this->placanje->javno()['nacin']]]);
                return;
            }
            case 'POST /narudzbe/poslano': {
                [, $k] = $this->prijavljen(true);
                $b = $this->jsonTijelo(1024);
                $id = is_string($b['id'] ?? null) ? $b['id'] : '';
                $poslano = ($b['poslano'] ?? null) === true;
                $n = preg_match('/^CS-\d{4,9}$/', $id) ? $this->narudzbe->izmijeni($id, fn ($x) => [...$x, 'poslano' => $poslano ? iso_vrijeme() : null]) : null;
                if (!$n) throw new Greska(404, 'Nema te narudžbe.');
                $this->dnevnik($k['ime'], ($poslano ? 'narudžba poslana: ' : 'narudžba nije poslana: ') . $id);
                $this->json(200, ['ok' => true, 'poslano' => $n['poslano']]);
                return;
            }
        }
        throw new Greska(404, 'Nepoznata adresa');
    }

    // ---------------- trgovina (javno) ----------------
    /** greške u obliku API-CONTRACT §5; kupac nikad ne vidi sirove poruke ni identifikatore */
    private function trgovinaGreska(int $status, string $kod, array $detalji = [], array $dodatno = []): void
    {
        $this->json($status, ['error' => ['code' => $kod, ...($detalji ? ['details' => $detalji] : [])]], $dodatno);
    }

    private function ogranici(string $vrsta, string $ukupno): void
    {
        $c = max($this->ogranicenja->cekaj($vrsta, self::ip()), $this->ogranicenja->cekaj($ukupno, '*'));
        if ($c > 0) throw new TrgovinaGreska('RATE_LIMITED', 429, ['retryAfterSec' => $c]);
        $this->ogranicenja->zabiljezi($vrsta, self::ip());
        $this->ogranicenja->zabiljezi($ukupno, '*');
    }

    private function trgovinaRuta(string $metoda, string $put): void
    {
        try {
            if ($metoda === 'GET' && preg_match('#^/trgovina/narudzba/([0-9a-f]{48})$#', $put, $m)) {
                [$odg, $placena] = $this->trgovina->stanje($m[1]);
                $this->json(200, $odg);
                if ($placena) $this->nakonOdgovora(fn () => $this->trgovina->posaljiMailove($placena));
                return;
            }
            if ($metoda === 'GET' && str_starts_with($put, '/trgovina/narudzba/')) { $this->json(200, ['status' => 'unknown']); return; }
            if ($metoda !== 'POST' || !$this->istiIzvor()) throw new TrgovinaGreska('INVALID_REQUEST', 403);
            if ($put === '/trgovina/narudzba') {
                $this->ogranici('narudzba', 'narudzbaUkupno');
                $this->json(200, $this->trgovina->zapocni($this->jsonTijelo(32 * 1024)));
                return;
            }
            if ($put === '/trgovina/contact') {
                $this->ogranici('kontakt', 'kontaktUkupno');
                $this->trgovina->kontakt($this->jsonTijelo(16 * 1024), $this->konf->trgovina['kontaktTeme']);
                $this->json(200, ['ok' => true]);
                return;
            }
            throw new TrgovinaGreska('INVALID_REQUEST', 404);
        } catch (TrgovinaGreska $e) {
            $this->trgovinaGreska($e->status, $e->kod, $e->detalji, $e->kod === 'RATE_LIMITED' ? ['Retry-After' => (string) ($e->detalji['retryAfterSec'] ?? 60)] : []);
        } catch (Greska $e) {
            $this->trgovinaGreska(400, 'INVALID_REQUEST'); // prevelik ili neispravan JSON
        } catch (Throwable $e) {
            error_log('[trgovina] ' . $e->getMessage());
            if (!headers_sent()) $this->trgovinaGreska(500, 'UNKNOWN');
        }
    }

    /** Stripe webhook: bez prijave i bez Origina, ali s potpisom; greška u obradi = 500, pa Stripe ponovi (do 3 dana) */
    private function stripeWebhook(): void
    {
        if (!$this->placanje->tajne()) { $this->json(503, ['greska' => 'Plaćanje nije postavljeno']); return; }
        try {
            $tijelo = $this->tijelo(512 * 1024);
        } catch (Greska) {
            $this->json(413, ['greska' => 'Prevelik zahtjev']);
            return;
        }
        try {
            $placena = $this->trgovina->webhook($tijelo, (string) self::zaglavlje('Stripe-Signature'));
        } catch (StripeGreska $e) {
            if ($e->vrsta === 'potpis' || $e->vrsta === 'tijelo') { $this->json(400, ['greska' => 'Neispravan potpis']); return; }
            error_log("[trgovina] webhook: Stripe {$e->status} {$e->vrsta}");
            $this->json(500, ['greska' => 'Pokušaj ponovno']);
            return;
        } catch (Throwable $e) {
            error_log('[trgovina] webhook: ' . $e->getMessage());
            $this->json(500, ['greska' => 'Pokušaj ponovno']);
            return;
        }
        $this->json(200, ['received' => true]);
        if ($placena) $this->nakonOdgovora(fn () => $this->trgovina->posaljiMailove($placena));
    }

    /** javna adresa za poveznice: produkcija = adresa stranice, lokalno = adresa s kojom je otvoreno */
    private function adresa(): string
    {
        return $this->produkcija ? $this->konf->origin : 'http://' . self::zaglavlje('Host');
    }
    /** odgovor ide pregledniku odmah, a slanje na GitHub radi se poslije (traje nekoliko sekundi) */
    private function nakonOdgovora(callable $fn): void
    {
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
        elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
        else flush();
        ignore_user_abort(true);
        @set_time_limit(120);
        $fn();
    }

    // ---------------- ulaz ----------------
    public function obradi(): void
    {
        $metoda = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $put = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        try {
            if (!in_array($metoda, ['GET', 'HEAD', 'POST', 'PUT'], true)) { $this->posalji(405, '', 'text/plain', ['Allow' => 'GET, HEAD, POST, PUT']); return; }
            // samo preko prave adrese (zaštita od DNS rebindinga)
            if (!$this->dopustenHost(self::zaglavlje('Host'))) { $this->posalji(421, '', 'text/plain'); return; }
            if (str_starts_with($put, '/urednistvo/api/')) { $this->api($metoda, substr($put, strlen('/urednistvo/api'))); return; }
            if ($metoda !== 'GET' && $metoda !== 'HEAD') { $this->posalji(405, '', 'text/plain'); return; }
            if (preg_match('#^/urednistvo/static/([a-z0-9-]+\.(js|mjs|css|svg))$#', $put, $m)) {
                $f = $this->p['sucelje'] . '/' . $m[1];
                if (!is_file($f)) { $this->posalji(404, '', 'text/plain'); return; }
                $vrste = ['js' => 'text/javascript; charset=utf-8', 'mjs' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'svg' => 'image/svg+xml'];
                $this->posalji(200, (string) file_get_contents($f), $vrste[$m[2]]);
                return;
            }
            $this->posalji(200, (string) file_get_contents($this->p['sucelje'] . '/index.html'), 'text/html; charset=utf-8');
        } catch (Throwable $e) {
            error_log('[uredništvo] ' . $e);
            if (!headers_sent()) $this->json(500, ['greska' => 'Greška na poslužitelju.']);
        }
    }

    private function api(string $metoda, string $podput): void
    {
        try {
            // minijature: GET /slike/<ključ>
            if ($metoda === 'GET' && preg_match('#^/slike/([A-Za-z0-9._-]{1,64})$#', $podput, $m)) {
                $this->prijavljen(false);
                $b = $this->slike->minijatura($m[1]);
                if ($b === null) throw new Greska(404, 'Nema fotografije');
                $this->posalji(200, $b, 'image/webp', ['Cache-Control' => 'private, max-age=3600']);
                return;
            }
            // Stripe potvrda plaćanja dolazi sa Stripea (bez Origina); vrijedi samo s ispravnim potpisom
            if ($metoda === 'POST' && $podput === '/stripe/webhook') { $this->stripeWebhook(); return; }
            // trgovina: javne rute za kupce (POST samo s naše stranice), greške u obliku API-CONTRACT §5
            if (str_starts_with($podput, '/trgovina/')) { $this->trgovinaRuta($metoda, $podput); return; }
            if ($metoda !== 'GET' && !$this->istiIzvor()) throw new Greska(403, 'Zahtjev nije s ove stranice');
            $this->ruta($metoda, $podput);
        } catch (Greska $e) {
            if (headers_sent()) return;
            $this->json($e->status, ['greska' => $e->getMessage(), ...$e->podaci], $e->status === 429 && isset($e->podaci['cekaj']) ? ['Retry-After' => (string) $e->podaci['cekaj']] : []);
        } catch (Throwable $e) {
            error_log('[uredništvo] ' . $e);
            if (!headers_sent()) $this->json(500, ['greska' => 'Greška na poslužitelju.']);
        }
    }
}
