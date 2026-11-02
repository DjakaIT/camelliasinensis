'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Pojava elemenata .rv pri skrolanju (prototip). Bez JS-a sadržaj je odmah vidljiv. */
export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv').forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.rv:not(.in)').forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
      else io.observe(el);
    });
    root.classList.add('js');
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
