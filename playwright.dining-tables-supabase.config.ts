import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseWebServerEnv } from "./tests/helpers/local-supabase-env";

/** E2E dirigidos 11B-6: mesas/cobros manuales con Auth y datos Supabase locales. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/dining-tables-supabase.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:3120",
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm run generate:menu && next dev -H 127.0.0.1 -p 3120",
    url: "http://127.0.0.1:3120",
    timeout: 180_000,
    reuseExistingServer: false,
    env: getLocalSupabaseWebServerEnv({ siteUrl: "http://127.0.0.1:3120" }),
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
