import { defineConfig, devices } from '@playwright/test';

// E2E nad izvezenim out/ (sirv), GUIDE §4.4. Prije: `npm run build:e2e` (izgradi devserver pa demo).
// Projekt "demo" koristi out/ na :3100, projekt "devserver" out-devserver/ na :3101 + mock-server (FAKE, bez .env) na :4050.
// Vlastiti portovi i uvijek svježi poslužitelji: ne smije se slučajno spojiti na `npm run dev` (:3000) ni na dev:mock sa Stripe ključem (:4000).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', locale: 'hr-HR' },
  projects: [
    { name: 'demo', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3100' } },
    { name: 'devserver', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3101' } },
  ],
  webServer: [
    { command: 'npx sirv out --port 3100 --host 127.0.0.1 --single 404.html --quiet', url: 'http://127.0.0.1:3100/', reuseExistingServer: false },
    {
      command: 'npx sirv out-devserver --port 3101 --host 127.0.0.1 --single 404.html --quiet',
      url: 'http://127.0.0.1:3101/',
      reuseExistingServer: false,
    },
    {
      command: 'node src/server.js',
      cwd: 'mock-server',
      url: 'http://127.0.0.1:4050/health',
      reuseExistingServer: false,
      env: { PORT: '4050', MOCK_QUIET: '1', CORS_ORIGINS: 'http://127.0.0.1:3101' },
    },
  ],
});
