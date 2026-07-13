/**
 * Evidencia cinética de la ESCENA 8 (regreso y conservación de estado).
 *
 * Uso: npx tsx scripts/capture-scene8.ts
 * Requiere el servidor de producción en http://localhost:3100
 * (npm run start:e2e). Salida: artifacts/visual-comparison/work/scene8-*.
 *
 * Graba el viaje ABRIR → VOLVER desde varias superficies y extrae una hoja
 * de contacto por grabación para inspeccionar fotograma a fotograma el
 * regreso: último estado antes de abrir, navegación, primer frame del
 * listado restaurado, filtros/scroll conservados, sin re-animación ni
 * skeletons, sin salto ni flash. Vigila la consola.
 */
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "@playwright/test";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const OUT = path.join("artifacts/visual-comparison", "work");
const VID = path.join(OUT, "_vid8");
const SIMPLE_NAME = "Carne asada plato con cebolleta";
const SIMPLE_SLUG = "carne-asada-plato-con-cebolleta";

const IGNORED = [/favicon/i, /third-party cookie/i];
const consoleErrors: string[] = [];

async function newCtx(
  browser: Browser,
  reduced = false,
  width = 390,
  height = 844,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height },
    baseURL: BASE_URL,
    reducedMotion: reduced ? "reduce" : "no-preference",
    recordVideo: { dir: VID, size: { width, height } },
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("rb-cookie-consent", "accepted");
    window.localStorage.setItem("rb-pwa-dismissed", String(Date.now()));
    window.localStorage.setItem(
      "rb-onboarding",
      JSON.stringify({ state: { seen: true }, version: 1 }),
    );
  });
  return context;
}

function watch(page: Page, label: string): void {
  page.on("pageerror", (error) => consoleErrors.push(`[${label}] pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
      consoleErrors.push(`[${label}] console.error: ${message.text()}`);
    }
  });
}

async function finish(context: BrowserContext, page: Page, name: string): Promise<void> {
  const video = page.video();
  await context.close();
  if (!video) return;
  const raw = await video.path();
  const dest = path.join(OUT, `${name}.webm`);
  fs.copyFileSync(raw, dest);
  console.log(`✓ ${name}.webm`);
  if (ffmpegPath) {
    const sheet = path.join(OUT, `${name}-sheet.png`);
    // fps bajo para que las 24 casillas (6x4) cubran TODO el viaje
    // (abrir → detalle → volver → restaurado), no solo el primer segundo.
    execFileSync(ffmpegPath, [
      "-y",
      "-i",
      dest,
      "-vf",
      "fps=3,scale=200:-1,tile=6x4",
      "-frames:v",
      "1",
      sheet,
    ]);
    console.log(`✓ ${name}-sheet.png`);
  }
}

/** /menu con categoría + búsqueda → detalle → volver (atrás del navegador). */
async function menuStateBack(browser: Browser, name: string): Promise<void> {
  const context = await newCtx(browser);
  const page = await context.newPage();
  watch(page, name);
  await page.goto("/menu");
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.getByRole("button", { name: "Carnes", exact: true }).click();
  await page.getByRole("searchbox").first().fill("carne");
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: `Ver ${SIMPLE_NAME}` }).click();
  await page.getByRole("heading", { level: 1, name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(900);
  await page.goBack();
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.waitForTimeout(1100);
  await finish(context, page, name);
}

/** /menu con scroll profundo → detalle → volver (scroll restaurado). */
async function menuScrollBack(browser: Browser, name: string): Promise<void> {
  const context = await newCtx(browser);
  const page = await context.newPage();
  watch(page, name);
  await page.goto("/menu");
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: `Ver ${SIMPLE_NAME}` }).click();
  await page.getByRole("heading", { level: 1, name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(900);
  await page.goBack();
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.waitForTimeout(1100);
  await finish(context, page, name);
}

/** Home → detalle → volver (home intacto, sin re-coreografía). */
async function homeBack(browser: Browser, name: string): Promise<void> {
  const context = await newCtx(browser);
  const page = await context.newPage();
  watch(page, name);
  await page.goto("/");
  await page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
  await page.waitForTimeout(500);
  await page
    .locator('section[aria-label="Plato de la casa"]')
    .getByRole("link", { name: /^Ver / })
    .first()
    .click();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForTimeout(900);
  await page.goBack();
  await page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
  await page.waitForTimeout(1100);
  await finish(context, page, name);
}

/** Favoritos → detalle → volver (regreso a /favoritos). */
async function favoritesBack(browser: Browser, name: string): Promise<void> {
  const context = await newCtx(browser);
  await context.addInitScript((slug) => {
    window.localStorage.setItem(
      "rb-favorites",
      JSON.stringify({ state: { slugs: [slug] }, version: 1 }),
    );
  }, SIMPLE_SLUG);
  const page = await context.newPage();
  watch(page, name);
  await page.goto("/favoritos");
  await page.getByRole("heading", { name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: `Ver ${SIMPLE_NAME}` }).click();
  await page.getByRole("heading", { level: 1, name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(900);
  await page.goBack();
  await page.getByRole("heading", { name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(1000);
  await finish(context, page, name);
}

/** Reduced motion: estado conservado, contenido siempre visible. */
async function reducedMotionBack(browser: Browser, name: string): Promise<void> {
  const context = await newCtx(browser, true);
  const page = await context.newPage();
  watch(page, name);
  await page.goto("/menu");
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.getByRole("button", { name: "Carnes", exact: true }).click();
  await page.getByRole("searchbox").first().fill("carne");
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: `Ver ${SIMPLE_NAME}` }).click();
  await page.getByRole("heading", { level: 1, name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(700);
  await page.goBack();
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.waitForTimeout(900);
  await finish(context, page, name);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(VID, { recursive: true });

  const cr = await chromium.launch();
  await menuStateBack(cr, "scene8-menu-state-back-390");
  await menuScrollBack(cr, "scene8-menu-scroll-back-390");
  await homeBack(cr, "scene8-home-back-390");
  await favoritesBack(cr, "scene8-favorites-back-390");
  await reducedMotionBack(cr, "scene8-reduced-motion-390");
  await cr.close();

  const wk = await webkit.launch();
  await menuStateBack(wk, "scene8-menu-state-back-webkit-390");
  await wk.close();

  fs.rmSync(VID, { recursive: true, force: true });

  if (consoleErrors.length > 0) {
    console.error("✖ Errores de consola detectados:\n" + consoleErrors.join("\n"));
    process.exit(1);
  }
  console.log("Consola limpia. Grabaciones y hojas de contacto en", OUT);
}

main().catch((error) => {
  console.error("✖ Error grabando:", error);
  process.exit(1);
});
