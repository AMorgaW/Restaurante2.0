import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding, SIMPLE_DISH_NAME, SIMPLE_DISH_SLUG } from "./helpers";

const MODIFIER_DISH_SLUG =
  "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de";
const SOUP_SLUG = "sopa-de-maiz-con-arroz-y-frijoles";

function skipDesktop(testInfo: { project: { name: string } }) {
  test.skip(testInfo.project.name === "desktop", "La presentación compacta solo se comprueba en móvil.");
}

async function prepareFavorites(page: Parameters<typeof skipOnboarding>[0], slugs: string[]) {
  await skipOnboarding(page);
  await page.addInitScript((favoriteSlugs) => {
    window.localStorage.setItem(
      "rb-favorites",
      JSON.stringify({ state: { slugs: favoriteSlugs }, version: 1 }),
    );
  }, slugs);
}

async function expectCompactSurface(page: Parameters<typeof skipOnboarding>[0]) {
  await expect(page.getByTestId("menu-grid")).toHaveAttribute(
    "data-mobile-presentation",
    "compact",
  );
  await expect(page.locator("[data-catalog-pane='row']:visible")).toHaveCount(0);
  await expect(page.locator("[data-catalog-pane='compact']:visible")).toBeVisible();
  await expect(page.locator("[data-compact-photo] img").first()).toBeVisible();
  const controls = await page.getByTestId("compact-dish-card").first().locator("button, a").evaluateAll(
    (nodes) =>
      nodes
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ width: rect.width, height: rect.height })),
  );
  expect(controls.some((rect) => rect.width >= 44 && rect.height >= 44)).toBe(true);
  expect(await expectNoHorizontalScroll(page)).toBe(true);
}

test.describe("/favoritos compacto en móvil", () => {
  test("320 px: muestra varios favoritos y elimina el último sin tarjetas fantasma", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.setViewportSize({ width: 320, height: 568 });
    await prepareFavorites(page, [SIMPLE_DISH_SLUG, MODIFIER_DISH_SLUG]);
    await page.goto("/favoritos");

    await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toBeVisible();
    await expectCompactSurface(page);
    const cards = page.getByTestId("compact-dish-card");
    await expect(cards).toHaveCount(2);

    await cards.first().getByRole("button", { name: /Quitar .* favoritos/ }).click();
    await expect(cards).toHaveCount(1);
    await cards.first().getByRole("button", { name: /Quitar .* favoritos/ }).click();
    await expect(page.getByText("Aún no tienes favoritos")).toBeVisible();
    await expect(page.getByTestId("compact-dish-card")).toHaveCount(0);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("390 px: detalle y regreso restauran solo el scroll de favoritos", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareFavorites(page, [SIMPLE_DISH_SLUG, MODIFIER_DISH_SLUG]);
    await page.addInitScript(() => {
      const makeScrollable = () => {
        document.body.style.minHeight = "1600px";
      };
      document.addEventListener("DOMContentLoaded", makeScrollable, { once: true });
    });
    await page.addInitScript(() => {
      window.sessionStorage.setItem("rb-menu-scroll-y", "111");
      window.sessionStorage.setItem("rb-search-scroll-y", "222");
    });
    await page.goto("/favoritos");
    await expectCompactSurface(page);

    await page.evaluate(() => window.scrollTo({ top: 260, behavior: "instant" }));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(100);
    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click({ force: true });
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/favoritos\/?$/);
    await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    const scopes = await page.evaluate(() => ({
      menu: sessionStorage.getItem("rb-menu-scroll-y"),
      search: sessionStorage.getItem("rb-search-scroll-y"),
      favorites: sessionStorage.getItem("rb-favorites-scroll-y"),
    }));
    expect(scopes.menu).toBe("111");
    expect(scopes.search).toBe("222");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("rb-favorites-scroll-y"))).toBeNull();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("no convierte una sopa guardada en favorito comprable", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareFavorites(page, [SOUP_SLUG]);
    await page.goto("/favoritos");

    await expect(page.getByText("Tus favoritos no están disponibles")).toBeVisible();
    await expect(page.getByText("Aún no tienes favoritos")).toHaveCount(0);
    await expect(page.getByTestId("compact-dish-card")).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rb-favorites") ?? "{}").state?.slugs ?? []);
    expect(stored).toContain(SOUP_SLUG);
  });

  test("conserva disponibilidad comercial en almuerzo, cena y cierre", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareFavorites(page, [SIMPLE_DISH_SLUG]);

    await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
    await page.goto("/favoritos");
    await expect(
      page.getByRole("link", { name: new RegExp(`Elegir (sopa|sin sopa) para ${SIMPLE_DISH_NAME}`) }),
    ).toBeVisible();

    await page.clock.setFixedTime(new Date("2026-07-21T18:00:00-05:00"));
    await page.reload();
    await expect(page.getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} al carrito` })).toBeVisible();

    await page.clock.setFixedTime(new Date("2026-07-21T23:00:00-05:00"));
    await page.reload();
    const closed = page.getByRole("button", { name: new RegExp(`No se puede añadir ${SIMPLE_DISH_NAME}`) });
    await expect(closed).toBeVisible();
    await expect(closed).toBeDisabled();
    await expect(page.getByTestId("compact-dish-card")).toBeVisible();
  });

  test("movimiento reducido deja favoritos visibles y asentados", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepareFavorites(page, [SIMPLE_DISH_SLUG, MODIFIER_DISH_SLUG]);
    await page.goto("/favoritos");
    await expectCompactSurface(page);
    await expect(page.getByTestId("compact-dish-card").first()).toHaveAttribute(
      "data-compact-phase",
      /rest|done/,
    );
    const motion = await page.getByTestId("compact-dish-card").first().evaluate((element) => ({
      animation: getComputedStyle(element).animationName,
      transform: getComputedStyle(element).transform,
    }));
    expect(motion.animation).toBe("none");
    expect(motion.transform).toBe("none");
  });
});
