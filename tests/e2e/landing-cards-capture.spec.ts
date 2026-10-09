import { expect, test } from "@playwright/test";
import { LONG_DISH_NAME } from "./helpers";

const DIR = "artifacts/visual-comparison/work/landing-card-fix";

const LANDING_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "1440x1000", width: 1440, height: 1000 },
] as const;

test("evidencia: portada estática en todos los tamaños", async ({ page }) => {
  for (const viewport of LANDING_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const landing = page.getByTestId("landing-page");
    const cta = landing.getByRole("link", { name: "Comenzar" });
    await expect(landing.getByRole("img", { name: /pescado frito/i })).toBeVisible();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box?.y ?? Infinity).toBeLessThan(viewport.height);
    await page.screenshot({ path: `${DIR}/portada-${viewport.name}.png`, fullPage: false });
  }
});

test("evidencia: tarjetas azul rey y nombre largo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu");
  await expect(page.getByTestId("menu-card-panel").first()).toBeVisible();
  await page.screenshot({ path: `${DIR}/menu-card-390x844.png`, fullPage: false });

  await page.getByRole("searchbox").fill("ternera");
  const longName = page.getByRole("heading", { name: LONG_DISH_NAME });
  await expect(longName).toBeVisible();
  await longName.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${DIR}/menu-card-long-name-390x844.png`, fullPage: false });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/menu");
  await expect(page.getByTestId("menu-card-panel").first()).toBeVisible();
  await page.screenshot({ path: `${DIR}/menu-card-desktop-1440x1000.png`, fullPage: false });
});
