// Build nad adapterom devserver. listProducts/listTypes pri buildu idu na mock-server, pa ovdje pokrećemo
// VLASTITI, svježi mock (port 4059, uvijek s trenutnom fixturom) samo za build. Preglednik kasnije zove
// mock na MOCK_PORT (zadano 4000; npr. `npm run dev:mock` sa Stripe ključem).
// Rezultat ide u out-devserver/ (out/ ostaje za demo build).
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const RUNTIME_PORT = process.env.MOCK_PORT ?? '4000';
const BUILD_PORT = process.env.MOCK_BUILD_PORT ?? '4059';
const shell = process.platform === 'win32';

// 1. Fixture i slike prije pokretanja mocka (mock čita fixture pri startu).
if (spawnSync('npm', ['run', 'assets'], { stdio: 'inherit', shell }).status !== 0) process.exit(1);

const health = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${BUILD_PORT}/health`)).ok;
  } catch {
    return false;
  }
};
if (await health()) {
  console.error(`build-devserver: port ${BUILD_PORT} je zauzet (stari mock-server?). Ugasi ga i pokušaj ponovno.`);
  process.exit(1);
}

// 2. Svježi mock samo za build (bez .env, FAKE plaćanje; build ionako čita samo katalog).
const mock = spawn(process.execPath, ['src/server.js'], {
  cwd: 'mock-server',
  env: { PATH: process.env.PATH, PORT: BUILD_PORT, MOCK_QUIET: '1' },
  stdio: 'inherit',
});
const stop = () => mock.kill();
process.on('exit', stop);

let up = false;
for (let i = 0; i < 100 && !up; i++) {
  up = await health();
  if (!up) await new Promise((r) => setTimeout(r, 100));
}
if (!up) {
  console.error('build-devserver: mock-server se nije pokrenuo');
  process.exit(1);
}

// 3. next build: katalog s build mocka, a u bundle ide adresa runtime mocka.
const r = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell,
  env: {
    ...process.env,
    NEXT_PUBLIC_BACKEND: 'devserver',
    NEXT_PUBLIC_DEMO: '0',
    NEXT_PUBLIC_DEVSERVER_URL: `http://127.0.0.1:${RUNTIME_PORT}`,
    DEVSERVER_BUILD_URL: `http://127.0.0.1:${BUILD_PORT}`,
  },
});
stop();
if (r.status !== 0) process.exit(r.status ?? 1);
const pb = spawnSync('node', ['scripts/postbuild.mjs'], {
  stdio: 'inherit',
  shell,
  env: { ...process.env, NEXT_PUBLIC_BACKEND: 'devserver', NEXT_PUBLIC_DEVSERVER_URL: `http://127.0.0.1:${RUNTIME_PORT}` },
});
if (pb.status !== 0) process.exit(pb.status ?? 1);
rmSync('out-devserver', { recursive: true, force: true });
cpSync('out', 'out-devserver', { recursive: true });
console.log('build-devserver: out-devserver/ spreman');
