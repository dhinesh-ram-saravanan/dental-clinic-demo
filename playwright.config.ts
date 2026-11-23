import { defineConfig } from '@playwright/test'

// BASE_URL=https://… runs the same suite against a deployed preview.
const baseURL = process.env.BASE_URL || 'http://localhost:4173'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL, timezoneId: 'Asia/Kolkata', locale: 'en-IN', viewport: { width: 1440, height: 900 } },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: true },
})
