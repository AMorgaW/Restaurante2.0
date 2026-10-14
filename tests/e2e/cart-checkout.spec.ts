import { expect, test } from "@playwright/test";
import { addSimpleDishToCart, SIMPLE_DISH_NAME, skipOnboarding } from "./helpers";

test.describe("Carrito y checkout demo", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("el carrito vacío invita a explorar el menú", async ({ page }) => {
    await page.goto("/carrito");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
    await page.getByRole("button", { name: "Ver el menú" }).click();
    await expect(page).toHaveURL(/\/menu/);
  });

  test("añade, cambia cantidades, aplica cupón y elimina", async ({ page }) => {
    await addSimpleDishToCart(page);
    await page.goto("/carrito");
    await expect(page.getByText(SIMPLE_DISH_NAME)).toBeVisible();

    // Badge de navegación con cantidad.
    await expect(page.getByRole("link", { name: /ver carrito \(1 productos?\)/i })).toBeVisible();

    // Cupón inválido → error accesible.
    await page.getByLabel("Código de cupón").fill("NOEXISTE");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("El cupón ingresado no es válido o ya expiró.")).toBeVisible();

    // Cupón válido → descuento visible en el resumen.
    await page.getByLabel("Código de cupón").fill("BIENVENIDA10");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByText("Cupón aplicado")).toBeVisible();
    // Fila exacta del desglose (evita coincidir con títulos y toasts).
    await expect(page.getByText("Descuento", { exact: true })).toBeVisible();

    // Propina.
    await page.getByRole("button", { name: "10%", exact: true }).click();
    await expect(page.getByText("Propina", { exact: true })).toBeVisible();

    // Cantidad + eliminar línea.
    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page
      .getByRole("button", { name: `Eliminar ${SIMPLE_DISH_NAME} del carrito` })
      .click();
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("vaciar el carrito pide confirmación", async ({ page }) => {
    await addSimpleDishToCart(page);
    await page.goto("/carrito");
    await page.getByRole("button", { name: "Vaciar" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Vaciar el carrito?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Conservar productos" }).click();
    await expect(page.getByText(SIMPLE_DISH_NAME)).toBeVisible();

    await page.getByRole("button", { name: "Vaciar" }).click();
    await page.getByRole("button", { name: "Sí, vaciar carrito" }).click();
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("reconcilia un snapshot antiguo sin conservar identidad CasaBrasa", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-cart",
        JSON.stringify({
          state: {
            items: [{
              lineId: "legacy-line",
              itemId: "legacy-item",
              slug: "arroz-amarillo-carne-asada-frijoles",
              nameSnapshot: "CasaBrasa · plato antiguo",
              unitPriceSnapshot: 1,
              quantity: 1,
              notes: "",
              modifiers: [],
              imagePath: "/legacy/casa-brasa.jpg",
            }],
            branchId: "branch-centro",
            fulfillmentType: "pickup",
            couponCode: null,
            tipPercent: 0,
          },
          version: 2,
        }),
      );
    });
    await page.goto("/carrito");
    await expect(page.getByTestId("cart-reconciliation-notice")).toBeVisible();
    await expect(page.getByText("Arroz amarillo, carne asada, frijoles")).toBeVisible();
    await expect(page.getByText("Actualizamos nombre, fotografía o identidad")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar aviso de actualización del carrito" }).click();
    await expect(page.getByTestId("cart-reconciliation-notice")).toBeHidden();
    await expect(page.getByRole("button", { name: "Aumentar cantidad" })).toBeEnabled();
  });

  test("informa datos corruptos sin inventar un carrito vacío silencioso", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-cart",
        JSON.stringify({
          state: {
            items: [{ quantity: 0 }],
            branchId: "branch-centro",
            fulfillmentType: "pickup",
            couponCode: null,
            tipPercent: 0,
          },
          version: 2,
        }),
      );
    });
    await page.goto("/carrito");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
    await expect(page.getByTestId("cart-reconciliation-notice")).toContainText(
      "Retiramos datos incompletos",
    );
  });

  test("checkout completo en modo demostración", async ({ page }) => {
    test.setTimeout(180_000);
    await addSimpleDishToCart(page);
    await page.goto("/carrito");
    await expect(page.getByRole("button", { name: "Continuar con el pedido" })).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/checkout/, { timeout: 45_000 }),
      page.getByRole("button", { name: "Continuar con el pedido" }).click(),
    ]);

    // Paso 1: entrega (recogida preseleccionada).
    await expect(page.getByRole("radio", { name: /recoger en tienda/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Continuar" }).click();

    // Paso 2: datos con validación.
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();

    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Teléfono").fill("+57 300 123 4567");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Paso 3: pago demo + confirmación.
    await expect(page.getByText("Pago de demostración")).toBeVisible();
    await expect(page.getByText("Requiere configuración")).toBeVisible();
    const confirm = page.getByRole("button", { name: /confirmar pedido/i });
    await expect(confirm).toBeEnabled();
    const orderPost = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/orders/.test(response.url()),
      { timeout: 60_000 },
    );
    await confirm.click();
    const settled = await orderPost;
    expect(settled.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 45_000 });

    // Confirmación.
    await expect(page.getByRole("heading", { name: "¡Pedido confirmado!" })).toBeVisible();
    // El número aparece en la página (y también en el toast): basta el primero.
    await expect(page.getByText(/CB-[A-Z0-9]+/).first()).toBeVisible();
    await expect(page.getByText(/no se realizó\s+ningún cobro real/i)).toBeVisible();

    // El carrito quedó vacío.
    await page.goto("/carrito");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("checkout con carrito vacío muestra estado claro", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("No hay nada para pagar")).toBeVisible();
  });

  test("un pedido inexistente muestra estado no encontrado", async ({ page }) => {
    await page.goto("/pedido/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Pedido no encontrado")).toBeVisible();
  });
});
