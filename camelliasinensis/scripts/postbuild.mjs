// Nakon `next build`:
// 1. ukloni pomoćnu rutu /__nema/ (vidi app/[stranica]/page.tsx) i sve .map datoteke iz out/;
// 2. prefetch segmentima Next 16 exporta dodaj ime koje klijent traži;
// 3. u svaku HTML stranicu upiši CSP s SHA-256 hashevima njezinih inline skripti (bez 'unsafe-inline', GUIDE §5).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve('out');
if (!existsSync(OUT)) {
  console.error('postbuild: nema out/');
  process.exit(1);
}
for (const p of ['__nema', '__nema.txt', '__nema.html']) rmSync(join(OUT, p), { recursive: true, force: true });

// connect-src: demo radi sve u pregledniku; devserver zove lokalni mock-server.
const backend = process.env.NEXT_PUBLIC_BACKEND ?? 'demo';
const connect = ["'self'"];
if (backend === 'devserver') connect.push(new URL(process.env.NEXT_PUBLIC_DEVSERVER_URL ?? 'http://127.0.0.1:4000').origin);

function csp(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.map((h) => `'sha256-${h}'`).join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    'frame-src https://www.google.com',
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

const INLINE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
function addCsp(file) {
  let html = readFileSync(file, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) return 0;
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(INLINE)) {
    const type = attrs.match(/type="([^"]+)"/)?.[1];
    if (type && !/javascript|module/.test(type)) continue; // npr. application/ld+json se ne izvršava
    if (!body) continue;
    hashes.add(createHash('sha256').update(body, 'utf8').digest('base64'));
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp([...hashes])}"/>`;
  html = html.replace(/<meta charSet="utf-8"\/>/i, (m) => `${m}${meta}`);
  if (!html.includes(meta)) throw new Error(`postbuild: nisam mogao upisati CSP u ${file}`);
  writeFileSync(file, html);
  return hashes.size;
}

let maps = 0;
let flat = 0;
let pages = 0;
let maxHashes = 0;
// Next 16 export sprema segmente za prefetch u podmape (__next.proizvod/$d$slug/__PAGE__.txt), a klijent ih
// traži pod spojenim imenom (__next.proizvod.$d$slug.__PAGE__.txt) pa na statičnom hostu dobiva 404.
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
    } else if (f.endsWith('.html')) {
      maxHashes = Math.max(maxHashes, addCsp(p));
      pages++;
    }
  }
};
walk(OUT);

// Izvedba koja se ne indeksira (demo, devserver) dobiva i X-Robots-Tag za sve datoteke, ne samo HTML.
const indexable = backend !== 'demo' && process.env.NEXT_PUBLIC_INDEXABLE === '1';
const ht = join(OUT, '.htaccess');
if (!indexable && existsSync(ht)) {
  writeFileSync(ht, readFileSync(ht, 'utf8') + '\n<IfModule mod_headers.c>\nHeader always set X-Robots-Tag "noindex, nofollow"\n</IfModule>\n');
}

console.log(
  `postbuild: ${maps} .map uklonjeno, ${flat} prefetch segmenata preimenovano, CSP upisan u ${pages} stranica (najviše ${maxHashes} hasheva)`,
);
