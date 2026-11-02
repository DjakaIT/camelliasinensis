// HTTP sučelje mock-servera (API-CONTRACT §6). Cijena i zaliha uvijek s poslužitelja; klijent šalje samo { sku, qty }.
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { checkLines, isAllowedReturnUrl, live, maskEmail, priceForCheckout, withOrderToken } from '../../lib/shop/engine.ts';
import { ShopError } from '../../lib/shop/errors.ts';
import { fakeCheckoutPage } from './fake-page.js';
import { verifyWebhook } from './payments.js';

const STATUS = { INVALID_REQUEST: 400, UNKNOWN_SKU: 409, OUT_OF_STOCK: 409, INSUFFICIENT_STOCK: 409, UNPUBLISHED: 409, PRICE_CHANGED: 409, CHECKOUT_UNAVAILABLE: 503, RATE_LIMITED: 429 };

export function createApp({ config, store, payments, log = () => {} }) {
  const app = new Hono();

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'no-store');
    // Samo metoda, putanja bez upita i status; nikad tijela, e-mail ni adresa (GUIDE §8.6).
    log(`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status}`);
  });
  app.use(
    '*',
    cors({
      origin: (origin) => (config.corsOrigins.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['content-type'],
      credentials: false,
      maxAge: 600,
    }),
  );
  app.use('*', bodyLimit({ maxSize: 32 * 1024, onError: (c) => c.json(err(new ShopError('INVALID_REQUEST')), 413) }));

  app.onError((e, c) => {
    const se = e instanceof ShopError ? e : new ShopError('UNKNOWN');
    if (!(e instanceof ShopError)) log(`greška: ${e?.name ?? 'Error'}`); // bez poruke (može sadržavati podatke)
    return c.json(err(se), STATUS[se.code] ?? 500);
  });

  const readJson = async (c) => {
    try {
      return await c.req.json();
    } catch {
      throw new ShopError('INVALID_REQUEST');
    }
  };

  app.get('/health', (c) => c.json({ ok: true, payments: payments.name }));

  // BUILD
  app.get('/products', (c) => c.json(store.products()));
  app.get('/types', (c) => c.json(store.types()));

  // KLIJENT
  app.get('/live', (c) => {
    const raw = c.req.query('skus') ?? '';
    const skus = raw ? raw.split(',') : [];
    return c.json(live(store.catalog(), skus));
  });

  app.post('/cart/check', async (c) => {
    const body = await readJson(c);
    return c.json(checkLines(store.catalog(), body?.lines));
  });

  app.post('/checkout/start', async (c) => {
    const body = await readJson(c);
    const urls = body?.urls ?? {};
    if (!isAllowedReturnUrl(urls.success, config.corsOrigins) || !isAllowedReturnUrl(urls.cancel, config.corsOrigins)) {
      throw new ShopError('INVALID_REQUEST');
    }
    const priced = priceForCheckout(store.catalog(), body?.lines); // ignorira amount, priceId, price_data…
    const order = store.createOrder({ lines: priced.lines, total: priced.total, successUrl: '', cancelUrl: urls.cancel });
    order.successUrl = withOrderToken(urls.success, order.token);
    try {
      const s = await payments.createSession(order);
      order.sessionId = s.sessionId;
      log(`narudžba ${order.id} stvorena (${payments.name})`);
      return c.json({ redirectUrl: s.redirectUrl, orderToken: order.token });
    } catch (e) {
      store.markStatus(order, 'failed');
      log(`plaćanje nedostupno za ${order.id}: ${e?.type ?? e?.name ?? 'greška'}`);
      throw new ShopError('CHECKOUT_UNAVAILABLE');
    }
  });

  app.get('/orders/:token', async (c) => {
    const order = store.orderByToken(c.req.param('token'));
    if (!order) return c.json({ status: 'unknown' });
    if (order.status === 'pending' && order.sessionId) {
      try {
        const s = await payments.retrieveStatus(order.sessionId);
        if (s?.email) order.emailMasked = s.email;
        if (s?.status === 'paid') store.markPaid(order);
        else if (s?.status === 'cancelled') store.markStatus(order, 'cancelled');
      } catch {
        // Stripe nedostupan: ostaje pending, frontend ponovno pita
      }
    }
    return c.json({
      status: order.status,
      ...(order.status === 'paid' ? { orderRef: order.ref, ...(order.emailMasked ? { email: order.emailMasked } : {}) } : {}),
    });
  });

  // KONTAKT FORMA (razvoj): provjera i potvrda; sadržaj poruke, ime i e-mail se NE zapisuju
  app.post('/contact', async (c) => {
    const b = (await readJson(c)) ?? {};
    const ok =
      typeof b.name === 'string' && b.name.trim().length >= 2 && b.name.length <= 200 &&
      typeof b.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(b.email.trim()) &&
      typeof b.topic === 'string' && b.topic.length <= 100 &&
      typeof b.message === 'string' && b.message.trim().length >= 10 && b.message.length <= 3000;
    if (!ok) throw new ShopError('INVALID_REQUEST');
    log('kontakt poruka zaprimljena');
    return c.json({ ok: true });
  });

  // STRIPE WEBHOOK: potpis se uvijek provjerava; obrada idempotentna po event.id
  app.post('/webhooks/stripe', async (c) => {
    if (!config.webhookSecret) return c.json({ error: 'webhook nije konfiguriran' }, 503);
    const raw = await c.req.text();
    let event;
    try {
      event = verifyWebhook(raw, c.req.header('stripe-signature') ?? '', config.webhookSecret);
    } catch {
      return c.json({ error: 'neispravan potpis' }, 400);
    }
    if (store.seenEvent(event.id)) return c.json({ received: true, duplicate: true });
    store.rememberEvent(event.id);
    const s = event.data?.object ?? {};
    const order = store.orderById(s.client_reference_id ?? s.metadata?.orderId);
    if (order && s.customer_details?.email) order.emailMasked = maskEmail(s.customer_details.email);
    switch (event.type) {
      case 'checkout.session.completed':
        if (s.payment_status === 'paid' || s.payment_status === 'no_payment_required') store.markPaid(order);
        break;
      case 'checkout.session.async_payment_succeeded':
        store.markPaid(order);
        break;
      case 'checkout.session.async_payment_failed':
        store.markStatus(order, 'failed');
        break;
      case 'checkout.session.expired':
        store.markStatus(order, 'cancelled');
        break;
    }
    log(`webhook ${event.type} → ${order ? `${order.id} ${order.status}` : 'nepoznata narudžba'}`);
    return c.json({ received: true });
  });

  // FAKE stranica za plaćanje (kad nema Stripe ključeva)
  if (payments.name === 'fake') {
    app.get('/fake-checkout/:token', (c) => {
      const order = store.orderByToken(c.req.param('token'));
      // form-action mora dopustiti i preusmjeravanje natrag na frontend (success/cancel URL).
      c.header(
        'Content-Security-Policy',
        `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${config.corsOrigins.join(' ')}; frame-ancestors 'none'`,
      );
      return c.html(fakeCheckoutPage(order), order ? 200 : 404);
    });
    app.post('/fake-checkout/:token/:action', (c) => {
      const order = store.orderByToken(c.req.param('token'));
      if (!order) return c.text('Narudžba nije pronađena', 404);
      const action = c.req.param('action');
      if (action === 'pay' && order.status === 'pending') {
        store.markPaid(order);
        return c.redirect(order.successUrl, 303);
      }
      if (action === 'cancel') {
        store.markStatus(order, 'cancelled');
        return c.redirect(order.cancelUrl, 303);
      }
      return c.redirect(`/fake-checkout/${order.token}`, 303);
    });
  }

  // Simulacija promjene zalihe "kao da ju je promijenila blagajna" (samo razvoj)
  if (config.devRoutes) {
    app.post('/__dev/stock', async (c) => {
      const { sku, qty } = (await readJson(c)) ?? {};
      const stock = typeof sku === 'string' ? store.setStock(sku, qty) : null;
      if (!stock) throw new ShopError('UNKNOWN_SKU', { sku });
      return c.json({ sku, stock });
    });
    app.post('/__dev/price', async (c) => {
      const { sku, amount } = (await readJson(c)) ?? {};
      if (!Number.isInteger(amount) || amount <= 0) throw new ShopError('INVALID_REQUEST');
      const price = typeof sku === 'string' ? store.setPrice(sku, amount) : null;
      if (!price) throw new ShopError('UNKNOWN_SKU', { sku });
      return c.json({ sku, price });
    });
    app.get('/__dev/order-id/:token', (c) => {
      const order = store.orderByToken(c.req.param('token'));
      return order ? c.json({ id: order.id, status: order.status }) : c.json({ error: 'nema' }, 404);
    });
    app.post('/__dev/reset', (c) => {
      store.reset();
      return c.json({ ok: true });
    });
  }

  app.notFound((c) => c.json({ error: { code: 'INVALID_REQUEST', message: 'Nepoznata putanja.' } }, 404));
  return app;
}

function err(se) {
  return { error: se.toJSON() };
}
