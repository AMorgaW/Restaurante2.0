import { expect, test, type Page } from "@playwright/test";
import { SIMPLE_DISH_SLUG } from "./helpers";

const output = "artifacts/visual-comparison/work/service-menu-redesign/after";
const at = (time: string) => new Date(`2026-07-21T${time}-05:00`);

test.use({ serviceWorkers: "block" });

async function waitForPainted(page: Page, selectors: string[]) {
  await page.waitForFunction((required) => {
    const painted = (element: Element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };
    const geometryReady = required.every((selector) => {
      const element = document.querySelector(selector);
      return element ? painted(element) : false;
    });
    return geometryReady;
  }, selectors);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        /* Algunas animaciones CSS ya terminadas no admiten finish(). */
      }
    }
  });
  await page.waitForFunction(() =>
    [...document.images].filter((image) => image.getBoundingClientRect().width > 0).every((image) => image.complete && image.naturalWidth > 0),
  );
}

test("captura la escena completa en estados y viewports requeridos", async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name !== "mobile-chromium", "Evidencia única en Chromium.");

  for (const viewport of [
    { name: "390x844", width: 390, height: 844 },
    { name: "1440x1000", width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByTestId("landing-title")).toBeVisible();
    await waitForPainted(page, ["[data-testid='landing-title']", "[data-testid='landing-cta']", "[data-testid='landing-tagline']"]);
    await page.screenshot({ path: `${output}/portada-${viewport.name}.png` });
  }

  // La portada es estática; abre una página limpia antes de las rutas SSR
  // para que el reloj inyectado no herede el documento anterior.
  const context = page.context();
  await page.close();
  page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const state of [
    { name: "almuerzo", time: "12:00:00", period: "lunch" },
    { name: "cena", time: "18:00:00", period: "dinner" },
    { name: "cerrado", time: "23:00:00", period: "closed" },
  ]) {
    await page.clock.setFixedTime(at(state.time));
    await page.goto("/menu");
    await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", state.period);
    await waitForPainted(page, ["[data-testid='service-status']", "[data-testid='menu-dish-row']"]);
    await page.screenshot({ path: `${output}/menu-${state.name}-390x844.png` });
  }

  await page.clock.setFixedTime(at("12:00:00"));
  await page.goto("/menu");
  const firstCard = page.getByTestId("menu-dish-row").first();
  await expect(firstCard).toBeVisible();
  await waitForPainted(page, ["[data-testid='menu-dish-row']"]);
  await firstCard.screenshot({ path: `${output}/tarjeta-vidrio-estatica.png` });
  await page.addStyleTag({ content: ".menu-card-panel::after{animation:none!important;opacity:.48!important;transform:translateX(215%) skewX(-18deg)!important}" });
  await firstCard.screenshot({ path: `${output}/tarjeta-reflejo.png` });

  await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
  await expect(page.getByTestId("included-soup-selector")).toBeVisible();
  await waitForPainted(page, ["[data-testid='detail-image-container']", "[data-testid='included-soup-selector']", "[data-testid='detail-order-summary']"]);
  await page.screenshot({ path: `${output}/detalle-almuerzo-390x844.png` });
  await page.getByRole("radio", { name: "Sin sopa" }).click();
  await page.screenshot({ path: `${output}/detalle-almuerzo-sin-sopa-390x844.png` });

  await page.clock.setFixedTime(at("18:00:00"));
  await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
  await expect(page.getByTestId("included-soup-selector")).toHaveCount(0);
  await waitForPainted(page, ["[data-testid='detail-image-container']", "[data-testid='detail-total']"]);
  await page.screenshot({ path: `${output}/detalle-cena-390x844.png` });

  // Un documento limpio evita conservar el snapshot de View Transition del detalle anterior.
  await page.close();
  page = await context.newPage();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.setFixedTime(at("12:00:00"));
  await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
  await expect(page.getByTestId("included-soup-selector")).toBeVisible();
  await waitForPainted(page, ["[data-testid='detail-image-container']", "[data-testid='included-soup-selector']"]);
  await page.screenshot({ path: `${output}/detalle-almuerzo-320x568.png` });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  });
  await page.screenshot({ path: `${output}/detalle-almuerzo-320x568-resumen.png` });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu");
  await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
  await waitForPainted(page, ["[data-testid='service-status']", "[data-testid='menu-dish-row']"]);
  await page.screenshot({ path: `${output}/menu-reduced-motion-390x844.png` });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const viewport of [
    { name: "430x932", width: 430, height: 932 },
    { name: "625x795", width: 625, height: 795 },
    { name: "768x900", width: 768, height: 900 },
    { name: "1260x800", width: 1260, height: 800 },
    { name: "1440x1000", width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/menu");
    await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
    await waitForPainted(page, ["[data-testid='service-status']", "[data-testid='menu-dish-row']"]);
    await page.screenshot({ path: `${output}/menu-almuerzo-${viewport.name}.png` });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await waitForPainted(page, ["[data-testid='detail-image-container']", "[data-testid='included-soup-selector']"]);
  await page.screenshot({ path: `${output}/detalle-almuerzo-1440x1000.png` });
});
