'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrow, IconBack, IconFilter, IconX } from '@/components/Icons';
import { ProductCard } from '@/components/ProductCard';
import {
  activeCount,
  applyFilters,
  countFor,
  emptyFilters,
  parseFilters,
  PER_PAGE,
  SORTS,
  toSearch,
  type Filters,
  type GroupKey,
  type SortKey,
} from '@/lib/catalog-filter';
import type { CardProduct } from '@/lib/catalog-view';
import { formatMoney } from '@/lib/format';
import { CAFFEINE_SHORT, FLAVORS, FORMS, MOODS } from '@/lib/labels';
import type { ProductTypeInfo } from '@/lib/shop/types';

type Props = { cards: CardProduct[]; types: ProductTypeInfo[]; fixedType?: string };

export function Catalog({ cards, types, fixedType }: Props) {
  const router = useRouter();
  const [f, setF] = useState<Filters>(() => emptyFilters(fixedType ? [fixedType] : []));
  const [panel, setPanel] = useState(false);
  const qRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const basePath = fixedType ? `/katalog/${fixedType}/` : '/katalog/';

  const origins = useMemo(
    () => [...new Set(cards.map((c) => c.origin).filter((o): o is string => Boolean(o)))].sort((a, b) => a.localeCompare(b, 'hr')),
    [cards],
  );
  const pmaxAll = useMemo(() => Math.ceil(Math.max(...cards.map((c) => c.price)) / 100) * 100, [cards]);

  const groups: [GroupKey, string, [string, string][], boolean?, boolean?][] = [
    ['type', 'Vrsta čaja', types.map((t) => [t.key, t.name])],
    ['lv', 'Razina kofeina', CAFFEINE_SHORT.map((l, i) => [String(i), l])],
    ['moods', 'Namjena', Object.entries(MOODS)],
    ['flav', 'Okus', Object.entries(FLAVORS), true],
    ['origin', 'Podrijetlo', origins.map((o) => [o, o]), false, true],
    ['form', 'Oblik', Object.entries(FORMS), false, true],
  ];

  // URL → stanje (direktno otvaranje, natrag/naprijed)
  useEffect(() => {
    const sync = () => {
      const next = parseFilters(window.location.search, fixedType);
      setF(next);
      if (new URLSearchParams(window.location.search).has('trazi')) setTimeout(() => qRef.current?.focus(), 50);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [fixedType]);

  const update = (patch: Partial<Filters>, keepPage = false) => {
    const next: Filters = { ...f, ...patch, page: keepPage ? (patch.page ?? f.page) : 1 };
    setF(next);
    // Na /katalog/<vrsta>/ promjena vrste vodi na opći katalog s parametrima.
    if (fixedType && !(next.type.length === 1 && next.type[0] === fixedType)) {
      router.push(`/katalog/${toSearch(next)}`);
      return;
    }
    window.history.replaceState(null, '', `${basePath}${toSearch(next, fixedType)}`);
  };

  const toggle = (g: GroupKey, v: string) => {
    const arr = f[g].includes(v) ? f[g].filter((x) => x !== v) : [...f[g], v];
    update({ [g]: arr } as Partial<Filters>);
  };
  const clear = () => update(emptyFilters(fixedType ? [fixedType] : []));

  const results = useMemo(() => applyFilters(cards, f), [cards, f]);
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const page = Math.min(f.page, pages);
  const slice = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const n = activeCount(f) - (fixedType && f.type.length === 1 && f.type[0] === fixedType ? 1 : 0);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (f.q) chips.push({ key: 'q', label: `„${f.q}”`, remove: () => update({ q: '' }) });
  for (const [g, , opts] of groups) {
    for (const v of f[g]) {
      if (g === 'type' && fixedType && v === fixedType && f.type.length === 1) continue;
      chips.push({ key: `${g}-${v}`, label: opts.find((o) => o[0] === v)?.[1] ?? v, remove: () => toggle(g, v) });
    }
  }
  if (f.pmin || f.pmax)
    chips.push({
      key: 'price',
      label: `${formatMoney(f.pmin)} – ${formatMoney(f.pmax || pmaxAll)}`,
      remove: () => update({ pmin: 0, pmax: 0 }),
    });
  if (f.bio) chips.push({ key: 'bio', label: 'Organski', remove: () => update({ bio: false }) });
  if (f.rare) chips.push({ key: 'rare', label: 'Rijetkosti', remove: () => update({ rare: false }) });
  if (f.isNew) chips.push({ key: 'new', label: 'Novo', remove: () => update({ isNew: false }) });

  const goPage = (p: number) => {
    update({ page: p }, true);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!panel) return;
    document.body.classList.add('x-lock');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('x-lock');
      document.removeEventListener('keydown', onKey);
    };
  }, [panel]);

  return (
    <section className="x-cat">
      <div className="x-wrap x-catgrid" ref={topRef} style={{ scrollMarginTop: 100 }}>
        <aside className={`x-filters${panel ? ' on' : ''}`} id="filteri" aria-label="Filteri">
          <div className="x-fhead">
            <h2>Filteri</h2>
            <button type="button" className="x-link" onClick={clear}>
              Očisti sve
            </button>
            <button type="button" className="x-fclose" onClick={() => setPanel(false)} aria-label="Zatvori filtere">
              <IconX />
            </button>
          </div>
          <label className="x-search">
            <span className="sr">Pretraži katalog</span>
            <input
              ref={qRef}
              type="search"
              placeholder="Pretraži katalog…"
              value={f.q}
              maxLength={80}
              onChange={(e) => update({ q: e.target.value })}
            />
          </label>
          {groups.map(([g, label, opts, asChips, closed]) => (
            <details key={g} className="x-fg" open={!closed || f[g].length > 0}>
              <summary>
                {label}
                {f[g].length > 0 && (
                  <i aria-label={`odabrano: ${f[g].length}`}>{f[g].length}</i>
                )}
              </summary>
              <div className={asChips ? 'x-fchips' : undefined}>
                {opts.map(([v, l]) => {
                  const count = countFor(cards, f, g, v);
                  const on = f[g].includes(v);
                  if (asChips)
                    return (
                      <button key={v} type="button" className={`x-fchip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(g, v)}>
                        {l} <em>{count}</em>
                      </button>
                    );
                  const off = !count && !on;
                  return (
                    <label key={v} className={`x-check${off ? ' is-off' : ''}`}>
                      <input type="checkbox" checked={on} disabled={off} onChange={() => toggle(g, v)} />
                      <span>{l}</span>
                      <em aria-label={`${count} proizvoda`}>{count}</em>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
          <details className="x-fg" open>
            <summary>Cijena</summary>
            <div className="x-price-f">
              <div className="x-prow">
                <span>{formatMoney(f.pmin)}</span>
                <span>{formatMoney(f.pmax || pmaxAll)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={pmaxAll / 100}
                step={1}
                value={f.pmin / 100}
                aria-label="Najniža cijena"
                aria-valuetext={formatMoney(f.pmin)}
                onChange={(e) => update({ pmin: Math.min(Number(e.target.value) * 100, f.pmax || pmaxAll) })}
              />
              <input
                type="range"
                min={0}
                max={pmaxAll / 100}
                step={1}
                value={(f.pmax || pmaxAll) / 100}
                aria-label="Najviša cijena"
                aria-valuetext={formatMoney(f.pmax || pmaxAll)}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value) * 100, f.pmin);
                  update({ pmax: v >= pmaxAll ? 0 : v });
                }}
              />
            </div>
          </details>
          <details className="x-fg" open>
            <summary>Posebno</summary>
            <label className="x-check">
              <input type="checkbox" checked={f.bio} onChange={(e) => update({ bio: e.target.checked })} />
              <span>Organski certificirano</span>
            </label>
            <label className="x-check">
              <input type="checkbox" checked={f.rare} onChange={(e) => update({ rare: e.target.checked })} />
              <span>Rijetkosti</span>
            </label>
            <label className="x-check">
              <input type="checkbox" checked={f.isNew} onChange={(e) => update({ isNew: e.target.checked })} />
              <span>Novo u ponudi</span>
            </label>
          </details>
          <button type="button" className="x-btn x-fapply" onClick={() => setPanel(false)}>
            Prikaži rezultate ({results.length})
          </button>
        </aside>

        <div className="x-results">
          <div className="x-toolbar">
            <button type="button" className="x-ftoggle" onClick={() => setPanel(true)} aria-controls="filteri" aria-expanded={panel}>
              <IconFilter />
              Filteri <em>{n || ''}</em>
            </button>
            <span className="x-count" role="status" aria-live="polite">
              {results.length
                ? `Prikazano ${(page - 1) * PER_PAGE + 1}–${(page - 1) * PER_PAGE + slice.length} od ${results.length}`
                : 'Nema rezultata'}
            </span>
            <label className="x-sort">
              Poredaj
              <select value={f.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
                {SORTS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {chips.length > 0 && (
            <div className="x-chips">
              {chips.map((c) => (
                <button key={c.key} type="button" className="x-chip" onClick={c.remove} aria-label={`Ukloni filtar: ${c.label}`}>
                  {c.label} <IconX />
                </button>
              ))}
              <button type="button" className="x-chip clear" onClick={clear}>
                Očisti
              </button>
            </div>
          )}
          <div className="x-grid">
            {slice.length ? (
              slice.map((p) => <ProductCard key={p.sku} p={p} headingLevel={2} sizes="(max-width: 820px) 120px, 200px" />)
            ) : (
              <div className="x-empty">
                <p>Nema proizvoda za odabrane filtre.</p>
                <button type="button" className="x-btn" onClick={clear}>
                  Očisti filtre
                </button>
              </div>
            )}
          </div>
          {pages > 1 && (
            <nav className="x-pager" aria-label="Stranice kataloga">
              <button type="button" className="x-pg" disabled={page === 1} onClick={() => goPage(page - 1)} aria-label="Prethodna stranica">
                <IconBack />
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`x-pg${i === page ? ' on' : ''}`}
                  aria-current={i === page ? 'page' : undefined}
                  aria-label={`Stranica ${i}`}
                  onClick={() => goPage(i)}
                >
                  {i}
                </button>
              ))}
              <button type="button" className="x-pg" disabled={page === pages} onClick={() => goPage(page + 1)} aria-label="Sljedeća stranica">
                <IconArrow />
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
