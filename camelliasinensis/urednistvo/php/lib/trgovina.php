<?php
// Trgovina na hostingu: naplata preko Stripe Checkouta, narudžbe, zaliha nakon prodaje, mailovi i kontakt obrazac.
// Javne rute (bez prijave, samo s naše stranice) su /urednistvo/api/trgovina/*, a Stripe šalje potvrde na
// /urednistvo/api/stripe/webhook (lib/api.php). Pravila cijene i zalihe su ista kao lib/shop/engine.ts (API-CONTRACT §3):
// klijent šalje samo { sku, qty }; cijenu, zalihu i dostavu uvijek računa poslužitelj iz kataloga uredništva.
// Podaci kupaca (ime, adresa, telefon) su samo u camellia-podaci/narudzbe/ izvan public_html i nikad u logu.
declare(strict_types=1);

const TRG_SKU = '/^[A-Za-z0-9._-]{1,64}$/';
const TRG_NAJVISE_REDAKA = 50;
const TRG_NAJVISE_KOLICINE_UNOS = 10_000;
const TRG_TOKEN_VRIJEDI_S = 86_400; // API-CONTRACT §3.7
const TRG_DOGADAJI = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];
const TRG_PROVJERA_STRIPEA_S = 5; // stranica nakon plaćanja pita svake 3 s; Stripe se pita najviše svakih 5 s po narudžbi

/** greška za kupca u obliku API-CONTRACT §5 ({ error: { code, details } }); poruku na hrvatskom piše frontend */
final class TrgovinaGreska extends RuntimeException
{
    public function __construct(public string $kod, public int $status = 409, public array $detalji = [])
    {
        parent::__construct($kod);
    }
}

function trg_brava(string $datoteka, callable $fn): mixed
{
    $f = fopen($datoteka, 'c');
    if ($f === false) throw new RuntimeException('Ne mogu zaključati ' . basename($datoteka));
    try {
        flock($f, LOCK_EX);
        return $fn();
    } finally {
        flock($f, LOCK_UN);
        fclose($f);
    }
}

function trg_eur(int $centi): string { return number_format($centi / 100, 2, ',', '.') . ' €'; }

/** "marko.horvat@gmail.com" → "m***@gmail.com" (kao maskEmail u engine.ts) */
function trg_maskiraj(?string $email): ?string
{
    if (!is_string($email)) return null;
    return preg_match('/^([^@\s])[^@\s]*@([^@\s]+\.[^@\s]+)$/', trim($email), $m) ? "{$m[1]}***@{$m[2]}" : null;
}

// ---------------- GLS paketomati ----------------
/**
 * Popis paketomata je public_html/gls/paketomati.json iz paketa stranice (scripts/gls-paketomati.mjs, javni GLS popis).
 * Kupac šalje samo ID; naziv i adresa za narudžbu, Stripe i mail uvijek se uzimaju odavde, nikad iz zahtjeva.
 */
final class Paketomati
{
    private ?array $indeks = null;

    public function __construct(private string $javno) {}

    /** @return ?array{id:string, naziv:string, ulica:string, postanski:string, grad:string} */
    public function nadji(string $id): ?array
    {
        if (!preg_match('/^[A-Za-z0-9-]{3,40}$/', $id)) return null;
        if ($this->indeks === null) {
            $this->indeks = [];
            $d = citaj_json(rtrim($this->javno, '/\\') . '/gls/paketomati.json', []);
            foreach (is_array($d['paketomati'] ?? null) ? $d['paketomati'] : [] as $r) {
                if (is_array($r) && isset($r[0], $r[1], $r[2], $r[3], $r[4]) && is_string($r[0])) $this->indeks[$r[0]] = $r;
            }
        }
        $r = $this->indeks[$id] ?? null;
        return $r ? ['id' => $id, 'naziv' => (string) $r[1], 'ulica' => (string) $r[2], 'postanski' => (string) $r[3], 'grad' => (string) $r[4]] : null;
    }

    public static function oznaka(array $p): string { return "{$p['naziv']}, {$p['ulica']}, {$p['postanski']} {$p['grad']}"; }
}

// ---------------- zaliha nakon prodaje ----------------
/**
 * Prodaje ne mijenjaju verziju kataloga (inače bi uredništvo pri svakoj prodaji javilo "netko je spremio promjene").
 * Bilježe se ovdje, a stvarna zaliha = zaliha u katalogu − prodano od zadnjeg spremanja. Kad urednik spremi katalog,
 * od upisane zalihe se oduzmu prodaje nakon trenutka kad je otvorio katalog (prodajaSeq), pa se zapis isprazni.
 */
final class Prodaja
{
    private string $dat;
    private string $brava;

    public function __construct(string $podaci)
    {
        $this->dat = $podaci . '/prodaja.json';
        $this->brava = $podaci . '/prodaja.lock';
    }

    public function sBravom(callable $fn): mixed { return trg_brava($this->brava, $fn); }

    /** @return array{seq:int, stavke:list<array{seq:int, sku:string, kol:int, narudzba:string}>} */
    private function stanje(): array
    {
        $s = citaj_json($this->dat, null);
        return is_array($s) ? ['seq' => (int) ($s['seq'] ?? 0), 'stavke' => array_values($s['stavke'] ?? [])] : ['seq' => 0, 'stavke' => []];
    }

    public function seq(): int { return $this->stanje()['seq']; }

    /** @return array<string,int> sku => prodano (od zadnjeg spremanja, ili nakon $odSeq) */
    public function prodano(int $odSeq = -1): array
    {
        $p = [];
        foreach ($this->stanje()['stavke'] as $s) if ($s['seq'] > $odSeq) $p[$s['sku']] = ($p[$s['sku']] ?? 0) + (int) $s['kol'];
        return $p;
    }

    /** katalog sa stvarnom zalihom (zaliha null = ne broji se) */
    public function primijeni(array $k, int $odSeq = -1): array
    {
        $p = $this->prodano($odSeq);
        if (!$p) return $k;
        foreach ($k['proizvodi'] as &$pr) {
            if (isset($p[$pr['sku']]) && is_int($pr['zaliha'] ?? null)) $pr['zaliha'] = max(0, $pr['zaliha'] - $p[$pr['sku']]);
        }
        return $k;
    }

    /** pozvati pod sBravom */
    public function zabiljezi(string $narudzba, array $stavke): void
    {
        $s = $this->stanje();
        $s['seq']++;
        foreach ($stavke as $st) $s['stavke'][] = ['seq' => $s['seq'], 'sku' => (string) $st['sku'], 'kol' => (int) $st['kol'], 'narudzba' => $narudzba, 'vrijeme' => iso_vrijeme()];
        pisi_json($this->dat, $s);
    }

    /** nakon spremanja kataloga (pod sBravom): sve prodaje su sad u zalihi kataloga */
    public function isprazni(): void
    {
        pisi_json($this->dat, ['seq' => $this->seq(), 'stavke' => []]);
    }
}

// ---------------- narudžbe ----------------
final class Narudzbe
{
    private string $dir;

