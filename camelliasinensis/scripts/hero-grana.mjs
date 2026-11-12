// Generira pozadinu heroja: grana biljke Camellia sinensis (od nje nastaju svi čajevi u ponudi).
// Pet listova od vrha prema dnu nosi boje vrsta čaja sa stranice (--t-bijeli … --t-puer), istim redom kao natpis
// u heroju "Bijeli · Zeleni · Oolong · Crni · Pu'er"; na vrhu je pupoljak (bijeli čaj), uz granu cvijet čaja.
// Pokretanje: node scripts/hero-grana.mjs → components/home/heroGrana.ts (ne uređivati ručno).
import { writeFileSync } from 'node:fs';

const W = 800, H = 600;
const r1 = (n) => Math.round(n * 10) / 10;
const pt = (x, y) => `${r1(x)} ${r1(y)}`;

// determinističan "slučaj" za prašnike
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// stabljika: kubna Bézierova krivulja od baze (desno, izvan slike) do vrha (gore lijevo)
const S = [[840, 392], [660, 388], [452, 282], [252, 86]];
const bez = (t) => {
  const m = 1 - t;
  const x = m ** 3 * S[0][0] + 3 * m * m * t * S[1][0] + 3 * m * t * t * S[2][0] + t ** 3 * S[3][0];
  const y = m ** 3 * S[0][1] + 3 * m * m * t * S[1][1] + 3 * m * t * t * S[2][1] + t ** 3 * S[3][1];
  return [x, y];
};
const tan = (t) => {
  const m = 1 - t;
  const dx = 3 * m * m * (S[1][0] - S[0][0]) + 6 * m * t * (S[2][0] - S[1][0]) + 3 * t * t * (S[3][0] - S[2][0]);
  const dy = 3 * m * m * (S[1][1] - S[0][1]) + 6 * m * t * (S[2][1] - S[1][1]) + 3 * t * t * (S[3][1] - S[2][1]);
  return Math.atan2(dy, dx);
};

function stabljika() {
  const n = 48, a = [], b = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = bez(t), th = tan(t), w = 5.4 * (1 - t) + 1;
    a.push(pt(x - Math.sin(th) * w, y + Math.cos(th) * w));
    b.push(pt(x + Math.sin(th) * w, y - Math.cos(th) * w));
  }
  return `<path class="st" d="M${a.join('L')}L${b.reverse().join('L')}Z"/>`;
}

/** list u lokalnim koordinatama (os x = glavna žila), zatim rotacija i pomak na peteljku */
const tamnije = (hex) => {
  const n = parseInt(hex.slice(1), 16), k = 0.86;
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * k).toString(16).padStart(2, '0')).join('');
};

function list({ t, strana, kut = 50, L, sirina = 0.2, savij = 0.07, boja, zila, i, pupoljak = false }) {
  const [sx, sy] = bez(t);
  const th = tan(t) + (strana * kut * Math.PI) / 180;
  const pet = pupoljak ? 0 : 0.07 * L;
  const bx = sx + Math.cos(th) * pet, by = sy + Math.sin(th) * pet;
  const Wm = sirina * L, b = savij * strana;
  const f = (u) => (Wm * u * (1 - u) ** (pupoljak ? 1.9 : 1.4)) / (pupoljak ? 0.164 : 0.196);
  const sav = (u) => b * L * u * u;

  const N = pupoljak ? 0 : Math.round(L / 8), d = 0.013 * L;
  const rub = (s) => {
    const p = [];
    for (let u = 0; u < 0.18; u += 0.02) p.push([u * L, sav(u) + s * f(u)]);
    if (N) {
      for (let k = Math.ceil(0.18 * N); k / N < 0.95; k++) {
        const u0 = k / N, u1 = (k + 0.72) / N, fade = Math.min(1, (u0 - 0.16) / 0.12, (0.97 - u1) / 0.1);
        p.push([u0 * L, sav(u0) + s * f(u0)]);
        p.push([u1 * L, sav(u1) + s * (f(u1) + d * Math.max(0, fade))]);
      }
    }
    for (let u = N ? 0.95 : 0.18; u <= 1.0001; u += 0.025) p.push([u * L, sav(u) + s * f(u)]);
    return p;
  };
  const zilaNazad = [];
  for (let u = 1; u >= -0.0001; u -= 0.05) zilaNazad.push([u * L, sav(u)]);
  const pola = (s) => [...rub(s), ...zilaNazad].map(([x, y]) => pt(x, y)).join('L');

  let zile = '';
  if (!pupoljak) {
    zile += `<path class="z0" d="M0 0Q${pt(L * 0.5, 0)} ${pt(L * 0.97, sav(0.97))}"/>`;
    for (let j = 0; j < 7; j++) {
      const u0 = 0.1 + j * 0.105, u1 = Math.min(u0 + 0.17, 0.93), uc = u0 + 0.05;
      for (const s of [1, -1]) {
        zile += `<path d="M${pt(u0 * L, sav(u0))}Q${pt(uc * L, sav(uc) + s * 0.55 * f(uc))} ${pt(u1 * L, sav(u1) + s * 0.8 * f(u1))}"/>`;
      }
    }
  } else {
    zile = `<path class="z0" d="M${pt(L * 0.08, sav(0.08) - f(0.08) * 0.4)}Q${pt(L * 0.5, sav(0.5) - f(0.5) * 0.55)} ${pt(L * 0.94, sav(0.94))}"/>`;
  }

  const deg = r1((th * 180) / Math.PI);
  const peteljka = pet ? `<path class="pt" d="M${pt(sx, sy)}L${pt(bx, by)}"/>` : '';
  return `<g class="l" style="--i:${i}">${peteljka}<g transform="translate(${pt(bx, by)}) rotate(${deg})"><path d="M${pola(1)}Z" fill="${boja}"/><path d="M${pola(-1)}Z" fill="${tamnije(boja)}"/><g class="zi" stroke="${zila}">${zile}</g></g></g>`;
}

