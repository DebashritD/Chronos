import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke test config: a single Chromium project at phone size,
 * against the Vite dev server (which proxies `/api` to the backend on
 * :8080). Reuses a dev server that's already running; set `E2E_BASE_URL` to point at a different one.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
  },
})
