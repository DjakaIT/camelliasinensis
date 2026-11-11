<?php
// Provjera kataloga — ista pravila kao urednistvo/katalog.mjs (provjeri), jer isti katalog.json poslije čita izgradnja
// stranice (scripts/data-to-fixtures.mjs), koja neispravan katalog i sama odbije.
// Greške su { putanja: [...], poruka } — uredništvo ih prikazuje uz polje.
declare(strict_types=1);

const FORMAT_KATALOGA = 1;
const KLJUC_SLIKE = '/^(?:[A-Za-z0-9._-]{1,64}|n-[a-f0-9]{24})$/';
const VRSTE_CAJA = ['bijeli', 'zeleni', 'oolong', 'crni', 'puer', 'aroma', 'biljni', 'pribor'];

/** tekst najviše $max znakova (UTF-8) */
function k_tekst(mixed $v, int $max): bool { return is_string($v) && mb_strlen(trim($v)) <= $max; }
function k_lista(mixed $v): bool { return is_array($v) && array_is_list($v); }

/**
 * @param array $oznake  okusi, namjene, oblici, oznake (ključ => naziv) iz konfiguracija.json
 * @return array{ok: bool, sadrzaj?: array, greske: array}
 */
function provjeri_katalog(mixed $k, array $oznake, int $najviseNaPolici, Closure $slikaPostoji): array
{
    $g = [];
    $greska = function (array $put, string $poruka) use (&$g) { $g[] = ['putanja' => $put, 'poruka' => $poruka]; };
    if (!is_array($k)) return ['ok' => false, 'greske' => [['putanja' => [], 'poruka' => 'Neispravan katalog']]];
    if (($k['format'] ?? null) !== FORMAT_KATALOGA) $greska(['format'], 'Nepoznat format kataloga');
    if (!is_int($k['verzija'] ?? null) || $k['verzija'] < 1) $greska(['verzija'], 'Neispravna verzija');

    $vrste = k_lista($k['vrste'] ?? null) ? $k['vrste'] : [];
    $kljucevi = array_map(fn ($v) => is_array($v) ? ($v['kljuc'] ?? null) : null, $vrste);
    if (count($vrste) !== count(VRSTE_CAJA) || array_diff(VRSTE_CAJA, $kljucevi)) $greska(['vrste'], 'Vrste čaja moraju biti točno: ' . implode(', ', VRSTE_CAJA));
    foreach ($vrste as $i => $v) {
        if (!is_array($v) || !k_tekst($v['naziv'] ?? null, 40) || trim($v['naziv']) === '') $greska(['vrste', $i, 'naziv'], 'Upiši naziv vrste (najviše 40 znakova)');
        if (!is_array($v) || !k_tekst($v['opis'] ?? null, 200)) $greska(['vrste', $i, 'opis'], 'Opis vrste je predug (najviše 200 znakova)');
    }

    $proizvodi = k_lista($k['proizvodi'] ?? null) ? $k['proizvodi'] : [];
    if (count($proizvodi) > 1000) $greska(['proizvodi'], 'Previše proizvoda');
    $skus = []; $slugs = []; $ids = [];
    foreach ($proizvodi as $i => $p) {
        $P = fn (string ...$x) => ['proizvodi', $i, ...$x];
        if (!is_array($p)) { $greska($P(), 'Neispravan proizvod'); continue; }
        $id = $p['id'] ?? null;
        if (!is_string($id) || !preg_match('/^[a-z0-9]{6,32}$/', $id) || isset($ids[$id])) $greska($P('id'), 'Neispravan id');
        if (is_string($id)) $ids[$id] = true;
        $sku = $p['sku'] ?? null;
        if (!is_string($sku) || !preg_match('/^[A-Za-z0-9._-]{1,64}$/', $sku)) $greska($P('sku'), 'Šifra (SKU): slova, brojke, točka, crtica, najviše 64 znaka');
        elseif (isset($skus[$sku])) $greska($P('sku'), "Šifra $sku već postoji");
        if (is_string($sku)) $skus[$sku] = true;
        $slug = $p['slug'] ?? null;
        if (!is_string($slug) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) $greska($P('slug'), 'Adresa: mala slova, brojke i crtice');
        elseif (isset($slugs[$slug])) $greska($P('slug'), 'Ta adresa već postoji');
        if (is_string($slug)) $slugs[$slug] = true;
        if (!k_tekst($p['naziv'] ?? null, 120) || trim($p['naziv']) === '') $greska($P('naziv'), 'Upiši naziv (najviše 120 znakova)');
        if (!in_array($p['vrsta'] ?? null, VRSTE_CAJA, true)) $greska($P('vrsta'), 'Odaberi vrstu');
        if (!k_tekst($p['podrijetlo'] ?? null, 60)) $greska($P('podrijetlo'), 'Podrijetlo je predugo');
        // polja koja smiju biti null (pribor bez teina i pripreme, zaliha koja se ne broji, bez fotografije):
        // "??" bi i null pretvorio u zamjensku vrijednost, pa se gleda postoji li ključ
        $ili = static fn (string $k): mixed => array_key_exists($k, $p) ? $p[$k] : 'x';
        $tein = $ili('tein');
        if (!($tein === null || in_array($tein, [0, 1, 2, 3], true))) $greska($P('tein'), 'Razina teina 0–3 ili bez oznake');
        foreach (['okusi' => 'okusi', 'namjene' => 'namjene', 'oznake' => 'oznake'] as $polje => $skup) {
            $v = $p[$polje] ?? null;
            if (!k_lista($v) || array_filter($v, fn ($x) => !is_string($x) || !isset($oznake[$skup][$x]))) $greska($P($polje), 'Nepoznata vrijednost');
        }
        if (!is_string($p['oblik'] ?? null) || !isset($oznake['oblici'][$p['oblik']])) $greska($P('oblik'), 'Odaberi oblik');
        $c = $p['cijena'] ?? null;
        if (!(is_int($c) || is_float($c)) || !($c > 0) || $c > 9999 || abs(round($c * 100) - $c * 100) > 1e-6) $greska($P('cijena'), 'Cijena mora biti veća od 0, najviše dvije decimale');
        if (!k_tekst($p['pakiranje'] ?? null, 40) || trim($p['pakiranje']) === '') $greska($P('pakiranje'), 'Upiši pakiranje (npr. 50 g)');
        $pr = $ili('priprema');
        if ($pr !== null && !(is_array($pr) && k_tekst($pr['temp'] ?? null, 40) && k_tekst($pr['vrijeme'] ?? null, 40) && k_tekst($pr['kolicina'] ?? null, 40))) $greska($P('priprema'), 'Neispravna priprema');
        if (!k_tekst($p['opis'] ?? null, 2000) || trim($p['opis']) === '') $greska($P('opis'), 'Upiši opis (najviše 2000 znakova)');
        $z = $ili('zaliha');
        if (!($z === null || (is_int($z) && $z >= 0 && $z <= 100000))) $greska($P('zaliha'), 'Zaliha je cijeli broj ≥ 0 (ili prazno = ne broji se)');
        if (!is_bool($p['objavljeno'] ?? null)) $greska($P('objavljeno'), 'Neispravno');
        $sl = $ili('slika');
        if (!($sl === null || (is_string($sl) && preg_match(KLJUC_SLIKE, $sl) && $slikaPostoji($sl)))) $greska($P('slika'), 'Fotografija ne postoji');
    }
    if (!array_filter($proizvodi, fn ($p) => is_array($p) && ($p['objavljeno'] ?? false) === true)) $greska(['proizvodi'], 'Barem jedan proizvod mora biti objavljen');

    $polica = $k['izdvojeno']['polica'] ?? null;
    if (!k_lista($polica)) $greska(['izdvojeno', 'polica'], 'Neispravan popis');
    else {
        if (count($polica) > $najviseNaPolici) $greska(['izdvojeno', 'polica'], "Na polici može biti najviše $najviseNaPolici proizvoda");
        if (count(array_unique($polica, SORT_REGULAR)) !== count($polica)) $greska(['izdvojeno', 'polica'], 'Proizvod je na polici dvaput');
        foreach ($polica as $i => $s) {
            $p = null;
            foreach ($proizvodi as $x) if (is_array($x) && ($x['sku'] ?? null) === $s) { $p = $x; break; }
            if (!$p) $greska(['izdvojeno', 'polica', $i], 'Proizvod ' . (is_string($s) ? $s : '?') . ' ne postoji');
            elseif (($p['objavljeno'] ?? false) !== true) $greska(['izdvojeno', 'polica', $i], "{$p['naziv']} nije objavljen");
        }
    }
    if ($g) return ['ok' => false, 'greske' => $g];

    $t = fn ($s) => trim($s);
    $jedinstveno = fn ($a) => array_values(array_unique($a));
    return ['ok' => true, 'greske' => [], 'sadrzaj' => [
        'format' => FORMAT_KATALOGA,
        'verzija' => $k['verzija'],
        'azurirano' => mb_substr((string) ($k['azurirano'] ?? ''), 0, 40),
        'azurirao' => mb_substr((string) ($k['azurirao'] ?? ''), 0, 40),
        'vrste' => array_map(fn ($v) => ['kljuc' => $v['kljuc'], 'naziv' => $t($v['naziv']), 'opis' => $t($v['opis'])], $vrste),
        'proizvodi' => array_map(fn ($p) => [
            'id' => $p['id'], 'sku' => $p['sku'], 'slug' => $p['slug'], 'naziv' => $t($p['naziv']), 'vrsta' => $p['vrsta'], 'podrijetlo' => $t($p['podrijetlo']),
            'tein' => $p['tein'], 'okusi' => $jedinstveno($p['okusi']), 'oblik' => $p['oblik'], 'cijena' => round((float) $p['cijena'], 2), 'pakiranje' => $t($p['pakiranje']),
            'namjene' => $jedinstveno($p['namjene']), 'oznake' => $jedinstveno($p['oznake']),
            'priprema' => $p['priprema'] === null ? null : ['temp' => $t($p['priprema']['temp']), 'vrijeme' => $t($p['priprema']['vrijeme']), 'kolicina' => $t($p['priprema']['kolicina'])],
            'opis' => $t($p['opis']), 'zaliha' => $p['zaliha'], 'objavljeno' => $p['objavljeno'], 'slika' => $p['slika'],
        ], $proizvodi),
        'izdvojeno' => ['polica' => array_values($polica)],
    ]];
}