    public function __construct(string $podaci)
    {
        $this->dir = $podaci . '/narudzbe';
        if (!is_dir($this->dir)) @mkdir($this->dir, 0700, true);
        if (!is_dir($this->dir . '/t')) @mkdir($this->dir . '/t', 0700, true);
    }

    public function sBravom(callable $fn): mixed { return trg_brava($this->dir . '/.brava', $fn); }

    private function put(string $id): string
    {
        if (!preg_match('/^CS-\d{4,9}$/', $id)) throw new RuntimeException('Neispravan broj narudžbe');
        return "{$this->dir}/$id.json";
    }

    /** nova narudžba: čitljiv broj (CS-1001, CS-1002 …) i token za stranicu nakon plaćanja */
    public function nova(array $podaci): array
    {
        return $this->sBravom(function () use ($podaci) {
            $b = citaj_json($this->dir . '/brojac.json', ['zadnji' => 1000]);
            $broj = (int) $b['zadnji'] + 1;
            pisi_json($this->dir . '/brojac.json', ['zadnji' => $broj]);
            $token = bin2hex(random_bytes(24)); // 192 bita (API-CONTRACT §3.7)
            $n = ['id' => "CS-$broj", 'token' => $token, 'stanje' => 'pending', 'stvoreno' => iso_vrijeme(), 'stvorenoS' => time(), ...$podaci];
            pisi_json($this->put($n['id']), $n);
            pisi_atomarno("{$this->dir}/t/" . hash('sha256', $token), $n['id']);
            return $n;
        });
    }

    public function poId(string $id): ?array
    {
        try { $n = citaj_json($this->put($id)); } catch (Throwable) { return null; }
        return is_array($n) ? $n : null;
    }

    public function poTokenu(mixed $token): ?array
    {
        if (!is_string($token) || !preg_match('/^[0-9a-f]{48}$/', $token)) return null;
        $f = "{$this->dir}/t/" . hash('sha256', $token);
        if (!is_file($f)) return null;
        $n = $this->poId(trim((string) file_get_contents($f)));
        return $n && hash_equals($n['token'], $token) ? $n : null;
    }

    /** izmjena pod bravom; $fn vraća novu narudžbu ili null (bez promjene) */
    public function izmijeni(string $id, callable $fn): ?array
    {
        return $this->sBravom(function () use ($id, $fn) {
            $n = $this->poId($id);
            if (!$n) return null;
            $novi = $fn($n);
            if (!is_array($novi)) return null;
            pisi_json($this->put($id), $novi);
            return $novi;
        });
    }

    /** zadnje narudžbe, najnovije prve (za uredništvo; bez tokena) */
    public function popis(int $najvise = 200): array
    {
        $sve = glob($this->dir . '/CS-*.json') ?: [];
        usort($sve, fn ($a, $b) => (int) substr(basename($b, '.json'), 3) <=> (int) substr(basename($a, '.json'), 3));
        $out = [];
        foreach (array_slice($sve, 0, $najvise) as $f) {
            $n = citaj_json($f);
            if (!is_array($n)) continue;
            unset($n['token'], $n['dogadaji'], $n['provjerenoS']);
            $out[] = $n;
        }
        return $out;
    }
}

// ---------------- postavke plaćanja (Stripe ključ, webhook, mailovi) ----------------
final class Placanje
{
    private string $dat;

    public function __construct(string $podaci, private string $origin, private bool $lokalno)
    {
        $this->dat = $podaci . '/placanje.json';
    }

    private function p(): array { return citaj_json($this->dat, []) ?: []; }

    public function stripe(): ?Stripe
    {
        $k = $this->p()['kljuc'] ?? '';
        return is_string($k) && Stripe::ispravanKljuc($k) ? new Stripe($k, getenv('UREDNISTVO_STRIPE_API') ?: STRIPE_API) : null;
    }

    /** @return string[] */
    public function tajne(): array { return array_values(array_filter([$this->p()['webhookTajna'] ?? null], 'is_string')); }
    public function emailTrgovine(): ?string { $e = $this->p()['emailTrgovine'] ?? null; return is_string($e) && $e !== '' ? $e : null; }
    public function posiljatelj(): ?string { $e = $this->p()['posiljatelj'] ?? null; return is_string($e) && $e !== '' ? $e : $this->emailTrgovine(); }
    public function telefon(): ?string { $t = $this->p()['telefonTrgovine'] ?? null; return is_string($t) && $t !== '' ? $t : null; }
    public function webhookUrl(): string { return $this->origin . '/urednistvo/api/stripe/webhook'; }

    /** za uredništvo: nikad ključ ni tajna, samo način i zadnja četiri znaka */
    public function javno(): array
    {
        $p = $this->p();
        $k = is_string($p['kljuc'] ?? null) ? $p['kljuc'] : '';
        return [
            'ukljuceno' => $k !== '' && !empty($p['webhookTajna']),
            'nacin' => $k !== '' ? Stripe::nacin($k) : null,
            'kljucKraj' => $k !== '' ? substr($k, -4) : null,
            'vrstaKljuca' => $k !== '' ? (str_starts_with($k, 'rk_') ? 'ograničeni' : 'tajni') : null,
            'webhookUrl' => $this->webhookUrl(),
            'emailTrgovine' => $p['emailTrgovine'] ?? '',
            'posiljatelj' => $p['posiljatelj'] ?? '',
            'telefonTrgovine' => $p['telefonTrgovine'] ?? '',
            'provjereno' => $p['provjereno'] ?? null,
        ];
    }

    private static function email(mixed $v, string $polje): string
    {
        $v = is_string($v) ? trim($v) : '';
        if ($v === '') return '';
        if (strlen($v) > 200 || preg_match('/[\r\n]/', $v) || !filter_var($v, FILTER_VALIDATE_EMAIL)) throw new Greska(422, "$polje nije ispravna e-mail adresa.");
        return $v;
    }

