// Svaki adapter + "ruke" kojima test mijenja stanje backenda (zaliha, cijena) i simulira plaćanje.
// Novi adapter (npr. woo) mora dodati svoj unos i proći cijeli skup (API-CONTRACT §7).
import { createDemoBackend, demoControls } from '@/lib/shop/adapters/demo';
import { createDevserverBackend } from '@/lib/shop/adapters/devserver';
import type { ShopBackend } from '@/lib/shop/types';
import { CONTRACT_PORT } from './global-setup';

export type Controls = {
  reset(): Promise<void>;
  setStock(sku: string, qty: number): Promise<void>;
  setPrice(sku: string, cents: number): Promise<void>;
  /** Kupac plati na stranici za plaćanje (FAKE). */
  pay(token: string, redirectUrl: string): Promise<void>;
};

export type AdapterCase = { name: string; backend: ShopBackend; controls: Controls };

const devUrl = `http://127.0.0.1:${CONTRACT_PORT}`;
const post = async (path: string, body?: unknown) => {
  const r = await fetch(devUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  if (r.status >= 400) throw new Error(`${path} → ${r.status}`);
  return r;
};

export const ADAPTERS: AdapterCase[] = [
  {
    name: 'demo',
    backend: createDemoBackend(),
    controls: {
      reset: async () => demoControls.reset(),
      setStock: async (sku, qty) => void demoControls.setStock(sku, qty),
      setPrice: async (sku, cents) => demoControls.setPrice(sku, cents),
      pay: async (token) => void demoControls.pay(token),
    },
  },
  {
    name: 'devserver',
    backend: createDevserverBackend(devUrl),
    controls: {
      reset: async () => void (await post('/__dev/reset')),
      setStock: async (sku, qty) => void (await post('/__dev/stock', { sku, qty })),
      setPrice: async (sku, amount) => void (await post('/__dev/price', { sku, amount })),
      pay: async (token, redirectUrl) => {
        const path = new URL(redirectUrl).pathname;
        if (!path.endsWith(token)) throw new Error('redirectUrl ne vodi na FAKE stranicu ove narudžbe');
        await post(`/fake-checkout/${token}/pay`);
      },
    },
  },
];

export const URLS = { success: 'http://localhost:3000/narudzba/uspjeh/', cancel: 'http://localhost:3000/kosarica/?otkazano=1' };
