import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoHorizontalScroll, motionRowCatalogPath, skipOnboarding } from "./helpers";

/**
 * Comparación de la entrada actual (64 px) con la cebolleta geométrica
 * (90–110 px). La ternera ya no usa esta curva.
 * El vídeo es la evidencia; las medidas comprueban que la tarjeta
 * entera comparte un solo desplazamiento.
 */

test.use({ video: "on" });

const CONTROL = "Carne asada falda de res con ensalada, arroz, frijoles y jalapeños";
const PILOT = "Carne asada plato con cebolleta";

function axisOf(transform: string) {
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (!matrix?.[1]) return { x: 0, y: 0 };
  const parts = matrix[1].split(",").map((part) => Number(part.trim()));
  return { x: parts[4] ?? 0, y: parts[5] ?? 0 };
}

async function openFresh(page: Page) {
  if (page.url() !== "about:blank") {
    await page.evaluate(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
  }
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
  await skipOnboarding(page);
  await page.goto(motionRowCatalogPath(page));
  await page.waitForSelector("[data-testid='menu-card-rise']");
  await expect
    .poll(async () => page.getByTestId("menu-grid").getAttribute("data-menu-entrance"), { timeout: 30_000 })
    .not.toBe("off");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
}

async function readCards(page: Page) {
  return page.evaluate(() => {
    const part = (rise: HTMLElement, selector: string) => {
      const node = rise.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        opacity: getComputedStyle(node).opacity,
      };
    };
    return [...document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']")].map((rise) => {
      const rect = rise.getBoundingClientRect();
      const price = rise.querySelector<HTMLElement>(".tabular-nums");
      return {
        name: rise.closest("article")?.querySelector("h3")?.textContent?.trim() ?? "",
        pilot: rise.dataset.slideCalibration === "pilot",
        rise: rise.dataset.rise ?? "",
        transform: getComputedStyle(rise).transform,
        top: rect.top,
        height: rect.height,
        opacity: getComputedStyle(rise).opacity,
        priceTop: price ? price.getBoundingClientRect().top : null,
        parts: {
          panel: part(rise, "[data-testid='menu-card-panel']"),
          photo: part(rise, ".menu-dish-photo"),
          category: part(rise, ".menu-card-kicker"),
          name: part(rise, "h3"),
          price: part(rise, ".tabular-nums"),
          favorite: part(rise, ".menu-card-favorite"),
          add: part(rise, ".menu-card-add"),
        },
      };
    });
  });
}

