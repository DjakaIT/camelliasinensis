'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { productHref } from '@/lib/catalog-view';
import { CAFFEINE, CAFFEINE_SHORT } from '@/lib/labels';

export type MeterItem = { slug: string; name: string; caffeine: number; rare: boolean; price: number };

const LIQ = ['#E9DFA8', '#D8C46A', '#B8852F', '#6E3A1C'];
const BG = ['var(--t-biljni)', 'var(--t-bijeli)', 'var(--t-zeleni)', 'var(--t-oolong)'];
const HINT = ['biljni čajevi, rooibos i kamilica', 'bijeli čaj i genmaicha', 'zeleni, oolong i pu’er', 'crni čaj, matcha i yerba maté'];

/** "Koliko kofeina?" iz prototipa: klizač 0–3 i prijedlozi. */
export function CaffeineMeter({ items }: { items: MeterItem[] }) {
  const [level, setLevel] = useState(1);
  const [touched, setTouched] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const touchedRef = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) {
          io.disconnect();
          [2, 3, 0, 1].forEach((v, k) => timers.push(setTimeout(() => setLevel((cur) => (touchedRef.current ? cur : v)), 500 + k * 650)));
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);
  const choose = (v: number) => {
    touchedRef.current = true;
    setTouched(true);
    setLevel(v);
  };

  const all = items.filter((p) => p.caffeine === level);
  const top = [...all].sort((a, b) => Number(b.rare) - Number(a.rare) || a.price - b.price).slice(0, 4);
  const pc = (level / 3) * 100;

  return (
    <div className="tile t-caf rv" ref={box} style={{ background: BG[level] }}>
      <h2 className="d">
        Koliko kofeina?<small>Povucite klizač ili odaberite razinu.</small>
      </h2>
      <div className="cupv" aria-hidden="true">
        <svg viewBox="0 0 140 120">
          <defs>
            <clipPath id="cupClip">
              <path d="M14 30h96v8c0 34-18 58-48 58S14 72 14 38z" />
            </clipPath>
          </defs>
          <g className="st">
            <path d="M44 22c-6-8 6-12 0-20" />
            <path d="M62 22c-6-8 6-12 0-20" />
            <path d="M80 22c-6-8 6-12 0-20" />
          </g>
          <g clipPath="url(#cupClip)">
            <g className="lvl" style={{ transform: `translateY(${(3 - level) * 9}px)` }}>
              <g className="wave">
                <path className="liq" d="M0 40 Q15 34 30 40 T60 40 T90 40 T120 40 T150 40 T180 40 V130 H0z" fill={LIQ[level]} />
              </g>
            </g>
          </g>
          <path d="M14 30h96v8c0 34-18 58-48 58S14 72 14 38z" fill="none" stroke="#272A20" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M110 44c16 0 20 22 2 26" fill="none" stroke="#272A20" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M22 104h80" stroke="#272A20" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="meter">
        <div className="now">
          <b>{CAFFEINE[level]}</b>
          <span>{HINT[level]}</span>
        </div>
        <div className="range">
          <div className="track">
            <div className="fill" style={{ width: `${pc}%` }} />
          </div>
          <div className="marks">
            <i />
            <i />
            <i />
            <i />
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={level}
            onChange={(e) => choose(Number(e.target.value))}
            aria-label="Razina kofeina"
            aria-valuetext={CAFFEINE[level]}
          />
          <div className={`knob${touched ? '' : ' hint'}`} style={{ left: `${pc}%` }} />
        </div>
        <div className="ticks">
          {CAFFEINE_SHORT.map((l, i) => (
            <button key={l} type="button" className={i === level ? 'on' : undefined} aria-pressed={i === level} onClick={() => choose(i)}>
              {i === 0 ? 'Bez' : l}
            </button>
          ))}
        </div>
      </div>
      <div className="caf-res" aria-live="polite">
        <div className="lst">
          {top.map((p, k) => (
            <Link key={`${level}-${p.slug}`} className="c" href={productHref(p.slug)} style={{ animationDelay: `${k * 70}ms` }}>
              {p.name}
            </Link>
          ))}
        </div>
        <Link className="all" href={`/katalog/?kofein=${level}`}>
          Svih {all.length}: {(CAFFEINE[level] ?? '').toLowerCase()} →
        </Link>
      </div>
    </div>
  );
}
