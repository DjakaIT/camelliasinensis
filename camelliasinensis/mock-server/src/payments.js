// Pružatelji plaćanja: FAKE (bez ključeva, isto kao demo) i Stripe hosted Checkout u TEST načinu.
import Stripe from 'stripe';

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

// Primjer za test; stvarna dostava i države ovise o GLS ugovoru [ODLUKA] (API-CONTRACT §6).
const TEST_SHIPPING = {
  shipping_rate_data: {
    type: 'fixed_amount',
    fixed_amount: { amount: 500, currency: 'eur' },
    display_name: 'Dostava (TESTNI PRIMJER, nije stvarna cijena)',
  },
};

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
          shipping_options: [TEST_SHIPPING],
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
      if (s.payment_status === 'paid' || s.payment_status === 'no_payment_required') return 'paid';
      if (s.status === 'expired') return 'cancelled';
      return 'pending';
    },
  };
}

/** Provjera potpisa webhooka. Ne treba tajni ključ, samo whsec_. Krivi potpis baca grešku. */
export function verifyWebhook(rawBody, signature, secret) {
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
