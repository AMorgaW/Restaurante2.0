import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

/**
 * 11B-7: el producto es sitio web responsive; no se promociona instalación PWA.
 * InstallPwaPrompt ya no se monta en Providers.
 */
test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "allow" });

function promptRegion(page: import("@playwright/test").Page) {
  return page.locator('[role="region"][aria-labelledby="pwa-prompt-title"]');
}

async function dispatchInstallEvent(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    Object.assign(event, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });
    window.dispatchEvent(event);
  });
}

test.describe("Sin promoción de instalación PWA", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("rb-cookie-consent", "accepted");
    });
    await skipOnboarding(page);
  });

  test("beforeinstallprompt no muestra prompt de instalar en landing ni menú", async ({ page }) => {
    await page.goto("/");
    await dispatchInstallEvent(page);
    await page.waitForTimeout(13_000);
    await expect(promptRegion(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Instalar" })).toHaveCount(0);
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    await page.goto("/menu");
    await dispatchInstallEvent(page);
    await expect(promptRegion(page)).toHaveCount(0);
  });

  test("rutas principales no muestran copy de instalar app", async ({ page }) => {
    for (const route of ["/", "/menu", "/carrito", "/checkout"]) {
      await page.goto(route);
      await expect(page.getByText(/instalar la app|pide más rápido desde tu inicio/i)).toHaveCount(0);
    }
  });
});
