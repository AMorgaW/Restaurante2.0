import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { MODIFIER_DISH_SLUG, SIMPLE_DISH_NAME, SIMPLE_DISH_SLUG } from "./helpers";

const phase = process.env.EVIDENCE_PHASE === "after" ? "after" : "before";
const evidenceDir = "artifacts/visual-comparison/work/interface-abc-redesign";

test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
});

function auditRuntime(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: Array<{ method: string; url: string; type: string; error: string }> = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push({
      method: request.method(),
      url: request.url(),
      type: request.resourceType(),
      error: request.failure()?.errorText ?? "failed",
    });
  });
  return () => {
    const actionableErrors = errors.filter(
      (message) => !/hydration|did not match/i.test(message),
    );
    expect(actionableErrors, actionableErrors.join("\n")).toEqual([]);
    // Clock de Playwright vs SSR en next dev genera hydration de service-period;
    // no es defecto de producción. Seguimos fallando por TypeError/view transition.
    expect(
      warnings.filter((warning) => /typeerror|view transition/i.test(warning)),
      warnings.join("\n"),
    ).toEqual([]);
    const actionablePageErrors = pageErrors.filter(
      (message) => !/hydration|did not match/i.test(message),
    );
    expect(actionablePageErrors, actionablePageErrors.join("\n")).toEqual([]);
    const unexpectedRequestFailures = requestFailures.filter((failure) => {
      const url = new URL(failure.url);
      const expectedNavigationCancellation = failure.method === "GET" &&
        failure.error.includes("net::ERR_ABORTED") &&
        (url.searchParams.has("_rsc") || url.pathname.startsWith("/_next/image"));
      const expectedPromotionsPrefetchCancellation = failure.method === "GET" &&
        failure.type === "script" &&
        failure.error.includes("net::ERR_ABORTED") &&
        /^\/_next\/static\/chunks\/app\/\(shell\)\/promociones\/page-[^/]+\.js$/.test(url.pathname);
      return !expectedNavigationCancellation && !expectedPromotionsPrefetchCancellation;
    });
    expect(unexpectedRequestFailures, JSON.stringify(unexpectedRequestFailures, null, 2)).toEqual([]);
  };
}

async function settleMenu(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Menú", exact: true })).toBeVisible();
  await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
  await expect(page.getByTestId("menu-grid").locator("> div").first()).toHaveCSS("opacity", "1");
}

test("evidencia visual de portada, menú y tarjetas", async ({ page }) => {
  const expectCleanRuntime = auditRuntime(page);
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("landing-page")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/${phase}-landing-390x844.png`, fullPage: false });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByTestId("landing-page")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/${phase}-landing-1440x1000.png`, fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu");
  await settleMenu(page);
  await expect(page.getByRole("group", { name: "Filtrar por categoría" }).locator("..")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByRole("button", { name: "Todas", exact: true }).locator("..")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({ path: `${evidenceDir}/${phase}-menu-390x844.png`, fullPage: false });

  const firstCard = page.getByTestId("menu-dish-row").first();
  await firstCard.screenshot({ path: `${evidenceDir}/${phase}-card-normal-390x844.png` });
  await firstCard.hover();
  await firstCard.screenshot({ path: `${evidenceDir}/${phase}-card-hover-390x844.png` });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/menu");
  await settleMenu(page);
  await page.screenshot({ path: `${evidenceDir}/${phase}-menu-1440x1000.png`, fullPage: false });
  expectCleanRuntime();
});

test("evidencia visual de detalle y reduced motion", async ({ page }) => {
  const expectCleanRuntime = auditRuntime(page);
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
  await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
  await expect(page.getByTestId("detail-image-container").locator("..")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: `${evidenceDir}/${phase}-detail-initial-390x844.png`, fullPage: false });

  await page.goto(`/plato/${MODIFIER_DISH_SLUG}`);
  await expect(page.getByTestId("included-soup-selector")).toBeVisible();
  await page.getByRole("radio", { name: /Sopa de/ }).first().click();
  await expect(page.getByRole("button", { name: "Añadir al carrito" })).toBeEnabled();
  await expect(page.getByTestId("detail-image-container").locator("..")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: `${evidenceDir}/${phase}-detail-validation-390x844.png`, fullPage: false });

  const personalization = page.locator("details[data-testid='product-personalization']");
  if ((await personalization.count()) > 0) {
    await personalization.scrollIntoViewIfNeeded();
    const summary = personalization.locator("summary");
    if (await personalization.evaluate((element) => (element as HTMLDetailsElement).open)) {
      await summary.click();
    }
    await personalization.screenshot({ path: `${evidenceDir}/${phase}-detail-collapsed-390x844.png` });
    await summary.click();
    await expect(personalization).toHaveAttribute("open", "");
    await personalization.screenshot({ path: `${evidenceDir}/${phase}-detail-expanded-390x844.png` });
  } else {
    const firstModifier = page.getByRole("radio").first();
    await firstModifier.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceDir}/${phase}-detail-expanded-390x844.png`, fullPage: false });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/menu");
  await settleMenu(page);
  await expect(page.getByRole("group", { name: "Filtrar por categoría" }).locator("..")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByRole("button", { name: "Todas", exact: true }).locator("..")).toHaveCSS(
    "opacity",
    "1",
  );
  const reducedLayout = await page.evaluate(() => {
    const search = document.querySelector('[role="searchbox"]');
    const chips = document.querySelector('[role="group"][aria-label]');
    const toolbar = document.querySelector(".menu-toolbar");
    const searchBox = search?.getBoundingClientRect();
    const chipsBox = chips?.getBoundingClientRect();
    const toolbarBox = toolbar?.getBoundingClientRect();
    return {
      gap: chipsBox && toolbarBox ? toolbarBox.top - chipsBox.bottom : Number.POSITIVE_INFINITY,
      searchGap: searchBox && chipsBox ? chipsBox.top - searchBox.bottom : Number.POSITIVE_INFINITY,
      chipsOpacity: chips ? getComputedStyle(chips).opacity : "missing",
      chipsParent: chips?.parentElement?.getBoundingClientRect().toJSON() ?? null,
      scrollY: window.scrollY,
    };
  });
  expect(reducedLayout.scrollY).toBe(0);
  expect(reducedLayout.gap).toBeLessThan(48);
  expect(reducedLayout.searchGap, JSON.stringify(reducedLayout)).toBeLessThan(48);
  await page.screenshot({ path: `${evidenceDir}/${phase}-reduced-motion-390x844.png`, fullPage: false });
  expectCleanRuntime();
});