function shot(info: TestInfo, name: string) {
  const dir = "artifacts/slide-calibration/frames";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${info.project.name}-${name}.png`;
}

test.describe("calibración de la entrada horizontal", () => {
  test("el móvil compara 64 px con el recorrido más largo", async ({ page }, info) => {
    test.setTimeout(120_000);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, "La comparación es de la columna móvil.");
    await openFresh(page);
    const initial = await readCards(page);
    const pilots = initial.filter((card) => card.pilot);
    expect(pilots).toHaveLength(1);
    expect(initial.filter((card) => card.name.startsWith("Carne asada ternera"))).toHaveLength(1);
    const control = initial.find((card) => card.name === CONTROL);
    const pilot = initial.find((card) => card.name === PILOT);
    expect(control).toBeTruthy();
    expect(pilot).toBeTruthy();
    expect(axisOf(control!.transform).x).toBeGreaterThan(56);
    expect(axisOf(control!.transform).x).toBeLessThan(72);
    expect(axisOf(pilot!.transform).x).toBeGreaterThanOrEqual(90);
    expect(axisOf(pilot!.transform).x).toBeLessThanOrEqual(110);
    expect(Math.abs(axisOf(pilot!.transform).y)).toBeLessThan(1.5);
    expect(pilot!.opacity).toBe("1");
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    const viewport = page.viewportSize()?.height ?? 844;
    const reading = new Map<string, number>();
    const travel = new Map<string, { x: number; lefts: number[] }[]>();
    let controlShot = false;
    let pilotShot = false;
    for (let step = 0; step < 220; step += 1) {
      const cards = await readCards(page);
      for (const card of cards) {
        if (card.name !== CONTROL && card.name !== PILOT) continue;
        const x = axisOf(card.transform).x;
        const priceTop = card.priceTop;
        const lefts = Object.values(card.parts)
          .filter((part): part is { left: number; top: number; opacity: string } => part != null)
          .map((part) => part.left);
        if (lefts.length >= 6 && x > 12) {
          const bucket = travel.get(card.name) ?? [];
          bucket.push({ x, lefts });
          travel.set(card.name, bucket);
        }
        if (priceTop != null && priceTop < viewport - 8 && priceTop > viewport - 72 && !reading.has(card.name)) {
          reading.set(card.name, x);
        }
        if (card.name === CONTROL && !controlShot && x > 16 && x < 52) {
          controlShot = true;
          await page.screenshot({ path: shot(info, "actual-64"), caret: "initial" });
        }
        if (card.name === PILOT && !pilotShot && priceTop != null && priceTop < viewport - 8 && priceTop > viewport - 90 && x > 24) {
          pilotShot = true;
          await page.screenshot({ path: shot(info, "calibrada"), caret: "initial" });
        }
      }
      if (reading.has(CONTROL) && reading.has(PILOT) && controlShot && pilotShot) break;
      await page.evaluate((delta) => window.scrollBy(0, delta), 14);
      await page.waitForTimeout(32);
    }

    const sharedShift = (name: string) => {
      const samples = travel.get(name) ?? [];
      const first = samples.find((sample) => sample.x > 36);
      const later = [...samples].reverse().find((sample) => first && sample.x < first.x - 16);
      expect(first && later, name).toBeTruthy();
      const shifts = first!.lefts.map((left, index) => later!.lefts[index]! - left);
      return Math.max(...shifts) - Math.min(...shifts);
    };

    expect(sharedShift(CONTROL)).toBeLessThan(1.5);
    expect(sharedShift(PILOT)).toBeLessThan(1.5);
    const controlReading = reading.get(CONTROL);
    const pilotReading = reading.get(PILOT);
    expect(controlReading, "la tarjeta de 64 px no mostró el precio").toBeDefined();
    expect(pilotReading, "la tarjeta calibrada no mostró el precio").toBeDefined();
    expect(pilotReading!).toBeGreaterThan(24);
    expect(controlReading!).toBeLessThan(pilotReading! - 12);
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    await page.getByRole("link", { name: `Ver ${PILOT}` }).click();
    await expect(page).toHaveURL(/\/plato\/carne-asada-plato-con-cebolleta/);
    await page.goBack();
    await page.waitForSelector("[data-testid='menu-grid']");
    await expect
      .poll(async () => {
        const cards = await readCards(page);
        const again = cards.find((card) => card.name === PILOT);
        return again ? axisOf(again.transform).x : 999;
      })
      .toBeLessThan(8);
  });

  test("con movimiento reducido la calibración nace en reposo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFresh(page);
    const cards = await readCards(page);
    const pilot = cards.find((card) => card.name === PILOT);
    expect(pilot).toBeTruthy();
    expect(Math.abs(axisOf(pilot!.transform).x)).toBeLessThan(1.5);
    expect(Math.abs(axisOf(pilot!.transform).y)).toBeLessThan(1.5);
    expect(pilot!.opacity).toBe("1");
    expect(Object.values(pilot!.parts).every((part) => part == null || part.opacity === "1")).toBe(true);
  });

  test("en escritorio el piloto conserva la subida vertical", async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width < 1024, "Este caso es el de dos columnas.");
    await openFresh(page);
    const cards = await readCards(page);
    const pilot = cards.find((card) => card.name === PILOT);
    expect(pilot?.pilot).toBe(true);
    expect(Math.abs(axisOf(pilot!.transform).x)).toBeLessThan(1.5);
  });
});
