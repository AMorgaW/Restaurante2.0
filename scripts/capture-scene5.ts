/**
 * Evidencia visual de la ESCENA 5 (tarjetas + menú) del rediseño.
 *
 * Uso: npx tsx scripts/capture-scene5.ts
 * Requiere el servidor de producción en http://localhost:3100
 * (npm run start:e2e). Salida: artifacts/visual-comparison/work/scene5-*.png
 *
 * Captura el VIEWPORT real (lo que ve el usuario) del catálogo /menu en los
 * cuatro tamaños objetivo, el estado de búsqueda con nombre largo y primeros
 * planos del bloque destacado y de una fila del grid. Vigila la consola: si
 * aparece cualquier error ajeno al ruido conocido, termina con código 1.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const OUT = path.join("artifacts/visual-comparison", "work");

const SIZES = [
  { w: 320, h: 568 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 1440, h: 1000 },
] as const;

const IGNORED = [/favicon/i, /third-party cookie/i];
const consoleErrors: string[] = [];

/** Silencia superficies no deterministas (onboarding/cookies/PWA). */
async function quietStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("rb-cookie-consent", "accepted");
    window.localStorage.setItem("rb-pwa-dismissed", String(Date.now()));
    window.localStorage.setItem(
      "rb-onboarding",
      JSON.stringify({ state: { seen: true }, version: 1 }),
    );
  });
}

function watchConsole(page: Page, label: string): void {
  page.on("pageerror", (error) => consoleErrors.push(`[${label}] pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
      consoleErrors.push(`[${label}] console.error: ${message.text()}`);
    }
  });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`✓ ${name}`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser: Browser = await chromium.launch();

  // Catálogo /menu en los cuatro tamaños objetivo (viewport real).
  for (const { w, h } of SIZES) {
    const tag = `${w}x${h}`;
    const context = await browser.newContext({ viewport: { width: w, height: h }, baseURL: BASE_URL });
    const page = await context.newPage();
    watchConsole(page, `menu-${tag}`);
    await quietStorage(page);
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await page.getByRole("heading", { name: "Menú", exact: true }).first().waitFor();
    await page.waitForTimeout(700); // materialización asentada
    await shot(page, `scene5-menu-${tag}`);
    await context.close();
  }

  // Estado de nombre largo: buscar el plato largo lo baja a la lista como
  // MenuDishRow (nombre completo, dos líneas, sin desbordar) en 320 px.
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, baseURL: BASE_URL });
    const page = await context.newPage();
    watchConsole(page, "menu-largo-320");
    await quietStorage(page);
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await page.getByRole("searchbox").first().fill("ternera");
    await page.getByRole("heading", {
      name: "Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima",
    }).waitFor();
    await page.waitForTimeout(500);
    await shot(page, "scene5-menu-nombre-largo-320");
    await context.close();
  }

  // Primeros planos (390): bloque destacado editorial y una fila del grid.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: BASE_URL });
    const page = await context.newPage();
    watchConsole(page, "menu-detalle-390");
    await quietStorage(page);
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    await page.locator("article").first().screenshot({ path: path.join(OUT, "scene5-bloque-destacado-390.png") });
    console.log("✓ scene5-bloque-destacado-390");
    const row = page.locator("article").nth(2);
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await row.screenshot({ path: path.join(OUT, "scene5-fila-grid-390.png") });
    console.log("✓ scene5-fila-grid-390");

    // Favoritos: la lista editorial reutilizada. Marca dos y navega.
    await page.locator("article").nth(1).getByRole("button", { name: /a favoritos$/ }).click();
    await page.locator("article").nth(2).getByRole("button", { name: /a favoritos$/ }).click();
    await page.goto("/favoritos");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    await shot(page, "scene5-favoritos-390");
    await context.close();
  }

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error("✖ Errores de consola detectados:\n" + consoleErrors.join("\n"));
    process.exit(1);
  }
  console.log("Consola limpia. Capturas completas en", OUT);
}

main().catch((error) => {
  console.error("✖ Error capturando:", error);
  process.exit(1);
});
