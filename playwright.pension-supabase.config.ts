import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseWebServerEnv } from "./tests/helpers/local-supabase-env";

/** E2E dirigidos 11B-5: pensionado web con Auth y datos Supabase locales. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/pension-supabase.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3112",
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm run generate:menu && next dev -p 3112",
    url: "http://localhost:3112",
    timeout: 180_000,
    reuseExistingServer: false,
    env: getLocalSupabaseWebServerEnv({ siteUrl: "http://localhost:3112" }),
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
