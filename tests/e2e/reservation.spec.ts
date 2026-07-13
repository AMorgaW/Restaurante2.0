import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

function futureDateIso(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

test.describe("Reservas", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("valida campos obligatorios con mensajes accesibles", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByRole("button", { name: /confirmar reserva/i }).click();
    await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();
    await expect(page.getByText(/teléfono válido/i)).toBeVisible();
  });

  test("crea una reserva demo, la lista y permite cancelarla", async ({ page }) => {
    await page.goto("/reservar");

    // Fecha a 3 días (siempre dentro de la ventana y con franjas).
    const date = futureDateIso(3);
    const dateInput = page.getByLabel("Fecha");
    // Evidencia observable de hidratación: el efecto de montaje rellena la
    // fecha con "hoy" (en SSR va vacía). Escribir antes de eso perdería el
    // valor (React aún no escucha y el efecto lo sobrescribiría).
    await expect(dateInput).not.toHaveValue("");
    // El fill de inputs date es poco fiable en webkit: se asigna el valor
    // con el setter nativo y eventos que React/RHF reconocen.
    await dateInput.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, date);
    await expect(dateInput).toHaveValue(date);
    await page.getByLabel("Hora").selectOption("13:00");
    await page.getByLabel("Número de personas").selectOption("4");
    await page.getByLabel("Nombre completo").fill("Carlos Ruiz");
    await page.getByLabel("Teléfono").fill("+57 301 555 1234");
    await page.getByLabel("Correo electrónico").fill("carlos@example.com");
    await page.getByLabel(/ocasión/i).selectOption("Cumpleaños");
    await page.getByRole("button", { name: /confirmar reserva/i }).click();

    await expect(page.getByText("¡Reserva confirmada!").first()).toBeVisible({ timeout: 10_000 });

    // Aparece en el listado local con estado confirmado.
    await expect(page.getByText("Carlos Ruiz")).toBeVisible();
    await expect(page.getByText("Confirmada").first()).toBeVisible();
    await expect(page.getByText(`${date} · 13:00`)).toBeVisible();

    // Cancelación con confirmación.
    await page.getByRole("button", { name: "Cancelar reserva" }).first().click();
    const dialog = page.getByRole("dialog", { name: "¿Cancelar la reserva?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(page.getByText("Cancelada").first()).toBeVisible();
  });

  test("las franjas dependen del horario de la sucursal", async ({ page }) => {
    await page.goto("/reservar");
    const date = futureDateIso(3);
    await page.getByLabel("Fecha").fill(date);
    const timeSelect = page.getByLabel("Hora");
    const options = await timeSelect.locator("option").allInnerTexts();
    // Existen franjas y ninguna después del cierre (23:00 máx → última ≤ 22:00).
    expect(options.length).toBeGreaterThan(3);
    expect(options.some((option) => option.includes("23:"))).toBe(false);
  });
});
