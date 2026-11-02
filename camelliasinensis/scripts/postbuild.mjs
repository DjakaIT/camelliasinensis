// Nakon `next build`: ukloni pomoćnu rutu /__nema/ (vidi app/[stranica]/page.tsx) i sve .map datoteke iz out/.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve('out');
if (!existsSync(OUT)) {
  console.error('postbuild: nema out/');
  process.exit(1);
}
for (const p of ['__nema', '__nema.txt', '__nema.html']) rmSync(join(OUT, p), { recursive: true, force: true });

let maps = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.map')) {
      rmSync(p);
      maps++;
    }
  }
};
walk(OUT);
console.log(`postbuild: očišćeno (${maps} .map datoteka uklonjeno)`);
