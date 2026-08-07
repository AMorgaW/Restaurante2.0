import { defineConfig, devices } from "@playwright/test";

/**
 * Las pruebas E2E de demo/Auth corren contra `next dev` (NODE_ENV=development)
 * con AUTH_MODE=disabled explícito. No usan `next start` ni debilitan producción.
 * El build productivo se valida por separado con `npm run build`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // La suite completa usa dos servidores Next (3100 y 3000) y contiene
  // capturas/evidencia que comparten el proceso de build. En este equipo, la
  // ejecución paralela reproduce timeouts de evidencia y cierres de contexto
  // en hydration; un worker mantiene el aislamiento y la repetibilidad sin
  // ocultar assertions ni alterar retries/timeouts.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  // webkit bajo carga paralela es notablemente más lento que chromium;
  // las aserciones que pasan devuelven de inmediato, así que el margen
  // extra no encarece la suite verde.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    // Cada prueba obtiene un contexto nuevo. El worker solo se habilita en las
    // specs que verifican PWA/hydration para evitar registros y cierres de
    // contexto ajenos al contrato del resto de la suite.
    serviceWorkers: "block",
  },
  webServer: [
    {
      command: "npm run dev:e2e",
      url: "http://localhost:3100",
      timeout: 180_000,
      // No forzar NODE_ENV=production (p. ej. heredado del shell tras un build).
      // next dev fija development; AUTH_MODE=disabled solo es válido ahí/test.
      env: (() => {
        const { NODE_ENV: _nodeEnv, ...rest } = process.env;
        return { ...rest, AUTH_MODE: "disabled", DATA_MODE: "local" };
      })(),
      reuseExistingServer: false,
    },
    {
      command: "npm run dev:e2e:hydration",
      url: "http://localhost:3000",
      timeout: 180_000,
      env: (() => {
        const { NODE_ENV: _nodeEnv, ...rest } = process.env;
        return { ...rest, AUTH_MODE: "disabled", DATA_MODE: "local" };
      })(),
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: ["**/desktop.spec.ts", "**/catalog-supabase.spec.ts", "**/staff-orders-supabase.spec.ts"],
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
      testIgnore: [
        "**/screenshots.spec.ts",
        "**/a11y.spec.ts",
        "**/desktop.spec.ts",
        "**/catalog-supabase.spec.ts",
        "**/staff-orders-supabase.spec.ts",
      ],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
      testMatch: ["**/desktop.spec.ts"],
    },
  ],
});
