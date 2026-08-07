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
      command: "npm run start:e2e",
      url: "http://localhost:3100",
      timeout: 180_000,
      // next start usa NODE_ENV=production: Auth ausente fallaría cerrado.
      // Las E2E locales demuestran el modo demo con AUTH_MODE=disabled explícito.
      env: {
        ...process.env,
        AUTH_MODE: process.env.AUTH_MODE ?? "disabled",
        DATA_MODE: process.env.DATA_MODE ?? "local",
      },
    // NUNCA reutilizar un servidor previo: un `next start` huérfano puede
    // servir un build desfasado tras reconstruir (.next regenerado bajo el
    // proceso) → chunks 404, hidración rota y fallos rotatorios espurios.
      reuseExistingServer: false,
    },
    {
      command: "npm run start:e2e:hydration",
      url: "http://localhost:3000",
      timeout: 180_000,
      env: {
        ...process.env,
        AUTH_MODE: process.env.AUTH_MODE ?? "disabled",
        DATA_MODE: process.env.DATA_MODE ?? "local",
      },
      reuseExistingServer: false,
    },
  ],
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
