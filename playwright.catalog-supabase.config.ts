import { defineConfig, devices } from "@playwright/test";

/**
 * E2E dirigidos del catálogo con DATA_MODE=supabase (Supabase local).
 * Puerto 3110 para no chocar con la suite demo en 3100.
 * No usa service_role ni producción.
 */
/** Claves demo del stack Supabase CLI local (no producción). */
const LOCAL_PUBLISHABLE = "[REDACTED_LOCAL_KEY]";
const LOCAL_ANON_JWT =
  "[REDACTED_LOCAL_KEY]";

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
    env: (() => {
      const { NODE_ENV: _nodeEnv, ...rest } = process.env;
      return {
        ...rest,
        AUTH_MODE: "disabled",
        DATA_MODE: "supabase",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3110",
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
