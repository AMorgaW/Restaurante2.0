import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const ATTEMPT_KEY = "rb-checkout-receipt-attempts";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

const cartSnapshot = {
  state: {
    items: [
      {
        lineId: "dish-mock-c2-2",
        itemId: "mock-item-c2-2",
        slug: "carne-asada-plato-con-cebolleta",
        nameSnapshot: "Carne asada plato con cebolleta",
        unitPriceSnapshot: 30000,
        quantity: 1,
        notes: "Sin cebolla",
        modifiers: [],
        imagePath: "/images/menu/carne-asada-plato-con-cebolleta.webp",
      },
    ],
    branchId: "branch-centro",
    fulfillmentType: "pickup",
    couponCode: null,
    tipPercent: 0,
  },
  version: 2,
};

function mockOrder(customerName = "Ana Pérez") {
  return {
    id: ORDER_ID,
    orderNumber: "CB-MOCK-C22",
    branchId: "branch-centro",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "demo",
    fulfillmentType: "pickup",
    items: [
      {
        itemId: "mock-item-c2-2",
        slug: "carne-asada-plato-con-cebolleta",
        nameSnapshot: "Carne asada plato con cebolleta",
        unitPrice: 30000,
        quantity: 1,
        modifiers: [],
        notes: "Sin cebolla",
        total: 30000,
      },
    ],
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
    customer: { name: customerName, phone: "3000000002", email: "ana@example.com" },
    notes: "",
    createdAt: "2026-10-15T12:00:00.000Z",
  };
}

async function seedCart(page: Page): Promise<void> {
  await page.addInitScript((snapshot) => {
    window.localStorage.setItem("rb-onboarding", JSON.stringify({ state: { seen: true }, version: 1 }));
    window.localStorage.setItem("rb-cart", JSON.stringify(snapshot));
  }, cartSnapshot);
}

async function openReview(page: Page, name = "Ana Pérez"): Promise<void> {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: "Finalizar pedido" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre completo").fill(name);
  await page.getByLabel("Teléfono").fill("+57 300 000 0002");
  await page.getByLabel("Correo electrónico").fill("ana@example.com");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeVisible();
}

async function readRequest(request: Request): Promise<Record<string, unknown>> {
  return JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
}

async function fulfillSuccess(route: Route, customerName = "Ana Pérez"): Promise<void> {
  await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ order: mockOrder(customerName) }) });
}

