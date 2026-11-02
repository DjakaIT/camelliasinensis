export class ConfigError extends Error {}
export type MockConfig = {
  host: string;
  port: number;
  publicUrl: string;
  stripeKey: string | null;
  webhookSecret: string | null;
  payments: 'stripe' | 'fake';
  corsOrigins: string[];
  devRoutes: boolean;
  quiet: boolean;
};
export function loadConfig(env?: Record<string, string | undefined>): MockConfig;
