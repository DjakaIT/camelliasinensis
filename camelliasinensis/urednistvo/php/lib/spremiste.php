<?php
// Konfiguracija (generira je izgradnja: urednistvo/php/pripremi.mjs) i katalog uredništva:
// podaci/katalog.json + povijest verzija (podaci/povijest/) + dnevnik promjena (podaci/dnevnik.log).
// Svako spremanje: provjera (sadrzaj.php) -> nova verzija -> atomarno pisanje. Sukob verzija = 409.
declare(strict_types=1);

const ZADRZI_VERZIJA = 60;

/** oznake (okusi, namjene, oblici, oznake, tein), javna adresa, lokalne fotografije i početni katalog — iz istih izvora kao stranica */
final class Konfiguracija
{
    public readonly array $oznake;
    public readonly int $najviseNaPolici;
    public readonly string $origin;
    public readonly array $lokalneSlike;
    /** @var array{dostava:list<array{id:string,name:string,price:int}>, besplatnaDostavaOd:int, poklon:string, najvisePoNarudzbi:int, kontaktTeme:list<string>} */
    public readonly array $trgovina;

    public function __construct(public readonly string $dir)
    {
        $k = citaj_json($dir . '/konfiguracija.json');
        if (!is_array($k)) throw new RuntimeException('Nema konfiguracija.json (pokreni urednistvo/php/pripremi.mjs)');
        $this->oznake = $k['oznake'];
        $this->najviseNaPolici = (int) $k['najviseNaPolici'];
        $this->origin = rtrim($k['origin'], '/');
        $this->lokalneSlike = array_flip($k['lokalneSlike']);
        $t = is_array($k['trgovina'] ?? null) ? $k['trgovina'] : [];
        $this->trgovina = [
            'dostava' => array_values($t['dostava'] ?? []),
            'besplatnaDostavaOd' => (int) ($t['besplatnaDostavaOd'] ?? 5000),
            'poklon' => (string) ($t['poklon'] ?? ''),
            'najvisePoNarudzbi' => (int) ($t['najvisePoNarudzbi'] ?? 20),
            'kontaktTeme' => array_values($t['kontaktTeme'] ?? []),
        ];
    }

    public function pocetni(): array { return citaj_json($this->dir . '/pocetni.json'); }
}

final class Spremiste
{
    private string $datoteka;
    private string $povijestDir;

    public function __construct(private string $dir, private Konfiguracija $konf, private Closure $slikaPostoji)
    {
        $this->datoteka = $dir . '/katalog.json';
        $this->povijestDir = $dir . '/povijest';
    }

    public function dnevnik(array $zapis): void
    {
        if (!is_dir($this->dir)) @mkdir($this->dir, 0700, true);
        $f = $this->dir . '/dnevnik.log';
        // ne raste bez granice (npr. tisuće neuspjelih prijava): iznad 1 MB postaje dnevnik.1.log, a prethodni se briše
        if (@filesize($f) > 1024 * 1024) @rename($f, $this->dir . '/dnevnik.1.log');
        file_put_contents($f, u_json(['vrijeme' => iso_vrijeme(), ...$zapis]) . "\n", FILE_APPEND | LOCK_EX);
    }

    private function snimiVerziju(array $s, string $opis): void
    {
        pisi_json(sprintf('%s/%06d.json', $this->povijestDir, $s['verzija']), ['opis' => $opis, 'sadrzaj' => $s]);
        $sve = glob($this->povijestDir . '/[0-9][0-9][0-9][0-9][0-9][0-9].json') ?: [];
        sort($sve);
        foreach (array_slice($sve, 0, max(0, count($sve) - ZADRZI_VERZIJA)) as $f) @unlink($f);
    }