    /**
     * Spremi postavke. Novi ključ se odmah isproba: probna sesija plaćanja (odmah se poništi, ništa se ne naplaćuje)
     * provjeri sve dozvole koje trgovina treba, a zatim se u Stripeu napravi webhook prema ovoj stranici.
     */
    public function spremi(array $b): array
    {
        $p = $this->p();
        $p['emailTrgovine'] = self::email($b['emailTrgovine'] ?? ($p['emailTrgovine'] ?? ''), 'E-mail trgovine');
        $p['posiljatelj'] = self::email($b['posiljatelj'] ?? ($p['posiljatelj'] ?? ''), 'Pošiljatelj');
        $tel = is_string($b['telefonTrgovine'] ?? null) ? trim($b['telefonTrgovine']) : (string) ($p['telefonTrgovine'] ?? '');
        if ($tel !== '' && !preg_match('#^\+?[0-9 ()/-]{6,30}$#', $tel)) throw new Greska(422, 'Telefon trgovine: samo brojke, razmaci, +, -, / i zagrade.');
        $p['telefonTrgovine'] = $tel;
        $kljuc = is_string($b['kljuc'] ?? null) ? trim($b['kljuc']) : '';
        if ($kljuc !== '') {
            if (!Stripe::ispravanKljuc($kljuc)) throw new Greska(422, 'Ključ mora počinjati s rk_live_, rk_test_, sk_live_ ili sk_test_.');
            $s = new Stripe($kljuc, getenv('UREDNISTVO_STRIPE_API') ?: STRIPE_API);
            try {
                self::probnaSesija($s, $this->origin);
                if ($this->lokalno) {
                    // lokalni test: Stripe ne može slati na localhost; potpise testovi rade sami s ovom tajnom
                    $wh = ['id' => null, 'secret' => getenv('UREDNISTVO_WEBHOOK_TAJNA') ?: 'whsec_lokalno_' . bin2hex(random_bytes(16))];
                } else {
                    $wh = $s->zahtjev('POST', '/v1/webhook_endpoints', [
                        'url' => $this->webhookUrl(),
                        'enabled_events' => TRG_DOGADAJI,
                        'api_version' => STRIPE_VERZIJA,
                        'description' => 'Camellia sinensis: potvrda plaćanja (uredništvo)',
                    ]);
                }
            } catch (StripeGreska $e) {
                throw new Greska(422, self::porukaKljuca($e));
            }
            // stari webhook (stari ključ ili isti račun) se briše, da Stripe ne šalje na dva mjesta
            $stari = $this->stripe();
            if ($stari && !empty($p['webhookId'])) {
                try { $stari->zahtjev('DELETE', '/v1/webhook_endpoints/' . rawurlencode((string) $p['webhookId'])); } catch (Throwable) {}
            }
            $p = [...$p, 'kljuc' => $kljuc, 'webhookId' => $wh['id'] ?? null, 'webhookTajna' => (string) ($wh['secret'] ?? ''), 'provjereno' => iso_vrijeme()];
        }
        pisi_json($this->dat, $p);
        return $this->javno();
    }

    public function ukloni(): array
    {
        $p = $this->p();
        $s = $this->stripe();
        if ($s && !empty($p['webhookId'])) {
            try { $s->zahtjev('DELETE', '/v1/webhook_endpoints/' . rawurlencode((string) $p['webhookId'])); } catch (Throwable) {}
        }
        unset($p['kljuc'], $p['webhookId'], $p['webhookTajna'], $p['provjereno']);
        pisi_json($this->dat, $p);
        return $this->javno();
    }

    /** sve što prava naplata radi, jednom: stvori sesiju s dostavom, pročitaj je s načinom dostave, poništi je */
    private static function probnaSesija(Stripe $s, string $origin): void
    {
        $ses = $s->zahtjev('POST', '/v1/checkout/sessions', [
            'mode' => 'payment',
            'line_items' => [['quantity' => 1, 'price_data' => ['currency' => 'eur', 'unit_amount' => 100, 'product_data' => ['name' => 'Provjera ključa (ne naplaćuje se)']]]],
            'shipping_address_collection' => ['allowed_countries' => ['HR']],
            'shipping_options' => [['shipping_rate_data' => ['type' => 'fixed_amount', 'fixed_amount' => ['amount' => 0, 'currency' => 'eur'], 'display_name' => 'Provjera']]],
            'success_url' => $origin . '/',
            'cancel_url' => $origin . '/',
        ]);
        $s->zahtjev('GET', '/v1/checkout/sessions/' . rawurlencode((string) $ses['id']), ['expand' => ['shipping_options.shipping_rate']]);
        $s->zahtjev('POST', '/v1/checkout/sessions/' . rawurlencode((string) $ses['id']) . '/expire');
    }

    private static function porukaKljuca(StripeGreska $e): string
    {
        if ($e->status === 401) return 'Stripe ne prihvaća ovaj ključ (je li dobro kopiran, ili je obrisan/zamijenjen?).';
        if ($e->status === 403) {
            // Stripe u poruci navede koja dozvola nedostaje (npr. "rak_webhook_write")
            $doz = preg_match('/\b(rak_[a-z_]+)\b/', $e->getMessage(), $m) ? " Nedostaje dozvola: {$m[1]}." : '';
            return 'Ključ nema sve potrebne dozvole.' . $doz . ' U Stripeu ključu dodaj dozvole iz uputa (Edit key) i spremi ponovno.';
        }
        if ($e->status === 0) return 'Stripe trenutno nije dostupan. Pokušaj ponovno za minutu.';
        return 'Stripe je odbio provjeru: ' . mb_substr($e->getMessage(), 0, 300);
    }
}

// ---------------- mail ----------------
final class Posta
{
    public function __construct(private ?string $posiljatelj) {}

    private static function adresa(?string $a): ?string
    {
        return is_string($a) && $a !== '' && !preg_match('/[\r\n]/', $a) && filter_var($a, FILTER_VALIDATE_EMAIL) ? $a : null;
    }

    /** mail u UTF-8: običan tekst, a uz $html i HTML inačica (multipart/alternative); false ako ga poslužitelj nije prihvatio */
    public function posalji(?string $za, string $naslov, string $tekst, ?string $odgovoriNa = null, ?string $html = null): bool
    {
        $za = self::adresa($za);
        $od = self::adresa($this->posiljatelj);
        if (!$za || !$od) return false;
        $b64 = static fn (string $s): string => chunk_split(base64_encode(str_replace(["\r\n", "\n"], ["\n", "\r\n"], $s)));
        $zag = [
            'From: ' . mb_encode_mimeheader('Camellia sinensis', 'UTF-8', 'B') . " <$od>",
            'MIME-Version: 1.0',
            'X-Mailer: camellia-trgovina',
        ];
        if ($html === null) {
            $zag[] = 'Content-Type: text/plain; charset=UTF-8';
            $zag[] = 'Content-Transfer-Encoding: base64';
            $tijelo = $b64($tekst);
        } else {
            $granica = 'cs-' . bin2hex(random_bytes(12));
            $zag[] = "Content-Type: multipart/alternative; boundary=\"$granica\"";
            $tijelo = "--$granica\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . $b64($tekst)
                . "--$granica\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . $b64($html)
                . "--$granica--\r\n";
        }
        if ($r = self::adresa($odgovoriNa)) $zag[] = "Reply-To: $r";
        $naslov = mb_encode_mimeheader(str_replace(["\r", "\n"], ' ', $naslov), 'UTF-8', 'B');
        $ok = @mail($za, $naslov, $tijelo, implode("\r\n", $zag), "-f$od");
        if (!$ok) $ok = @mail($za, $naslov, $tijelo, implode("\r\n", $zag)); // neki poslužitelji ne dopuštaju -f
        if (!$ok) error_log('[trgovina] mail nije poslan (' . substr(hash('sha256', $za), 0, 8) . ')');
        return $ok;
    }
}

// ---------------- trgovina ----------------
final class Trgovina
{
    /** @param array{dostava:list<array{id:string,name:string,price:int}>, besplatnaDostavaOd:int, najvisePoNarudzbi:int, maloNaZalihi:int} $pravila */
    public function __construct(
        private Spremiste $spremiste,
        private Prodaja $prodaja,
        private Narudzbe $narudzbe,
        private Placanje $placanje,
        private Zivo $zivo,
        private array $pravila,
        private string $origin,
        private ?Paketomati $paketomati = null,
    ) {}

