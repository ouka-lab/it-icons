// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8787;
const baseURL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  // Leave the OS / browser name out of snapshot names so that macOS and CI (Linux) share the same files
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
  },
  // e2e/builder.spec.js drives the page in a browser, so use Chromium (the API tests only use request)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL },
    },
  ],
  webServer: {
    // Build dist/icons.json, then start the Worker locally (workerd). No Cloudflare login is needed
    command: `npm run dev -- --port ${PORT} --ip 127.0.0.1`,
    url: `${baseURL}/api/icons`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