    /** trenutni katalog; prvi put se stvara iz početnog sadržaja (prototip) */
    public function ucitaj(): array
    {
        $s = citaj_json($this->datoteka);
        if (is_array($s)) return uskladi_katalog($s);
        return s_bravom($this->dir, function () {
            $s = citaj_json($this->datoteka);
            if (is_array($s)) return uskladi_katalog($s);
            $pocetni = array_merge(uskladi_katalog($this->konf->pocetni()), ['verzija' => 1, 'azurirano' => iso_vrijeme(), 'azurirao' => 'početni sadržaj']);
            pisi_json($this->datoteka, $pocetni);
            $this->snimiVerziju($pocetni, 'Početni sadržaj');
            return $pocetni;
        });
    }

    private function spremi(array $novi, string $ime, string $opis): array
    {
        $r = provjeri_katalog($novi, $this->konf->oznake, $this->konf->najviseNaPolici, $this->slikaPostoji);
        if (!$r['ok']) throw new Greska(422, 'Sadržaj nije ispravan', ['greske' => $r['greske']]);
        pisi_json($this->datoteka, $r['sadrzaj']);
        $this->snimiVerziju($r['sadrzaj'], $opis);
        $this->dnevnik(['ime' => $ime, 'radnja' => 'spremanje', 'verzija' => $r['sadrzaj']['verzija'], 'opis' => $opis]);
        return $r['sadrzaj'];
    }

    /** spremi cijeli katalog; bazna verzija mora biti trenutna (inače je netko drugi u međuvremenu spremio) */
    public function spremiKatalog(mixed $katalog, int $baznaVerzija, string $ime, string $opis): array
    {
        $this->ucitaj();
        return s_bravom($this->dir, function () use ($katalog, $baznaVerzija, $ime, $opis) {
            $trenutni = citaj_json($this->datoteka);
            if ($trenutni['verzija'] !== $baznaVerzija) throw new Greska(409, 'Katalog je u međuvremenu promijenjen', ['verzija' => $trenutni['verzija']]);
            if (!is_array($katalog)) throw new Greska(422, 'Sadržaj nije ispravan', ['greske' => []]);
            $novi = array_merge($katalog, ['format' => $trenutni['format'], 'verzija' => $trenutni['verzija'] + 1, 'azurirano' => iso_vrijeme(), 'azurirao' => $ime]);
            return $this->spremi(uskladi_katalog($novi), $ime, mb_substr($opis !== '' ? $opis : 'Promjena kataloga', 0, 120));
        });
    }

    public function povijest(): array
    {
        $sve = glob($this->povijestDir . '/[0-9][0-9][0-9][0-9][0-9][0-9].json') ?: [];
        rsort($sve);
        return array_map(function ($f) {
            $v = citaj_json($f);
            return ['verzija' => $v['sadrzaj']['verzija'], 'azurirano' => $v['sadrzaj']['azurirano'], 'azurirao' => $v['sadrzaj']['azurirao'], 'opis' => $v['opis']];
        }, $sve);
    }

    /** vrati staru verziju (kao novu verziju — povijest se ne briše) */
    public function vrati(mixed $verzija, mixed $bazna, string $ime): array
    {
        if (!is_int($verzija) || $verzija < 1) throw new Greska(404, 'Verzija ne postoji');
        return s_bravom($this->dir, function () use ($verzija, $bazna, $ime) {
            $trenutni = citaj_json($this->datoteka);
            if ($trenutni['verzija'] !== $bazna) throw new Greska(409, 'Katalog je u međuvremenu promijenjen', ['verzija' => $trenutni['verzija']]);
            $stara = citaj_json(sprintf('%s/%06d.json', $this->povijestDir, $verzija));
            if (!$stara) throw new Greska(404, 'Verzija ne postoji');
            $novi = array_merge(($stara['sadrzaj']), ['verzija' => $trenutni['verzija'] + 1, 'azurirano' => iso_vrijeme(), 'azurirao' => $ime]);
            return $this->spremi($novi, $ime, "Vraćena verzija $verzija");
        });
    }
}
