// Pokreće mock-server (FAKE plaćanje, bez Stripe ključeva) za test ugovora nad adapterom devserver.
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CONTRACT_PORT = 4100;
export const CONTRACT_WEBHOOK_SECRET = 'whsec_contract_test_only';

let child: ChildProcess | null = null;

export async function setup() {
  const cwd = fileURLToPath(new URL('../../mock-server/', import.meta.url));
  child = spawn(process.execPath, ['src/server.js'], {
    cwd,
    env: {
      PATH: process.env.PATH ?? '',
      PORT: String(CONTRACT_PORT),
      MOCK_QUIET: '1',
      STRIPE_WEBHOOK_SECRET: CONTRACT_WEBHOOK_SECRET,
    } as unknown as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = `http://127.0.0.1:${CONTRACT_PORT}/health`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // još se pokreće
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('mock-server se nije pokrenuo');
}

export async function teardown() {
  child?.kill();
}
