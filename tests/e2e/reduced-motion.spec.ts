import { expect, test } from "@playwright/test";

// La versión instalada de @playwright/test (1.61.x) no expone reducedMotion
// como test option directa; la vía documentada es contextOptions (equivale a
// pasarla a browser.newContext()).
test.use({ contextOptions: { reducedMotion: "reduce" } });

test("reduced motion: flujo completo sin contenido invisible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const onboarding = page.getByTestId("landing-page");
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByRole("img", { name: /pescado frito/i })).toHaveCSS("transform", "none");
  await onboarding.getByRole("button", { name: "Comenzar" }).click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole("heading", { name: "Menú", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Filtrar por categoría" }).locator("..")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByRole("button", { name: "Todas", exact: true }).locator("..")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.locator("article").first()).toBeVisible();

  // Tras scrollear hasta el fondo, TODAS las tarjetas quedan reveladas
  // (whileInView con fade corto bajo reduced motion, sin quedarse ocultas).
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect
    .poll(
      () =>
        page
          .locator("article")
          .evaluateAll((els) =>
            els.every((el) => Number(getComputedStyle(el.parentElement as Element).opacity) > 0.9),
          ),
      { timeout: 5_000 },
    )
    .toBe(true);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("link", { name: /ver carne asada plato con cebolleta/i }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Carne asada plato con cebolleta" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Añadir al carrito" })).toBeVisible();
  await expect(page.getByTestId("detail-total")).toBeVisible();
  expect(errors).toEqual([]);
});
