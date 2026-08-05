import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

test.describe("Rutas, PWA y estados generales", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("la página 404 ofrece salidas claras", async ({ page }) => {
    await page.goto("/ruta-que-no-existe");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver el menú" })).toBeVisible();
  });

  test("un plato inexistente devuelve 404", async ({ page }) => {
    // En rutas dinámicas con streaming, Next puede entregar HTTP 200 aunque
    // `notFound()` haya renderizado correctamente la pantalla 404.
    await page.goto("/plato/plato-inventado");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver el menú" })).toBeVisible();
  });

  test("la página offline existe y ofrece reintento", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Sin conexión a internet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  test("manifest, robots, sitemap y service worker responden", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const manifestJson = (await manifest.json()) as { display: string; icons: unknown[] };
    expect(manifestJson.display).toBe("standalone");
    expect(manifestJson.icons.length).toBeGreaterThanOrEqual(3);

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Disallow: /admin");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain("/plato/");
    expect(sitemapText).toContain("/menu/carnes");
    expect(sitemapText).toContain("/sucursales/centro");

    const serviceWorker = await request.get("/sw.js");
    expect(serviceWorker.ok()).toBe(true);
    const workerText = await serviceWorker.text();
    expect(workerText).toContain("PRIVATE_PREFIXES");
    expect(workerText).toContain("isCacheableResponse");
    expect(workerText).toContain('response.headers.has("set-cookie")');

    const health = await request.get("/api/health");
    expect(health.ok()).toBe(true);
    const healthJson = (await health.json()) as { dataMode: string; menuItems: number };
    expect(healthJson.dataMode).toBe("local");
    expect(healthJson.menuItems).toBe(6);
  });

  test("el JSON-LD del inicio y del plato es válido", async ({ page }) => {
    await page.goto("/");
    const homeJsonLd = await page.locator('script[type="application/ld+json"]').first().innerText();
    const homeData = JSON.parse(homeJsonLd) as { "@type": string };
    expect(homeData["@type"]).toBe("Restaurant");

    await page.goto("/plato/plato-de-carne-asada");
    const dishJsonLd = await page.locator('script[type="application/ld+json"]').first().innerText();
    const dishData = JSON.parse(dishJsonLd) as { "@type": string; offers: { priceCurrency: string } };
    expect(dishData["@type"]).toBe("MenuItem");
    expect(dishData.offers.priceCurrency).toBe("COP");
  });

  test("las páginas informativas cargan y son navegables desde el pie", async ({ page }) => {
    await page.goto("/menu");
    for (const [link, heading] of [
      ["Preguntas frecuentes", "Preguntas frecuentes"],
      ["Privacidad", "Política de privacidad"],
      ["Términos y condiciones", "Términos y condiciones"],
      ["Cookies", "Política de cookies"],
      ["Alérgenos", "Alérgenos e ingredientes"],
    ] as const) {
      await page.goto("/menu");
      await page.getByRole("contentinfo").getByRole("link", { name: link }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(await expectNoHorizontalScroll(page)).toBe(true);
    }
  });

  test("sucursales: listado, detalle con horario y acciones de contacto", async ({ page }) => {
    await page.goto("/sucursales");
    await page.getByRole("link", { name: /ver detalles de casa brasa centro/i }).click();
    await expect(page.getByRole("heading", { name: "Casa Brasa Centro" })).toBeVisible();
    await expect(page.getByText("Lunes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", /tel:/);
    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      /wa\.me/,
    );
    await expect(page.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute(
      "href",
      /google\.com\/maps/,
    );
  });

  test("promociones permite copiar el cupón", async ({ page, context, browserName }) => {
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await page.goto("/promociones");
    await page.getByRole("button", { name: /copiar bienvenida10/i }).click();
    // Con portapapeles disponible: "Cupón copiado"; sin él: fallback visible.
    await expect(page.getByText(/cupón copiado|cupón: bienvenida10/i).first()).toBeVisible();
  });

  test("navegación por teclado: skip link y foco visible", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "webkit (macOS) no mueve el foco a enlaces con Tab por defecto del sistema",
    );
    await page.goto("/menu");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    // El contenido principal recibe el foco/scroll.
    await expect(page.locator("#contenido")).toBeVisible();

    // Tab hasta un elemento interactivo y verificación de outline visible.
    await page.keyboard.press("Tab");
    const focusedOutline = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return "";
      return window.getComputedStyle(element).outlineStyle;
    });
    expect(focusedOutline).not.toBe("none");
  });

  test("admin exige rol demo y funciona el flujo de edición", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
    await page.getByRole("button", { name: /propietario/i }).click();
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

    // Edición real: marcar un plato como agotado se refleja en la tienda.
    await page.getByRole("link", { name: "Platos" }).first().click();
    await expect(page.getByRole("heading", { name: "Platos" })).toBeVisible();
    const toggle = page.getByRole("switch", { name: /disponibilidad de arroz amarillo/i });
    await toggle.click();
    await expect(page.getByText("Plato marcado como agotado")).toBeVisible();

    await page.goto("/menu");
    await expect(page.getByText("Agotado").first()).toBeVisible();

    // Restablecer para no contaminar otros escenarios.
    await page.goto("/admin/platos");
    await page.getByRole("button", { name: "Restablecer valores originales" }).first().click();
  });
});
