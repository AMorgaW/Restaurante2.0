import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

const SIMPLE_DISH_NAME = "Carne asada plato con cebolleta";

async function gotoAfterDevReload(page: Page, path: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path);
      return;
    } catch (error) {
      if (!String(error).includes("Navigation to") || !String(error).includes("interrupted"))
        throw error;
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`No se pudo navegar a ${path} tras recargas del servidor de desarrollo.`);
}

async function openDetailWhenHydrated(
  page: Page,
  link: ReturnType<Page["getByRole"]>,
): Promise<void> {
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/plato\//);
  await expect(async () => {
    await link.click();
    await expect(page).toHaveURL(new RegExp(href ?? "/plato/"));
  }).toPass({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
});

test.describe("/buscar compacto en móvil", () => {
  test("respeta la consulta directa y conserva fotografías y controles", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "La política compacta solo se comprueba en móvil.",
    );
    await gotoAfterDevReload(page, "/buscar?q=carne");

    const search = page.getByRole("searchbox");
    const grid = page.getByTestId("menu-grid");
    await expect(search).toHaveValue("carne");
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("rb-menu-grid-visited")))
      .toBe("1");
    await expect(grid).toHaveAttribute("data-mobile-presentation", "compact");
    await expect(page.locator("[data-catalog-pane='row']:visible")).toHaveCount(0);

    const card = page.getByTestId("compact-dish-card").first();
    await expect(card).toBeVisible();
    await expect(card.locator("[data-compact-photo] img")).toBeVisible();
    await expect(card.getByRole("button", { name: /favoritos/ })).toBeVisible();
    await expect(card.getByRole("link", { name: /Ver / })).toBeAttached();
    const controls = await card.locator("button, a").evaluateAll((nodes) =>
      nodes
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ width: rect.width, height: rect.height })),
    );
    expect(controls.some((rect) => rect.width >= 44 && rect.height >= 44)).toBe(true);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("muestra vacío, filtros, orden y favoritos sin duplicar acciones", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "La política compacta solo se comprueba en móvil.",
    );
    await page.goto("/buscar?query=plato-inexistente");
    await expect(page.getByText("No encontramos platos con esa búsqueda")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue("");

    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await page.locator("#menu-sort").selectOption("nombre");
    const card = page.getByTestId("compact-dish-card").first();
    await expect(card).toBeVisible();
    const favorite = card.getByRole("button", { name: /favoritos/ });
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    expect(await card.getByRole("button", { name: /favoritos/ }).count()).toBe(1);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("aísla la búsqueda de /menu", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "La política compacta solo se comprueba en móvil.",
    );
    await gotoAfterDevReload(page, "/menu");
    await expect(page.getByTestId("menu-grid")).not.toHaveAttribute("data-menu-entrance", "off");
    // next dev termina la compilación inicial antes de aceptar la primera
    // navegación cruzada en WebKit; no es una espera de fotograma.
    await page.waitForTimeout(1_000);
    const catalogSearch = page.getByRole("searchbox");
    await catalogSearch.fill("arroz");
    await expect(catalogSearch).toHaveValue("arroz");
    await expect
      .poll(() =>
        page.evaluate(() => {
          try {
            return JSON.parse(sessionStorage.getItem("rb-menu-view") ?? "{}").state?.query ?? "";
          } catch {
            return "";
          }
        }),
      )
      .toBe("arroz");

    await gotoAfterDevReload(page, "/buscar?q=carne");
    await expect(page.getByRole("searchbox")).toHaveValue("carne");
    await gotoAfterDevReload(page, "/menu");
    await expect(page.getByRole("searchbox")).toHaveValue("arroz");
    await gotoAfterDevReload(page, "/buscar");
    await expect(page.getByRole("searchbox")).toHaveValue("carne");
  });

  test("restaura filtros y scroll al volver del detalle", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "La política compacta solo se comprueba en móvil.",
    );
    await gotoAfterDevReload(page, "/buscar");
    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await page.locator("#menu-sort").selectOption("precio-desc");
    await page.evaluate(() => window.scrollTo({ top: 450, behavior: "instant" }));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(100);

    const detailLink = page
      .getByTestId("compact-dish-card")
      .first()
      .getByRole("link", { name: /Ver / });
    await openDetailWhenHydrated(page, detailLink);
    await expect(page).toHaveURL(/\/plato\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/buscar$/);
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(page.locator("#menu-sort")).toHaveValue("precio-desc");
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("movimiento reducido deja la tarjeta visible y asentada", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === "desktop",
      "La política compacta solo se comprueba en móvil.",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/buscar?q=carne");
    const card = page.getByTestId("compact-dish-card").first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-compact-phase", /rest|done/);
    await expect(card.locator("[data-compact-photo] img")).toBeVisible();
    const motion = await card.evaluate((element) => ({
      animation: getComputedStyle(element).animationName,
      transform: getComputedStyle(element).transform,
    }));
    expect(motion.animation).toBe("none");
    expect(motion.transform).toBe("none");
  });
});

test("escritorio conserva filas sin duplicación visible en /buscar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Comprobación exclusiva del proyecto desktop.");
  await page.goto("/buscar?q=carne");
  await expect(page.getByTestId("menu-grid")).toHaveAttribute(
    "data-mobile-presentation",
    "compact",
  );
  await expect(
    page.locator("[data-catalog-pane='row']:visible [data-testid='menu-dish-row']").first(),
  ).toBeVisible();
  await expect(page.locator("[data-catalog-pane='compact']:visible")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: SIMPLE_DISH_NAME })).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(true);
});
