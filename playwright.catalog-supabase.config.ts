import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseWebServerEnv } from "./tests/helpers/local-supabase-env";

/** E2E dirigidos del catálogo con DATA_MODE=supabase contra Supabase local. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/catalog-supabase.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3110",
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm run generate:menu && next dev -p 3110",
    url: "http://localhost:3110",
    timeout: 180_000,
    reuseExistingServer: false,
    env: getLocalSupabaseWebServerEnv({
      siteUrl: "http://localhost:3110",
      authMode: "disabled",
    }),
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
