// Slike iz design-reference/ → public/img/ (AVIF + WebP u više širina, plus JPG za Open Graph i JSON-LD).
// Nikakav base64 u kodu. Hero mora biti ≤ 200 KB po datoteci; inače skripta pada.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const OUT = resolve('public/img');
const HERO_MAX = 200 * 1024;
const force = process.argv.includes('--force');

const jobs = [
  // [izvor, odredište bez ekstenzije, širine]
  ['design-reference/hero-tea.jpg', 'hero/hero-tea', [640, 1124]],
  ['assets/photos/o-nama-ilustracija.jpg', 'foto/o-nama-ilustracija', [480, 960]],
];
// fotografije proizvoda prema katalogu (scripts/data-to-fixtures.mjs): iz uredništva ili iz prototipa
const izvori = JSON.parse(readFileSync(resolve('fixtures/slike-izvori.json'), 'utf8'));
for (const [sku, src] of Object.entries(izvori)) jobs.push([src, `p/${sku}`, [200, 460]]);

const manifest = {};
let made = 0;
for (const [src, dest, widths] of jobs) {
  if (!existsSync(src)) {
    console.warn(`optimize-images: nema ${src}, preskačem`);
    continue;
  }
  const meta = await sharp(src).metadata();
  const ws = [...new Set(widths.map((w) => Math.min(w, meta.width)))];
  const outBase = resolve(OUT, dest);
  mkdirSync(resolve(outBase, '..'), { recursive: true });
  const srcTime = statSync(src).mtimeMs;
  const outputs = [];
  for (const w of ws) {
    for (const fmt of ['avif', 'webp']) {
      const file = `${outBase}-${w}.${fmt}`;
      outputs.push(file);
      if (!force && existsSync(file) && statSync(file).mtimeMs >= srcTime) continue;
      const img = sharp(src).resize({ width: w, withoutEnlargement: true });
      await (fmt === 'avif' ? img.avif({ quality: 52, effort: 5 }) : img.webp({ quality: 74 })).toFile(file);
      made++;
    }
  }
  const jpg = `${outBase}.jpg`;
  if (force || !existsSync(jpg) || statSync(jpg).mtimeMs < srcTime) {
    if (dest.startsWith('p/') && src.endsWith('.jpg')) copyFileSync(src, jpg);
    else await sharp(src).jpeg({ quality: 78, mozjpeg: true }).toFile(jpg);
  }
  if (dest.startsWith('hero/')) {
    for (const f of [...outputs, jpg]) {
      const size = statSync(f).size;
      if (size > HERO_MAX) {
        console.error(`optimize-images: hero ${f} ima ${Math.round(size / 1024)} KB (> 200 KB)`);
        process.exit(1);
      }
    }
  }
  manifest[`/img/${dest}.jpg`] = { width: meta.width, height: meta.height, widths: ws };
}

// Logotipi (SVG, zlatna) i ikone. Ikona u prototipu ima tamnoplavu podlogu (#232A5C); plava je zabranjena
// (GUIDE §2), pa ikonu slažemo iz zlatnog znaka na --olive-d (#262D1D).
const BRAND = resolve('public/brand');
mkdirSync(BRAND, { recursive: true });
for (const [from, to] of [
  ['camellia-sinensis_vodoravni_zlatna.svg', 'logo-vodoravni.svg'],
  ['camellia-sinensis_okomiti_zlatna.svg', 'logo-okomiti.svg'],
  ['camellia-sinensis_znak_zlatna.svg', 'znak.svg'],
]) {
  copyFileSync(resolve('design-reference/logo', from), resolve(BRAND, to));
}
const fav = readFileSync(resolve('design-reference/logo/favicon.svg'), 'utf8').replace(/#232A5C/gi, '#262D1D');
if (/#232A5C/i.test(fav)) throw new Error('favicon još sadrži plavu');
writeFileSync(resolve('public/favicon.svg'), fav);
await sharp(Buffer.from(fav)).resize(180, 180).png().toFile(resolve('public/apple-touch-icon.png'));
await sharp(Buffer.from(fav)).resize(512, 512).png().toFile(resolve('public/brand/ikona-512.png'));

mkdirSync(resolve('fixtures'), { recursive: true });
writeFileSync(resolve('fixtures/image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`optimize-images: ${Object.keys(manifest).length} slika, ${made} novih datoteka`);
