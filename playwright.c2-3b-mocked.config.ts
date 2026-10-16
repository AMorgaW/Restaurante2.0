import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/order-receipt-c2-3b-mocked.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  use: {
    baseURL: "http://localhost:3211",
    serviceWorkers: "block",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run generate:menu && next dev -p 3211",
    url: "http://localhost:3211",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      AUTH_MODE: "disabled",
      DATA_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:59999",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_c2_3b_mock_key",
      GUEST_RECEIPT_RECOVERY_ENABLED: "true",
    },
  },
  projects: [
    { name: "c2-3b-chromium-320", use: { ...devices["Pixel 7"], viewport: { width: 320, height: 568 } } },
    { name: "c2-3b-webkit-320", use: { ...devices["iPhone 13"], viewport: { width: 320, height: 568 } } },
    { name: "c2-3b-chromium-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "c2-3b-webkit-390", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } } },
    { name: "c2-3b-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