    /** katalog sa stvarnom zalihom (nakon prodaja) */
    public function katalog(): array { return $this->prodaja->primijeni($this->spremiste->ucitaj()); }

    /** zivo.json sa stvarnom zalihom: cijena i zaliha na stranici odmah */
    public function osvjeziZivo(): void { $this->zivo->zapisi($this->katalog()); }

    private function dozvoljeno(?int $zaliha): int
    {
        if ($zaliha === null) return $this->pravila['najvisePoNarudzbi'];
        return max(0, min($zaliha, $this->pravila['najvisePoNarudzbi']));
    }

    /** @return list<array{sku:string, kol:int}> spojeni retci; samo { sku, qty }, sve ostalo se zanemaruje */
    private static function retci(mixed $ulaz): array
    {
        if (!is_array($ulaz) || !array_is_list($ulaz) || !$ulaz || count($ulaz) > TRG_NAJVISE_REDAKA) throw new TrgovinaGreska('INVALID_REQUEST', 400);
        $spojeno = [];
        foreach ($ulaz as $r) {
            if (!is_array($r)) throw new TrgovinaGreska('INVALID_REQUEST', 400);
            $sku = $r['sku'] ?? null;
            $kol = $r['qty'] ?? null;
            if (!is_string($sku) || !preg_match(TRG_SKU, $sku)) throw new TrgovinaGreska('INVALID_REQUEST', 400);
            if (!is_int($kol) || $kol < 1 || $kol > TRG_NAJVISE_KOLICINE_UNOS) throw new TrgovinaGreska('INVALID_REQUEST', 400, ['sku' => $sku]);
            $spojeno[$sku] = ($spojeno[$sku] ?? 0) + $kol;
        }
        return array_map(fn ($sku, $kol) => ['sku' => (string) $sku, 'kol' => $kol], array_keys($spojeno), $spojeno);
    }

    /** cijene iz kataloga uredništva; prvi problem je greška (kao priceForCheckout u engine.ts) */
    public function obracunaj(mixed $ulaz): array
    {
        $retci = self::retci($ulaz);
        $katalog = [];
        foreach ($this->katalog()['proizvodi'] as $p) $katalog[$p['sku']] = $p;
        $stavke = [];
        $medjuzbroj = 0;
        foreach ($retci as ['sku' => $sku, 'kol' => $kol]) {
            $p = $katalog[$sku] ?? null;
            if (!$p) throw new TrgovinaGreska('UNKNOWN_SKU', 409, ['sku' => $sku, 'availableQty' => null]);
            if (empty($p['objavljeno'])) throw new TrgovinaGreska('UNPUBLISHED', 409, ['sku' => $sku, 'availableQty' => null]);
            if ($kol > $this->pravila['najvisePoNarudzbi']) throw new TrgovinaGreska('INVALID_REQUEST', 400, ['sku' => $sku]);
            $ima = $this->dozvoljeno(is_int($p['zaliha'] ?? null) ? $p['zaliha'] : null);
            if ($ima === 0) throw new TrgovinaGreska('OUT_OF_STOCK', 409, ['sku' => $sku, 'availableQty' => 0]);
            if ($kol > $ima) throw new TrgovinaGreska('INSUFFICIENT_STOCK', 409, ['sku' => $sku, 'availableQty' => $ima]);
            $cijena = (int) round(((float) $p['cijena']) * 100);
            if ($cijena <= 0) throw new TrgovinaGreska('UNPUBLISHED', 409, ['sku' => $sku, 'availableQty' => null]);
            $stavke[] = ['sku' => $sku, 'naziv' => (string) $p['naziv'], 'pakiranje' => (string) ($p['pakiranje'] ?? ''), 'kol' => $kol, 'cijena' => $cijena, 'iznos' => $cijena * $kol, 'slika' => !empty($p['slika'])];
            $medjuzbroj += $cijena * $kol;
        }
        return ['stavke' => $stavke, 'medjuzbroj' => $medjuzbroj];
    }

    private function dopustenUrl(mixed $url): bool
    {
        if (!is_string($url) || strlen($url) > 500) return false;
        $u = parse_url($url);
        if (!$u || empty($u['scheme']) || empty($u['host'])) return false;
        $izvor = strtolower("{$u['scheme']}://{$u['host']}" . (isset($u['port']) ? ":{$u['port']}" : ''));
        return $izvor === strtolower($this->origin);
    }

    /** fotografija proizvoda (JPG, do ~50 KB) za Stripe i mailove; gradnja je uvijek izradi uz ostale verzije */
    private function slikaProizvoda(string $sku): string { return $this->origin . '/img/p/' . rawurlencode($sku) . '.jpg'; }

    private static function sNarudzbom(string $url, string $token): string
    {
        return $url . (str_contains($url, '?') ? '&' : '?') . 'narudzba=' . $token;
    }

    /**
     * Odabir iz košarice: { nacin, paketomat? }. null = stariji klijent bez odabira: kupac bira način na Stripeu, a
     * paketomat se odabire najbliži adresi kupca. Paketomat mora postojati u GLS popisu.
     * @return ?array{nacin:string, paketomat:?array}
     */
    private function odabirDostave(mixed $d): ?array
    {
        if ($d === null) return null;
        if (!is_array($d) || !is_string($d['nacin'] ?? null)) throw new TrgovinaGreska('INVALID_REQUEST', 400);
        $ids = array_map(fn ($x) => $x['id'], $this->pravila['dostava']);
        if (!in_array($d['nacin'], $ids, true)) throw new TrgovinaGreska('INVALID_REQUEST', 400);
        if ($d['nacin'] !== 'gls-paketomat') return ['nacin' => $d['nacin'], 'paketomat' => null];
        $p = is_string($d['paketomat'] ?? null) && $this->paketomati ? $this->paketomati->nadji($d['paketomat']) : null;
        if (!$p) throw new TrgovinaGreska('INVALID_REQUEST', 400, ['field' => 'paketomat']);
        return ['nacin' => 'gls-paketomat', 'paketomat' => $p];
    }

