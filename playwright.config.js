// @ts-check
const { defineConfig } = require('@playwright/test');

const PORT = 8787;
const baseURL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  // スナップショット名に OS / ブラウザ名を含めず、macOS と CI (Linux) で同じファイルを共有する
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
  },
  webServer: {
    // dist/icons.json をビルドしてから Worker をローカル (workerd) で起動する。Cloudflare へのログインは不要
    command: `npm run dev -- --port ${PORT} --ip 127.0.0.1`,
    url: `${baseURL}/api/icons`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
