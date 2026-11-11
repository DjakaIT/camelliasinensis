<?php
// Stripe API bez SDK-a (dijeljeni hosting nema Composer): cURL prema https://api.stripe.com/v1, ključ samo u zaglavlju.
// Ključ se nikad ne zapisuje u log ni u odgovor. Provjera potpisa webhooka prema https://docs.stripe.com/webhooks
// (zaglavlje Stripe-Signature: t=…, v1=… ; HMAC-SHA256 nad "t.tijelo"; tolerancija 5 min; usporedba u konstantnom vremenu).
declare(strict_types=1);

const STRIPE_API = 'https://api.stripe.com';
// fiksna verzija API-ja (provjerena 11. 11. 2026.); ista se postavlja na webhook, pa događaji uvijek imaju isti oblik
const STRIPE_VERZIJA = '2026-06-24.dahlia';
const STRIPE_TOLERANCIJA_S = 300;

final class StripeGreska extends RuntimeException
{
    public function __construct(public int $status, public string $vrsta, string $poruka, public ?string $kod = null)
    {
        parent::__construct($poruka);
    }
}

final class Stripe
{
    public function __construct(private string $kljuc, private string $api = STRIPE_API) {}

    public static function ispravanKljuc(string $k): bool { return (bool) preg_match('/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,255}$/', $k); }
    public static function nacin(string $k): string { return str_contains(substr($k, 0, 8), '_live_') ? 'live' : 'test'; }

    /** @return array<string, mixed> */
    public function zahtjev(string $metoda, string $put, array $podaci = [], ?string $idempotentnost = null): array
    {
        $url = rtrim($this->api, '/') . $put;
        $tijelo = $podaci ? http_build_query($podaci, '', '&', PHP_QUERY_RFC1738) : '';
        if ($metoda === 'GET' && $tijelo !== '') { $url .= '?' . $tijelo; $tijelo = ''; }
        $zag = ['Authorization: Bearer ' . $this->kljuc, 'Stripe-Version: ' . STRIPE_VERZIJA, 'User-Agent: camellia-trgovina'];
        if ($idempotentnost !== null) $zag[] = 'Idempotency-Key: ' . $idempotentnost;
        if ($metoda !== 'GET') $zag[] = 'Content-Type: application/x-www-form-urlencoded';
        $c = curl_init($url);
        curl_setopt_array($c, [
            CURLOPT_CUSTOMREQUEST => $metoda,
            CURLOPT_HTTPHEADER => $zag,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        ]);
        if ($metoda !== 'GET') curl_setopt($c, CURLOPT_POSTFIELDS, $tijelo);
        $odg = curl_exec($c);
        $status = (int) curl_getinfo($c, CURLINFO_RESPONSE_CODE);
        $greska = curl_error($c);
        curl_close($c);
        if ($odg === false) throw new StripeGreska(0, 'veza', 'Stripe nije dostupan: ' . $greska);
        $j = json_decode((string) $odg, true);
        if (!is_array($j)) throw new StripeGreska($status, 'odgovor', 'Neočekivan odgovor Stripea');
        if ($status < 200 || $status >= 300) {
            $e = is_array($j['error'] ?? null) ? $j['error'] : [];
            throw new StripeGreska($status, (string) ($e['type'] ?? 'api_error'), (string) ($e['message'] ?? "Stripe je odgovorio $status"), isset($e['code']) ? (string) $e['code'] : null);
        }
        return $j;
    }

    /**
     * Provjeri potpis webhooka i vrati događaj. Baca StripeGreska ako potpis ne vrijedi.
     * @param string[] $tajne whsec_ tajne (više njih dok traje zamjena tajne)
     */
    public static function dogadaj(string $tijelo, string $zaglavlje, array $tajne, ?int $sada = null): array
    {
        $sada ??= time();
        $t = null;
        $potpisi = [];
        foreach (explode(',', $zaglavlje) as $dio) {
            [$k, $v] = array_pad(explode('=', trim($dio), 2), 2, '');
            if ($k === 't' && ctype_digit($v)) $t = (int) $v;
            if ($k === 'v1' && $v !== '') $potpisi[] = $v; // samo v1; v0 i ostale sheme se zanemaruju
        }
        if ($t === null || !$potpisi) throw new StripeGreska(400, 'potpis', 'Nema potpisa');
        if (abs($sada - $t) > STRIPE_TOLERANCIJA_S) throw new StripeGreska(400, 'potpis', 'Potpis je zastario');
        foreach ($tajne as $tajna) {
            if (!is_string($tajna) || $tajna === '') continue;
            $ocekivano = hash_hmac('sha256', "$t.$tijelo", $tajna);
            foreach ($potpisi as $p) {
                if (hash_equals($ocekivano, $p)) {
                    $d = json_decode($tijelo, true);
                    if (!is_array($d) || !isset($d['id'], $d['type'])) throw new StripeGreska(400, 'tijelo', 'Neispravan događaj');
                    return $d;
                }
            }
        }
        throw new StripeGreska(400, 'potpis', 'Potpis ne vrijedi');
    }
}
