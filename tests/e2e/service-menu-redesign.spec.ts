import { expect, test, type Page } from "@playwright/test";
import { SIMPLE_DISH_NAME, SIMPLE_DISH_SLUG } from "./helpers";

const atBogota = (time: string) => new Date(`2026-07-21T${time}-05:00`);

async function openAt(page: Page, path: string, time: string) {
  await page.clock.setFixedTime(atBogota(time));
  await page.goto(path);
}

test.describe("servicio automático", () => {
  for (const [time, period] of [
    ["06:59:59", "closed"],
    ["07:00:00", "lunch"],
    ["16:59:59", "lunch"],
    ["17:00:00", "dinner"],
    ["21:59:59", "dinner"],
    ["22:00:00", "closed"],
  ] as const) {
    test(`${time} → ${period}`, async ({ page }) => {
      await openAt(page, "/menu", time);
      await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", period);
    });
  }

  test("el estado no ofrece controles para cambiar manualmente", async ({ page }) => {
    await openAt(page, "/menu", "12:00:00");
    await expect(page.getByTestId("service-status").getByRole("button")).toHaveCount(0);
    await expect(page.getByTestId("service-status").getByRole("tab")).toHaveCount(0);
  });
});

test.describe("sopa incluida y carrito", () => {
  test("almuerzo muestra sopas y la acción rápida abre la elección", async ({ page }) => {
    await openAt(page, "/menu", "12:00:00");
    await expect(page.getByTestId("lunch-soup-banner")).toBeVisible();
    await page.getByRole("link", { name: /elegir sopa para/i }).first().click();
    await expect(page).toHaveURL(/\/plato\//);
    await expect(page.getByTestId("included-soup-selector")).toBeVisible();
  });

  test("selección y Sin sopa actualizan el resumen y el carrito", async ({ page }) => {
    await openAt(page, `/plato/${SIMPLE_DISH_SLUG}`, "12:00:00");
    const soupRadio = page.getByRole("radio").filter({ hasNotText: "Sin sopa" }).first();
    await expect(soupRadio).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Sin sopa" }).click();
    await expect(page.getByTestId("detail-order-summary")).toContainText("Sin sopa");
    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("rb-cart") ?? "{}"));
    expect(cart.state.items[0].nameSnapshot).toBe(SIMPLE_DISH_NAME);
    expect(cart.state.items[0].modifiers[0].optionId).toBe("no-soup");
  });

  test("cena no muestra sopa y añade el plato sin ella", async ({ page }) => {
    await openAt(page, `/plato/${SIMPLE_DISH_SLUG}`, "18:00:00");
    await expect(page.getByTestId("included-soup-selector")).toHaveCount(0);
    await expect(page.getByText("Incluye sopa")).toHaveCount(0);
    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    const modifiers = await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem("rb-cart") ?? "{}");
      return cart.state.items[0].modifiers;
    });
    expect(modifiers).toEqual([]);
  });

  test("cerrado bloquea nuevas adiciones sin vaciar el carrito", async ({ page }) => {
    await openAt(page, `/plato/${SIMPLE_DISH_SLUG}`, "23:00:00");
    await expect(page.getByRole("button", { name: "Cerrado" })).toBeDisabled();
    await expect(page.getByText(/puedes consultar el menú/i)).toBeVisible();
  });
});

test.describe("contratos visuales y de interacción", () => {
  test("detalle compacto de 320 px conserva controles sin overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openAt(page, `/plato/${SIMPLE_DISH_SLUG}`, "12:00:00");
    const summary = page.getByTestId("detail-order-summary");
    const cta = page.locator(".detail-cta");
    await expect(summary).toBeVisible();

    const metrics = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    });
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(metrics.vertical);
    const summaryBox = await summary.boundingBox();
    const ctaBox = await cta.boundingBox();
    const optionHeights = await page.getByRole("radio").evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
    );

    expect(metrics.horizontal).toBeLessThanOrEqual(1);
    expect(summaryBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(ctaBox!.y + 1);
    expect(optionHeights.every((height) => height >= 44)).toBe(true);
    console.info(`[320x568] overflow vertical=${metrics.vertical}px; horizontal=${metrics.horizontal}px; clearance=${Math.round(ctaBox!.y - summaryBox!.y - summaryBox!.height)}px`);
  });

  test("detalle elimina término, notas y relacionados y conserva dish-<slug>", async ({ page }) => {
    await openAt(page, `/plato/${SIMPLE_DISH_SLUG}`, "12:00:00");
    await expect(page.getByText(/término de la carne/i)).toHaveCount(0);
    await expect(page.getByText(/notas para la cocina/i)).toHaveCount(0);
    await expect(page.getByText(/también te puede gustar/i)).toHaveCount(0);
    const names = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("*")]
        .map((node) => getComputedStyle(node).viewTransitionName)
        .filter((name) => name && name !== "none"),
    );
    expect(names.filter((name) => name === `dish-${SIMPLE_DISH_SLUG}`)).toHaveLength(1);
  });

  test("sin errores de hidratación y reduced motion desactiva el reflejo", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || /hydration|did not match/i.test(message.text())) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openAt(page, "/menu", "12:00:00");
    const animationName = await page.getByTestId("menu-card-panel").first().evaluate((node) =>
      getComputedStyle(node, "::after").animationName,
    );
    expect(animationName).toBe("none");
    expect(errors).toEqual([]);
  });
});
