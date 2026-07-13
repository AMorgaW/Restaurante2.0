/**
 * Evidencia visual de la ESCENA 6 (detalle inmersivo) del rediseño.
 *
 * Uso: npx tsx scripts/capture-scene6.ts
 * Requiere el servidor de producción en http://localhost:3100
 * (npm run start:e2e). Salida: artifacts/visual-comparison/work/scene6-*.
 *
 * Captura el viewport real del detalle en los cuatro tamaños, los estados
 * de nombre largo / modificadores / agotado, la zona inferior con CTA y una
 * grabación corta de la entrada en motion normal (+ hoja de contacto ffmpeg).
 * Vigila la consola y sale con código 1 si hay errores.
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const OUT = path.join("artifacts/visual-comparison", "work");

const SIMPLE = "carne-asada-plato-con-cebolleta";
const MODIFIER = "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de";

const IGNORED = [/favicon/i, /third-party cookie/i];
const consoleErrors: string[] = [];

function watchConsole(page: Page, label: string): void {
  page.on("pageerror", (error) => consoleErrors.push(`[${label}] pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
      consoleErrors.push(`[${label}] console.error: ${message.text()}`);
    }
  });
}

/** localStorage limpio (onboarding visto, sin cookie/PWA) + override opcional. */
function initStorage(page: Page, adminOverrides?: Record<string, unknown>) {
  return page.addInitScript(
    ([overrides]) => {
      window.localStorage.setItem("rb-cookie-consent", "accepted");
      window.localStorage.setItem("rb-pwa-dismissed", String(Date.now()));
      window.localStorage.setItem(
        "rb-onboarding",
        JSON.stringify({ state: { seen: true }, version: 1 }),
      );
      if (overrides) {
        window.localStorage.setItem(
          "rb-admin",
          JSON.stringify({ state: { demoRole: null, overrides }, version: 1 }),
        );
      }
    },
    [adminOverrides ?? null],
  );
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`✓ ${name}`);
}

async function openDetail(page: Page, slug: string): Promise<void> {
  await page.goto(`/plato/${slug}`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  // Entrada asentada (chips + panel): espera el estado final, no un fotograma.
  await page.waitForTimeout(1400);
}

async function captureSize(
  browser: Browser,
  slug: string,
  w: number,
  h: number,
  name: string,
): Promise<void> {
  const context = await browser.newContext({ viewport: { width: w, height: h }, baseURL: BASE_URL });
  const page = await context.newPage();
  watchConsole(page, name);
  await initStorage(page);
  await openDetail(page, slug);
  await shot(page, name);
  await context.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Producto normal en los cuatro tamaños.
  await captureSize(browser, SIMPLE, 320, 568, "scene6-detail-320");
  await captureSize(browser, SIMPLE, 390, 844, "scene6-detail-390");
  await captureSize(browser, SIMPLE, 430, 932, "scene6-detail-430");
  await captureSize(browser, SIMPLE, 1440, 1000, "scene6-detail-desktop");

  // Nombre largo (320) y modificadores (390) — mismo plato (el largo tiene
  // término obligatorio + extras).
  await captureSize(browser, MODIFIER, 320, 568, "scene6-detail-long-name-320");
  await captureSize(browser, MODIFIER, 390, 844, "scene6-detail-modifiers-390");

  // Agotado (390) vía override admin demo.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      baseURL: BASE_URL,
    });
    const page = await context.newPage();
    watchConsole(page, "sold-out");
    await initStorage(page, { [SIMPLE]: { available: false } });
    await openDetail(page, SIMPLE);
    await shot(page, "scene6-detail-sold-out-390");
    await context.close();
  }

  // Zona inferior: CTA + relacionados + safe area (scroll al fondo).
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      baseURL: BASE_URL,
    });
    const page = await context.newPage();
    watchConsole(page, "cta");
    await initStorage(page);
    await openDetail(page, MODIFIER);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(500);
    await shot(page, "scene6-detail-cta-390");
    await context.close();
  }

  // Grabación corta de la entrada (motion normal) + hoja de contacto.
  const videoDir = path.join(OUT, "_vid");
  fs.mkdirSync(videoDir, { recursive: true });
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      baseURL: BASE_URL,
      recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    watchConsole(page, "entrance");
    await initStorage(page);
    await page.goto(`/plato/${MODIFIER}`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.waitForTimeout(2200); // deja correr panel + chips + CTA
    await context.close();
    const raw = await page.video()?.path();
    if (raw) {
      const dest = path.join(OUT, "scene6-detail-entrance-390.webm");
      fs.copyFileSync(raw, dest);
      console.log("✓ scene6-detail-entrance-390.webm");
      if (ffmpegPath) {
        const sheet = path.join(OUT, "scene6-detail-entrance-sheet.png");
        execFileSync(ffmpegPath, [
          "-y",
          "-i",
          dest,
          "-vf",
          "fps=8,scale=200:-1,tile=4x3",
          "-frames:v",
          "1",
          sheet,
        ]);
        console.log("✓ scene6-detail-entrance-sheet.png");
      }
    }
  }
  fs.rmSync(videoDir, { recursive: true, force: true });

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
