// Priprema PHP uredništva za hosting: iz istih izvora kao stranica zapisuje u <izlaz>:
//   konfiguracija.json  oznake (okusi, namjene, oblici, oznake, tein), javna adresa, popis postojećih fotografija (SKU)
//   pocetni.json        početni katalog (dok uredništvo još nema svoj podaci/katalog.json)
//   minijature/*.webp   male verzije postojećih fotografija proizvoda za uredništvo (480 px)
// Poziva je paket za hosting (scripts/paket-hosting.mjs). Upotreba: node urednistvo/php/pripremi.mjs <izlaz>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { CONTACT_TOPICS } from '../../lib/contact/topics.ts';
import { FREE_SHIPPING_FROM, FREE_SHIPPING_GIFT, SHIPPING_METHODS } from '../../lib/shop/shipping.ts';
import { NAJVISE_NA_POLICI, NAJVISE_PO_NARUDZBI, NAMJENE, OBLICI, OKUSI, OZNAKE, pocetniKatalog, TEIN } from '../katalog.mjs';
import { ROOT } from '../lib/postavke.mjs';

sharp.cache(false);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://camelliasinensis.eu').replace(/\/+$/, '');

export async function pripremi(izlaz, { origin = SITE_URL } = {}) {
  const IMG = path.join(ROOT, 'design-reference/img');
  const lokalne = fs.readdirSync(IMG).filter((f) => /^[A-Za-z0-9._-]{1,64}\.jpg$/.test(f));
  fs.mkdirSync(path.join(izlaz, 'minijature'), { recursive: true });
  fs.writeFileSync(
    path.join(izlaz, 'konfiguracija.json'),
    JSON.stringify(
      {
        format: 1,
        origin,
        oznake: { okusi: OKUSI, namjene: NAMJENE, oblici: OBLICI, oznake: OZNAKE, tein: TEIN },
        najviseNaPolici: NAJVISE_NA_POLICI,
        lokalneSlike: lokalne.map((f) => f.replace(/\.jpg$/, '')),
        // pravila naplate za PHP trgovinu: isti izvor kao stranica (lib/shop/shipping.ts, urednistvo/katalog.mjs)
        trgovina: {
          dostava: SHIPPING_METHODS.map((m) => ({ id: m.id, name: m.name, price: m.price })),
          besplatnaDostavaOd: FREE_SHIPPING_FROM,
          poklon: FREE_SHIPPING_GIFT, // uz besplatnu dostavu
          najvisePoNarudzbi: NAJVISE_PO_NARUDZBI,
          kontaktTeme: CONTACT_TOPICS,
        },
      },
      null,
      1,
    ),
  );
  fs.writeFileSync(path.join(izlaz, 'pocetni.json'), JSON.stringify(pocetniKatalog(ROOT), null, 1));
  for (const f of lokalne) {
    const cilj = path.join(izlaz, 'minijature', f.replace(/\.jpg$/, '.webp'));
    if (fs.existsSync(cilj)) continue;
    // iz memorije: sharp inače drži datoteku otvorenom (Windows je tada ne može obrisati)
    await sharp(fs.readFileSync(path.join(IMG, f))).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(cilj);
  }
  return { slika: lokalne.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const izlaz = process.argv[2];
  if (!izlaz) {
    console.error('Upotreba: node urednistvo/php/pripremi.mjs <izlaz>');
    process.exit(1);
  }
  const r = await pripremi(path.resolve(izlaz));
  console.log(`[uredništvo] konfiguracija, početni katalog i ${r.slika} minijatura -> ${izlaz}`);
}
