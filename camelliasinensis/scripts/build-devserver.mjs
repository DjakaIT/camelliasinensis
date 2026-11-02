// Build nad adapterom devserver: listProducts/listTypes pri buildu idu na mock-server, pa ga ovdje pokrećemo.
// Rezultat ide u out-devserver/ (out/ ostaje za demo build).
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const PORT = process.env.MOCK_PORT ?? '4000';
const mock = spawn(process.execPath, ['src/server.js'], {
  cwd: 'mock-server',
  env: { PATH: process.env.PATH, PORT, MOCK_QUIET: process.env.MOCK_QUIET ?? '1' },
  stdio: 'inherit',
});
const stop = () => mock.kill();
process.on('exit', stop);

let up = false;
for (let i = 0; i < 100 && !up; i++) {
  try {
    up = (await fetch(`http://127.0.0.1:${PORT}/health`)).ok;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
if (!up) {
  console.error('build-devserver: mock-server se nije pokrenuo');
  process.exit(1);
}

const r = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    NEXT_PUBLIC_BACKEND: 'devserver',
    NEXT_PUBLIC_DEMO: '0',
    NEXT_PUBLIC_DEVSERVER_URL: `http://127.0.0.1:${PORT}`,
  },
});
stop();
if (r.status !== 0) process.exit(r.status ?? 1);
rmSync('out-devserver', { recursive: true, force: true });
cpSync('out', 'out-devserver', { recursive: true });
console.log('build-devserver: out-devserver/ spreman');
