/**
 * Graba los flujos de movimiento de la aplicación (producción, next start)
 * para compararlos frame a frame con el video de referencia.
 *
 * Uso: npx tsx scripts/record-motion.ts [outDir]
 * Requiere el servidor en http://localhost:3100 (npm run start:e2e).
 * Salida: videos .webm en references/analysis/reports/<outDir>/.
 */
import { chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const OUT_DIR = path.join(
  "references/analysis/reports",
  process.argv[2] ?? "app-recordings",
);

const VIEWPORT = { width: 390, height: 844 };

async function withRecording(
  browserContextFactory: () => Promise<BrowserContext>,
  name: string,
  flow: (context: BrowserContext) => Promise<void>,
): Promise<void> {
  const context = await browserContextFactory();
  try {
    await flow(context);
  } finally {
    // Cerrar el contexto vuelca el video a disco.
    const pages = context.pages();
    const video = pages[0]?.video();
    await context.close();
    if (video) {
      const target = path.join(OUT_DIR, `${name}.webm`);
      await video.saveAs(target);
      console.log(`✓ ${name} → ${target}`);
    }
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch();

  const makeContext = () =>
    browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      recordVideo: { dir: OUT_DIR, size: VIEWPORT },
      baseURL: BASE_URL,
    });

  // Flujo 1: onboarding completo → splash → home (primera visita).
  await withRecording(makeContext, "flow1-onboarding-splash-home", async (context) => {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("dialog", { name: /bienvenida/i }).waitFor();
    await page.waitForTimeout(2600); // entrada completa del onboarding
    await page.getByRole("button", { name: "Explorar menú" }).click();
    await page.waitForTimeout(2600); // salida + splash + entrada del home
    await page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
    await page.waitForTimeout(1800);
  });

  // Flujo 2: home → categoría → scroll → regreso arriba.
  await withRecording(makeContext, "flow2-home-category-scroll", async (context) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-onboarding",
        JSON.stringify({ state: { seen: true }, version: 1 }),
      );
    });
    await page.goto("/");
    await page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Todas", exact: true }).click();
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo({ top: 1400, behavior: "smooth" }));
    await page.waitForTimeout(1300);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(1200);
  });

  // Flujo 3: tarjeta → detalle (morph) → regreso.
  await withRecording(makeContext, "flow3-card-detail-back", async (context) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-onboarding",
        JSON.stringify({ state: { seen: true }, version: 1 }),
      );
    });
    await page.goto("/menu");
    await page.getByRole("heading", { name: "Menú", exact: true }).waitFor();
    await page.waitForTimeout(1100);
    await page
      .getByRole("link", { name: "Ver Carne asada plato con cebolleta" })
      .click();
    await page.getByRole("heading", { name: "Carne asada plato con cebolleta" }).waitFor();
    await page.waitForTimeout(2200); // construcción del detalle
    await page.goBack();
    await page.waitForTimeout(1500);
  });

  // Flujo 4: favorito + añadir al carrito (microinteracciones).
  await withRecording(makeContext, "flow4-favorite-add", async (context) => {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-onboarding",
        JSON.stringify({ state: { seen: true }, version: 1 }),
      );
    });
    await page.goto("/menu");
    await page.getByRole("heading", { name: "Menú", exact: true }).waitFor();
    await page.waitForTimeout(800);
    await page
      .getByRole("button", { name: "Añadir Carne asada plato con cebolleta a favoritos" })
      .click();
    await page.waitForTimeout(800);
    await page
      .getByRole("button", { name: "Añadir Carne asada plato con cebolleta al carrito" })
      .click();
    await page.waitForTimeout(1600); // toast visible
  });

  await browser.close();
  console.log("Grabaciones completas en", OUT_DIR);
}

main().catch((error) => {
  console.error("✖ Error grabando la aplicación:", error);
  process.exit(1);
});
