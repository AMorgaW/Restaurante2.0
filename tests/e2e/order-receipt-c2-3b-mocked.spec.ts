import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const validKey = "A".repeat(43);
const receipt = {
  orderNumber: "BS-1001",
  status: "confirmed",
  paymentStatus: "pending",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  branchName: "Sucursal Centro",
  currency: "COP",
  items: [{ name: "Plato snapshot", quantity: 1, modifiers: [{ groupName: "Sopa", optionName: "Snapshot", price: 0 }], total: 24000 }],
  subtotal: 24000,
  discount: 0,
  tax: 0,
  serviceFee: 0,
  deliveryFee: 0,
  tip: 0,
  total: 24000,
};

test("aplica las cabeceras de seguridad efectivas de Next.js al endpoint", async ({ request }) => {
  const cases = [
    { name: "malformada", body: JSON.stringify({ receiptKey: "not-a-key" }), expectedStatus: 404 },
    { name: "excesiva", body: JSON.stringify({ receiptKey: "A".repeat(43), padding: "x".repeat(1100) }), expectedStatus: 413 },
    { name: "infraestructura", body: JSON.stringify({ receiptKey: validKey }), expectedStatus: 503 },
  ];

  for (const testCase of cases) {
    const response = await request.post("/api/order-receipt", {
      headers: { "content-type": "application/json" },
      data: testCase.body,
    });
    expect(response.status(), testCase.name).toBe(testCase.expectedStatus);
    expect(response.headers()["referrer-policy"], testCase.name).toBe("no-referrer");
    expect(response.headers()["cache-control"], testCase.name).toContain("no-store");
    expect(response.headers()["cache-control"], testCase.name).toContain("private");
    expect(response.headers()["x-robots-tag"], testCase.name).toContain("noindex");
    expect(response.headers()["x-content-type-options"], testCase.name).toBe("nosniff");
  }
});

test("recupera un comprobante solo por POST y no conserva la clave en la URL", async ({ page }) => {
  const posts: string[] = [];
  const methods: string[] = [];
  const statuses: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/order-receipt")) statuses.push(response.status());
  });
  await page.route("**/api/order-receipt**", async (route) => {
    posts.push(route.request().postData() ?? "");
    methods.push(route.request().method());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ receipt }) });
  });
  await page.goto("http://127.0.0.1:3211/pedido/recuperar", { waitUntil: "networkidle" });
  const input = page.getByLabel("Clave de recuperación");
  await input.waitFor({ state: "visible" });
  const visibilityToggle = page.getByRole("button", { name: "Mostrar clave" });
  await visibilityToggle.click();
  await expect(input).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar clave" }).click();
  await input.fill(validKey);
  await expect(input).toHaveValue(validKey);
  await input.press("Tab");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.getByRole("button", { name: "Consultar comprobante" }).click();
  await expect(page.getByText("Comprobante recuperado")).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(methods).toEqual(["POST"]);
  expect(statuses).toEqual([200]);
  expect(JSON.parse(posts[0]!).receiptKey).toBe(validKey);
  expect(page.url()).not.toContain(validKey);
  await page.reload();
  await expect(page.getByLabel("Clave de recuperación")).toBeVisible();
  expect(page.url()).not.toContain(validKey);
});

test("mantiene una respuesta de clave no disponible neutral", async ({ page }) => {
  let postCount = 0;
  const methods: string[] = [];
  await page.route("**/api/order-receipt**", async (route) => {
    postCount += 1;
    methods.push(route.request().method());
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No disponible", code: "receipt-unavailable" }) });
  });
  await page.goto("http://127.0.0.1:3211/pedido/recuperar", { waitUntil: "networkidle" });
  const input = page.getByLabel("Clave de recuperación");
  await input.waitFor({ state: "visible" });
  const visibilityToggle = page.getByRole("button", { name: "Mostrar clave" });
  await visibilityToggle.click();
  await expect(input).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar clave" }).click();
  await input.fill(validKey);
  await expect(input).toHaveValue(validKey);
  await input.press("Tab");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.getByRole("button", { name: "Consultar comprobante" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("No hay un comprobante disponible");
  await expect(input).toHaveValue("");
  expect(postCount).toBe(1);
  expect(methods).toEqual(["POST"]);
  expect(page.url()).not.toContain(validKey);
  expect(await page.evaluate(() => {
    const entries = [...Object.entries(localStorage), ...Object.entries(sessionStorage)];
    return entries.some(([key, value]) => /receipt[-_]?key|guest[-_]?receipt/i.test(key) || /receipt[-_]?key|guest[-_]?receipt/i.test(value));
  })).toBe(false);
});

test("no tiene infracciones axe critical, serious o moderate", async ({ page }) => {
  await page.goto("/pedido/recuperar");
  const results = await new AxeBuilder({ page }).analyze();
  const relevant = results.violations.filter((violation) => ["critical", "serious", "moderate"].includes(violation.impact ?? ""));
  expect(relevant).toEqual([]);
});
