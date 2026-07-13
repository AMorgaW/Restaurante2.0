import { expect, test } from "@playwright/test";
import {
  LONG_DISH_NAME,
  MODIFIER_DISH_SLUG,
  SIMPLE_DISH_NAME,
  SIMPLE_DISH_SLUG,
  skipOnboarding,
} from "./helpers";

test.describe("Detalle de plato", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("abre desde la tarjeta y muestra el nombre completo sin truncar", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: `Ver ${LONG_DISH_NAME}` }).click();
    await expect(page).toHaveURL(new RegExp(`/plato/${MODIFIER_DISH_SLUG}`));
    // El h1 del detalle contiene el nombre íntegro.
    await expect(page.getByRole("heading", { level: 1, name: LONG_DISH_NAME })).toBeVisible();
    await expect(page.getByText(/consulta con el restaurante los ingredientes/i)).toBeVisible();
  });

  test("volver conserva la categoría, la búsqueda y el scroll", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await expect(page.getByText(/platos?$/).first()).toBeVisible();

    // Scroll hasta el final del grid (scrollTo instantáneo: mouse.wheel no
    // existe en WebKit móvil y el CSS usa scroll-behavior smooth).
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(100);

    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
    // La categoría sigue seleccionada…
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // …y la posición NO se reinicia al tope: el navegador restaura el scroll.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(200);
  });

  test("exige el término de la carne antes de añadir (modificador obligatorio)", async ({
    page,
  }) => {
    await page.goto(`/plato/${MODIFIER_DISH_SLUG}`);
    const cta = page.getByRole("button", { name: "Añadir al carrito" });
    await expect(cta).toBeDisabled();
    await expect(page.getByText(/selecciona: término de la carne/i)).toBeVisible();

    await page.getByRole("radio", { name: "Término medio" }).click();
    await expect(cta).toBeEnabled();

    // Extra con recargo actualiza el total del CTA.
    const total = page.getByTestId("detail-total");
    const totalBefore = await total.innerText();
    await page.getByRole("checkbox", { name: /guacamole extra/i }).click();
    await expect(total).not.toHaveText(totalBefore);

    await cta.click();
    await expect(page.getByText("Añadido al carrito")).toBeVisible();
  });

  test("cantidad y notas se reflejan en el carrito", async ({ page }) => {
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.getByLabel(/notas para la cocina/i).fill("Sin cebolla, por favor");
    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    await expect(page.getByText("Añadido al carrito")).toBeVisible();

    await page.goto("/carrito");
    await expect(page.getByText(SIMPLE_DISH_NAME)).toBeVisible();
    await expect(page.getByText("Sin cebolla, por favor")).toBeVisible();
    await expect(page.getByLabel(`Cantidad de ${SIMPLE_DISH_NAME}`).getByText("2")).toBeVisible();
  });

  test("favorito persiste y aparece en /favoritos", async ({ page }) => {
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await page
      .getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} a favoritos` })
      .click();
    await page.goto("/favoritos");
    await expect(page.getByRole("heading", { name: SIMPLE_DISH_NAME })).toBeVisible();

    // Quitar favorito desde la tarjeta → estado vacío.
    await page
      .getByRole("button", { name: `Quitar ${SIMPLE_DISH_NAME} de favoritos` })
      .click();
    await expect(page.getByText("Aún no tienes favoritos")).toBeVisible();
  });

  test("compartir copia el enlace (fallback de portapapeles)", async ({
    page,
    context,
    browserName,
  }) => {
    // webkit no soporta conceder permisos de portapapeles vía CDP.
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await page.getByRole("button", { name: `Compartir ${SIMPLE_DISH_NAME}` }).click();
    // Sin Web Share nativo cae a portapapeles (toast de copiado) y, si el
    // portapapeles tampoco está disponible, informa el fallo con claridad.
    await expect(page.getByText(/enlace copiado|no se pudo compartir/i).first()).toBeVisible();
  });

  test("los relacionados navegan a otro detalle", async ({ page }) => {
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    const related = page.getByRole("link", { name: /^Ver / }).first();
    await related.click();
    await expect(page).toHaveURL(/\/plato\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
