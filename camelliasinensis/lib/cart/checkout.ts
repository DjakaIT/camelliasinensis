// Polazak na plaćanje (API-CONTRACT §3.3, §3.4): checkCart neposredno prije, pa startCheckout i preusmjeravanje.
// Košarica se ovdje NE briše; briše se tek kad je narudžba `paid` (/narudzba/uspjeh/).
import { getShop, ShopError, type CartCheck } from '../shop';
import { readCart, readSeenPrices } from './store';

export const ORDER_TOKEN_KEY = 'cs.order.token';

export type CheckoutOutcome =
  | { kind: 'redirect'; url: string }
  | { kind: 'blocked'; check: CartCheck; reason: 'lines' | 'price' }
  | { kind: 'error'; error: ShopError };

export async function beginCheckout(origin = window.location.origin): Promise<CheckoutOutcome> {
  const lines = readCart();
  if (!lines.length) return { kind: 'error', error: new ShopError('INVALID_REQUEST') };
  const shop = getShop();
  try {
    const check = await shop.checkCart(lines);
    if (check.lines.some((l) => !l.ok)) return { kind: 'blocked', check, reason: 'lines' };
    const seen = readSeenPrices();
    const changed = check.lines.some((l) => l.ok && seen[l.sku] != null && seen[l.sku] !== l.unitPrice.amount);
    if (check.priceChanged || changed) return { kind: 'blocked', check, reason: 'price' };

    const start = await shop.startCheckout(lines, {
      success: `${origin}/narudzba/uspjeh/`,
      cancel: `${origin}/kosarica/?otkazano=1`,
    });
    try {
      sessionStorage.setItem(ORDER_TOKEN_KEY, start.orderToken);
    } catch {
      // token je i u success URL-u
    }
    return { kind: 'redirect', url: start.redirectUrl };
  } catch (e) {
    return { kind: 'error', error: ShopError.from(e) };
  }
}
