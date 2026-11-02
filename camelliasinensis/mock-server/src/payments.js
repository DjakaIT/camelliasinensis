// Pružatelji plaćanja: FAKE (bez ključeva, isto kao demo) i Stripe hosted Checkout u TEST načinu.
import Stripe from 'stripe';
import { maskEmail } from '../../lib/shop/engine.ts';
import { SHIPPING_METHODS, shippingPrice } from '../../lib/shop/shipping.ts';

export function createFakePayments(config) {
  return {
    name: 'fake',
    async createSession(order) {
      return { redirectUrl: `${config.publicUrl}/fake-checkout/${order.token}`, sessionId: null };
    },
    async retrieveStatus() {
      return null;
    },
  };
}

// GLS opcije iz lib/shop/shipping.ts; besplatno od 50 €. Cijene su PRIMJERI [ODLUKA: GLS ugovor] (API-CONTRACT §6).
// Odabir konkretnog paketomata Stripe Checkout ne podržava; to dolazi s GLS integracijom na backendu.
function glsOptions(subtotal) {
  return SHIPPING_METHODS.map((m) => {
    const amount = shippingPrice(m, subtotal);
    return {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount, currency: 'eur' },
        display_name: amount ? m.name : `${m.name} (besplatno od 50 €)`,
        delivery_estimate: { minimum: { unit: 'business_day', value: 1 }, maximum: { unit: 'business_day', value: m.id === 'gls-adresa' ? 3 : 2 } },
      },
    };
  });
}

export function createStripePayments(config) {
  const stripe = new Stripe(config.stripeKey, { maxNetworkRetries: 1, timeout: 15000 });
  return {
    name: 'stripe',
    async createSession(order) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: order.lines.map((l) => ({
            quantity: l.qty,
            price_data: {
              currency: 'eur',
              unit_amount: l.unitPrice.amount, // iz kataloga poslužitelja, nikad iz zahtjeva
              product_data: { name: l.name, metadata: { sku: l.sku } },
            },
          })),
          locale: 'hr',
          client_reference_id: order.id,
          metadata: { orderId: order.id, skus: order.lines.map((l) => `${l.sku}x${l.qty}`).join(',').slice(0, 500) },
          shipping_address_collection: { allowed_countries: ['HR'] },
          shipping_options: glsOptions(order.total.amount),
          phone_number_collection: { enabled: true },
          success_url: order.successUrl, // sadrži naš orderToken, ne ID Stripe sesije
          cancel_url: order.cancelUrl,
        },
        { idempotencyKey: `cs-${order.id}` },
      );
      return { redirectUrl: session.url, sessionId: session.id };
    },
    /** Server prema serveru: je li sesija plaćena (API-CONTRACT §6). */
    async retrieveStatus(sessionId) {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      const email = maskEmail(s.customer_details?.email); // samo maskirano, nikad u log
      if (s.payment_status === 'paid' || s.payment_status === 'no_payment_required') return { status: 'paid', email };
      if (s.status === 'expired') return { status: 'cancelled' };
      return { status: 'pending' };
    },
  };
}

/** Provjera potpisa webhooka. Ne treba tajni ključ, samo whsec_. Krivi potpis baca grešku. */
export function verifyWebhook(rawBody, signature, secret) {
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