test.describe("C2.2 checkout con servidor simulado", () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page);
  });

  test("crea una sola credencial, persiste incierto antes del POST y confirma sin filtrar el secreto", async ({ page }) => {
    let requestCount = 0;
    let requestBody: Record<string, unknown> | null = null;
    await page.route("**/api/orders", async (route) => {
      requestCount += 1;
      requestBody = await readRequest(route.request());
      const stored = await page.evaluate((key) => sessionStorage.getItem(key), ATTEMPT_KEY);
      expect(stored).toContain('"state":"uncertain"');
      await fulfillSuccess(route);
    });
    await openReview(page);
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page).toHaveURL(new RegExp(`/pedido/${ORDER_ID}`));
    expect(requestCount).toBe(1);
    const capturedBody = requestBody as unknown as Record<string, unknown>;
    expect(capturedBody.receiptKey).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    expect(capturedBody.idempotencyKey).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/i));
    expect(JSON.stringify(requestBody)).not.toContain("rb-checkout-receipt");
    const stored = await page.evaluate((key) => sessionStorage.getItem(key), ATTEMPT_KEY);
    expect(stored).toContain('"state":"confirmed"');
    expect(await page.evaluate(() => localStorage.getItem("rb-orders"))).not.toContain("receiptKey");
  });

  test("doble toque comparte el mismo POST lógico", async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route("**/api/orders", async (route) => {
      bodies.push(await readRequest(route.request()));
      await new Promise((resolve) => setTimeout(resolve, 120));
      await fulfillSuccess(route);
    });
    await openReview(page);
    const confirm = page.getByRole("button", { name: /confirmar pedido/i });
    await Promise.all([confirm.click(), confirm.click()]);
    await expect(page).toHaveURL(new RegExp(`/pedido/${ORDER_ID}`));
    expect(bodies).toHaveLength(1);
  });

  test("respuesta perdida conserva el par y permite reintento idempotente", async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    let first = true;
    await page.route("**/api/orders", async (route) => {
      bodies.push(await readRequest(route.request()));
      if (first) {
        first = false;
        await route.abort("connectionreset");
        return;
      }
      await fulfillSuccess(route);
    });
    await openReview(page);
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page.getByLabel("Revisión y confirmación").getByRole("alert")).toContainText("Sin conexión con el servidor.");
    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page).toHaveURL(new RegExp(`/pedido/${ORDER_ID}`));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]?.idempotencyKey).toBe(bodies[0]?.idempotencyKey);
    expect(bodies[1]?.receiptKey).toBe(bodies[0]?.receiptKey);
  });

  test("recarga conserva el intento incierto y bloquea datos comerciales distintos", async ({ page }) => {
    let first = true;
    const bodies: Record<string, unknown>[] = [];
    await page.route("**/api/orders", async (route) => {
      bodies.push(await readRequest(route.request()));
      if (first) {
        first = false;
        await route.abort("connectionreset");
        return;
      }
      await fulfillSuccess(route);
    });
    await openReview(page);
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page.getByLabel("Revisión y confirmación").getByRole("alert")).toContainText("Sin conexión con el servidor.");
    await page.reload();
    await openReview(page, "Otro cliente");
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page.getByLabel("Revisión y confirmación").getByRole("alert")).toContainText("otros datos");
    expect(bodies).toHaveLength(1);
  });

  test("recarga con los mismos datos permite reintentar con el mismo par", async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    let first = true;
    await page.route("**/api/orders", async (route) => {
      bodies.push(await readRequest(route.request()));
      if (first) {
        first = false;
        await route.abort("connectionreset");
        return;
      }
      await fulfillSuccess(route);
    });
    await openReview(page);
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page.getByLabel("Revisión y confirmación").getByRole("alert")).toContainText("Sin conexión");
    await page.reload();
    await openReview(page);
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page).toHaveURL(new RegExp(`/pedido/${ORDER_ID}`));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]?.idempotencyKey).toBe(bodies[0]?.idempotencyKey);
    expect(bodies[1]?.receiptKey).toBe(bodies[0]?.receiptKey);
  });

  test("clasifica 23505, 42501 y wrapper ausente sin éxito falso", async ({ page }) => {
    for (const response of [
      { status: 409, error: "El intento ya existe con otros datos.", code: "idempotency-conflict" },
      { status: 409, error: "Comprobante no disponible.", code: "receipt-unavailable" },
      { status: 503, error: "La recuperación del comprobante no está disponible.", code: "receipt-recovery-unavailable" },
    ]) {
      let calls = 0;
      await page.route("**/api/orders", async (route) => {
        calls += 1;
        await route.fulfill({ status: response.status, contentType: "application/json", body: JSON.stringify(response) });
      });
      await openReview(page);
      await page.getByRole("button", { name: /confirmar pedido/i }).click();
      await expect(page.getByLabel("Revisión y confirmación").getByRole("alert")).toContainText(response.error);
      await expect(page.getByRole("heading", { name: "Revisa tu pedido" })).toBeVisible();
      expect(calls).toBe(1);
      await page.unroute("**/api/orders");
      await page.evaluate((key) => { sessionStorage.removeItem(key); localStorage.removeItem("rb-orders"); }, ATTEMPT_KEY);
    }
  });

  test("bloquea antes del POST cuando las ocho plazas ya están reservadas", async ({ page }) => {
    await page.addInitScript((key) => {
      const encodeCanonicalBase64Url = (bytes: Uint8Array): string =>
        btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/u, "");
      const confirmed = Array.from({ length: 8 }, (_, index) => ({
        version: 1,
        state: "confirmed",
        idempotencyKey: `66666666-6666-4666-8666-66666666666${index}`,
        receiptKey: encodeCanonicalBase64Url(new Uint8Array(32).fill(index + 1)),
        commercialFingerprint: encodeCanonicalBase64Url(new Uint8Array(32).fill(index + 101)),
        createdAt: "2026-10-15T12:00:00.000Z",
        updatedAt: "2026-10-15T12:00:00.000Z",
        orderId: `77777777-7777-4777-8777-77777777777${index}`,
      }));
      window.sessionStorage.setItem(key, JSON.stringify({ version: 1, pending: null, confirmed }));
    }, ATTEMPT_KEY);

    let requestCount = 0;
    await page.route("**/api/orders", async (route) => {
      requestCount += 1;
      await fulfillSuccess(route);
    });
    await openReview(page);
    const before = await page.evaluate((key) => sessionStorage.getItem(key), ATTEMPT_KEY);
    const fixture = await page.evaluate((key) => {
      const envelope = JSON.parse(sessionStorage.getItem(key) ?? "null") as {
        pending: unknown;
        confirmed: Array<{ idempotencyKey: string; receiptKey: string; commercialFingerprint: string }>;
      };
      const isCanonical32ByteBase64Url = (value: string): boolean => {
        if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
        const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=";
        const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
        const roundTrip = btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/u, "");
        return bytes.length === 32 && roundTrip === value;
      };
      return {
        pending: envelope.pending,
        confirmed: envelope.confirmed.map((entry) => ({
          idempotencyKey: /^[0-9a-f-]{36}$/i.test(entry.idempotencyKey),
          receiptKey: isCanonical32ByteBase64Url(entry.receiptKey),
          commercialFingerprint: isCanonical32ByteBase64Url(entry.commercialFingerprint),
        })),
      };
    }, ATTEMPT_KEY);
    expect(fixture.pending).toBeNull();
    expect(fixture.confirmed).toHaveLength(8);
    expect(fixture.confirmed.every((entry) => Object.values(entry).every(Boolean))).toBe(true);
    await page.getByRole("button", { name: /confirmar pedido/i }).click();
    await expect(page.getByLabel("Revisión y confirmación").getByRole("alert")).toContainText(
      "máximo de comprobantes",
    );
    expect(requestCount).toBe(0);
    const after = await page.evaluate((key) => sessionStorage.getItem(key), ATTEMPT_KEY);
    expect(after).toBe(before);
  });
});
