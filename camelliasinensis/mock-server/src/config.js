// Zaštite pri pokretanju (API-CONTRACT §6, GUIDE §8.2). Svako kršenje = poslužitelj ne starta.

export class ConfigError extends Error {}

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function loadConfig(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new ConfigError('mock-server odbija start uz NODE_ENV=production: služi samo za lokalni razvoj.');
  }

  const host = env.HOST ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    throw new ConfigError(`mock-server sluša samo na 127.0.0.1 (zadano HOST=${host}).`);
  }

  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new ConfigError(`Neispravan PORT: ${env.PORT}`);

  const key = (env.STRIPE_SECRET_KEY ?? '').trim();
  if (/^(sk|rk)_live_/.test(key)) {
    throw new ConfigError('Odbijeno: STRIPE_SECRET_KEY je LIVE ključ. Dopušteni su samo test ključevi (sk_test_ / rk_test_).');
  }
  if (key && !/^(sk|rk)_test_/.test(key)) {
    throw new ConfigError('Odbijeno: STRIPE_SECRET_KEY mora počinjati s sk_test_ ili rk_test_.');
  }

  const webhookSecret = (env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
    throw new ConfigError('STRIPE_WEBHOOK_SECRET mora počinjati s whsec_.');
  }

  const corsOrigins = (env.CORS_ORIGINS ?? DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.includes('*')) throw new ConfigError('CORS_ORIGINS ne smije sadržavati "*".');
  for (const o of corsOrigins) {
    const u = new URL(o);
    if (!['localhost', '127.0.0.1'].includes(u.hostname)) {
      throw new ConfigError(`CORS_ORIGINS smije sadržavati samo lokalne adrese, a ne ${o}.`);
    }
  }

  return {
    host,
    port,
    publicUrl: `http://${host}:${port}`,
    stripeKey: key || null,
    webhookSecret: webhookSecret || null,
    payments: key ? 'stripe' : 'fake',
    corsOrigins,
    devRoutes: env.NODE_ENV !== 'production',
    quiet: env.MOCK_QUIET === '1',
  };
}
