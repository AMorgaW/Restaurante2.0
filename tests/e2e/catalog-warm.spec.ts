import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

const evidenceDir = "artifacts/visual-comparison/work/catalog-warm-t0-t1";

async function expectNoHydrationErrors(page: Page, problems: string[]) {
  expect(problems, problems.join("\n")).toEqual([]);
}

test.describe("tema cálido del catálogo y cabecera", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.clock.install({ time: new Date("2026-07-21T12:00:00-05:00") });
  });

  test("el menú usa lienzo crema, marca visible y piezas navy legibles", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error" || /hydration|did not match/i.test(text)) problems.push(text);
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
    await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
    await expect(page.locator("header")).toHaveCSS("opacity", "1");

    const shell = page.locator(".catalog-shell");
    await expect(shell).toHaveCount(1);
    await expect(page.locator("header")).not.toHaveCount(0);
    const headerOutsideMain = await page.locator("header").evaluate((header) => {
      return header.closest("main") === null && header.parentElement?.classList.contains("catalog-shell") === true;
    });
    expect(headerOutsideMain).toBe(true);

    await expect(page.locator("header").getByText("Brisas del Sinú")).toBeVisible();
    await expect(page.locator("footer").getByText("Casa Brasa", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al menú" })).toBeVisible();
    await expect(page.getByTestId("menu-user-entry")).toHaveAttribute("aria-label", "Iniciar sesión");
    await expect(page.getByRole("link", { name: "Ver favoritos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver carrito", exact: true })).toBeVisible();

    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(body).toBe("rgb(255, 246, 232)");

    const headingColor = await page.getByRole("heading", { name: "Menú" }).evaluate((element) => getComputedStyle(element).color);
    expect(headingColor).toBe("rgb(16, 29, 57)");
    const titleColor = await page.getByTestId("menu-dish-row").first().locator("h3").evaluate((element) => getComputedStyle(element).color);
    expect(titleColor).toBe("rgb(16, 29, 57)");
    const searchColor = await page.getByRole("searchbox").evaluate((element) => getComputedStyle(element).color);
    expect(searchColor).toBe("rgb(16, 29, 57)");

    const panel = await page.getByTestId("menu-card-panel").first().evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(panel).toBe("rgb(255, 255, 255)");

    for (const name of ["Ver favoritos", "Ver carrito"] as const) {
      const box = await page.getByRole("link", { name, exact: true }).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const account = await page.getByTestId("menu-user-entry").boundingBox();
    expect(account?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(account?.height ?? 0).toBeGreaterThanOrEqual(44);

    await expectNoHydrationErrors(page, problems);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
  });

  test("no hay scroll horizontal y la cabecera cabe en 320 y en escritorio", async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 568, shot: "menu-320x568.png" },
      { width: 390, height: 844, shot: "menu-390x844.png" },
      { width: 1440, height: 1000, shot: "menu-1440x1000.png" },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/menu");
      await expect(page.locator("header").getByText("Brisas del Sinú")).toBeVisible();
      await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
      await expect(page.locator("header")).toHaveCSS("opacity", "1");
      expect(await expectNoHorizontalScroll(page)).toBe(true);
      await page.screenshot({ path: `${evidenceDir}/${viewport.shot}` });
    }
  });

  test("buscar y favoritos comparten el shell cálido", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/buscar");
    await expect(page.locator(".catalog-shell")).toHaveCount(1);
    await expect(page.locator("header").getByText("Brisas del Sinú")).toBeVisible();
    const searchBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(searchBody).toBe("rgb(255, 246, 232)");

    await page.goto("/favoritos");
    await expect(page.locator(".catalog-shell")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toBeVisible();
    await expect(page.locator("header").getByText("Brisas del Sinú")).toBeVisible();
  });

  test("carrito, administración y empleados conservan el navy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/carrito");
    await expect(page.locator(".catalog-shell")).toHaveCount(0);
    await expect(page.locator("header").getByText("Casa Brasa", { exact: true })).toBeVisible();
    await expect(page.locator("header").getByText("Brisas del Sinú")).toHaveCount(0);
    const cartBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(cartBody).toBe("rgb(2, 1, 24)");
    await expect(page.getByTestId("menu-user-entry")).toBeVisible();
    await page.screenshot({ path: `${evidenceDir}/carrito-390x844.png` });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${evidenceDir}/carrito-1440x1000.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await expect(page.locator(".catalog-shell")).toHaveCount(0);
    const adminBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(adminBody).toBe("rgb(2, 1, 24)");
    await page.screenshot({ path: `${evidenceDir}/admin-390x844.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${evidenceDir}/admin-1440x1000.png` });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/empleado");
    await expect(page.locator(".catalog-shell")).toHaveCount(0);
    const employeeBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(employeeBody).toBe("rgb(2, 1, 24)");
    await page.screenshot({ path: `${evidenceDir}/empleado-390x844.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${evidenceDir}/empleado-1440x1000.png` });
  });
});

test.describe("cabecera con movimiento reducido", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("la cabecera queda visible sin la entrada", async ({ page }) => {
    await skipOnboarding(page);
    await page.clock.install({ time: new Date("2026-07-21T12:00:00-05:00") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu");
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS("opacity", "1");
    await expect(header).not.toHaveClass(/menu-header-enter/);
    await expect(header.getByText("Brisas del Sinú")).toBeVisible();
  });
});
