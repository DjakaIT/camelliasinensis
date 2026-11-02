// check:bundle (GUIDE §4.5): u izvezenom out/ nema tajni, vrijednosti iz .env, .map datoteka ni mock-servera.
// Upotreba: node scripts/check-bundle.mjs [mapa=out]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const DIR = resolve(process.argv[2] ?? 'out');
if (!existsSync(DIR)) {
  console.error(`check:bundle: nema ${DIR} (prvo npm run build)`);
  process.exit(1);
}

const PATTERNS = [
  [/\bsk_(live|test)_[A-Za-z0-9]{6,}/, 'Stripe tajni ključ'],
  [/\brk_(live|test)_[A-Za-z0-9]{6,}/, 'Stripe ograničeni ključ'],
  [/\bwhsec_[A-Za-z0-9]{6,}/, 'Stripe webhook tajna'],
  [/\b(ck|cs)_[0-9a-f]{40}\b/, 'Woo REST ključ'],
  [/\bghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'privatni ključ'],
  [/api\.stripe\.com/, 'Stripe API u frontendu (Stripe smije samo u mock-server/)'],
  [/fake-checkout|__dev\/stock|mock-server\/src/, 'kod mock-servera'],
];

// Vrijednosti iz lokalnih .env datoteka (ako postoje) ne smiju završiti u bundleu.
const envValues = [];
for (const f of ['.env', '.env.local', '.env.production', 'mock-server/.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m || m[1].startsWith('NEXT_PUBLIC_')) continue; // javne varijable su namjerno u bundleu
    const v = m[2].replace(/^["']|["']$/g, '');
    if (v.length >= 8) envValues.push([m[1], v]);
  }
}

const problems = [];
let files = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const rel = relative(DIR, p).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) {
      if (/(^|\/)(mock-server|node_modules|\.git)$/.test(rel)) problems.push(`${rel}/: ne smije biti u izlazu`);
      walk(p);
      continue;
    }
    files++;
    if (f.endsWith('.map')) problems.push(`${rel}: source map`);
    if (/^\.env/.test(f)) problems.push(`${rel}: .env datoteka`);
    if (!/\.(html|txt|js|css|json|xml|svg|htaccess)$/.test(f) && f !== '.htaccess') continue;
    const text = readFileSync(p, 'utf8');
    for (const [re, label] of PATTERNS) if (re.test(text)) problems.push(`${rel}: ${label}`);
    for (const [k, v] of envValues) if (text.includes(v)) problems.push(`${rel}: vrijednost varijable ${k}`);
  }
};
walk(DIR);

if (problems.length) {
  console.error(`check:bundle: PAD (${problems.length})\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(`check:bundle: u redu (${files} datoteka, ${envValues.length} vrijednosti iz .env provjereno)`);
