// Paket za hosting (Hostinger: Apache/LiteSpeed + PHP): sadržaj mape public_html. Model je preuzet iz Septilliona.
//   hosting/                 izgrađena stranica (out/, s .htaccess) + uredništvo u hosting/urednistvo/
//   hosting/urednistvo/      index.php, .htaccess, lib/*.php, static/ (sučelje), konfiguracija.json, pocetni.json, minijature/
//   hosting.zip              isto u jednoj datoteci (prvi put ručno: hPanel -> File Manager -> public_html -> Upload -> Extract)
// GitHub Actions sprema hosting/ kao artefakt "hosting"; uredništvo na hostingu ga preuzima i postavlja (lib/instalacija.php).
// Podaci uredništva NISU u paketu: na hostingu su izvan public_html (camellia-podaci/) i paket ih nikad ne dira.
// Upotreba: npm run build && npm run paket   (to radi i .github/workflows/objava.yml)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../urednistvo/lib/postavke.mjs';
import { pripremi } from '../urednistvo/php/pripremi.mjs';
import { zipMape } from './zip.mjs';

const OUT = path.join(ROOT, 'out');
const IZLAZ = path.join(ROOT, 'hosting');
if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('Nema out/ — prvo npm run build');
  process.exit(1);
}

fs.rmSync(IZLAZ, { recursive: true, force: true });
fs.cpSync(OUT, IZLAZ, { recursive: true });

// PAKET_PRIJELAZ=1 (jednom, ručno pokretanje workflowa "Objava" s prijelaz=da): bez datoteka s "$" u imenu.
// Instalacija na hostingu prije 11. 11. 2026. odbija "$" (Next.js 16 ga stavlja u datoteke za prethodno učitavanje
// dinamičkih stranica), pa ne bi postavila ni paket s popravkom. Ovaj paket postavi novu instalaciju; sljedeći su potpuni.
if (process.env.PAKET_PRIJELAZ === '1') {
  let maknuto = 0;
  const makni = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.name.includes('$')) {
        fs.rmSync(p, { recursive: true, force: true });
        maknuto++;
      } else if (f.isDirectory()) makni(p);
    }
  };
  makni(IZLAZ);
  console.log(`[paket] PRIJELAZ: maknuto ${maknuto} datoteka/mapa s "$" u imenu`);
}
const U = path.join(IZLAZ, 'urednistvo');
fs.mkdirSync(path.join(U, 'lib'), { recursive: true });
fs.mkdirSync(path.join(U, 'static'), { recursive: true });
for (const f of ['index.php', '.htaccess']) fs.copyFileSync(path.join(ROOT, 'urednistvo/php', f), path.join(U, f));
for (const f of fs.readdirSync(path.join(ROOT, 'urednistvo/php/lib'))) {
  if (f.endsWith('.php')) fs.copyFileSync(path.join(ROOT, 'urednistvo/php/lib', f), path.join(U, 'lib', f));
}
for (const f of ['index.html', 'app.js', 'app.css', 'ikona.svg', 'qrcode.mjs']) {
  fs.copyFileSync(path.join(ROOT, 'urednistvo/sucelje', f), path.join(U, 'static', f));
}
await pripremi(U);

const { podaci, broj } = zipMape(IZLAZ);
fs.writeFileSync(path.join(ROOT, 'hosting.zip'), podaci);
console.log(`[paket] hosting/ i hosting.zip (${broj} datoteka) — sadržaj za public_html`);
