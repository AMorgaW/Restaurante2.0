import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { addSimpleDishToCart, MODIFIER_DISH_SLUG, skipOnboarding } from "./helpers";
import type { Order } from "@/types/order";

/**
 * Capturas de revisión visual en los tamaños exigidos, guardadas en
 * artifacts/screenshots para inspección manual (ver TEST_REPORT.md).
 */
const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x1000", width: 1440, height: 1000 },
] as const;

const DIR = "artifacts/screenshots";

const CONFIRMATION_SCREENSHOT_ORDER: Order = {
  id: "order-screenshot-c1",
  orderNumber: "CB-C1-SCREENSHOT",
  branchId: "branch-centro",
  status: "pending",
  paymentStatus: "pending",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  items: [
    {
      itemId: "dish-screenshot",
      slug: "dish-screenshot",
      nameSnapshot: "Arroz de coco con pescado",
      unitPrice: 42000,
      quantity: 2,
      modifiers: [
        {
          groupId: "included-lunch-soup",
          groupName: "Sopa incluida",
          optionId: "soup-screenshot",
          optionName: "Sopa de pescado",
          priceSnapshot: 0,
        },
        {
          groupId: "side",
          groupName: "Acompañante",
          optionId: "patacon",
          optionName: "Patacón",
          priceSnapshot: 2500,
        },
      ],
      notes: "Sin cilantro",
      total: 84500,
    },
  ],
  totals: {
    subtotal: 84500,
    discount: 5000,
    tax: 6360,
    serviceFee: 0,
    deliveryFee: 0,
    tip: 0,
    total: 85860,
  },
  currency: "COP",
  customer: { name: "Ana Pérez", phone: "+57 300 123 4567", email: "ana@example.com" },
  notes: "Llamar al llegar",
  createdAt: "2026-10-14T12:00:00.000Z",
};

async function seedConfirmationOrder(page: import("@playwright/test").Page, order: Order) {
  await page.evaluate((nextOrder) => {
    window.localStorage.setItem(
      "rb-orders",
      JSON.stringify({ state: { orders: [nextOrder] }, version: 2 }),
    );
  }, order);
}