    /** startCheckout (API-CONTRACT §3.4): sve ponovno provjeri, stvori narudžbu i Stripe sesiju */
    public function zapocni(array $tijelo): array
    {
        $urls = is_array($tijelo['urls'] ?? null) ? $tijelo['urls'] : [];
        if (!$this->dopustenUrl($urls['success'] ?? null) || !$this->dopustenUrl($urls['cancel'] ?? null)) throw new TrgovinaGreska('INVALID_REQUEST', 400);
        $obr = $this->obracunaj($tijelo['lines'] ?? null);
        $odabir = $this->odabirDostave($tijelo['dostava'] ?? null);
        $stripe = $this->placanje->stripe();
        if (!$stripe || !$this->placanje->tajne()) throw new TrgovinaGreska('CHECKOUT_UNAVAILABLE', 503);

        $besplatno = $obr['medjuzbroj'] >= $this->pravila['besplatnaDostavaOd'];
        $poklon = $besplatno && $this->pravila['poklon'] !== '' ? $this->pravila['poklon'] : null;
        $paketomat = $odabir['paketomat'] ?? null;
        $n = $this->narudzbe->nova(['stavke' => $obr['stavke'], 'medjuzbroj' => $obr['medjuzbroj'], 'poklon' => $poklon,
            'paketomat' => $paketomat ? Paketomati::oznaka($paketomat) . " (GLS {$paketomat['id']})" : null]);
        $opcije = [];
        foreach ($this->pravila['dostava'] as $d) {
            if ($odabir && $d['id'] !== $odabir['nacin']) continue; // samo način odabran u košarici
            $cijena = $besplatno ? 0 : (int) $d['price'];
            $opcije[] = ['shipping_rate_data' => [
                'type' => 'fixed_amount',
                'fixed_amount' => ['amount' => $cijena, 'currency' => 'eur'],
                'display_name' => ($paketomat ? "{$d['name']}: {$paketomat['naziv']}, {$paketomat['grad']}" : (!$odabir && $d['id'] === 'gls-paketomat' ? "{$d['name']} najbliži vašoj adresi" : $d['name']))
                    . ($besplatno ? ' (besplatno od ' . trg_eur($this->pravila['besplatnaDostavaOd']) . ')' : ''),
                'metadata' => ['dostava' => $d['id']],
                'delivery_estimate' => ['minimum' => ['unit' => 'business_day', 'value' => 1], 'maximum' => ['unit' => 'business_day', 'value' => $d['id'] === 'gls-adresa' ? 3 : 2]],
            ]];
        }
        try {
            $ses = $stripe->zahtjev('POST', '/v1/checkout/sessions', [
                'mode' => 'payment',
                'locale' => 'hr',
                'client_reference_id' => $n['id'],
                'metadata' => ['narudzba' => $n['id']],
                'payment_intent_data' => ['metadata' => ['narudzba' => $n['id']]],
                'line_items' => [
                    ...array_map(fn ($s) => ['quantity' => $s['kol'], 'price_data' => [
                        'currency' => 'eur',
                        'unit_amount' => $s['cijena'], // iz kataloga poslužitelja, nikad iz zahtjeva
                        'product_data' => [
                            'name' => mb_substr($s['naziv'] . ($s['pakiranje'] !== '' ? " ({$s['pakiranje']})" : ''), 0, 250),
                            'metadata' => ['sku' => $s['sku']],
                            ...($s['slika'] ? ['images' => [$this->slikaProizvoda($s['sku'])]] : []),
                        ],
                    ]], $obr['stavke']),
                    // poklon uz besplatnu dostavu: stavka od 0 € da ga kupac vidi i na Stripeovoj stranici
                    ...($poklon ? [['quantity' => 1, 'price_data' => ['currency' => 'eur', 'unit_amount' => 0, 'product_data' => ['name' => mb_strtoupper(mb_substr($poklon, 0, 1)) . mb_substr($poklon, 1) . ' (poklon)']]]] : []),
                ],
                // samo kartice (Visa, Mastercard, Maestro) s Apple Payem i Google Payem; bez Linka i ostalih načina
                'payment_method_types' => ['card'],
                'payment_method_options' => ['card' => ['restrictions' => ['brands_blocked' => ['american_express', 'discover_global_network']]]],
                'wallet_options' => ['link' => ['display' => 'never']],
                // izgled kao stranica: krem pozadina, maslinasti gumb, font Inter (podržava hrvatski), naš znak
                'branding_settings' => [
                    'display_name' => 'Camellia sinensis',
                    'background_color' => '#f6f0e4',
                    'button_color' => '#3b432e',
                    'font_family' => 'inter',
                    'border_style' => 'rounded',
                    'logo' => ['type' => 'url', 'url' => $this->origin . '/apple-touch-icon.png'],
                    'icon' => ['type' => 'url', 'url' => $this->origin . '/apple-touch-icon.png'],
                ],
                // paketomat: adresa samo za račun, paket ide u odabrani paketomat (piše iznad gumba za plaćanje)
                ...($paketomat
                    ? ['billing_address_collection' => 'required', 'custom_text' => ['submit' => ['message' => mb_substr('Paket šaljemo u GLS paketomat: ' . Paketomati::oznaka($paketomat) . '. GLS vam SMS-om javi kad stigne i pošalje kod za otvaranje.', 0, 1000)]]]
                    : ['shipping_address_collection' => ['allowed_countries' => ['HR']]]),
                'shipping_options' => $opcije,
                'phone_number_collection' => ['enabled' => 'true'],
                'tax_id_collection' => ['enabled' => 'true'], // tvrtke: naziv i OIB (PDV broj) za R1 račun
                'success_url' => self::sNarudzbom((string) $urls['success'], $n['token']), // naš token, ne ID Stripe sesije
                'cancel_url' => (string) $urls['cancel'],
            ], 'cs-' . $n['id'] . '-' . substr($n['token'], 0, 16)); // jedinstveno i ako se brojač narudžbi ikad vrati
        } catch (StripeGreska $e) {
            error_log("[trgovina] sesija plaćanja za {$n['id']} nije stvorena: {$e->status} {$e->vrsta} {$e->kod}");
            $this->narudzbe->izmijeni($n['id'], fn ($x) => [...$x, 'stanje' => 'failed', 'greska' => 'Stripe: ' . mb_substr($e->getMessage(), 0, 300)]);
            throw new TrgovinaGreska('CHECKOUT_UNAVAILABLE', 503);
        }
        $this->narudzbe->izmijeni($n['id'], fn ($x) => [...$x, 'sesija' => (string) $ses['id'], 'nacin' => !empty($ses['livemode']) ? 'live' : 'test']);
        return ['redirectUrl' => (string) $ses['url'], 'orderToken' => $n['token']];
    }

    /**
     * getOrderStatus (API-CONTRACT §3.5); ako webhook kasni, pita Stripe izravno (poslužitelj prema poslužitelju).
     * @return array{0: array, 1: ?array} odgovor za kupca i narudžba ako je upravo ovim pozivom postala plaćena (mailovi)
     */
    public function stanje(mixed $token): array
    {
        $n = $this->narudzbe->poTokenu($token);
        if (!$n || time() - (int) ($n['stvorenoS'] ?? 0) > TRG_TOKEN_VRIJEDI_S) return [['status' => 'unknown'], null];
        $placena = null;
        if ($n['stanje'] === 'pending' && !empty($n['sesija']) && time() - (int) ($n['provjerenoS'] ?? 0) >= TRG_PROVJERA_STRIPEA_S) {
            $this->narudzbe->izmijeni($n['id'], fn ($x) => [...$x, 'provjerenoS' => time()]);
            try {
                $placena = $this->obradiSesiju((string) $n['sesija'], null);
            } catch (Throwable $e) {
                error_log('[trgovina] provjera plaćanja: ' . $e->getMessage()); // ostaje pending, stranica pita ponovno
            }
            $n = $this->narudzbe->poId($n['id']) ?? $n;
        }
        $odg = ['status' => $n['stanje'], ...($n['stanje'] === 'paid' ? ['orderRef' => $n['id'], ...(($m = trg_maskiraj($n['kupac']['email'] ?? null)) ? ['email' => $m] : [])] : [])];
        return [$odg, $placena];
    }

