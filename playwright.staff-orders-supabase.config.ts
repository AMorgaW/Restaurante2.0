import { defineConfig, devices } from "@playwright/test";

/**
 * E2E dirigidos 11B-3: staff + pedidos reales (Supabase Auth + DATA local).
 * Puerto 3111 para no chocar con demo (3100) ni catálogo supabase (3110).
 */
const LOCAL_PUBLISHABLE = "[REDACTED_LOCAL_KEY]";
const LOCAL_ANON_JWT =
  "[REDACTED_LOCAL_KEY]";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/staff-orders-supabase.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3111",
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm run generate:menu && next dev -p 3111",
    url: "http://localhost:3111",
    timeout: 180_000,
    reuseExistingServer: false,
    env: (() => {
      const { NODE_ENV: _nodeEnv, ...rest } = process.env;
      return {
        ...rest,
        AUTH_MODE: "supabase",
        DATA_MODE: "supabase",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3111",
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