test.describe("Capturas de revisión visual", () => {
  // Recorre 8 viewports con capturas de página completa: necesita margen.
  test.slow();

  test("onboarding en tamaños clave", async ({ page }) => {
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3], VIEWPORTS[5], VIEWPORTS[7]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await expect(page.getByTestId("landing-page")).toBeVisible();
      await expect
        .poll(() =>
          page
            .getByRole("img", { name: /pescado frito/i })
            .evaluate((element) => (element as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.waitForTimeout(1100); // fin de la secuencia de entrada
      await page.screenshot({ path: `${DIR}/onboarding-${viewport.name}.png`, fullPage: false });
      await page.evaluate(() => window.localStorage.clear());
    }
  });

  test("menú tras completar y visita recurrente", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("link", { name: "Comenzar" }).click();
    await expect(page.getByRole("heading", { name: "Menú", exact: true })).toBeVisible();
    await page.screenshot({ path: `${DIR}/landing-menu-after-start-390x844.png`, fullPage: true });

    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await page.screenshot({ path: `${DIR}/landing-returning-390x844.png`, fullPage: true });
  });

  test("pantallas principales en todos los tamaños", async ({ page }) => {
    await skipOnboarding(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto("/");
      await expect(page.getByTestId("landing-page")).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${DIR}/landing-root-${viewport.name}.png`, fullPage: true });

      await page.goto("/menu");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/menu-${viewport.name}.png`, fullPage: true });
    }
  });

  test("detalle con nombre largo, carrito y checkout", async ({ page }) => {
    await skipOnboarding(page);
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3], VIEWPORTS[5], VIEWPORTS[7]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto(`/plato/${MODIFIER_DISH_SLUG}`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${DIR}/detalle-${viewport.name}.png`, fullPage: true });

      // Carrito con producto.
      await addSimpleDishToCart(page);
      await page.goto("/carrito");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/carrito-${viewport.name}.png`, fullPage: true });

      await page.goto("/checkout");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/checkout-${viewport.name}.png`, fullPage: true });

      if (viewport.name === "320x568" || viewport.name === "390x844") {
        // Estados del checkout que revisamos manualmente en los tamaños objetivo.
        await page.getByRole("button", { name: "Continuar" }).click();
        await page.getByLabel("Nombre completo").fill("Ana Pérez");
        await page.getByLabel("Teléfono").fill("+57 300 123 4567");
        await page.getByLabel("Correo electrónico").fill("ana@example.com");
        await page.screenshot({
          path: `${DIR}/checkout-datos-${viewport.name}.png`,
          fullPage: true,
        });
        await page.getByRole("button", { name: "Continuar" }).click();
        await page.screenshot({
          path: `${DIR}/checkout-revision-${viewport.name}.png`,
          fullPage: true,
        });

        const confirm = page.getByRole("button", { name: /confirmar pedido/i });
        await expect(confirm).toBeVisible();
        await expect(page.getByText(/Stripe|Mercado Pago|Requiere configuración/)).toHaveCount(0);
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

        await page.route("**/api/orders", (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Sin conexión con el servidor. Revisa tu red e intenta de nuevo.",
              code: "network",
            }),
          }),
        );
        await page.getByRole("button", { name: /confirmar pedido/i }).click();
        await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
        await expect(page.getByRole("button", { name: /confirmar pedido/i })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(1);
        const errorColors = await page.locator(".checkout-error-alert").evaluate((alert) => {
          const message = alert.querySelector("p") ?? alert;
          return {
            text: getComputedStyle(message).color,
            background: getComputedStyle(alert).backgroundColor,
          };
        });
        expect(errorColors.text).toBe("rgb(159, 18, 57)");
        expect(errorColors.background).toMatch(/^(rgba?|oklab)\(/);
        await page.screenshot({
          path: `${DIR}/checkout-error-${viewport.name}.png`,
          fullPage: true,
        });
        await page.unroute("**/api/orders");
      }
    }
  });

  test("estados vacío, error 404 y offline", async ({ page }) => {
    await skipOnboarding(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/carrito");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/estado-vacio-390x844.png`, fullPage: true });

    await page.goto("/buscar");
    await page.getByRole("searchbox").first().fill("zzzz sin resultados");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/sin-resultados-390x844.png`, fullPage: true });

    await page.goto("/ruta-inexistente");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/error-404-390x844.png`, fullPage: true });

    await page.goto("/offline");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/offline-390x844.png`, fullPage: true });

    await page.goto("/favoritos");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/favoritos-vacio-390x844.png`, fullPage: true });
  });

  test("comprobante C1 en tamaños móviles y escritorio", async ({ page }) => {
    await skipOnboarding(page);
    await page.request.post("/__nextjs_disable_dev_indicator");
    await page.addInitScript(() => {
      const removeDevPortal = () => {
        document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
      };
      removeDevPortal();
      new MutationObserver(removeDevPortal).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });

    for (const viewport of [
      { name: "320x568", width: 320, height: 568 },
      { name: "390x844", width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/pedido/order-screenshot-c1");
      await seedConfirmationOrder(page, CONFIRMATION_SCREENSHOT_ORDER);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Pedido recibido" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(
        true,
      );
      await page.screenshot({ path: `${DIR}/order-pending-${viewport.name}.png`, fullPage: true });
    }

    const a11yResults = await new AxeBuilder({ page }).analyze();
    expect(
      a11yResults.violations.filter((violation) =>
        ["critical", "serious", "moderate"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);

    const confirmed = { ...CONFIRMATION_SCREENSHOT_ORDER, status: "confirmed" as const };
    await page.setViewportSize({ width: 390, height: 844 });
    await seedConfirmationOrder(page, confirmed);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible();
    await expect(page.getByText("Sopa incluida: Sopa de pescado · COP 0")).toBeVisible();
    await page.screenshot({ path: `${DIR}/order-confirmed-soup-390x844.png`, fullPage: true });

    await page.evaluate(() => window.localStorage.removeItem("rb-orders"));
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "No hay un comprobante guardado en este navegador para este enlace",
      }),
    ).toBeVisible();
    await page.screenshot({ path: `${DIR}/order-missing-local-390x844.png`, fullPage: true });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await seedConfirmationOrder(page, confirmed);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible();
    await page.screenshot({ path: `${DIR}/order-confirmed-1440x1000.png`, fullPage: true });
  });
});
