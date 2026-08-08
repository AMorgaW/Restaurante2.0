import { defineConfig, devices } from "@playwright/test";

/**
 * E2E dirigidos 11B-6: mesas / cobros manuales (Supabase Auth + DATA).
 * Puerto 3120 dedicado a esta suite.
 */
const LOCAL_PUBLISHABLE = "[REDACTED_LOCAL_KEY]";
const LOCAL_ANON_JWT =
  "[REDACTED_LOCAL_KEY]";

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
    env: (() => {
      const { NODE_ENV: _nodeEnv, ...rest } = process.env;
      return {
        ...rest,
        AUTH_MODE: "supabase",
        DATA_MODE: "supabase",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3120",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_PUBLISHABLE,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON_JWT,
      };
    })(),
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
