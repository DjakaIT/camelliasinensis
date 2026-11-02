import { defineConfig, devices } from '@playwright/test';

// E2E nad izvezenim out/ (sirv), GUIDE §4.4. Prije: `npm run build:e2e` (izgradi devserver pa demo).
// Projekt "demo" koristi out/ na :3000, projekt "devserver" out-devserver/ na :3001 + mock-server (FAKE) na :4000.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', locale: 'hr-HR' },
  projects: [
    { name: 'demo', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3000' } },
    { name: 'devserver', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3001' } },
  ],
  webServer: [
    { command: 'npx sirv out --port 3000 --host 127.0.0.1 --single 404.html --quiet', url: 'http://127.0.0.1:3000/', reuseExistingServer: true },
    {
      command: 'npx sirv out-devserver --port 3001 --host 127.0.0.1 --single 404.html --quiet',
      url: 'http://127.0.0.1:3001/',
      reuseExistingServer: true,
    },
    {
      command: 'node src/server.js',
      cwd: 'mock-server',
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: true,
      env: { MOCK_QUIET: '1', CORS_ORIGINS: 'http://127.0.0.1:3001,http://localhost:3000,http://127.0.0.1:3000' },
    },
  ],
});