    /** Stripe webhook: potpis, pa obrada (svaki događaj jednom). Vraća narudžbu koja je upravo plaćena (za mailove) */
    public function webhook(string $tijelo, string $potpis): ?array
    {
        $d = Stripe::dogadaj($tijelo, $potpis, $this->placanje->tajne());
        if (!in_array($d['type'], TRG_DOGADAJI, true)) return null;
        $s = $d['data']['object'] ?? [];
        return $this->obradiSesiju((string) ($s['id'] ?? ''), $d);
    }

    /**
     * Stanje sesije uvijek se čita sa Stripea (ne iz tijela događaja), s odabranom dostavom.
     * @return array|null narudžba ako je OVIM pozivom postala plaćena (samo tada se šalju mailovi)
     */
    private function obradiSesiju(string $sesijaId, ?array $dogadaj): ?array
    {
        if (!preg_match('/^cs_(test|live)_[A-Za-z0-9]{10,200}$/', $sesijaId)) return null;
        $stripe = $this->placanje->stripe();
        if (!$stripe) throw new RuntimeException('Plaćanje nije postavljeno');
        $s = $stripe->zahtjev('GET', '/v1/checkout/sessions/' . rawurlencode($sesijaId), ['expand' => ['shipping_cost.shipping_rate']]);
        $id = (string) ($s['client_reference_id'] ?? ($s['metadata']['narudzba'] ?? ''));
        $n = preg_match('/^CS-\d{4,9}$/', $id) ? $this->narudzbe->poId($id) : null;
        if (!$n || ($n['sesija'] ?? '') !== $sesijaId) {
            error_log("[trgovina] Stripe sesija bez naše narudžbe ($id)");
            return null;
        }
        $vrsta = $dogadaj['type'] ?? null;
        $placeno = in_array($s['payment_status'] ?? '', ['paid', 'no_payment_required'], true);
        if ($placeno) return $this->plati($n['id'], $s, $dogadaj['id'] ?? null);
        // "complete" + "unpaid" = odgođeno plaćanje (npr. bankovni prijenos) još traje: ostaje pending do svog događaja
        if ($vrsta === 'checkout.session.async_payment_failed') {
            $this->narudzbe->izmijeni($n['id'], fn ($x) => $x['stanje'] === 'pending' ? [...$x, 'stanje' => 'failed'] : null);
        } elseif (($s['status'] ?? '') === 'expired') {
            $this->narudzbe->izmijeni($n['id'], fn ($x) => $x['stanje'] === 'pending' ? [...$x, 'stanje' => 'cancelled'] : null);
        }
        return null;
    }

    /** označi plaćeno (jednom), zapiši kupca i dostavu, skini zalihu. Vraća narudžbu samo pri prvom označavanju. */
    private function plati(string $id, array $s, ?string $dogadajId): ?array
    {
        $kd = is_array($s['customer_details'] ?? null) ? $s['customer_details'] : [];
        $ci = is_array($s['collected_information'] ?? null) ? $s['collected_information'] : [];
        $sd = is_array($ci['shipping_details'] ?? null) ? $ci['shipping_details'] : (is_array($s['shipping_details'] ?? null) ? $s['shipping_details'] : []);
        $adr = is_array($sd['address'] ?? null) ? $sd['address'] : [];
        $rate = $s['shipping_cost']['shipping_rate'] ?? null;
        if (!$adr && is_array($kd['address'] ?? null)) $adr = $kd['address']; // paketomat: adresa za račun
        $oib = [];
        foreach ($kd['tax_ids'] ?? [] as $t) if (is_string($t['value'] ?? null)) $oib[] = $t['value'];
        $podaci = [
            'kupac' => [
                'ime' => (string) ($kd['name'] ?? ($sd['name'] ?? '')),
                'email' => (string) ($kd['email'] ?? ''),
                'telefon' => (string) ($kd['phone'] ?? ''),
                'tvrtka' => is_string($kd['business_name'] ?? null) ? $kd['business_name'] : null,
                'oib' => $oib ? implode(', ', $oib) : null,
            ],
            'adresa' => [
                'ime' => (string) ($sd['name'] ?? ($kd['name'] ?? '')),
                'ulica' => trim(((string) ($adr['line1'] ?? '')) . ' ' . ((string) ($adr['line2'] ?? ''))),
                'postanski' => (string) ($adr['postal_code'] ?? ''),
                'grad' => (string) ($adr['city'] ?? ''),
                'drzava' => (string) ($adr['country'] ?? ''),
            ],
            'dostava' => [
                'id' => is_array($rate) ? (string) ($rate['metadata']['dostava'] ?? '') : '',
                'naziv' => is_array($rate) ? (string) ($rate['display_name'] ?? 'Dostava') : 'Dostava',
                'cijena' => (int) ($s['shipping_cost']['amount_total'] ?? 0),
            ],
            'ukupno' => (int) ($s['amount_total'] ?? 0),
            'placeno' => iso_vrijeme(),
            'placanje' => is_string($s['payment_intent'] ?? null) ? $s['payment_intent'] : null,
            'nacin' => !empty($s['livemode']) ? 'live' : 'test',
        ];
        $upravo = false;
        $n = $this->narudzbe->izmijeni($id, function ($x) use ($podaci, $dogadajId, &$upravo) {
            if ($x['stanje'] === 'paid') return null;
            $upravo = true;
            // paketomat je zapisan pri stvaranju narudžbe; stariji klijent bez odabira: najbliži adresi kupca
            $paketomat = $x['paketomat'] ?? (($podaci['dostava']['id'] ?? '') === 'gls-paketomat' ? 'najbliži adresi kupca (odaberi pri slanju)' : null);
            return [...$x, ...$podaci, 'paketomat' => $paketomat, 'stanje' => 'paid', 'dogadaji' => array_slice([...($x['dogadaji'] ?? []), $dogadajId], -20)];
        });
        if (!$upravo || !$n) return null;
        // zaliha: jednom po narudžbi; ako je u međuvremenu netko kupio zadnje komade, narudžba je plaćena,
        // ali se trgovina upozorava u mailu (povrat ili dogovor s kupcem)
        $manjak = $this->prodaja->sBravom(function () use ($n) {
            $katalog = $this->katalog();
            $zalihe = [];
            foreach ($katalog['proizvodi'] as $p) $zalihe[$p['sku']] = is_int($p['zaliha'] ?? null) ? $p['zaliha'] : null;
            $manjak = [];
            foreach ($n['stavke'] as $st) {
                $z = $zalihe[$st['sku']] ?? null;
                if ($z !== null && $z < $st['kol']) $manjak[] = $st['sku'];
            }
            $this->prodaja->zabiljezi($n['id'], $n['stavke']);
            return $manjak;
        });
        $n = $this->narudzbe->izmijeni($id, fn ($x) => [...$x, 'zalihaSkinuta' => true, 'manjak' => $manjak]) ?? $n;
        $this->osvjeziZivo();
        return $n;
    }

