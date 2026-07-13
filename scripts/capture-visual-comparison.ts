/**
 * Capturas de comparación visual (viewport real, build de producción).
 *
 * Uso: npx tsx scripts/capture-visual-comparison.ts <before|after>
 * Requiere el servidor en http://localhost:3100 (npm run start:e2e).
 * Salida: artifacts/visual-comparison/<fase>/screens/*.png
 *
 * A diferencia de tests/e2e/screenshots.spec.ts (página completa, para
 * revisión de contenido), aquí se captura el VIEWPORT: lo que un usuario
 * ve realmente en cada tamaño, que es lo comparable con el video.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const PHASE = process.argv[2] ?? "before";
const OUT = path.join("artifacts/visual-comparison", PHASE, "screens");

const SIZES = [
  { w: 320, h: 568 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
  { w: 1440, h: 1000 },
] as const;

const SIMPLE_DISH = "carne-asada-plato-con-cebolleta";

/** Evita superficies no deterministas (cookies/PWA) en las capturas. */
async function quietStorage(page: Page, seenOnboarding: boolean): Promise<void> {
  await page.addInitScript(
    ([seen]) => {
      window.localStorage.setItem("rb-cookie-consent", "accepted");
      window.localStorage.setItem("rb-pwa-dismissed", String(Date.now()));
      if (seen) {
        window.localStorage.setItem(
          "rb-onboarding",
          JSON.stringify({ state: { seen: true }, version: 1 }),
        );
      }
    },
    [seenOnboarding],
  );
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`✓ ${name}`);
}

async function captureAtSize(browser: Browser, w: number, h: number): Promise<void> {
  const tag = `${w}x${h}`;
  const context = await browser.newContext({ viewport: { width: w, height: h }, baseURL: BASE_URL });
  const page = await context.newPage();

  // Onboarding (primera visita)
  await quietStorage(page, false);
  await page.goto("/");
  await page.getByRole("dialog", { name: /bienvenida/i }).waitFor();
  await page.waitForTimeout(2400); // entrada completa asentada
  await shot(page, `onboarding-${tag}`);
  await context.close();

  // Resto: visita normal
  const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, baseURL: BASE_URL });
  const page2 = await ctx2.newPage();
  await quietStorage(page2, true);

  await page2.goto("/");
  await page2.waitForLoadState("networkidle");
  await page2.waitForTimeout(600);
  await shot(page2, `home-${tag}`);

  await page2.goto("/menu");
  await page2.waitForLoadState("networkidle");
  await page2.waitForTimeout(600);
  await shot(page2, `menu-${tag}`);

  await page2.goto(`/plato/${SIMPLE_DISH}`);
  await page2.waitForLoadState("networkidle");
  await page2.waitForTimeout(1200); // panel + stagger asentados
  await shot(page2, `detalle-${tag}`);

  await ctx2.close();
}

async function captureStates(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: BASE_URL });
  const page = await context.newPage();
  await quietStorage(page, true);

  // Splash (instante medio del bloom): primera visita real.
  const ctxSplash = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: BASE_URL });
  const pageSplash = await ctxSplash.newPage();
  await quietStorage(pageSplash, false);
  await pageSplash.goto("/");
  await pageSplash.getByRole("dialog", { name: /bienvenida/i }).waitFor();
  await pageSplash.waitForTimeout(1600);
  await pageSplash.getByRole("button", { name: "Explorar menú" }).click();
  await pageSplash.waitForTimeout(950); // salida (350) + pausa (450) + bloom en curso
  await shot(pageSplash, "splash-mid-390x844");
  await ctxSplash.close();

  // Menú: scroll medio, cambio de categoría y regreso con estado.
  await page.goto("/menu");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await page.waitForTimeout(700);
  await shot(page, "menu-scrolled-390x844");

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Carnes", exact: true }).click();
  await page.waitForTimeout(600);
  await shot(page, "menu-categoria-carnes-390x844");

  // Tarjeta → detalle → volver (conservación de scroll/categoría).
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
  await page.waitForTimeout(300);
  const anyCard = page.locator("article").filter({ hasText: "$" }).last();
  await anyCard.scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "Ver Carne asada plato con cebolleta" }).click();
  await page.getByRole("heading", { name: "Carne asada plato con cebolleta" }).waitFor();
  await page.waitForTimeout(1400);
  await page.goBack();
  await page.waitForTimeout(900);
  await shot(page, "menu-regreso-390x844");

  // Elementos sueltos (tarjetas y navegación) para comparaciones de cerca.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const featured = page.locator("article").first();
  await featured.screenshot({ path: path.join(OUT, "tarjeta-destacada-390.png") });
  console.log("✓ tarjeta-destacada-390");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.screenshot({ path: path.join(OUT, "bottom-nav-390.png") });
  console.log("✓ bottom-nav-390");

  await page.goto("/menu");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const gridCard = page.locator("article").last();
  await gridCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await gridCard.screenshot({ path: path.join(OUT, "tarjeta-secundaria-390.png") });
  console.log("✓ tarjeta-secundaria-390");

  await context.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const { w, h } of SIZES) {
    await captureAtSize(browser, w, h);
  }
  await captureStates(browser);
  await browser.close();
  console.log("Capturas completas en", OUT);
}

main().catch((error) => {
  console.error("✖ Error capturando:", error);
  process.exit(1);
});
