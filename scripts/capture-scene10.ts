/**
 * Evidencia visual de la escena 10: prompt de instalación PWA.
 * Uso: npx tsx scripts/capture-scene10.ts (requiere producción en :3100).
 */
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const BASE_URL = "http://localhost:3100";
const OUT = path.join("artifacts", "visual-comparison", "work");
const VIDEO_DIR = path.join(OUT, "scene10-video");
const PROMPT_NAME = /pide más rápido desde tu inicio/i;
const IGNORED = [/favicon/i, /third-party cookie/i];
const errors: string[] = [];

async function makeContext(width: number, height: number, reduced = false, standalone = false) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width, height },
    reducedMotion: reduced ? "reduce" : "no-preference",
    recordVideo: { dir: VIDEO_DIR, size: { width, height } },
  });
  await context.addInitScript({ content: `
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, timeout, ...args) =>
      nativeSetTimeout(callback, Math.min(Number(timeout) || 0, 10), ...args);
    window.localStorage.setItem("rb-onboarding", JSON.stringify({ state: { seen: true }, version: 1 }));
    window.localStorage.setItem("rb-cookie-consent", "accepted");
    ${standalone ? `
      window.matchMedia = (query) => ({
        matches: query.includes("standalone"), media: query, onchange: null,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      });
    ` : ""}
  ` });
  return { browser, context };
}

function watch(page: Page, label: string) {
  page.on("pageerror", (error) => errors.push(`[${label}] pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
      errors.push(`[${label}] console.error: ${message.text()}`);
    }
  });
}

async function dispatchInstallEvent(page: Page) {
  await page.evaluate(`
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  `);
}

async function openEligible(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await dispatchInstallEvent(page);
  await page.getByRole("region", { name: PROMPT_NAME }).waitFor();
}

async function screenshot(name: string, route: string, width: number, height: number, standalone = false) {
  const { browser, context } = await makeContext(width, height, false, standalone);
  const page = await context.newPage();
  watch(page, name);
  if (standalone) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await dispatchInstallEvent(page);
    await page.waitForTimeout(80);
  } else {
    await openEligible(page, route);
  }
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  await context.close();
  await browser.close();
}

async function hiddenScreenshot(name: string, route: string) {
  const { browser, context } = await makeContext(390, 844);
  const page = await context.newPage();
  watch(page, name);
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await dispatchInstallEvent(page);
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  await context.close();
  await browser.close();
}

function makeContactSheet(video: string, sheet: string) {
  if (!ffmpegPath) throw new Error("ffmpeg-static no está disponible");
  execFileSync(ffmpegPath, [
    "-y",
    "-i",
    path.join(OUT, video),
    "-vf",
    "fps=2/1,scale=195:-1,tile=3x2",
    "-frames:v",
    "1",
    path.join(OUT, sheet),
  ], { stdio: "ignore" });
}

async function record(name: string, reduced = false) {
  const { browser, context } = await makeContext(390, 844, reduced);
  const page = await context.newPage();
  watch(page, name);
  await openEligible(page, "/");
  await page.waitForTimeout(reduced ? 120 : 280);
  await page.getByRole("button", { name: "Ahora no" }).click();
  await page.waitForTimeout(reduced ? 120 : 280);
  const video = page.video();
  await context.close();
  if (video) fs.copyFileSync(await video.path(), path.join(OUT, `${name}.webm`));
  await browser.close();
  makeContactSheet(`${name}.webm`, `${name}-contact-sheet.png`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  await screenshot("scene10-pwa-home-320.png", "/", 320, 568);
  await screenshot("scene10-pwa-home-390.png", "/", 390, 844);
  await screenshot("scene10-pwa-menu-430.png", "/menu", 430, 932);
  await screenshot("scene10-pwa-above-nav-390.png", "/", 390, 844);
  await hiddenScreenshot("scene10-pwa-cart-hidden-390.png", "/carrito");
  await hiddenScreenshot("scene10-pwa-detail-hidden-390.png", "/plato/carne-asada-plato-con-cebolleta");
  await screenshot("scene10-pwa-standalone-hidden-390.png", "/", 390, 844, true);
  await screenshot("scene10-pwa-desktop.png", "/menu", 1440, 1000);
  await record("scene10-pwa-entry-390");
  await record("scene10-pwa-dismiss-390");
  await record("scene10-pwa-reduced-motion-390", true);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
