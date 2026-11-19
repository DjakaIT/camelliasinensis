import { formatIsoDate, formatMoney } from '@/lib/format';
import type { BasePrice as Base } from '@/lib/shop/types';

/**
 * Bazna (sidrena) cijena uz cijenu proizvoda: Pravilnik o isticanju bazne cijene proizvoda (NN 132/2026, od 17. 11. 2026.).
 * Za robu ponuđenu nakon 2. 5. 2025. to je cijena s dana kad je prvi put ponuđena (podatak iz uredništva, ne mijenja se
 * s cijenom). Sitno (6 px, Daniel 19. 11. 2026.) i apsolutno ispod cijene, pa ne mijenja raspored (.bz u styles/extra.css).
 */
export function BasePrice({ base }: { base: Base | null | undefined }) {
  if (!base) return null;
  return (
    <small className="bz" data-testid="bazna">
      Bazna cijena <time dateTime={base.date}>{formatIsoDate(base.date)}</time>: {formatMoney(base.amount)}
    </small>
  );
}
