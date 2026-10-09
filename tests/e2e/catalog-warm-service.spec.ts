import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

const evidenceDir = "artifacts/visual-comparison/work/catalog-warm-t5";

async function paint(page: Page, path: string, time: string) {
  await page.clock.setFixedTime(new Date(`2026-07-21T${time}-05:00`));
  await page.goto(path);
}

async function expectVisibleDuringHydration(page: Page, testId: string) {
  const node = page.getByTestId(testId);
  await expect(node).toBeVisible();
  const opacity = await node.evaluate((element) => {
    const parent = element.parentElement;
    return {
      self: getComputedStyle(element).opacity,
      parent: parent ? getComputedStyle(parent).opacity : "1",
    };
  });
  expect(opacity.self).toBe("1");
  expect(opacity.parent).toBe("1");
}

test.describe("indicadores, sopas y buscador cálidos", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("almuerzo muestra servicio, sopas y buscador sobre el lienzo cálido", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error" || /hydration|did not match/i.test(text)) problems.push(text);
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await paint(page, "/menu", "12:00:00");
    await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", "lunch");
    await expectVisibleDuringHydration(page, "service-status");
    await expectVisibleDuringHydration(page, "lunch-soup-banner");
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCSS("opacity", "1");

    const lunch = page.getByRole("listitem").filter({ hasText: "Almuerzo" });
    const dinner = page.getByRole("listitem").filter({ hasText: "Cena" });
    await expect(lunch).toHaveAttribute("aria-current", "true");
    await expect(lunch).toContainText("Disponible hasta las 5:00 p. m.");
    await expect(dinner).not.toHaveAttribute("aria-current", "true");
    await expect(dinner).toContainText("5:00 p. m. – 10:00 p. m.");
    await expect(page.getByTestId("service-status").getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sopa incluida con el almuerzo" })).toBeVisible();
    await expect(page.getByText("Sopa de maíz con arroz y frijoles")).toBeVisible();
    await expect(page.getByText("Elige una en el detalle del plato o pide sin sopa.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por separado" })).toBeVisible();
    await expect(page.getByTestId("separate-portions-note")).toHaveAttribute("data-flexible-orders", "pending");
    await expect(page.getByTestId("included-soup-lane")).toHaveCSS("background-color", "rgb(244, 251, 247)");
    await expect(page.getByTestId("separate-portions-note")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const borders = await page.evaluate(() => {
      const included = document.querySelector("[data-testid='included-soup-lane']");
      const separate = document.querySelector("[data-testid='separate-portions-note']");
      return {
        included: included ? getComputedStyle(included).borderTopStyle : "",
        separate: separate ? getComputedStyle(separate).borderTopStyle : "",
      };
    });
    expect(borders.included).toBe("solid");
    expect(borders.separate).toBe("dashed");

    await expect(page.getByTestId("catalog-masthead")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(lunch).toHaveCSS("background-color", "rgb(19, 106, 87)");
    await expect(lunch).toHaveCSS("color", "rgb(255, 246, 232)");
    await expect(dinner).toHaveCSS("color", "rgb(60, 77, 104)");
    await expect(page.getByRole("heading", { name: "Sopa incluida con el almuerzo" })).toHaveCSS("color", "rgb(16, 29, 57)");
    await expect(page.getByRole("searchbox")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.getByRole("searchbox")).toHaveCSS("color", "rgb(16, 29, 57)");
    await expect(page.getByRole("heading", { name: "Menú", exact: true })).toHaveCSS("color", "rgb(16, 29, 57)");
    const mastheadMotion = await page.getByTestId("catalog-masthead").evaluate((element) => {
      const style = getComputedStyle(element);
      return { name: style.animationName, opacity: style.opacity };
    });
    expect(mastheadMotion.opacity).toBe("1");
    expect(mastheadMotion.name).toBe("catalog-masthead-enter");
    await page.getByTestId("catalog-masthead").evaluate((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.style.animation = "none";
      void element.offsetWidth;
      element.style.animation = "catalog-masthead-enter 1.6s cubic-bezier(0.22, 1, 0.36, 1) both paused";
      element.style.animationDelay = "-0.42s";
    });
    await page.screenshot({ path: `${evidenceDir}/menu-masthead-motion-390x844.png` });
    await page.getByTestId("catalog-masthead").evaluate((element) => {
      element.style.animation = "";
      element.style.animationDelay = "";
    });

    const search = page.getByRole("searchbox");
    await search.focus();
    await expect(search).toHaveCSS("outline-color", "rgb(19, 106, 87)");
    await expect(async () => {
      await search.fill("maíz");
      await expect(search).toHaveValue("maíz");
    }).toPass();
    const clear = page.getByRole("button", { name: "Limpiar búsqueda" });
    await expect(clear).toBeVisible();
    const clearBox = await clear.boundingBox();
    expect(clearBox?.width ?? 0).toBeGreaterThanOrEqual(40);
    expect(clearBox?.height ?? 0).toBeGreaterThanOrEqual(40);
    await page.screenshot({ path: `${evidenceDir}/menu-search-390x844.png` });
    await clear.click();
    await expect(search).toHaveValue("");

    const card = page.getByTestId("menu-dish-row").first();
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("h3")).toHaveCSS("color", "rgb(16, 29, 57)");
    await expect(card.getByTestId("menu-card-panel")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(card.getByText("Puede llevar sopa")).toBeVisible();
    await expect(card).toHaveCSS("animation-name", "menu-card-rise");
    await page.screenshot({ path: `${evidenceDir}/menu-cards-390x844.png` });

    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(problems, problems.join("\n")).toEqual([]);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
    await page.screenshot({ path: `${evidenceDir}/menu-lunch-390x844.png` });
  });

  test("cena oculta las sopas y marca el periodo activo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await paint(page, "/menu", "18:00:00");
    await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", "dinner");
    await expectVisibleDuringHydration(page, "service-status");
    await expect(page.getByTestId("lunch-soup-banner")).toHaveCount(0);
    await expect(page.getByText("Puede llevar sopa")).toHaveCount(0);
    const dinner = page.getByRole("listitem").filter({ hasText: "Cena" });
    const lunch = page.getByRole("listitem").filter({ hasText: "Almuerzo" });
    await expect(dinner).toHaveAttribute("aria-current", "true");
    await expect(dinner).toContainText("Disponible hasta las 10:00 p. m.");
    await expect(dinner).toHaveCSS("background-color", "rgb(19, 106, 87)");
    await expect(lunch).toContainText("7:00 a. m. – 5:00 p. m.");
    await expect(page.getByRole("searchbox")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
    await page.screenshot({ path: `${evidenceDir}/menu-dinner-390x844.png` });
  });

  test("cerrado conserva el aviso y no ofrece sopas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await paint(page, "/menu", "23:00:00");
    await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", "closed");
    await expect(page.getByTestId("service-status")).toContainText("Cerrado");
    await expect(page.getByTestId("service-status")).toContainText("Abrimos a las 7:00 a. m.");
    await expect(page.getByTestId("lunch-soup-banner")).toHaveCount(0);
    await expect(page.getByTestId("service-status").getByRole("button")).toHaveCount(0);
    await expect(page.locator(".service-closed")).toHaveCSS("color", "rgb(159, 18, 57)");
    await expect(page.getByRole("searchbox")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
    await page.screenshot({ path: `${evidenceDir}/menu-closed-390x844.png` });
  });

  test("escritorio y 320 px conservan el bloque cálido sin scroll horizontal", async ({ page }) => {
    for (const viewport of [
      { width: 320, height: 568, shot: "menu-lunch-320x568.png" },
      { width: 1440, height: 1000, shot: "menu-lunch-1440x1000.png" },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await paint(page, "/menu", "12:00:00");
      await expect(page.getByTestId("lunch-soup-banner")).toBeVisible();
      await expect(page.getByRole("searchbox")).toBeVisible();
      expect(await expectNoHorizontalScroll(page), viewport.shot).toBe(true);
      await page.screenshot({ path: `${evidenceDir}/${viewport.shot}` });
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await paint(page, "/menu", "18:00:00");
    await expect(page.getByTestId("lunch-soup-banner")).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "Cena" })).toHaveAttribute("aria-current", "true");
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: `${evidenceDir}/menu-dinner-1440x1000.png` });
  });

  test("buscar reutiliza el campo cálido", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await paint(page, "/buscar", "12:00:00");
    const search = page.getByRole("searchbox");
    await expect(search).toBeVisible();
    await expect(search).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(search).toHaveCSS("color", "rgb(16, 29, 57)");
    await page.screenshot({ path: `${evidenceDir}/buscar-lunch-390x844.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${evidenceDir}/buscar-lunch-1440x1000.png` });
  });

  test("administración conserva el buscador navy", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-admin",
        JSON.stringify({
          state: { demoRole: "owner", demoSessionActive: true, overrides: {} },
          version: 2,
        }),
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await paint(page, "/admin/platos", "12:00:00");
    await expect(page.getByRole("heading", { name: "Platos" })).toBeVisible();
    await expect(page.locator(".catalog-shell")).toHaveCount(0);
    const search = page.getByRole("searchbox");
    await expect(search).toBeVisible();
    const background = await search.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).not.toBe("rgb(255, 255, 255)");
    await page.screenshot({ path: `${evidenceDir}/admin-platos-390x844.png` });
  });
});

