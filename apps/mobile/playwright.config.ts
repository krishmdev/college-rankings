import { defineConfig, devices } from '@playwright/test';

// Runs against the static export served under the GitHub Pages subpath (`pnpm export:web` first).
const port = Number(process.env.PORT ?? 4173);
export const BASE = `http://127.0.0.1:${port}/college-rankings/`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: BASE, trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/preview-subpath.mjs',
    url: BASE,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port), EGRESS_CANARY: process.env.EGRESS_CANARY ?? '' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
