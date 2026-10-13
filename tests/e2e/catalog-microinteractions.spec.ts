import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { SIMPLE_DISH_NAME, SIMPLE_DISH_SLUG, motionRowCatalogPath, skipOnboarding, visibleRowPhoto } from "./helpers";

/**
 * T8-C: el catálogo se asienta solo al cambiar categoría u orden,
 * la cantidad y la selección se confirman en el detalle, y la barra
 * de compra permanece usable. El morph de la foto sigue en 470 ms.
 */

const devNoise = /favicon|third-party cookie|ChunkLoadError|turbopack-hmr|__nextjs_original-stack-frames|Transition was aborted because of timeout/i;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!devNoise.test(error.message)) errors.push(error.message);
  });
  page.on("console", (message) => {
    const text = message.text();
    if ((message.type() === "error" || /hydration|did not match/i.test(text)) && !devNoise.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

function translateY(transform: string | null) {
  if (!transform || transform === "none") return 0;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (!matrix?.[1]) return 0;
  const parts = matrix[1].split(",").map((part) => Number(part.trim()));
  return parts.length === 6 ? (parts[5] ?? 0) : 0;
}

function scaleOf(transform: string | null) {
  if (!transform || transform === "none") return 1;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (!matrix?.[1]) return 1;
  return Number(matrix[1].split(",")[0] ?? 1);
}

async function openMenu(page: Page, time: string) {
  await page.clock.setFixedTime(new Date(`2026-07-21T${time}-05:00`));
  await skipOnboarding(page);
  await page.goto(motionRowCatalogPath(page));
  await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", time < "17:00:00" ? "lunch" : "dinner");
  await expect(visibleRowPhoto(page).first()).toBeVisible();
}

function saveEvidence(info: TestInfo, name: string, data: unknown) {
  const dir = "artifacts/t8c";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${info.project.name}-${name}.json`, JSON.stringify(data, null, 2));
}

test.describe("microinteracciones del recorrido público", () => {
  test("categoría, búsqueda y filtros rápidos no esconden ni retrasan los platos", async ({ page }, info) => {
    const errors = watchErrors(page);
    await openMenu(page, "12:00:00");
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-results-motion", "instant");
    await expect(page.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
    await page.waitForFunction(
      () => document.querySelector("[data-testid='menu-grid']")?.getAttribute("data-menu-entrance") !== "off",
    );

    const settled = await page.evaluate(async () => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("[aria-label='Filtrar por categoría'] button")].find(
        (node) => node.getAttribute("aria-pressed") !== "true",
      );
      if (!button) return null;
      button.click();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const grid = document.querySelector<HTMLElement>("[data-testid='menu-grid']");
      const animation = grid?.getAnimations().find((entry) => {
        const name = (entry as CSSAnimation).animationName || getComputedStyle(grid as HTMLElement).animationName;
        return name.includes("menu-results-swap");
      });
      if (animation) {
        animation.pause();
        animation.currentTime = 40;
      }
      const image = grid?.querySelector("img");
      return {
        label: button.textContent?.trim() ?? "",
        pressed: button.getAttribute("aria-pressed"),
        motion: grid?.getAttribute("data-results-motion") ?? null,
        entrance: grid?.getAttribute("data-menu-entrance") ?? null,
        transform: grid ? getComputedStyle(grid).transform : null,
        opacity: image ? getComputedStyle(image).opacity : null,
        animation: grid ? getComputedStyle(grid).animationName : null,
      };
    });

    expect(settled, "hace falta una categoría distinta de Todas").not.toBeNull();
    saveEvidence(info, "categoria", settled);
    await page.screenshot({
      path: `artifacts/t8c/${info.project.name}-categoria.png`,
      caret: "initial",
    });
    expect(settled?.motion).toBe("settle");
    expect(settled?.animation).toBe("menu-results-swap");
    expect(settled?.opacity).toBe("1");
    expect(settled?.entrance).toBe("settled");
    const offset = Math.abs(translateY(settled?.transform ?? null));
    expect(offset).toBeGreaterThan(1);
    expect(offset).toBeLessThanOrEqual(10);

    await page.evaluate(() => {
      document.querySelector("[data-testid='menu-grid']")?.getAnimations().forEach((animation) => animation.finish());
    });

    const countBeforeSearch = await page.locator(".menu-toolbar p").innerText();
    await page.getByRole("searchbox").fill("zz");
    await expect(page.locator("[data-results-motion]")).toHaveAttribute("data-results-motion", "instant");
    await page.getByRole("searchbox").press("q");
    await expect(page.locator("[data-results-motion]")).toHaveAttribute("data-results-motion", "instant");
    const countAfterSearch = await page.locator(".menu-toolbar p").innerText();
    expect(countAfterSearch).not.toBe(countBeforeSearch);

    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.evaluate(async () => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("[aria-label='Filtrar por categoría'] button")];
      const category = buttons.find((node) => !/todas/i.test(node.textContent ?? ""));
      const all = buttons.find((node) => /todas/i.test(node.textContent ?? ""));
      category?.click();
      all?.click();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    });
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-results-motion", "instant");
    const rapidOpacity = await visibleRowPhoto(page).first().evaluate((image) => getComputedStyle(image).opacity);
    expect(rapidOpacity).toBe("1");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("almuerzo confirma sopa, cantidad y compra sin mover el morph", async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
    await skipOnboarding(page);
    await page.addInitScript(() => {
      const samples: Array<{ transform: string; top: number; bottom: number; height: number }> = [];
      const tick = () => {
        const bar = document.querySelector<HTMLElement>(".detail-cta");
        const button = bar?.querySelector("button");
        if (bar && button && samples.length < 10) {
          const rect = button.getBoundingClientRect();
          samples.push({
            transform: getComputedStyle(bar).transform,
            top: rect.top,
            bottom: rect.bottom,
            height: window.innerHeight,
          });
        }
        if (samples.length < 10) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      (window as Window & { __ctaSamples?: typeof samples }).__ctaSamples = samples;
    });
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await expect(page.getByTestId("included-soup-selector")).toBeVisible();
    await expect(page.locator("[data-testid^='modifier-group-']")).toHaveCount(0);

    const samples = await page.evaluate(() => {
      const bag = window as Window & { __ctaSamples?: Array<{ transform: string; top: number; bottom: number; height: number }> };
      return bag.__ctaSamples ?? [];
    });
    const morph = await page.evaluate(() => {
      let duration = "";
      for (const sheet of document.styleSheets) {
        let rules: CSSRule[] = [];
        try {
          rules = [...sheet.cssRules];
        } catch {
          continue;
        }
        const walk = (list: CSSRule[]) => {
          for (const rule of list) {
            if ("cssRules" in rule) walk([...(rule as CSSGroupingRule).cssRules]);
            const styleRule = rule as CSSStyleRule;
            if (
              styleRule.selectorText?.includes("view-transition-group") &&
              styleRule.style?.animationDuration === "470ms"
            ) {
              duration = "470ms";
            }
          }
        };
        walk(rules);
      }
      const hero = document.querySelector("[data-testid='detail-image-container']");
      const image = hero?.querySelector("img");
      return {
        duration,
        name: hero ? getComputedStyle(hero).viewTransitionName : null,
        opacity: image ? getComputedStyle(image).opacity : null,
      };
    });
    saveEvidence(info, "almuerzo-barra", { samples, morph });
    expect(morph.duration).toBe("470ms");
    expect(morph.name).toBe(`dish-${SIMPLE_DISH_SLUG}`);
    expect(morph.opacity).toBe("1");
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every((sample) => sample.top < sample.height && translateY(sample.transform) <= 20)).toBe(true);
    expect(Math.max(...samples.map((sample) => translateY(sample.transform)))).toBeLessThanOrEqual(16.5);

    const initialTotal = await page.getByTestId("detail-total").innerText();
    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    const quantityFrame = await page.evaluate(() => {
      const tick = document.querySelector<HTMLElement>(".detail-quantity .qty-tick");
      const animation = tick?.getAnimations()[0];
      if (animation) {
        animation.pause();
        animation.currentTime = 30;
      }
      return {
        text: tick?.textContent ?? null,
        transform: tick ? getComputedStyle(tick).transform : null,
      };
    });
    saveEvidence(info, "cantidad", quantityFrame);
    await page.screenshot({ path: `artifacts/t8c/${info.project.name}-cantidad.png`, caret: "initial" });
    expect(quantityFrame.text).toBe("2");
    expect(scaleOf(quantityFrame.transform)).toBeGreaterThan(1);
    expect(await page.getByTestId("detail-total").innerText()).not.toBe(initialTotal);

    await page.getByRole("radio", { name: "Sin sopa" }).click();
    const soupFrame = await page.evaluate(() => {
      const option = document.querySelector<HTMLElement>(".soup-option-confirm .soup-option-label");
      const animation = option?.getAnimations()[0];
      if (animation) {
        animation.pause();
        animation.currentTime = 40;
      }
      return {
        text: option?.textContent ?? null,
        transform: option ? getComputedStyle(option).transform : null,
        checked: document.querySelector(".soup-option-confirm")?.getAttribute("aria-checked") ?? null,
      };
    });
    saveEvidence(info, "sopa", soupFrame);
    await page.screenshot({ path: `artifacts/t8c/${info.project.name}-sopa.png`, caret: "initial" });
    expect(soupFrame.text).toBe("Sin sopa");
    expect(soupFrame.checked).toBe("true");
    expect(scaleOf(soupFrame.transform)).toBeLessThan(1);
    await expect(page.getByTestId("detail-order-summary")).toContainText("Sin sopa");

    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    await expect(page.getByText("Añadido al carrito").first()).toBeVisible();
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("rb-cart") ?? "{}"));
    expect(cart.state.items[0].nameSnapshot).toBe(SIMPLE_DISH_NAME);
    expect(cart.state.items[0].quantity).toBe(2);
    expect(cart.state.items[0].modifiers).toEqual([
      expect.objectContaining({ optionId: "no-soup", priceSnapshot: 0 }),
    ]);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("cena compra sin sopa y conserva la cantidad", async ({ page }) => {
    const errors = watchErrors(page);
    await page.clock.setFixedTime(new Date("2026-07-21T18:00:00-05:00"));
    await skipOnboarding(page);
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
    await expect(page.getByTestId("included-soup-selector")).toHaveCount(0);
    await expect(page.locator("[data-testid^='modifier-group-']")).toHaveCount(0);
    const bar = await page.locator(".detail-cta").boundingBox();
    const viewport = page.viewportSize();
    expect(bar).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(bar!.y).toBeLessThan(viewport!.height);
    expect(bar!.y + bar!.height).toBeGreaterThan(viewport!.height - 8);
    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await expect(page.getByRole("group", { name: "Cantidad" })).toContainText("2");
    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("rb-cart") ?? "{}"));
    expect(cart.state.items[0].quantity).toBe(2);
    expect(cart.state.items[0].modifiers).toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("movimiento reducido", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("catálogo y barra quedan en reposo con la foto visible", async ({ page }, info) => {
    const errors = watchErrors(page);
    await openMenu(page, "12:00:00");
    await page.evaluate(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("[aria-label='Filtrar por categoría'] button")].find(
        (node) => node.getAttribute("aria-pressed") !== "true",
      );
      button?.click();
    });
    const menu = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>("[data-testid='menu-grid']");
      const image = grid?.querySelector("[data-testid='menu-dish-row'] .menu-dish-photo img");
      return {
        motion: grid?.getAttribute("data-results-motion") ?? null,
        transform: grid ? getComputedStyle(grid).transform : null,
        animation: grid ? getComputedStyle(grid).animationName : null,
        opacity: image ? getComputedStyle(image).opacity : null,
      };
    });
    expect(menu.opacity).toBe("1");
    expect(menu.animation === "none" || menu.transform === "none").toBe(true);
    expect(Math.abs(translateY(menu.transform))).toBeLessThan(1);

    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await expect(page.getByRole("button", { name: "Añadir al carrito" })).toBeVisible();
    const detail = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>(".detail-cta");
      const image = document.querySelector("[data-testid='detail-image-container'] img");
      const button = bar?.querySelector("button");
      const rect = button?.getBoundingClientRect();
      return {
        transform: bar ? getComputedStyle(bar).transform : null,
        opacity: image ? getComputedStyle(image).opacity : null,
        top: rect?.top ?? null,
        height: window.innerHeight,
      };
    });
    saveEvidence(info, "reducido", { menu, detail });
    await page.screenshot({ path: `artifacts/t8c/${info.project.name}-reducido.png`, caret: "initial" });
    expect(detail.opacity).toBe("1");
    expect(Math.abs(translateY(detail.transform))).toBeLessThan(1);
    expect(detail.top).not.toBeNull();
    expect(detail.top!).toBeLessThan(detail.height);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
