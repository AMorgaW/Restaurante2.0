import { defineConfig, devices } from "@playwright/test";

/**
 * C2.2 determinista: DATA_MODE=supabase y la capacidad están activados solo en
 * este servidor de pruebas; cada POST de pedidos se intercepta en el navegador.
 * No conecta con Supabase ni crea pedidos.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/checkout-c2-2-mocked.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  use: {
    baseURL: "http://localhost:3200",
    serviceWorkers: "block",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run generate:menu && next dev -p 3200",
    url: "http://localhost:3200",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      AUTH_MODE: "disabled",
      DATA_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:59999",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_c2_2_mock_key",
      GUEST_RECEIPT_RECOVERY_ENABLED: "true",
    },
  },
  projects: [
    { name: "c2-2-chromium", use: { ...devices["Pixel 7"] } },
    { name: "c2-2-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
