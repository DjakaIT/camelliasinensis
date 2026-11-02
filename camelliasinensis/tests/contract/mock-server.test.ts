// Sigurnosna pravila mock-servera (API-CONTRACT §6, GUIDE §8): webhook, CORS, zaštite pri pokretanju.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Stripe from '../../mock-server/node_modules/stripe';
import { beforeEach, describe, expect, it } from 'vitest';
import { CONTRACT_PORT, CONTRACT_WEBHOOK_SECRET } from './global-setup';
import { URLS } from './adapters';

const base = `http://127.0.0.1:${CONTRACT_PORT}`;
const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

async function newOrder(qty = 2) {
  const r = await json('/checkout/start', { lines: [{ sku: 'CSTB-2', qty }], urls: URLS });
  expect(r.status).toBe(200);
  const { orderToken } = (await r.json()) as { orderToken: string };
  return orderToken;
}

function signed(event: object) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: CONTRACT_WEBHOOK_SECRET });
  return { payload, header };
}

describe('mock-server: webhook', () => {
  beforeEach(async () => {
    await fetch(`${base}/__dev/reset`, { method: 'POST' });
  });

  it('krivi potpis → 400', async () => {
    const r = await fetch(`${base}/webhooks/stripe`, {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef', 'content-type': 'application/json' },
      body: '{"id":"evt_x","type":"checkout.session.completed"}',
    });
    expect(r.status).toBe(400);
  });

  it('ispravan potpis označi narudžbu plaćenom; ponovljeni događaj je idempotentan', async () => {
    const token = await newOrder(2);
    // Interni ID narudžbe (Stripe ga dobiva kao client_reference_id) nije javan; test ga čita iz /__dev/.
    const ref = (await (await fetch(`${base}/__dev/order-id/${token}`)).json()) as { id: string };
    expect(ref.id).toBeTruthy();
    const event = {
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: ref.id, payment_status: 'paid' } },
    };
    for (let i = 0; i < 2; i++) {
      const { payload, header } = signed(event);
      const r = await fetch(`${base}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'stripe-signature': header, 'content-type': 'application/json' },
        body: payload,
      });
      expect(r.status).toBe(200);
      if (i === 1) expect(await r.json()).toMatchObject({ duplicate: true });
    }
    expect(await (await fetch(`${base}/orders/${token}`)).json()).toMatchObject({ status: 'paid' });
    const live = (await (await fetch(`${base}/live?skus=CSTB-2`)).json()) as { stock: { quantity: number } }[];
    expect(live[0]?.stock.quantity).toBe(22); // 24 − 2, jednom
  });
});

describe('mock-server: CORS', () => {
  it('nepoznat origin ne dobiva Access-Control-Allow-Origin', async () => {
    const r = await fetch(`${base}/live?skus=CSTB-2`, { headers: { origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('localhost:3000 dobiva točno svoj origin, bez credentials', async () => {
    const r = await fetch(`${base}/live?skus=CSTB-2`, { headers: { origin: 'http://localhost:3000' } });
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(r.headers.get('access-control-allow-credentials')).toBeNull();
  });
});

describe('mock-server: zaštite pri pokretanju', () => {
  const cwd = fileURLToPath(new URL('../../mock-server/', import.meta.url));
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, ['src/server.js'], { cwd, env: { PATH: process.env.PATH ?? '', PORT: '4199', ...env } as unknown as NodeJS.ProcessEnv, encoding: 'utf8', timeout: 10_000 });

  it.each([
    ['sk_live_ ključ', { STRIPE_SECRET_KEY: 'sk_live_' + 'x'.repeat(20) }, /LIVE/],
    ['rk_live_ ključ', { STRIPE_SECRET_KEY: 'rk_live_' + 'x'.repeat(20) }, /LIVE/],
    ['ključ koji nije test', { STRIPE_SECRET_KEY: 'pk_test_abc' }, /sk_test_/],
    ['adresa izvan 127.0.0.1', { HOST: '0.0.0.0' }, /127\.0\.0\.1/],
    ['NODE_ENV=production', { NODE_ENV: 'production' }, /production/],
    ['CORS *', { CORS_ORIGINS: '*' }, /CORS/],
  ])('odbija start: %s', (_, env, msg) => {
    const r = run(env);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(msg);
    expect(r.stderr + r.stdout).not.toMatch(/x{20}/); // ključ se nikad ne ispisuje
  });
});
