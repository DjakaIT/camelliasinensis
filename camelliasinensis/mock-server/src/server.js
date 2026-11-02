// SAMO ZA RAZVOJ (API-CONTRACT §6): nikad se ne deploya, sluša samo na 127.0.0.1, samo Stripe TEST ključevi.
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createFakePayments, createStripePayments } from './payments.js';
import { createStore } from './store.js';

let config;
try {
  config = loadConfig();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`[mock-server] ${e.message}`);
    process.exit(1);
  }
  throw e;
}

const log = config.quiet ? () => {} : (m) => console.log(`[mock-server] ${m}`);
const store = createStore();
const payments = config.payments === 'stripe' ? createStripePayments(config) : createFakePayments(config);
const app = createApp({ config, store, payments, log });

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  // Ključevi se nikad ne ispisuju, samo način rada.
  console.log(
    `[mock-server] http://${info.address}:${info.port} · plaćanje: ${payments.name === 'stripe' ? 'Stripe TEST' : 'FAKE (bez ključeva)'}` +
      ` · webhook: ${config.webhookSecret ? 'uključen' : 'isključen'} · CORS: ${config.corsOrigins.join(', ')}`,
  );
});
