// check:prerender (GUIDE §4.7): svaka javna ruta ima index.html s jedinstvenim title, description i canonical;
// broj stranica proizvoda = broj proizvoda u fixturi. Upotreba: node scripts/check-prerender.mjs [mapa=out]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(process.argv[2] ?? 'out');
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://camelliasinensis.eu').replace(/\/+$/, '');
const { products, types } = JSON.parse(readFileSync('fixtures/products.json', 'utf8'));

const routes = [
  '/',
  '/katalog/',
  ...types.map((t) => `/katalog/${t.key}/`),
  ...products.filter((p) => p.published).map((p) => `/proizvod/${p.slug}/`),
  '/o-nama/',
  '/kosarica/',
  '/narudzba/uspjeh/',
];

// Uz fiksne rute, provjeri i sve iz sitemap.xml (kontakt, pravne stranice…).
const sitemapText = existsSync(join(DIR, 'sitemap.xml')) ? readFileSync(join(DIR, 'sitemap.xml'), 'utf8') : '';
for (const [, loc] of sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const path = loc.replace(SITE, '');
  if (!routes.includes(path)) routes.push(path);
}

const problems = [];
const seen = { title: new Map(), description: new Map(), canonical: new Map() };
const attr = (html, re) => html.match(re)?.[1]?.trim() ?? '';
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

const robots = existsSync(join(DIR, 'robots.txt')) ? readFileSync(join(DIR, 'robots.txt'), 'utf8') : '';
const noindexBuild = /Disallow: \/\s*$/m.test(robots);

for (const r of routes) {
  const file = join(DIR, r, 'index.html');
  if (!existsSync(file)) {
    problems.push(`${r}: nema index.html`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const title = decode(attr(html, /<title>([^<]*)<\/title>/));
  const description = decode(attr(html, /<meta name="description" content="([^"]*)"/));
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!/<html lang="hr"/.test(html)) problems.push(`${r}: nema lang="hr"`);
  if (!title) problems.push(`${r}: nema <title>`);
  if (!description) problems.push(`${r}: nema meta description`);
  if (canonical !== `${SITE}${r}`) problems.push(`${r}: canonical "${canonical}" umjesto "${SITE}${r}"`);
  if (!/hrefLang="hr"/i.test(html)) problems.push(`${r}: nema hreflang="hr"`);
  if (!/http-equiv="Content-Security-Policy"/.test(html)) problems.push(`${r}: nema CSP`);
  if (noindexBuild && !/<meta name="robots" content="noindex/.test(html)) problems.push(`${r}: demo build bez noindex`);
  if (r.startsWith('/proizvod/')) {
    if (!/"@type":"Product"/.test(html)) problems.push(`${r}: nema JSON-LD Product`);
    if (/aggregateRating|"review"/.test(html)) problems.push(`${r}: JSON-LD s ocjenama/recenzijama`);
    if (!/<h1 class="x-ptitle">/.test(html)) problems.push(`${r}: sadržaj nije u HTML-u`);
  }
  for (const [k, v] of Object.entries({ title, description, canonical })) {
    if (!v) continue;
    if (seen[k].has(v)) problems.push(`${r}: ${k} isti kao na ${seen[k].get(v)}`);
    else seen[k].set(v, r);
  }
}

const productDirs = existsSync(join(DIR, 'proizvod'))
  ? readdirSync(join(DIR, 'proizvod'), { withFileTypes: true }).filter((d) => d.isDirectory()).length
  : 0;
const expected = products.filter((p) => p.published).length;
if (productDirs !== expected) problems.push(`stranica proizvoda: ${productDirs}, proizvoda u fixturi: ${expected}`);
for (const f of ['404.html', 'sitemap.xml', 'robots.txt', '.htaccess']) if (!existsSync(join(DIR, f))) problems.push(`nema ${f}`);

const sitemap = existsSync(join(DIR, 'sitemap.xml')) ? readFileSync(join(DIR, 'sitemap.xml'), 'utf8') : '';
for (const r of routes.filter((x) => !['/kosarica/', '/narudzba/uspjeh/'].includes(x))) {
  if (!sitemap.includes(`<loc>${SITE}${r}</loc>`)) problems.push(`sitemap.xml: nema ${r}`);
}

if (problems.length) {
  console.error(`check:prerender: PAD (${problems.length})\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check:prerender: u redu (${routes.length} ruta, ${productDirs} stranica proizvoda${noindexBuild ? ', noindex' : ''})`);
