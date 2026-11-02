// Jedinstveni oblik grešaka (API-CONTRACT §5). Kupac vidi samo hrvatsku poruku, nikad sirovu poruku backenda.

export type ShopErrorCode =
  | 'UNKNOWN_SKU'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'PRICE_CHANGED'
  | 'UNPUBLISHED'
  | 'INVALID_REQUEST'
  | 'CHECKOUT_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN';

export type ShopErrorDetails = { sku?: string; availableQty?: number | null; retryAfterSec?: number };

export const SHOP_ERROR_CODES: readonly ShopErrorCode[] = [
  'UNKNOWN_SKU',
  'OUT_OF_STOCK',
  'INSUFFICIENT_STOCK',
  'PRICE_CHANGED',
  'UNPUBLISHED',
  'INVALID_REQUEST',
  'CHECKOUT_UNAVAILABLE',
  'RATE_LIMITED',
  'NETWORK',
  'UNKNOWN',
];

export function shopErrorMessage(code: ShopErrorCode, details: ShopErrorDetails = {}): string {
  switch (code) {
    case 'INSUFFICIENT_STOCK':
      return details.availableQty != null
        ? `Nažalost, od ovog artikla imamo još samo ${details.availableQty}.`
        : 'Nažalost, nema dovoljno komada.';
    case 'OUT_OF_STOCK':
      return 'Ovaj artikl je upravo rasprodan.';
    case 'UNKNOWN_SKU':
    case 'UNPUBLISHED':
      return 'Ovaj artikl više nije u ponudi.';
    case 'PRICE_CHANGED':
      return 'Cijena se promijenila. Provjerite novu cijenu prije plaćanja.';
    case 'CHECKOUT_UNAVAILABLE':
      return 'Plaćanje trenutno nije dostupno. Pokušajte ponovno za nekoliko minuta.';
    case 'RATE_LIMITED':
      return `Previše pokušaja, pokušajte ponovno za ${details.retryAfterSec ?? 30} s.`;
    case 'NETWORK':
      return 'Nema veze s trgovinom. Provjerite internet i pokušajte ponovno.';
    case 'INVALID_REQUEST':
      return 'Košarica nije ispravna. Osvježite stranicu i pokušajte ponovno.';
    default:
      return 'Nešto nije u redu. Pokušajte ponovno.';
  }
}

export class ShopError extends Error {
  readonly code: ShopErrorCode;
  readonly details: ShopErrorDetails;

  constructor(code: ShopErrorCode, details: ShopErrorDetails = {}, message = shopErrorMessage(code, details)) {
    super(message);
    this.name = 'ShopError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { code: this.code, message: this.message, ...(Object.keys(this.details).length ? { details: this.details } : {}) };
  }

  /** Bilo što (fetch greška, JSON s poslužitelja, nepoznato) → ShopError s našom porukom. */
  static from(err: unknown): ShopError {
    if (err instanceof ShopError) return err;
    if (err && typeof err === 'object' && 'code' in err && SHOP_ERROR_CODES.includes((err as { code: ShopErrorCode }).code)) {
      const e = err as { code: ShopErrorCode; details?: ShopErrorDetails };
      return new ShopError(e.code, sanitizeDetails(e.details));
    }
    if (err instanceof TypeError) return new ShopError('NETWORK');
    return new ShopError('UNKNOWN');
  }
}

function sanitizeDetails(d: unknown): ShopErrorDetails {
  if (!d || typeof d !== 'object') return {};
  const x = d as Record<string, unknown>;
  const out: ShopErrorDetails = {};
  if (typeof x.sku === 'string') out.sku = x.sku;
  if (typeof x.availableQty === 'number' || x.availableQty === null) out.availableQty = x.availableQty as number | null;
  if (typeof x.retryAfterSec === 'number') out.retryAfterSec = x.retryAfterSec;
  return out;
}