    // ---------------- mailovi ----------------
    private function stavkeTekst(array $n): string
    {
        $r = [];
        foreach ($n['stavke'] as $s) $r[] = "  {$s['kol']} × {$s['naziv']}" . ($s['pakiranje'] !== '' ? " ({$s['pakiranje']})" : '') . ' — ' . trg_eur($s['iznos']);
        if (!empty($n['poklon'])) $r[] = "  1 × {$n['poklon']} — poklon";
        return implode("\n", $r);
    }

    /**
     * HTML inačica maila (tablice i stilovi u retku, jer ih tako čitaju svi programi za poštu), u bojama stranice.
     * Fotografije proizvoda su JPG s naše stranice; kontakt trgovine je na dnu (kupcu) ili kupac na vrhu (trgovini).
     */
    private function htmlMail(array $n, bool $zaTrgovinu): string
    {
        $e = static fn (mixed $s): string => htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $o = $this->origin;
        $k = $n['kupac'] ?? [];
        $a = $n['adresa'] ?? [];
        $tel = $this->placanje->telefon();
        $mailTrg = $this->placanje->emailTrgovine();
        $test = ($n['nacin'] ?? '') === 'test';
        $red = static fn (string $lijevo, string $desno, bool $jako = false): string =>
            '<tr><td style="padding:6px 0;font-size:14px;color:#3b432e' . ($jako ? ';font-weight:bold;font-size:16px' : '') . '">' . $lijevo . '</td>'
            . '<td align="right" style="padding:6px 0;font-size:14px;color:#272a20;white-space:nowrap' . ($jako ? ';font-weight:bold;font-size:16px' : '') . '">' . $desno . '</td></tr>';

        $stavke = '';
        foreach ($n['stavke'] as $s) {
            $slika = !empty($s['slika'])
                ? '<img src="' . $e($this->slikaProizvoda($s['sku'])) . '" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:10px;object-fit:cover;background:#ece4d2">'
                : '<div style="width:56px;height:56px;border-radius:10px;background:#ece4d2"></div>';
            $stavke .= '<tr><td width="68" valign="top" style="padding:8px 12px 8px 0">' . $slika . '</td>'
                . '<td valign="top" style="padding:8px 0;font-size:14px;color:#272a20"><b>' . $e($s['naziv']) . '</b>'
                . ($s['pakiranje'] !== '' ? '<br><span style="color:#6b6b5f">' . $e($s['pakiranje']) . '</span>' : '')
                . ($zaTrgovinu ? '<br><span style="color:#6b6b5f">SKU ' . $e($s['sku']) . '</span>' : '')
                . '<br><span style="color:#6b6b5f">' . (int) $s['kol'] . ' × ' . $e(trg_eur((int) $s['cijena'])) . '</span></td>'
                . '<td valign="top" align="right" style="padding:8px 0;font-size:14px;color:#272a20;white-space:nowrap">' . $e(trg_eur((int) $s['iznos'])) . '</td></tr>';
        }
        if (!empty($n['poklon'])) {
            $stavke .= '<tr><td width="68" valign="top" style="padding:8px 12px 8px 0"><div style="width:56px;height:56px;border-radius:10px;background:#3b432e;color:#d4af37;font-size:26px;line-height:56px;text-align:center">&#10047;</div></td>'
                . '<td valign="top" style="padding:8px 0;font-size:14px;color:#272a20"><b>' . $e(mb_strtoupper(mb_substr($n['poklon'], 0, 1)) . mb_substr($n['poklon'], 1)) . '</b><br><span style="color:#8a6d14">poklon uz besplatnu dostavu</span></td>'
                . '<td valign="top" align="right" style="padding:8px 0;font-size:14px;color:#272a20">0,00 €</td></tr>';
        }
        $adresaKupca = implode('<br>', array_map($e, array_filter([$a['ime'] ?? '', $a['ulica'] ?? '', trim(($a['postanski'] ?? '') . ' ' . ($a['grad'] ?? ''))])));
        $uPaketomat = !empty($n['paketomat']);
        $adresa = $uPaketomat ? '<b>GLS paketomat:</b> ' . $e($n['paketomat']) . ($adresaKupca !== '' ? '<br><span style="color:#6b6b5f">Kupac: ' . $adresaKupca . '</span>' : '') : $adresaKupca;

        if ($zaTrgovinu) {
            $naslov = 'Nova narudžba ' . $e($n['id']) . ($test ? ' <span style="color:#8a6d14">(TEST)</span>' : '');
            $uvod = !empty($n['manjak'])
                ? '<p style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#f6e2dc;color:#8f2d1c;font-size:14px"><b>Pažnja:</b> za ' . $e(implode(', ', $n['manjak'])) . ' nije bilo dovoljno zalihe u trenutku plaćanja. Javi se kupcu ili napravi povrat u Stripeu.</p>'
                : '';
            $kupacTel = (string) ($k['telefon'] ?? '');
            $uvod .= '<p style="margin:0 0 4px;font-size:15px;color:#272a20"><b>' . $e($k['ime'] ?? '') . '</b></p>'
                . '<p style="margin:0 0 4px;font-size:14px"><a href="mailto:' . $e($k['email'] ?? '') . '" style="color:#3b432e">' . $e($k['email'] ?? '') . '</a></p>'
                . ($kupacTel !== '' ? '<p style="margin:0 0 4px;font-size:14px">Telefon: <a href="tel:' . $e(preg_replace('/[^0-9+]/', '', $kupacTel)) . '" style="color:#3b432e;font-weight:bold">' . $e($kupacTel) . '</a></p>' : '')
                . (!empty($k['tvrtka']) || !empty($k['oib']) ? '<p style="margin:0 0 4px;font-size:14px">R1 račun: ' . $e(trim(($k['tvrtka'] ?? '') . ' ' . ($k['oib'] ?? ''))) . '</p>' : '');
            $kraj = '<p style="margin:0;font-size:14px;color:#272a20">Odgovorom na ovaj e-mail pišete izravno kupcu.</p>';
        } else {
            $naslov = 'Hvala na narudžbi!';
            $uvod = '<p style="margin:0 0 4px;font-size:15px;color:#272a20">Narudžba <b>' . $e($n['id']) . '</b> je plaćena' . ($test ? ' (probna)' : '') . '. Javit ćemo vam se kad pošiljka krene.</p>';
            $kraj = '<p style="margin:0 0 6px;font-size:14px;color:#272a20"><b>Pitanja o narudžbi?</b> Samo odgovorite na ovaj e-mail'
                . ($tel ? ' ili nazovite <a href="tel:' . $e(preg_replace('/[^0-9+]/', '', $tel)) . '" style="color:#3b432e;font-weight:bold">' . $e($tel) . '</a>' : '') . '.</p>'
                . ($mailTrg ? '<p style="margin:0;font-size:14px"><a href="mailto:' . $e($mailTrg) . '" style="color:#3b432e">' . $e($mailTrg) . '</a></p>' : '');
        }

        return '<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' . strip_tags($naslov) . '</title></head>'
            . '<body style="margin:0;padding:0;background:#f6f0e4;font-family:Helvetica,Arial,sans-serif">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f0e4"><tr><td align="center" style="padding:24px 12px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">'
            . '<tr><td style="padding:0 4px 16px"><img src="' . $e($o) . '/apple-touch-icon.png" width="40" height="40" alt="" style="vertical-align:middle;border-radius:10px">'
            . '<span style="vertical-align:middle;margin-left:10px;font-size:18px;font-weight:bold;color:#3b432e">Camellia sinensis</span></td></tr>'
            . '<tr><td style="background:#fffdf8;border-radius:18px;padding:24px">'
            . '<h1 style="margin:0 0 12px;font-size:22px;color:#3b432e">' . $naslov . '</h1>' . $uvod
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #e2d9c6">' . $stavke . '</table>'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #e2d9c6">'
            . $red('Proizvodi', $e(trg_eur((int) $n['medjuzbroj'])))
            . $red('Dostava: ' . $e($n['dostava']['naziv'] ?? ''), (int) ($n['dostava']['cijena'] ?? 0) === 0 ? 'besplatno' : $e(trg_eur((int) $n['dostava']['cijena'])))
            . $red('Ukupno plaćeno', $e(trg_eur((int) $n['ukupno'])), true)
            . '</table>'
            . '<p style="margin:20px 0 4px;font-size:13px;color:#6b6b5f;text-transform:uppercase;letter-spacing:.08em">' . ($uPaketomat ? 'Dostava u paketomat' : 'Dostava na') . '</p>'
            . '<p style="margin:0 0 20px;font-size:14px;color:#272a20;line-height:1.5">' . $adresa . '</p>'
            . '<div style="border-top:1px solid #e2d9c6;padding-top:16px">' . $kraj . '</div>'
            . '</td></tr>'
            . '<tr><td align="center" style="padding:16px 4px;font-size:12px;color:#6b6b5f"><a href="' . $e($o) . '" style="color:#6b6b5f">' . $e(preg_replace('#^https?://#', '', $o)) . '</a></td></tr>'
            . '</table></td></tr></table></body></html>';
    }

