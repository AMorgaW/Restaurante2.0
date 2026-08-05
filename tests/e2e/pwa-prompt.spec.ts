import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

// The install event and client hydration share the browser lifecycle. Keep the
// prompt scenarios serial so their timing remains representative in WebKit too.
test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "allow" });

const PROMPT_TITLE = "Pide más rápido desde tu inicio";

function promptRegion(page: import("@playwright/test").Page) {
  return page.locator('[role="region"][aria-labelledby="pwa-prompt-title"]');
}

async function dispatchInstallEvent(
  page: import("@playwright/test").Page,
  outcome: "accepted" | "dismissed" = "accepted",
) {
  await page.evaluate((choice) => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    let calls = 0;
    Object.assign(event, {
      prompt: async () => {
        calls += 1;
      },
      userChoice: Promise.resolve({ outcome: choice }),
    });
    (window as Window & { __pwaPromptCalls?: () => number }).__pwaPromptCalls = () => calls;
    window.dispatchEvent(event);
  }, outcome);
}

async function showPrompt(
  page: import("@playwright/test").Page,
  outcome: "accepted" | "dismissed" = "accepted",
) {
  const prompt = promptRegion(page);

  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("html")).toHaveAttribute("data-pwa-install-listener", "ready");
  await dispatchInstallEvent(page, outcome);
  await expect(prompt).toBeVisible();
  await expect(page.locator("#pwa-prompt-title")).toHaveText(PROMPT_TITLE);

  return prompt;
}

test.describe("Prompt PWA editorial", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("rb-cookie-consent", "accepted");
    });
    await skipOnboarding(page);
  });

  test("respeta la safe area sin navegación, instala una vez y conserva la consola limpia", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !/favicon/i.test(message.text())) errors.push(message.text());
    });
    await page.goto("/");
    const prompt = await showPrompt(page, "accepted");
    const promptBox = await prompt.boundingBox();
    expect(promptBox).not.toBeNull();
    expect((promptBox?.y ?? 0) + (promptBox?.height ?? 0)).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
    await page.getByRole("button", { name: "Instalar" }).click();
    await expect(prompt).not.toBeVisible();
    expect(
      await page.evaluate(
        () => (window as Window & { __pwaPromptCalls?: () => number }).__pwaPromptCalls?.(),
      ),
    ).toBe(1);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("cierra, recuerda el rechazo, escucha appinstalled y mantiene teclado", async ({ page }) => {
    await page.goto("/menu");
    await showPrompt(page, "dismissed");
    await page.getByRole("button", { name: "Cerrar aviso de instalación" }).focus();
    await page.keyboard.press("Escape");
    await expect(promptRegion(page)).not.toBeVisible();

    await page.reload();
    await dispatchInstallEvent(page);
    await expect(promptRegion(page)).toHaveCount(0);

    await page.evaluate(() => localStorage.removeItem("rb-pwa-dismissed"));
    await page.reload();
    await showPrompt(page);
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(promptRegion(page)).not.toBeVisible();
  });

  test("se oculta en standalone", async ({ page }) => {
    await page.addInitScript(() => {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = ((query: string) => {
        const result = nativeMatchMedia(query);
        if (query.includes("standalone")) {
          Object.defineProperty(result, "matches", { configurable: true, value: true });
        }
        return result;
      }) as typeof window.matchMedia;
    });
    await page.goto("/");
    await dispatchInstallEvent(page);
    await expect(promptRegion(page)).toHaveCount(0);

  });

  test("no aparece en rutas con CTA o shells excluidos", async ({ page }) => {
    for (const route of ["/carrito", "/plato/carne-asada-plato-con-cebolleta", "/checkout", "/pedido/demo", "/admin", "/visual-lab"]) {
      await page.goto(route);
      await dispatchInstallEvent(page);
      await expect(promptRegion(page)).toHaveCount(0);
    }
  });

  test("el prompt visible no introduce violaciones axe críticas o serias", async ({ page }) => {
    await page.goto("/menu");
    await showPrompt(page);

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(serious).toEqual([]);
  });
});

test.describe("Prompt PWA con reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("se muestra y cierra sin dejar contenido invisible", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/");
    const prompt = await showPrompt(page);
    await expect(prompt).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "Ahora no" }).click();
    await expect(prompt).not.toBeVisible();
  });
});
