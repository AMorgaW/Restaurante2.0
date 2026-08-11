import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseWebServerEnv } from "./tests/helpers/local-supabase-env";

/** E2E 11B-7: avisos in-web de pedidos para staff y owner contra Supabase local. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/order-alerts-supabase.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 180_000,
  expect: { timeout: 45_000 },
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
