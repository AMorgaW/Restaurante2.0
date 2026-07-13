import { defineConfig, devices } from "@playwright/test";

/**
 * Las pruebas E2E corren contra el build de producción (`next start -p 3100`).
 * `npm run test:e2e` construye primero y luego ejecuta Playwright.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Tres motores + servidor Next en un mismo host: la suite completa se
  // ejecuta POR MOTOR de forma secuencial (ver script test:e2e); dentro de
  // cada motor, 3 workers es el equilibrio estable medido en este equipo
  // (webkit concurrente consigo mismo o con chromium produce timeouts
  // espurios que desaparecen con los motores aislados).
  workers: 3,
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
  },
  webServer: {
    command: "npm run start:e2e",
    url: "http://localhost:3100",
    timeout: 180_000,
    // NUNCA reutilizar un servidor previo: un `next start` huérfano puede
    // servir un build desfasado tras reconstruir (.next regenerado bajo el
    // proceso) → chunks 404, hidración rota y fallos rotatorios espurios.
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: ["**/desktop.spec.ts"],
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
      testIgnore: ["**/screenshots.spec.ts", "**/a11y.spec.ts", "**/desktop.spec.ts"],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
      testMatch: ["**/desktop.spec.ts"],
    },
  ],
});
