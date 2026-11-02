// Filtri kataloga (prototip engine.js, prepisano): stanje ↔ URL parametri, filtriranje, brojači.
import { normalize, type CardProduct } from './catalog-view';

export type Filters = {
  q: string;
  type: string[];
  lv: string[];
  moods: string[];
  flav: string[];
  origin: string[];
  form: string[];
  pmin: number; // centi; 0 = bez donje granice
  pmax: number; // centi; 0 = bez gornje granice
  bio: boolean;
  rare: boolean;
  isNew: boolean;
  sort: SortKey;
  page: number;
};

export type SortKey = 'pre' | 'novo' | 'cu' | 'cd' | 'az' | 'kf';
export const SORTS: [SortKey, string][] = [
  ['pre', 'Preporučeno'],
  ['novo', 'Novo i rijetko'],
  ['cu', 'Cijena: niža prema višoj'],
  ['cd', 'Cijena: viša prema nižoj'],
  ['az', 'Naziv A–Ž'],
  ['kf', 'Kofein: manje prema više'],
];

export const PER_PAGE = 12;
export type GroupKey = 'type' | 'lv' | 'moods' | 'flav' | 'origin' | 'form';

/** Naziv parametra u URL-u za svaku grupu (isti kao u prototipu). */
export const PARAM: Record<GroupKey, string> = {
  type: 'vrsta',
  lv: 'kofein',
  moods: 'namjena',
  flav: 'okus',
  origin: 'podrijetlo',
  form: 'oblik',
};

export const emptyFilters = (type: string[] = []): Filters => ({
  q: '',
  type,
  lv: [],
  moods: [],
  flav: [],
  origin: [],
  form: [],
  pmin: 0,
  pmax: 0,
  bio: false,
  rare: false,
  isNew: false,
  sort: 'pre',
  page: 1,
});

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20) : []);
const int = (v: string | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export function parseFilters(search: string, fixedType?: string): Filters {
  const ps = new URLSearchParams(search);
  const f = emptyFilters(fixedType ? [fixedType] : []);
  for (const g of Object.keys(PARAM) as GroupKey[]) {
    if (g === 'type' && fixedType && !ps.get(PARAM.type)) continue;
    f[g] = list(ps.get(PARAM[g]));
  }
  f.q = (ps.get('q') ?? '').slice(0, 80);
  f.pmin = int(ps.get('od')) * 100;
  f.pmax = int(ps.get('do')) * 100;
  f.bio = ps.get('bio') === '1';
  f.rare = ps.get('rijetko') === '1';
  f.isNew = ps.get('novo') === '1';
  const sort = ps.get('poredaj') as SortKey | null;
  if (sort && SORTS.some(([k]) => k === sort)) f.sort = sort;
  f.page = int(ps.get('stranica')) || 1;
  return f;
}

/** Filtri → query string. Na /katalog/<vrsta>/ vrsta je u putanji pa se ne ponavlja. */
export function toSearch(f: Filters, fixedType?: string): string {
  const ps = new URLSearchParams();
  if (f.q) ps.set('q', f.q);
  for (const g of Object.keys(PARAM) as GroupKey[]) {
    if (g === 'type' && fixedType && f.type.length === 1 && f.type[0] === fixedType) continue;
    if (f[g].length) ps.set(PARAM[g], f[g].join(','));
  }
  if (f.pmin) ps.set('od', String(Math.round(f.pmin / 100)));
  if (f.pmax) ps.set('do', String(Math.round(f.pmax / 100)));
  if (f.bio) ps.set('bio', '1');
  if (f.rare) ps.set('rijetko', '1');
  if (f.isNew) ps.set('novo', '1');
  if (f.sort !== 'pre') ps.set('poredaj', f.sort);
  if (f.page > 1) ps.set('stranica', String(f.page));
  const s = ps.toString().replace(/%2C/g, ',');
  return s ? `?${s}` : '';
}

const valueOf = (p: CardProduct, g: GroupKey): string[] => {
  switch (g) {
    case 'type':
      return [p.type];
    case 'lv':
      return p.caffeine == null ? [] : [String(p.caffeine)];
    case 'moods':
      return p.moods;
    case 'flav':
      return p.flavors;
    case 'origin':
      return p.origin ? [p.origin] : [];
    case 'form':
      return p.form ? [p.form] : [];
  }
};

/** Prolazi li proizvod filtre; `skip` izostavlja jednu grupu (za brojače u toj grupi). */
export function passes(p: CardProduct, f: Filters, skip?: GroupKey): boolean {
  if (f.q) {
    const words = normalize(f.q).split(/\s+/).filter(Boolean);
    if (!words.every((w) => p.search.includes(w))) return false;
  }
  for (const g of Object.keys(PARAM) as GroupKey[]) {
    if (g === skip || !f[g].length) continue;
    const v = valueOf(p, g);
    if (!f[g].some((x) => v.includes(x))) return false;
  }
  if (f.pmin && p.price < f.pmin) return false;
  if (f.pmax && p.price > f.pmax) return false;
  if (f.bio && !p.bio) return false;
  if (f.rare && !p.rare) return false;
  if (f.isNew && !p.isNew) return false;
  return true;
}

export function applyFilters(all: CardProduct[], f: Filters): CardProduct[] {
  const L = all.filter((p) => passes(p, f));
  const cmp: Record<SortKey, ((a: CardProduct, b: CardProduct) => number) | null> = {
    pre: null,
    cu: (a, b) => a.price - b.price,
    cd: (a, b) => b.price - a.price,
    az: (a, b) => a.name.localeCompare(b.name, 'hr'),
    kf: (a, b) => (a.caffeine ?? -1) - (b.caffeine ?? -1),
    novo: (a, b) => Number(b.isNew) - Number(a.isNew) || Number(b.rare) - Number(a.rare),
  };
  const c = cmp[f.sort];
  return c ? [...L].sort(c) : L;
}

export function countFor(all: CardProduct[], f: Filters, g: GroupKey, value: string): number {
  return all.filter((p) => passes(p, f, g) && valueOf(p, g).includes(value)).length;
}

export const activeCount = (f: Filters) =>
  (f.q ? 1 : 0) +
  (Object.keys(PARAM) as GroupKey[]).reduce((s, g) => s + f[g].length, 0) +
  (f.pmin || f.pmax ? 1 : 0) +
  Number(f.bio) +
  Number(f.rare) +
  Number(f.isNew);
