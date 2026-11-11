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

    /** običan tekstualni mail (UTF-8); false ako ga poslužitelj nije prihvatio */
    public function posalji(?string $za, string $naslov, string $tekst, ?string $odgovoriNa = null): bool
    {
        $za = self::adresa($za);
        $od = self::adresa($this->posiljatelj);
        if (!$za || !$od) return false;
        $zag = [
            'From: ' . mb_encode_mimeheader('Camellia sinensis', 'UTF-8', 'B') . " <$od>",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            'X-Mailer: camellia-trgovina',
        ];
        if ($r = self::adresa($odgovoriNa)) $zag[] = "Reply-To: $r";
        $naslov = mb_encode_mimeheader(str_replace(["\r", "\n"], ' ', $naslov), 'UTF-8', 'B');
        $tijelo = chunk_split(base64_encode(str_replace("\n", "\r\n", $tekst)));
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
            $stavke[] = ['sku' => $sku, 'naziv' => (string) $p['naziv'], 'pakiranje' => (string) ($p['pakiranje'] ?? ''), 'kol' => $kol, 'cijena' => $cijena, 'iznos' => $cijena * $kol];
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

    private static function sNarudzbom(string $url, string $token): string
    {
        return $url . (str_contains($url, '?') ? '&' : '?') . 'narudzba=' . $token;
    }

    /** startCheckout (API-CONTRACT §3.4): sve ponovno provjeri, stvori narudžbu i Stripe sesiju */
    public function zapocni(array $tijelo): array
    {
        $urls = is_array($tijelo['urls'] ?? null) ? $tijelo['urls'] : [];
        if (!$this->dopustenUrl($urls['success'] ?? null) || !$this->dopustenUrl($urls['cancel'] ?? null)) throw new TrgovinaGreska('INVALID_REQUEST', 400);
        $obr = $this->obracunaj($tijelo['lines'] ?? null);
        $stripe = $this->placanje->stripe();
        if (!$stripe || !$this->placanje->tajne()) throw new TrgovinaGreska('CHECKOUT_UNAVAILABLE', 503);

        $n = $this->narudzbe->nova(['stavke' => $obr['stavke'], 'medjuzbroj' => $obr['medjuzbroj']]);
        $besplatno = $obr['medjuzbroj'] >= $this->pravila['besplatnaDostavaOd'];
        $opcije = [];
        foreach ($this->pravila['dostava'] as $d) {
            $cijena = $besplatno ? 0 : (int) $d['price'];
            $opcije[] = ['shipping_rate_data' => [
                'type' => 'fixed_amount',
                'fixed_amount' => ['amount' => $cijena, 'currency' => 'eur'],
                'display_name' => $besplatno ? "{$d['name']} (besplatno od " . trg_eur($this->pravila['besplatnaDostavaOd']) . ')' : $d['name'],
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
                'line_items' => array_map(fn ($s) => ['quantity' => $s['kol'], 'price_data' => [
                    'currency' => 'eur',
                    'unit_amount' => $s['cijena'], // iz kataloga poslužitelja, nikad iz zahtjeva
                    'product_data' => ['name' => mb_substr($s['naziv'] . ($s['pakiranje'] !== '' ? " ({$s['pakiranje']})" : ''), 0, 250), 'metadata' => ['sku' => $s['sku']]],
                ]], $obr['stavke']),
                'shipping_address_collection' => ['allowed_countries' => ['HR']],
                'shipping_options' => $opcije,
                'phone_number_collection' => ['enabled' => 'true'],
                'tax_id_collection' => ['enabled' => 'true'], // tvrtke: naziv i OIB (PDV broj) za R1 račun
                'custom_fields' => [['key' => 'paketomat', 'type' => 'text', 'optional' => 'true', 'label' => ['type' => 'custom', 'custom' => 'Paketomat (samo za dostavu u paketomat)']]],
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
        $paketomat = null;
        foreach ($s['custom_fields'] ?? [] as $cf) if (($cf['key'] ?? '') === 'paketomat') $paketomat = trim((string) ($cf['text']['value'] ?? '')) ?: null;
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
            'paketomat' => $paketomat,
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
            return [...$x, ...$podaci, 'stanje' => 'paid', 'dogadaji' => array_slice([...($x['dogadaji'] ?? []), $dogadajId], -20)];
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
        return implode("\n", $r);
    }

    private function adresaTekst(array $n): string
    {
        $a = $n['adresa'] ?? [];
        $r = array_filter([$a['ime'] ?? '', $a['ulica'] ?? '', trim(($a['postanski'] ?? '') . ' ' . ($a['grad'] ?? ''))]);
        if (!empty($n['paketomat'])) $r[] = "Paketomat: {$n['paketomat']}";
        return '  ' . implode("\n  ", $r);
    }

    public function posaljiMailove(array $n): void
    {
        $posta = new Posta($this->placanje->posiljatelj());
        $test = ($n['nacin'] ?? '') === 'test' ? ' [TEST]' : '';
        $dostava = "Dostava: {$n['dostava']['naziv']} — " . trg_eur((int) $n['dostava']['cijena']);
        $kupac = "Hvala na narudžbi!\n\nBroj narudžbe: {$n['id']}\nPlaćeno: " . trg_eur((int) $n['ukupno']) . "\n\nNaručeno:\n" . $this->stavkeTekst($n)
            . "\n$dostava\nUkupno: " . trg_eur((int) $n['ukupno']) . "\n\nDostava na:\n" . $this->adresaTekst($n)
            . "\n\nJavit ćemo vam se kad pošiljka krene. Za pitanja samo odgovorite na ovaj e-mail.\n\nCamellia sinensis\n{$this->origin}\n";
        $okKupac = $posta->posalji($n['kupac']['email'] ?? null, "Narudžba {$n['id']} — Camellia sinensis$test", $kupac, $this->placanje->emailTrgovine());

        $k = $n['kupac'];
        $upozorenje = !empty($n['manjak']) ? "\n!!! PAŽNJA: za " . implode(', ', $n['manjak']) . " nije bilo dovoljno zalihe u trenutku plaćanja (netko je kupio zadnje komade). Javi se kupcu ili napravi povrat u Stripeu.\n" : '';
        $trgovina = "Nova plaćena narudžba {$n['id']}$test\n$upozorenje\nKupac: {$k['ime']}\nE-mail: {$k['email']}\nTelefon: {$k['telefon']}"
            . (!empty($k['tvrtka']) || !empty($k['oib']) ? "\nR1 račun: " . trim(($k['tvrtka'] ?? '') . ' ' . ($k['oib'] ?? '')) : '')
            . "\n\nDostava ({$n['dostava']['naziv']}) na:\n" . $this->adresaTekst($n)
            . "\n\nNaručeno:\n" . implode("\n", array_map(fn ($s) => "  {$s['kol']} × {$s['naziv']} [{$s['sku']}] — " . trg_eur($s['iznos']), $n['stavke']))
            . "\n$dostava\nUkupno plaćeno: " . trg_eur((int) $n['ukupno'])
            . "\n\nSve narudžbe: {$this->origin}/urednistvo (☰ → Narudžbe)\n";
        $okTrgovina = $posta->posalji($this->placanje->emailTrgovine(), "Nova narudžba {$n['id']} · " . trg_eur((int) $n['ukupno']) . $test, $trgovina, $k['email'] ?? null);
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
