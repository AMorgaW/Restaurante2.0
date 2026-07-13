import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, SIMPLE_DISH_NAME, skipOnboarding } from "./helpers";

const NAV_ITEMS = [
  { label: "Inicio", path: "/" },
  { label: "Menú", path: "/menu" },
  { label: "Buscar", path: "/buscar" },
  { label: "Reservar", path: "/reservar" },
  { label: "Carrito", path: "/carrito" },
] as const;

function bottomNav(page: import("@playwright/test").Page) {
  return page.getByRole("navigation", { name: "Navegación principal" });
}

test.describe("Navegación inferior flotante", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("mantiene un único destino activo al navegar por clic", async ({ page }) => {
    await page.goto("/");

    for (const item of NAV_ITEMS) {
      const nav = bottomNav(page);
      await nav.getByRole("link", { name: item.label, exact: true }).click();
      await expect(page).toHaveURL(item.path === "/" ? /\/$/ : new RegExp(`${item.path}$`));
      await expect(nav.getByRole("link", { name: item.label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByTestId("bottom-nav-active-pill")).toBeVisible();
      expect(await expectNoHorizontalScroll(page)).toBe(true);
    }
  });

  test("funciona con teclado y conserva historial", async ({ page }) => {
    await page.goto("/");
    const menuLink = bottomNav(page).getByRole("link", { name: "Menú", exact: true });
    await menuLink.focus();
    await expect(menuLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/menu$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(bottomNav(page).getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("respeta geometría, targets y separación del CTA del carrito", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} al carrito` }).click();
    await page.goto("/carrito");

    const nav = bottomNav(page);
    await expect(nav.getByLabel("1 producto en el carrito")).toBeVisible();
    const navBox = await nav.boundingBox();
    const cartLinkBox = await nav.getByTestId("bottom-nav-carrito").boundingBox();
    const ctaBox = await page.getByRole("button", { name: "Continuar con el pedido" }).boundingBox();
    expect(navBox).not.toBeNull();
    expect(cartLinkBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(navBox?.x).toBeGreaterThanOrEqual(11);
    expect(navBox?.height).toBeGreaterThanOrEqual(64);
    expect(cartLinkBox?.height).toBeGreaterThanOrEqual(44);
    expect((ctaBox?.y ?? 0) + (ctaBox?.height ?? 0)).toBeLessThanOrEqual((navBox?.y ?? 0) - 7);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("se oculta en flujos, administración y deja favoritos sin destino activo", async ({ page }) => {
    await page.goto("/favoritos");
    await expect(bottomNav(page).locator('[aria-current="page"]')).toHaveCount(0);

    await page.goto("/plato/carne-asada-plato-con-cebolleta");
    await expect(bottomNav(page)).toHaveCount(0);
    await page.goto("/checkout");
    await expect(bottomNav(page)).toHaveCount(0);
    await page.goto("/admin");
    await expect(bottomNav(page)).toHaveCount(0);
    await page.goto("/visual-lab");
    await page.getByLabel("Escena").selectOption("nav");
    await expect(page.getByRole("navigation", { name: "Vista previa de navegación" })).toBeVisible();
    await expect(bottomNav(page)).toHaveCount(0);
  });
});

test.describe("Navegación inferior con reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("cambia el destino activo sin ocultar contenido", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/");
    const nav = bottomNav(page);
    await nav.getByRole("link", { name: "Menú", exact: true }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(nav.getByRole("link", { name: "Menú", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByTestId("bottom-nav-active-pill")).toBeVisible();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });
});