test.describe("servicio cálido con movimiento reducido", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("almuerzo, cena y buscador quedan visibles", async ({ page }) => {
    await skipOnboarding(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await paint(page, "/menu", "12:00:00");
    await expectVisibleDuringHydration(page, "service-status");
    await expectVisibleDuringHydration(page, "lunch-soup-banner");
    await expect(page.getByRole("searchbox")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("listitem").filter({ hasText: "Almuerzo" })).toHaveCSS("background-color", "rgb(19, 106, 87)");
    await expect(page.getByTestId("catalog-masthead")).toHaveCSS("animation-name", "none");
    await expect(page.getByTestId("catalog-masthead")).toHaveCSS("opacity", "1");
    await expect(page.getByTestId("menu-dish-row").first()).toHaveCSS("animation-name", "none");
    const transition = await page.locator(".service-period-active").evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(
      transition.split(",").every((part) => {
        const value = part.trim();
        return value === "0s" || value === "0.001s" || value.startsWith("0.001");
      }),
    ).toBe(true);
    await page.screenshot({ path: `${evidenceDir}/menu-lunch-reduced-390x844.png` });

    await paint(page, "/menu", "18:00:00");
    await expectVisibleDuringHydration(page, "service-status");
    await expect(page.getByTestId("lunch-soup-banner")).toHaveCount(0);
    await expect(page.getByRole("searchbox")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("listitem").filter({ hasText: "Cena" })).toBeVisible();
  });
});
