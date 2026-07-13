/**
 * Evidencia cinética de la ESCENA 7 (transición tarjeta → detalle).
 *
 * Uso: npx tsx scripts/capture-scene7.ts
 * Requiere el servidor de producción en http://localhost:3100
 * (npm run start:e2e). Salida: artifacts/visual-comparison/work/scene7-*.
 *
 * Graba el viaje compartido (home hero, fila del menú, regreso, reduced
 * motion y WebKit) y extrae una hoja de contacto por grabación para poder
 * inspeccionar el morph fotograma a fotograma (pointerdown → 25/50/75 % →
 * héroe asentado → panel → regreso). Vigila la consola.
 */
import { chromium, webkit, type Browser, type BrowserContext, type Page } from "@playwright/test";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const OUT = path.join("artifacts/visual-comparison", "work");
const VID = path.join(OUT, "_vid7");
const SIMPLE_NAME = "Carne asada plato con cebolleta";

const IGNORED = [/favicon/i, /third-party cookie/i];
const consoleErrors: string[] = [];

async function newCtx(browser: Browser, reduced = false): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    baseURL: BASE_URL,
    reducedMotion: reduced ? "reduce" : "no-preference",
    recordVideo: { dir: VID, size: { width: 390, height: 844 } },
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

/** Cierra el contexto y renombra el vídeo; extrae hoja de contacto densa. */
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
    execFileSync(ffmpegPath, [
      "-y",
      "-i",
      dest,
      "-vf",
      "fps=20,scale=180:-1,tile=6x4",
      "-frames:v",
      "1",
      sheet,
    ]);
    console.log(`✓ ${name}-sheet.png`);
  }
}

async function recordOpen(
  browser: Browser,
  name: string,
  fromUrl: string,
  clickLabel: RegExp | string,
  reduced = false,
): Promise<void> {
  const context = await newCtx(browser, reduced);
  const page = await context.newPage();
  watch(page, name);
  await page.goto(fromUrl);
  if (fromUrl === "/") {
    await page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
  } else {
    await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  }
  await page.waitForTimeout(400);
  const link =
    fromUrl === "/"
      ? page.locator("article").first().getByRole("link", { name: clickLabel })
      : page.getByRole("link", { name: clickLabel });
  await link.click();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForTimeout(1600); // morph + asentado del panel/CTA
  await finish(context, page, name);
}

async function recordBack(browser: Browser, name: string): Promise<void> {
  const context = await newCtx(browser);
  const page = await context.newPage();
  watch(page, name);
  await page.goto("/menu");
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.getByRole("link", { name: `Ver ${SIMPLE_NAME}` }).click();
  await page.getByRole("heading", { level: 1, name: SIMPLE_NAME }).waitFor();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Volver" }).click();
  await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  await page.waitForTimeout(1000);
  await finish(context, page, name);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(VID, { recursive: true });

  const cr = await chromium.launch();
  await recordOpen(cr, "scene7-home-to-detail-390", "/", /^Ver /);
  await recordOpen(cr, "scene7-menu-to-detail-390", "/menu", `Ver ${SIMPLE_NAME}`);
  await recordBack(cr, "scene7-detail-back-390");
  await recordOpen(cr, "scene7-reduced-motion-390", "/menu", `Ver ${SIMPLE_NAME}`, true);
  await cr.close();

  const wk = await webkit.launch();
  await recordOpen(wk, "scene7-webkit-390", "/menu", `Ver ${SIMPLE_NAME}`);
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
