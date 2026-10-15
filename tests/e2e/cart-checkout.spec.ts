import { expect, test } from "@playwright/test";
import {
  addSimpleDishToCart,
  expectNoHorizontalScroll,
  SIMPLE_DISH_NAME,
  skipOnboarding,
} from "./helpers";

async function gotoCartAfterProductAdd(page: import("@playwright/test").Page): Promise<void> {
  try {
    await page.goto("/carrito");
  } catch {
    // WebKit puede conservar una transición de desarrollo del detalle justo
    // cuando se inicia la navegación al carrito; el segundo intento no cambia
    // el estado del carrito y evita convertir esa carrera en un falso fallo.
    await page.waitForTimeout(300);
    await page.goto("/carrito");
  }
}

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
    await page.getByRole("button", { name: `Eliminar ${SIMPLE_DISH_NAME} del carrito` }).click();
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
            items: [
              {
                lineId: "legacy-line",
                itemId: "legacy-item",
                slug: "arroz-amarillo-carne-asada-frijoles",
                nameSnapshot: "CasaBrasa · plato antiguo",
                unitPriceSnapshot: 1,
                quantity: 1,
                notes: "",
                modifiers: [],
                imagePath: "/legacy/casa-brasa.jpg",
              },
            ],
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
    await addSimpleDishToCart(page, { service: "dinner" });
    await gotoCartAfterProductAdd(page);
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
    expect(await expectNoHorizontalScroll(page)).toBe(true);
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
    await expect(page.getByText(/Stripe|Mercado Pago|Requiere configuración/)).toHaveCount(0);
    const confirm = page.getByRole("button", { name: /confirmar pedido/i });
    await expect(confirm).toBeEnabled();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(
      await confirm.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        return (
          button.scrollWidth <= button.clientWidth + 1 &&
          button.scrollHeight <= button.clientHeight + 1 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1
        );
      }),
    ).toBe(true);
    const orderPost = page.waitForResponse(
      (response) => response.request().method() === "POST" && /\/api\/orders/.test(response.url()),
      { timeout: 60_000 },
    );
    await confirm.click();
    const settled = await orderPost;
    expect(settled.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/pedido\//, { timeout: 45_000 });

    // Confirmación.
    await expect(page.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible();
    // El número aparece en la página (y también en el toast): basta el primero.
    const orderReference = page.getByText(/CB-[A-Z0-9]+/).first();
    await expect(orderReference).toBeVisible();
    await expect(page.getByText("Demostración · sin cobro real").first()).toBeVisible();
    await expect(page.getByText("Pagado (demostración)")).toHaveCount(0);

    // La copia inmediata se conserva al recargar el mismo navegador.
    const referenceText = await orderReference.textContent();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible();
    await expect(page.getByText(referenceText ?? "").first()).toBeVisible();

    // El carrito quedó vacío.
    await page.goto("/carrito");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("modo local conserva el POST demo sin credencial de recuperación", async ({ page }) => {
    let requestBody: Record<string, unknown> | null = null;
    await page.route("**/api/orders", async (route) => {
      requestBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          order: {
            id: "22222222-2222-4222-8222-222222222222",
            orderNumber: "CB-LOCAL-C22",
            branchId: "branch-centro",
            status: "pending",
            paymentStatus: "pending",
            paymentMethod: "demo",
            fulfillmentType: "pickup",
            items: [],
            totals: {
              subtotal: 30000,
              discount: 0,
              tax: 2400,
              serviceFee: 0,
              deliveryFee: 0,
              tip: 0,
              total: 32400,
            },
            currency: "COP",
            customer: { name: "Ana Pérez", phone: "3000000002", email: "ana@example.com" },
            notes: "",
            createdAt: "2026-10-15T12:00:00.000Z",
          },
        }),
      });
    });
    await addSimpleDishToCart(page, { service: "dinner" });
    await page.goto("/carrito");
    await Promise.all([
      page.waitForURL(/\/checkout/),
      page.getByRole("button", { name: "Continuar con el pedido" }).click(),
    ]);
    await expect(page.getByRole("heading", { name: "¿Cómo quieres recibir tu pedido?" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByLabel("Datos del cliente")).toBeVisible();
    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Teléfono").fill("+57 300 000 0002");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page).toHaveURL(/\/pedido\/22222222-2222-4222-8222-222222222222/);
    expect(requestBody).not.toBeNull();
    expect(requestBody).not.toHaveProperty("receiptKey");
    expect(await page.evaluate(() => sessionStorage.getItem("rb-checkout-receipt-attempts"))).toBeNull();
  });

  test("checkout con carrito vacío muestra estado claro", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("No hay nada para pagar")).toBeVisible();
  });

  test("domicilio exige dirección y conserva el desglose", async ({ page }) => {
    await addSimpleDishToCart(page);
    await page.goto("/carrito");
    await page.getByRole("button", { name: "Continuar con el pedido" }).click();
    await page.getByRole("radio", { name: /domicilio/i }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Teléfono").fill("+57 300 123 4567");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escribe la dirección de entrega.")).toBeVisible();

    await page.getByLabel("Dirección").fill("Calle 10 # 5-51");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(/Sopa incluida:/)).toBeVisible();
    await expect(page.getByText("Domicilio", { exact: true })).toBeVisible();
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /confirmar pedido/i })).toBeEnabled();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("mesa QR conserva el contexto y bloquea el cambio de modalidad", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "rb-table-context",
        JSON.stringify({
          tableQrToken: "table-token-for-local-demo",
          tableCode: "M1",
          tableName: "Mesa 1",
          branchConfigId: "branch-centro",
        }),
      );
    });
    await addSimpleDishToCart(page);
    await page.goto("/carrito");
    await page.getByRole("button", { name: "Continuar con el pedido" }).click();

    await expect(page.getByText("Pedido en mesa")).toBeVisible();
    await expect(page.getByText("Mesa M1")).toBeVisible();
    await expect(page.getByRole("button", { name: /recoger en tienda/i })).not.toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  });

  test("un pedido sin copia local muestra un estado neutral", async ({ page }) => {
    await page.goto("/pedido/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByRole("heading", {
        name: "No hay un comprobante guardado en este navegador para este enlace",
      }),
    ).toBeVisible();
    await expect(page.getByText(/no confirma ni descarta/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver al menú" })).toBeVisible();
  });
});
