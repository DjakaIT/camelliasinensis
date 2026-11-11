// Adapter `hosting`: cijena i zaliha iz kataloga (zivo.json ili gradnja) pravilima engine.ts, a plaćanje i stanje
// narudžbe s PHP-a na istoj domeni. Klijent šalje samo { sku, qty }.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostingBackend, HOSTING_API } from '@/lib/shop/adapters/hosting';
import demoLive from '@/fixtures/demo-live.json';

const shop = createHostingBackend();
const SKU = Object.keys((demoLive as { skus: Record<string, unknown> }).skus)[0]!;
const odgovor = (status: number, tijelo: unknown) => new Response(JSON.stringify(tijelo), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('adapter hosting', () => {
  it('košarica se provjerava pravilima engine.ts nad katalogom', async () => {
    const c = await shop.checkCart([{ sku: SKU, qty: 1 }, { sku: 'NEMA-1', qty: 1 }]);
    expect(c.lines[0]!.ok).toBe(true);
    expect(c.lines[1]).toMatchObject({ ok: false, reason: 'UNKNOWN_SKU' });
    await expect(shop.checkCart([{ sku: SKU, qty: 0 }])).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('plaćanje šalje samo sku i qty na PHP i vraća preusmjeravanje', async () => {
    const fetch = vi.fn(async () => odgovor(200, { redirectUrl: 'https://checkout.stripe.com/c/pay/x', orderToken: 'a'.repeat(48) }));
    vi.stubGlobal('fetch', fetch);
    const r = await shop.startCheckout([{ sku: SKU, qty: 2, price: 1 } as never], { success: 'https://x/ok', cancel: 'https://x/no' });
    expect(r.redirectUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${HOSTING_API}/narudzba`);
    expect(JSON.parse(init.body as string)).toEqual({ lines: [{ sku: SKU, qty: 2 }], urls: { success: 'https://x/ok', cancel: 'https://x/no' } });
  });

  it('greške poslužitelja dolaze u obliku API-CONTRACT §5', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => odgovor(409, { error: { code: 'INSUFFICIENT_STOCK', details: { sku: SKU, availableQty: 1 } } })));
    await expect(shop.startCheckout([{ sku: SKU, qty: 5 }], { success: 'https://x/', cancel: 'https://x/' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    vi.stubGlobal('fetch', vi.fn(async () => odgovor(503, { error: { code: 'CHECKOUT_UNAVAILABLE' } })));
    await expect(shop.startCheckout([{ sku: SKU, qty: 1 }], { success: 'https://x/', cancel: 'https://x/' })).rejects.toMatchObject({ code: 'CHECKOUT_UNAVAILABLE' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(shop.getOrderStatus('b'.repeat(48))).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('neispravan token stanja ne ide na poslužitelj', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await shop.getOrderStatus('../x')).toEqual({ status: 'unknown' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
