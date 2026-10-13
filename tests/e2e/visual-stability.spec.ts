import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * T8-A: la foto descargada no espera a la animacion de carga, el recorrido
 * menu -> detalle no desalinea la hidratacion y el movimiento reducido vale
 * desde el primer frame visible.
 */

const devNoise = /favicon|third-party cookie|ChunkLoadError|turbopack-hmr|__nextjs_original-stack-frames/i;

function watchHydration(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!devNoise.test(error.message)) errors.push(error.message);
  });
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || /hydration|did not match/i.test(text)) {
      // El aviso de hidratacion sigue contando. El chunk HMR de next dev
      // falla a veces en WebKit por el overlay, no por el arbol renderizado.
      if (!devNoise.test(text)) errors.push(text);
    }
  });
  return errors;
}

function saveFrame(page: Page, info: TestInfo, name: string, data: unknown) {
  const dir = "artifacts/t8a/frames";
  mkdirSync(dir, { recursive: true });
  const base = `${dir}/${info.project.name}-${name}`;
  writeFileSync(`${base}.json`, JSON.stringify(data, null, 2));
  // caret initial: Playwright no escribe caret-color en los inputs
  // mientras React hidrata. Ese estilo inline era el falso desajuste.
  return page.screenshot({ path: `${base}.png`, caret: "initial" });
}

async function photoOpacity(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((img) => ({
    opacity: getComputedStyle(img).opacity,
    complete: (img as HTMLImageElement).complete,
    width: (img as HTMLImageElement).naturalWidth,
  }));
}

async function returnFromDetail(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // El boton existe en el HTML antes de que el onClick este hidratado.
  // En WebKit el primer clic puede llegar en ese hueco y no navegar.
  await expect(async () => {
    if (/\/plato\//.test(page.url())) {
      await page.getByRole("button", { name: "Volver" }).click();
    }
    await expect(page).toHaveURL(/\/menu$/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("estabilidad visual del catalogo", () => {
  test("primera visita, recarga y regreso conservan la foto y la hidratacion", async ({ page }, info) => {
    const errors = watchHydration(page);

    await page.goto("/");
    await page.getByTestId("landing-cta").click();
    await page.waitForSelector("[data-testid='menu-grid'] img");
    const firstFrame = await photoOpacity(page, "[data-testid='compact-dish-card']:visible img, [data-testid='menu-dish-row']:visible img");
    await saveFrame(page, info, "menu-primera-visita", firstFrame);
    expect(firstFrame.opacity, "la foto del primer frame no puede nacer invisible").toBe("1");

    await page.reload();
    await page.waitForSelector("[data-testid='menu-grid'] img");
    const reloaded = await photoOpacity(page, "[data-testid='compact-dish-card']:visible img, [data-testid='menu-dish-row']:visible img");
    await saveFrame(page, info, "menu-recarga", reloaded);
    expect(reloaded.opacity).toBe("1");

    const dishLabel = await page
      .locator("[data-testid='compact-dish-card']:visible a[aria-label^='Ver '], [data-testid='menu-dish-row']:visible a[aria-label^='Ver ']")
      .first()
      .getAttribute("aria-label");
    await page.getByRole("link", { name: dishLabel ?? "" }).click();
    await page.waitForSelector("[data-testid='detail-image-container'] img");
    const detail = await photoOpacity(page, "[data-testid='detail-image-container'] img");
    const transitionName = await page
      .getByTestId("detail-image-container")
      .evaluate((element) => getComputedStyle(element).viewTransitionName);
    await saveFrame(page, info, "detalle", { ...detail, transitionName });
    expect(detail.opacity).toBe("1");
    expect(transitionName.startsWith("dish-")).toBe(true);

    await returnFromDetail(page);
    await expect(page.getByTestId("menu-grid")).toBeVisible();
    const returned = await photoOpacity(page, "[data-testid='compact-dish-card']:visible img, [data-testid='menu-dish-row']:visible img");
    await saveFrame(page, info, "menu-regreso", returned);
    expect(returned.opacity).toBe("1");

    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("movimiento reducido desde el primer frame", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("catalogo y detalle no quedan desplazados ni con la foto oculta", async ({ page }, info) => {
    const errors = watchHydration(page);

    await page.goto("/menu");
    await page.waitForSelector("[data-testid='menu-grid'] img");
    const menu = await page.evaluate(() => {
      const wrap = document.querySelector("[data-catalog-pane='compact'], [data-testid='menu-grid'] > div");
      const img = document.querySelector("[data-testid='compact-dish-card'] img, .menu-dish-photo img");
      return {
        wrap: wrap ? getComputedStyle(wrap).transform : null,
        opacity: img ? getComputedStyle(img).opacity : null,
      };
    });
    await saveFrame(page, info, "reducido-menu", menu);
    expect(menu.opacity).toBe("1");
    expect(menu.wrap === "none" || menu.wrap === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

    const dishLabel = await page
      .locator("[data-testid='compact-dish-card']:visible a[aria-label^='Ver '], [data-testid='menu-dish-row']:visible a[aria-label^='Ver ']")
      .first()
      .getAttribute("aria-label");
    await page.getByRole("link", { name: dishLabel ?? "" }).click();
    await page.waitForSelector("[data-testid='product-detail']");
    const detail = await page.evaluate(() => {
      const cta = document.querySelector(".detail-cta");
      const img = document.querySelector("[data-testid='detail-image-container'] img");
      return {
        cta: cta ? getComputedStyle(cta).transform : null,
        opacity: img ? getComputedStyle(img).opacity : null,
      };
    });
    await saveFrame(page, info, "reducido-detalle", detail);
    expect(detail.opacity).toBe("1");
    expect(detail.cta === "none" || detail.cta === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});