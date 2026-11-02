// Nakon `next build`: ukloni pomoćnu rutu /__nema/ (vidi app/[stranica]/page.tsx) i sve .map datoteke iz out/.
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve('out');
if (!existsSync(OUT)) {
  console.error('postbuild: nema out/');
  process.exit(1);
}
for (const p of ['__nema', '__nema.txt', '__nema.html']) rmSync(join(OUT, p), { recursive: true, force: true });

let maps = 0;
let flat = 0;
// Next 16 export sprema segmente za prefetch u podmape (__next.proizvod/$d$slug/__PAGE__.txt), a klijent ih
// traži pod spojenim imenom (__next.proizvod.$d$slug.__PAGE__.txt) pa na statičnom hostu dobiva 404.
// Dodajemo kopiju pod imenom koje klijent traži.
const flatten = (segDir, parent, prefix) => {
  for (const f of readdirSync(segDir)) {
    const p = join(segDir, f);
    if (statSync(p).isDirectory()) flatten(p, parent, `${prefix}.${f}`);
    else {
      copyFileSync(p, join(parent, `${prefix}.${f}`));
      flat++;
    }
  }
};
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (f.startsWith('__next.')) flatten(p, d, f);
      else walk(p);
    } else if (f.endsWith('.map')) {
      rmSync(p);
      maps++;
    }
  }
};
walk(OUT);
console.log(`postbuild: ${maps} .map datoteka uklonjeno, ${flat} prefetch segmenata preimenovano`);
