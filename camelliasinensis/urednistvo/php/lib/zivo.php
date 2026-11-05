<?php
// Živi podaci trgovine: public_html/zivo.json (cijena, zaliha, objavljenost po SKU-u). Zapisuje se ODMAH pri svakom
// spremanju kataloga, pa nova cijena i zaliha vrijede za sekundu, bez čekanja gradnje na GitHubu. Trgovina ga čita pri
// otvaranju stranice (lib/shop/zivo.ts); nove proizvode, tekstove i fotografije i dalje donosi gradnja.
// Paket stranice ga nema, pa ga instalacija nikad ne prepiše starijim podacima. Oblik: API-CONTRACT §2 (Money, Stock),
// isto pravilo zalihe kao uOblikStranice() u urednistvo/katalog.mjs.
declare(strict_types=1);

const ZIVO_NAJVISE_PO_NARUDZBI = 20;
const ZIVO_MALO_NA_ZALIHI = 3;

/** @return array{verzija:int, azurirano:?string, skus:object} */
function zivo_iz_kataloga(array $k): array
{
    $skus = [];
    foreach ($k['proizvodi'] ?? [] as $p) {
        $z = $p['zaliha'] ?? null;
        $stock = $z === null
            ? ['status' => 'instock', 'quantity' => null, 'maxPerOrder' => ZIVO_NAJVISE_PO_NARUDZBI]
            : ['status' => $z <= 0 ? 'outofstock' : ($z <= ZIVO_MALO_NA_ZALIHI ? 'low' : 'instock'), 'quantity' => (int) $z, 'maxPerOrder' => ZIVO_NAJVISE_PO_NARUDZBI];
        $skus[(string) $p['sku']] = [
            'name' => (string) $p['naziv'],
            'price' => ['amount' => (int) round(((float) $p['cijena']) * 100), 'currency' => 'EUR'],
            'stock' => $stock,
            'published' => (bool) ($p['objavljeno'] ?? false),
        ];
    }
    return ['verzija' => (int) ($k['verzija'] ?? 0), 'azurirano' => $k['azurirano'] ?? null, 'skus' => (object) $skus];
}

final class Zivo
{
    private string $datoteka;

    public function __construct(string $javno)
    {
        $this->datoteka = rtrim($javno, '/\\') . '/zivo.json';
    }

    public function postoji(): bool { return is_file($this->datoteka); }

    /** greška pri zapisu ne ruši spremanje kataloga: trgovina tada pokazuje podatke zadnje gradnje */
    public function zapisi(array $katalog): void
    {
        try {
            pisi_atomarno($this->datoteka, u_json(zivo_iz_kataloga($katalog)), 0644);
        } catch (Throwable $e) {
            error_log('[uredništvo] zivo.json: ' . $e->getMessage());
        }
    }
}
