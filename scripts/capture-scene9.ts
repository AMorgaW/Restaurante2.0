/**
 * Evidencia visual de la escena 9: navegación inferior flotante.
 * Uso: npx tsx scripts/capture-scene9.ts (requiere producción en :3100).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3100";
const OUT = path.join("artifacts", "visual-comparison", "work");
const VIDEO_DIR = path.join(OUT, "scene9-video");
const SIMPLE_DISH = "Carne asada plato con cebolleta";
const IGNORED = [/favicon/i, /third-party cookie/i];
const errors: string[] = [];

async function contextFor(
  width: number,
  height: number,
  reduced = false,
): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width, height },
    reducedMotion: reduced ? "reduce" : "no-preference",
    recordVideo: { dir: VIDEO_DIR, size: { width, height } },
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("rb-onboarding", JSON.stringify({ state: { seen: true }, version: 1 }));
    window.localStorage.setItem("rb-cookie-consent", "accepted");
    window.localStorage.setItem("rb-pwa-dismissed", String(Date.now()));
  });
  return { browser, context };
}

function watch(page: Page, label: string): void {
  page.on("pageerror", (error) => errors.push(`[${label}] pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
      errors.push(`[${label}] console.error: ${message.text()}`);
    }
  });
}

async function screenshot(
  name: string,
  route: string,
  width: number,
  height: number,
  expectNav = true,
): Promise<void> {
  const { browser, context } = await contextFor(width, height);
  const page = await context.newPage();
  watch(page, name);
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  if (route === "/favoritos") await page.getByText("Aún no tienes favoritos").waitFor();
  if (route.startsWith("/plato/")) {
    await page.getByRole("heading", { level: 1, name: SIMPLE_DISH }).waitFor();
  }
  if (expectNav) await page.getByRole("navigation", { name: "Navegación principal" }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  await context.close();
  await browser.close();
}

async function cartScreenshot(): Promise<void> {
  const { browser, context } = await contextFor(390, 844);
  const page = await context.newPage();
  watch(page, "scene9-nav-cart-count-390");
  await page.goto("/menu");
  await page.getByRole("button", { name: `Añadir ${SIMPLE_DISH} al carrito` }).click();
  await page.goto("/carrito");
  await page.getByLabel("1 producto en el carrito").waitFor();
  await page.screenshot({ path: path.join(OUT, "scene9-nav-cart-count-390.png"), fullPage: false });
  await context.close();
  await browser.close();
}

async function recordTabs(reduced = false): Promise<void> {
  const { browser, context } = await contextFor(390, 844, reduced);
  const page = await context.newPage();
  const label = reduced ? "scene9-nav-reduced-motion-390" : "scene9-nav-tabs-390";
  watch(page, label);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const item of ["Menú", "Buscar", "Carrito", "Inicio"] as const) {
    await nav.getByRole("link", { name: item, exact: true }).click();
    await page.waitForTimeout(reduced ? 140 : 280);
  }
  const video = page.video();
  await context.close();
  if (video) fs.copyFileSync(await video.path(), path.join(OUT, `${label}.webm`));
  await browser.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  await screenshot("scene9-nav-home-320.png", "/", 320, 568);
  await screenshot("scene9-nav-home-390.png", "/", 390, 844);
  await screenshot("scene9-nav-menu-430.png", "/menu", 430, 932);
  await screenshot("scene9-nav-favorites-390.png", "/favoritos", 390, 844);
  await cartScreenshot();
  await screenshot("scene9-nav-detail-390.png", "/plato/carne-asada-plato-con-cebolleta", 390, 844, false);
  await screenshot("scene9-nav-desktop.png", "/menu", 1440, 1000, false);
  await recordTabs();
  await recordTabs(true);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
