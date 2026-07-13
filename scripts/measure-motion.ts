/**
 * Mide la capacidad de respuesta de interacciones clave en producción.
 * Nota: incluye ~20-50 ms de sobrecarga del protocolo CDP por medición;
 * útil como cota superior. Uso: npx tsx scripts/measure-motion.ts
 */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.setItem("rb-onboarding", JSON.stringify({ state: { seen: true }, version: 1 }));
  });
  const results: Array<[string, number]> = [];
  const ms = async (label: string, action: () => Promise<void>) => {
    const start = Date.now();
    await action();
    results.push([label, Date.now() - start]);
  };

  await page.goto(BASE + "/");
  await page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
  await page.waitForTimeout(600);

  await ms("chip categoría → contador actualizado", async () => {
    await page.getByRole("button", { name: "Sopas", exact: true }).click();
    await page.getByText("1 plato", { exact: true }).waitFor();
  });
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  await page.waitForTimeout(300);

  await ms("favorito → aria-pressed", async () => {
    const btn = page.getByRole("button", { name: /añadir sopa de maíz.*a favoritos/i });
    await btn.click();
    await page.getByRole("button", { name: /quitar sopa de maíz.*de favoritos/i }).waitFor();
  });

  await ms("añadir al carrito → toast visible", async () => {
    await page.getByRole("button", { name: /añadir sopa de maíz.*al carrito/i }).click();
    await page.getByText("Añadido al carrito").waitFor();
  });
  await page.waitForTimeout(400);

  await ms("selector de sucursal → sheet visible", async () => {
    await page.getByRole("button", { name: /casa brasa centro/i }).click();
    await page.getByRole("dialog", { name: "Elige tu sucursal" }).waitFor();
  });
  await ms("cerrar sheet → oculto", async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Elige tu sucursal" }).waitFor({ state: "hidden" });
  });

  await ms("tarjeta → detalle h1 visible (nav+morph)", async () => {
    await page.getByRole("link", { name: "Ver Sopa de maíz con arroz y frijoles" }).click();
    await page.getByRole("heading", { level: 1, name: "Sopa de maíz con arroz y frijoles" }).waitFor();
  });

  await ms("volver → grid visible", async () => {
    await page.goBack();
    await page.getByRole("group", { name: "Filtrar por categoría" }).waitFor();
  });

  // Onboarding CTA → splash (contexto limpio)
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await context2.newPage();
  await page2.goto(BASE + "/");
  await page2.getByRole("button", { name: "Explorar menú" }).waitFor();
  await page2.waitForTimeout(1500);
  const start = Date.now();
  await page2.getByRole("button", { name: "Explorar menú" }).click();
  await page2.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" }).waitFor();
  results.push(["CTA onboarding → home interactivo", Date.now() - start]);

  for (const [label, value] of results) console.log(String(value).padStart(5), "ms |", label);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