    private function adresaTekst(array $n): string
    {
        $a = $n['adresa'] ?? [];
        $r = array_filter([$a['ime'] ?? '', $a['ulica'] ?? '', trim(($a['postanski'] ?? '') . ' ' . ($a['grad'] ?? ''))]);
        if (!empty($n['paketomat'])) array_unshift($r, "GLS paketomat: {$n['paketomat']}");
        return '  ' . implode("\n  ", $r);
    }

    public function posaljiMailove(array $n): void
    {
        $posta = new Posta($this->placanje->posiljatelj());
        $test = ($n['nacin'] ?? '') === 'test' ? ' [TEST]' : '';
        $dostava = "Dostava: {$n['dostava']['naziv']} — " . trg_eur((int) $n['dostava']['cijena']);
        $tel = $this->placanje->telefon();
        $kupac = "Hvala na narudžbi!\n\nBroj narudžbe: {$n['id']}\nPlaćeno: " . trg_eur((int) $n['ukupno']) . "\n\nNaručeno:\n" . $this->stavkeTekst($n)
            . "\n$dostava\nUkupno: " . trg_eur((int) $n['ukupno']) . "\n\nDostava na:\n" . $this->adresaTekst($n)
            . "\n\nJavit ćemo vam se kad pošiljka krene. Za pitanja samo odgovorite na ovaj e-mail" . ($tel ? " ili nazovite $tel" : '') . ".\n\nCamellia sinensis\n{$this->origin}\n";
        $okKupac = $posta->posalji($n['kupac']['email'] ?? null, "Narudžba {$n['id']} — Camellia sinensis$test", $kupac, $this->placanje->emailTrgovine(), $this->htmlMail($n, false));

        $k = $n['kupac'];
        $upozorenje = !empty($n['manjak']) ? "\n!!! PAŽNJA: za " . implode(', ', $n['manjak']) . " nije bilo dovoljno zalihe u trenutku plaćanja (netko je kupio zadnje komade). Javi se kupcu ili napravi povrat u Stripeu.\n" : '';
        $trgovina = "Nova plaćena narudžba {$n['id']}$test\n$upozorenje\nKupac: {$k['ime']}\nE-mail: {$k['email']}\nTelefon: {$k['telefon']}"
            . (!empty($k['tvrtka']) || !empty($k['oib']) ? "\nR1 račun: " . trim(($k['tvrtka'] ?? '') . ' ' . ($k['oib'] ?? '')) : '')
            . "\n\nDostava ({$n['dostava']['naziv']}) na:\n" . $this->adresaTekst($n)
            . "\n\nNaručeno:\n" . implode("\n", array_map(fn ($s) => "  {$s['kol']} × {$s['naziv']} [{$s['sku']}] — " . trg_eur($s['iznos']), $n['stavke']))
            . (!empty($n['poklon']) ? "\n  1 × {$n['poklon']} — POKLON (stavi u paket)" : '')
            . "\n$dostava\nUkupno plaćeno: " . trg_eur((int) $n['ukupno'])
            . "\n";
        $okTrgovina = $posta->posalji($this->placanje->emailTrgovine(), "Nova narudžba {$n['id']} · " . trg_eur((int) $n['ukupno']) . $test, $trgovina, $k['email'] ?? null, $this->htmlMail($n, true));
        $this->narudzbe->izmijeni($n['id'], fn ($x) => [...$x, 'mail' => ['kupac' => $okKupac, 'trgovina' => $okTrgovina]]);
    }

    /** kontakt obrazac: poruka ide na mail trgovine (s adresom pošiljatelja za odgovor); ništa se ne sprema */
    public function kontakt(array $b, array $teme): void
    {
        $ime = is_string($b['name'] ?? null) ? trim($b['name']) : '';
        $email = is_string($b['email'] ?? null) ? trim($b['email']) : '';
        $tema = is_string($b['topic'] ?? null) ? $b['topic'] : '';
        $poruka = is_string($b['message'] ?? null) ? trim($b['message']) : '';
        $ok = mb_strlen($ime) >= 2 && mb_strlen($ime) <= 200 && !preg_match('/[\r\n]/', $ime . $email . $tema)
            && filter_var($email, FILTER_VALIDATE_EMAIL) && strlen($email) <= 200
            && in_array($tema, $teme, true) && mb_strlen($poruka) >= 10 && mb_strlen($poruka) <= 3000;
        if (!$ok) throw new TrgovinaGreska('INVALID_REQUEST', 400);
        $za = $this->placanje->emailTrgovine();
        if (!$za) throw new TrgovinaGreska('CHECKOUT_UNAVAILABLE', 503);
        $tekst = "Poruka s kontakt obrasca na {$this->origin}\n\nIme: $ime\nE-mail: $email\nTema: $tema\n\n$poruka\n";
        if (!(new Posta($this->placanje->posiljatelj()))->posalji($za, "Poruka s weba: $tema", $tekst, $email)) throw new TrgovinaGreska('CHECKOUT_UNAVAILABLE', 503);
    }
}
