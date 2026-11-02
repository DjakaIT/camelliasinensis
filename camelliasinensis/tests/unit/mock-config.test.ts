// Zaštite mock-servera pri pokretanju (API-CONTRACT §6.2, GUIDE §8.2).
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../mock-server/src/config.js';

describe('mock-server loadConfig', () => {
  it('bez ključeva radi s FAKE plaćanjem na 127.0.0.1', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({ host: '127.0.0.1', port: 4000, payments: 'fake', stripeKey: null });
    expect(c.corsOrigins).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });
  it('sk_test_ ključ uključuje Stripe test način', () => {
    expect(loadConfig({ STRIPE_SECRET_KEY: 'sk_test_123' }).payments).toBe('stripe');
    expect(loadConfig({ STRIPE_SECRET_KEY: 'rk_test_123' }).payments).toBe('stripe');
  });
  it.each([
    { STRIPE_SECRET_KEY: 'sk_live_123' },
    { STRIPE_SECRET_KEY: 'rk_live_123' },
    { STRIPE_SECRET_KEY: 'pk_test_123' },
    { STRIPE_SECRET_KEY: 'nesto' },
    { HOST: '0.0.0.0' },
    { HOST: 'localhost' },
    { NODE_ENV: 'production' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://camelliasinensis.eu' },
    { STRIPE_WEBHOOK_SECRET: 'tajna' },
  ])('odbija %o', (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });
});