function cvijet({ t, i }) {
  const [sx, sy] = bez(t);
  const cx = sx - 14, cy = sy + 74;
  const stapka = `<path class="pt" d="M${pt(sx, sy)}Q${pt(sx + 10, sy + 34)} ${pt(cx, cy - 6)}"/>`;
  const R = 44, w = 37;
  const latica = `M0 0C${pt(-0.2 * w, -0.35 * R)} ${pt(-0.66 * w, -0.72 * R)} ${pt(-0.44 * w, -0.97 * R)}Q0 ${r1(-1.13 * R)} ${pt(0.44 * w, -0.97 * R)}C${pt(0.66 * w, -0.72 * R)} ${pt(0.2 * w, -0.35 * R)} 0 0Z`;
  let lat = '';
  [0, 120, 240, 60, 180, 300].forEach((a, k) => {
    lat += `<path d="${latica}" transform="rotate(${a + 14})" fill="${k < 3 ? '#e9e0c9' : '#f6f0e4'}"/>`;
  });
  let pr = '';
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2 + rnd() * 0.2, r0 = 4 + rnd() * 3, r = 9 + rnd() * 10;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    pr += `<path d="M${pt(Math.cos(a) * r0, Math.sin(a) * r0)}L${pt(x, y)}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="1.9"/>`;
  }
  const pupoljak = `<g transform="translate(${pt(cx + 54, cy - 30)})"><circle r="11" fill="#efe7d3"/><path d="M-9 2Q-6 11 0 11Q6 11 9 2Q4 6 0 6Q-4 6-9 2Z" fill="#8fa35c"/></g>`;
  return `<g class="l" style="--i:${i}">${stapka}<path class="pt" d="M${pt(sx - 2, sy + 4)}Q${pt(sx + 30, sy + 8)} ${pt(cx + 54, cy - 40)}"/>${pupoljak}<g transform="translate(${pt(cx, cy)}) rotate(-18) scale(1 .84)"><g stroke="#e0d5bb" stroke-width=".8">${lat}</g><circle r="12" fill="#d9c27a"/><g class="pr">${pr}</g><circle r="5" fill="#b8962f"/></g></g>`;
}

// boje = tokeni vrsta čaja iz styles/app.css; žile su tamnija (ili kod tamnih listova zlatna) nijansa iste boje
const dijelovi = [
  list({ t: 0.1, strana: 1, kut: 62, L: 240, boja: '#4a2e24', zila: '#8a6d14', i: 0 }), // pu'er
  list({ t: 0.27, strana: -1, kut: 34, L: 220, boja: '#d98c68', zila: '#a65d3f', i: 1 }), // crni
  list({ t: 0.47, strana: 1, kut: 54, L: 200, boja: '#edc98c', zila: '#b98f45', i: 2 }), // oolong
  cvijet({ t: 0.6, i: 3 }),
  list({ t: 0.74, strana: 1, kut: 48, L: 160, savij: 0.06, boja: '#cfe0a6', zila: '#8fa35c', i: 4 }), // zeleni
  list({ t: 0.89, strana: -1, kut: 46, L: 112, savij: 0.05, boja: '#efe7d3', zila: '#b9a77a', i: 5 }), // bijeli
  list({ t: 0.995, strana: 1, kut: 4, L: 74, sirina: 0.14, savij: 0.04, boja: '#efe7d3', zila: '#ffffff', i: 6, pupoljak: true }),
];

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round" focusable="false">` +
  `<style>.st{fill:#d4af37}.pt{stroke:#d4af37;stroke-width:2.4}.zi{fill:none;stroke-width:1;opacity:.75}.zi .z0{stroke-width:1.6}.pr path{stroke:#eadfb8;stroke-width:.8}.pr circle{fill:#d4af37}</style>` +
  stabljika() +
  dijelovi.join('') +
  `</svg>`;

const out = new URL('../components/home/heroGrana.ts', import.meta.url);
writeFileSync(
  out,
  `// GENERIRANO: node scripts/hero-grana.mjs (ne uređivati ručno)\nexport const HERO_GRANA = ${JSON.stringify(svg)};\n`,
);
console.log(`hero-grana: ${(svg.length / 1024).toFixed(1)} KB → components/home/heroGrana.ts`);
