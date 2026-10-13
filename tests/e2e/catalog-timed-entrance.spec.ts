import { expect, test, type Page } from "@playwright/test";
import { TIMED_PRICE_LEAD_PX } from "@/lib/menu/horizontal-entrance";
import { expectNoHorizontalScroll, LONG_DISH_NAME, motionRowCatalogPath, skipOnboarding } from "./helpers";

/**
 * Piloto de la ternera: 100 px y 360 ms con la Web Animations API.
 * «Plato con cebolleta» conserva la entrada geométrica. El vídeo es
 * la evidencia; las medidas solo comprueban que el disparo y el
 * recorrido compartido no se salieron del encargo.
 */

test.use({ video: "on" });

const devNoise = /favicon|third-party cookie|ChunkLoadError|turbopack-hmr|__nextjs_original-stack-frames|Transition was aborted because of timeout/i;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!devNoise.test(error.message)) errors.push(error.message);
  });
  page.on("console", (message) => {
    const text = message.text();
    if ((message.type() === "error" || /hydration|did not match/i.test(text)) && !devNoise.test(text)) {
      errors.push(text);
    }
  });
  return errors;
}

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
  await page.waitForSelector("[data-slide-timed='pilot']");
  await expect
    .poll(async () => page.getByTestId("menu-grid").getAttribute("data-menu-entrance"), { timeout: 30_000 })
    .not.toBe("off");
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll("[data-testid='menu-grid'] img")];
    return images.length > 0 && images.every((img) => (img as HTMLImageElement).complete);
  }, undefined, { timeout: 4_000 }).catch(() => undefined);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
}

async function readPair(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string) => {
      const rise = document.querySelector<HTMLElement>(selector);
      if (!rise) return null;
      const part = (partSelector: string) => {
        const node = rise.querySelector<HTMLElement>(partSelector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          opacity: getComputedStyle(node).opacity,
        };
      };
      const animation = rise.getAnimations()[0];
      const photo = rise.querySelector("img");
      return {
        rise: rise.dataset.rise ?? "",
        transform: getComputedStyle(rise).transform,
        opacity: getComputedStyle(rise).opacity,
        photoOpacity: photo ? getComputedStyle(photo).opacity : "",
        animations: rise.getAnimations().length,
        currentTime: animation ? Number(animation.currentTime ?? -1) : null,
        titleTop: part("h3")?.top ?? null,
        priceTop: part(".tabular-nums")?.top ?? null,
        heartRight: part(".menu-card-favorite")?.right ?? null,
        parts: {
          panel: part("[data-testid='menu-card-panel']"),
          photo: part(".menu-dish-photo"),
          name: part("h3"),
          description: part(".menu-card-secondary"),
          price: part(".tabular-nums"),
          heart: part(".menu-card-favorite"),
          add: part(".menu-card-add"),
        },
      };
    };
    return {
      geometric: read("[data-slide-calibration='pilot']"),
      timed: read("[data-slide-timed='pilot']"),
      viewport: window.innerHeight,
      width: window.innerWidth,
    };
  });
}

test.describe("entrada de duración fija de la ternera", () => {
  test("scroll lento compara las dos tarjetas hasta el precio", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, "La comparación es de la columna móvil.");
    await openFresh(page);
    const trace = await page.evaluate(async () => {
      const axis = (transform: string) => {
        const matrix = transform.match(/matrix\(([^)]+)\)/);
        if (!matrix?.[1]) return 0;
        return Number(matrix[1].split(",")[4] ?? 0);
      };
      const snap = (selector: string) => {
        const rise = document.querySelector<HTMLElement>(selector);
        if (!rise) return null;
        const box = (partSelector: string) => {
          const node = rise.querySelector<HTMLElement>(partSelector);
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, opacity: getComputedStyle(node).opacity };
        };
        const animation = rise.getAnimations()[0];
        const rect = rise.getBoundingClientRect();
        return {
          x: axis(getComputedStyle(rise).transform),
          y: Number(getComputedStyle(rise).transform.match(/matrix\(([^)]+)\)/)?.[1]?.split(",")[5] ?? 0),
          rise: rise.dataset.rise ?? "",
          time: animation ? Number(animation.currentTime ?? -1) : null,
          opacity: getComputedStyle(rise).opacity,
          photo: getComputedStyle(rise.querySelector("img") ?? rise).opacity,
          raw: rect.height > 0 ? (window.innerHeight - rect.top) / rect.height : 0,
          titleTop: box("h3")?.top ?? null,
          priceTop: box(".tabular-nums")?.top ?? null,
          heartRight: box(".menu-card-favorite")?.right ?? null,
          heartTop: box(".menu-card-favorite")?.top ?? null,
          parts: [
            box("[data-testid='menu-card-panel']"),
            box(".menu-dish-photo"),
            box("h3"),
            box(".menu-card-secondary"),
            box(".tabular-nums"),
            box(".menu-card-favorite"),
            box(".menu-card-add"),
          ],
        };
      };
      const timedSamples: NonNullable<ReturnType<typeof snap>>[] = [];
      const geometricSamples: NonNullable<ReturnType<typeof snap>>[] = [];
      const started = performance.now();
      let scrolled = 0;
      let last = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          const dt = Math.min(48, Math.max(8, now - last));
          last = now;
          const timed = snap("[data-slide-timed='pilot']");
          const geometric = snap("[data-slide-calibration='pilot']");
          if (timed && timed.raw > -0.05 && timed.raw < 1.35) timedSamples.push(timed);
          if (geometric && geometric.raw > -0.05 && geometric.raw < 1.35) geometricSamples.push(geometric);
          const priceIn = timed?.priceTop != null && timed.priceTop < window.innerHeight - 48 && timed.rise === "done";
          if (priceIn || now - started > 28_000) {
            resolve();
            return;
          }
          const dy = Math.min(14, Math.max(4, (190 * dt) / 1000));
          window.scrollBy(0, dy);
          scrolled += dy;
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const elapsed = performance.now() - started;
      const entering = (samples: typeof timedSamples) =>
        samples.find((sample) => sample.priceTop != null && sample.priceTop <= window.innerHeight && sample.priceTop > window.innerHeight - 28);
      const titleIn = timedSamples.find((sample) => sample.titleTop != null && sample.titleTop <= window.innerHeight && sample.titleTop > window.innerHeight - 28);
      const priceMoving = timedSamples.find(
        (sample) =>
          sample.priceTop != null &&
          sample.priceTop < window.innerHeight - 4 &&
          sample.time != null &&
          sample.time >= 16 &&
          sample.time < 340 &&
          sample.x > 6,
      );
      let heartClipMs = 0;
      for (let index = 1; index < timedSamples.length; index += 1) {
        const sample = timedSamples[index]!;
        const heartIn = sample.heartTop != null && sample.heartTop < window.innerHeight && sample.heartTop > 0;
        const clipped = heartIn && sample.heartRight != null && sample.heartRight > window.innerWidth + 1;
        if (clipped) heartClipMs += 32;
      }
      const moving = timedSamples.filter((sample) => sample.time != null && sample.time > 20 && sample.time < 240);
      let partSpread = -1;
      if (moving.length >= 2) {
        const first = moving[0]!;
        const later = moving[moving.length - 1]!;
        const shifts = first.parts.map((part, index) => (later.parts[index] && part ? later.parts[index]!.left - part.left : null));
        const usable = shifts.filter((shift): shift is number => shift != null);
        if (usable.length >= 6) partSpread = Math.max(...usable) - Math.min(...usable);
      }
      return {
        pxPerSec: elapsed > 0 ? (scrolled / elapsed) * 1000 : 0,
        titleIn,
        priceIn: entering(timedSamples),
        priceMoving,
        geometricPriceIn: entering(geometricSamples),
        heartClipMs,
        partSpread,
        photoDim: timedSamples.some((sample) => sample.photo !== "1" || sample.opacity !== "1"),
      };
    });

    console.log(`TIMED_SLOW ${JSON.stringify({ pxPerSec: Math.round(trace.pxPerSec), titleX: trace.titleIn?.x, titleTime: trace.titleIn?.time, priceX: trace.priceMoving?.x, priceTime: trace.priceMoving?.time, priceRaw: trace.priceMoving?.raw, geometricX: trace.geometricPriceIn?.x, heartClipMs: trace.heartClipMs, partSpread: trace.partSpread })}`);
    expect(trace.titleIn?.x ?? 0).toBeGreaterThan(90);
    expect(trace.titleIn?.time ?? null).toBeNull();
    expect(trace.priceMoving, "el precio no coincidió con la animación").toBeTruthy();
    expect(trace.priceMoving!.time!).toBeGreaterThanOrEqual(16);
    expect(trace.priceMoving!.time!).toBeLessThan(340);
    expect(trace.priceMoving!.x).toBeGreaterThan(6);
    expect(Math.abs(trace.priceMoving!.y)).toBeLessThan(1.5);
    expect(trace.partSpread).toBeGreaterThanOrEqual(0);
    expect(trace.partSpread).toBeLessThan(2);
    expect(trace.photoDim).toBe(false);
    expect(trace.geometricPriceIn?.x ?? 0).toBeGreaterThan(12);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
    console.log(`TIMED_SLOW ${JSON.stringify({ pxPerSec: Math.round(trace.pxPerSec), titleX: trace.titleIn?.x, titleTime: trace.titleIn?.time, priceX: trace.priceIn?.x, priceTime: trace.priceIn?.time, priceRaw: trace.priceIn?.raw, geometricX: trace.geometricPriceIn?.x, heartClipMs: trace.heartClipMs, partSpread: trace.partSpread })}`);
  });

  test("scroll rápido sigue pudiendo asentar la tarjeta", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, "La comparación es de la columna móvil.");
    await openFresh(page);
    const trace = await page.evaluate(async () => {
      const snap = () => {
        const rise = document.querySelector<HTMLElement>("[data-slide-timed='pilot']");
        if (!rise) return null;
        const price = rise.querySelector<HTMLElement>(".tabular-nums");
        const animation = rise.getAnimations()[0];
        const matrix = getComputedStyle(rise).transform.match(/matrix\(([^)]+)\)/);
        return {
          x: matrix?.[1] ? Number(matrix[1].split(",")[4] ?? 0) : 0,
          time: animation ? Number(animation.currentTime ?? -1) : null,
          rise: rise.dataset.rise ?? "",
          priceTop: price ? price.getBoundingClientRect().top : null,
          opacity: getComputedStyle(rise.querySelector("img") ?? rise).opacity,
        };
      };
      let crossed: ReturnType<typeof snap> = null;
      await new Promise<void>((resolve) => {
        let frames = 0;
        const step = () => {
          frames += 1;
          const sample = snap();
          if (!crossed && sample?.priceTop != null && sample.priceTop < window.innerHeight) crossed = sample;
          window.scrollBy(0, 28);
          const passed = sample?.priceTop != null && sample.priceTop < 40 && sample.rise === "done";
          if (passed || frames > 90) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      return { crossed, settled: snap() };
    });
    expect(trace.settled?.opacity).toBe("1");
    expect(Math.abs(trace.settled?.x ?? 99)).toBeLessThan(2);
    expect(trace.settled?.rise).toBe("done");
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
    console.log(`TIMED_FAST ${JSON.stringify(trace.crossed)}`);
  });

  test("detenerse en la fotografía devuelve el corazón sin esperar al precio", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, "La comparación es de la columna móvil.");
    await openFresh(page);
    const parked = await page.evaluate(
      async ({ leadPx }) => {
        for (let step = 0; step < 240; step += 1) {
          const rise = document.querySelector<HTMLElement>("[data-slide-timed='pilot']");
          const heart = rise?.querySelector<HTMLElement>(".menu-card-favorite");
          const title = rise?.querySelector<HTMLElement>("h3");
          const price = rise?.querySelector<HTMLElement>(".tabular-nums");
          if (rise && heart && title && price) {
            const heartBox = heart.getBoundingClientRect();
            const titleTop = title.getBoundingClientRect().top;
            const priceTop = price.getBoundingClientRect().top;
            const verticallyIn = heartBox.top > 0 && heartBox.bottom < window.innerHeight;
            const titleBelow = titleTop > window.innerHeight + 4;
            const priceBelow = priceTop > window.innerHeight + leadPx;
            if (verticallyIn && titleBelow && priceBelow) {
              return {
                titleTop,
                priceTop,
                heartTop: heartBox.top,
                heartBottom: heartBox.bottom,
                rise: rise.dataset.rise ?? "",
              };
            }
          }
          window.scrollBy(0, 8);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        return null;
      },
      { leadPx: TIMED_PRICE_LEAD_PX },
    );
    expect(parked, "no se encontró el corazón de la ternera antes del título").toBeTruthy();
    const viewportHeight = page.viewportSize()?.height ?? 800;
    const viewportWidth = page.viewportSize()?.width ?? 400;
    expect(parked!.titleTop).toBeGreaterThan(viewportHeight + 4);
    expect(parked!.priceTop).toBeGreaterThan(viewportHeight + TIMED_PRICE_LEAD_PX);
    expect(parked!.heartTop).toBeGreaterThan(0);
    expect(parked!.heartBottom).toBeLessThan(viewportHeight);
    const favorite = page.locator("[data-slide-timed='pilot'] .menu-card-favorite");
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    const after = await readPair(page);
    expect(after.timed?.heartRight ?? 9999).toBeLessThan(viewportWidth - 1);
    expect(after.timed?.titleTop ?? 0).toBeGreaterThan(viewportHeight - 8);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("al detenerse en el título y seguir hasta el precio la tarjeta no queda recortada", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, "La comparación es de la columna móvil.");
    await openFresh(page);
    const found = await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      for (let step = 0; step < 500; step += 1) {
        const title = document.querySelector<HTMLElement>("[data-slide-timed='pilot'] h3");
        if (title) {
          const top = title.getBoundingClientRect().top;
          if (top < window.innerHeight - 12 && top > window.innerHeight - 90) return top;
        }
        window.scrollBy(0, 6);
        await sleep(28);
      }
      return null;
    });
    expect(found, "el título no quedó en el borde").not.toBeNull();
    await page.waitForTimeout(620);
    const paused = await readPair(page);
    expect(paused.timed?.heartRight ?? 9999).toBeLessThan((page.viewportSize()?.width ?? 400) - 1);
    expect(paused.timed?.photoOpacity).toBe("1");
    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      for (let step = 0; step < 180; step += 1) {
        const price = document.querySelector<HTMLElement>("[data-slide-timed='pilot'] .tabular-nums");
        if (price && price.getBoundingClientRect().top < window.innerHeight - 28) return;
        window.scrollBy(0, 8);
        await sleep(32);
      }
    });
    const price = await readPair(page);
    expect(price.timed?.priceTop ?? 9999).toBeLessThan((page.viewportSize()?.height ?? 800) - 20);
    expect(price.timed?.photoOpacity).toBe("1");
    expect(Math.abs(axisOf(price.timed?.transform ?? "none").x)).toBeLessThan(8);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("abrir el plato durante el movimiento no repite la entrada al volver", async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 1024, "La comparación es de la columna móvil.");
    await openFresh(page);
    const navigation = page.waitForURL(/\/plato\/carne-asada-ternera-a-la-parrilla/, { timeout: 40_000 });
    await page.evaluate(() => {
      const started = performance.now();
      let last = started;
      const frame = (now: number) => {
        const rise = document.querySelector<HTMLElement>("[data-slide-timed='pilot']");
        const time = Number(rise?.getAnimations()[0]?.currentTime ?? -1);
        if (time >= 24 && time <= 240) {
          window.sessionStorage.setItem("rb-pilot-click-ms", String(time));
          const link = rise?.querySelector<HTMLAnchorElement>("a[href*='/plato/']");
          link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, button: 0 }));
          return;
        }
        if (now - started > 25_000) return;
        const dt = Math.min(48, Math.max(8, now - last));
        last = now;
        window.scrollBy(0, Math.min(14, Math.max(4, (190 * dt) / 1000)));
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }).catch(() => undefined);
    await navigation;
    const clickedAt = await page.evaluate(() => Number(window.sessionStorage.getItem("rb-pilot-click-ms") ?? "-1"));
    expect(clickedAt).toBeGreaterThan(20);
    await expect(page.getByRole("heading", { level: 1, name: LONG_DISH_NAME })).toBeVisible();
    const detail = await page.getByTestId("detail-image-container").evaluate((element) => ({
      opacity: getComputedStyle(element.querySelector("img") ?? element).opacity,
      name: getComputedStyle(element).viewTransitionName,
    }));
    expect(detail.opacity).toBe("1");
    expect(detail.name.startsWith("dish-")).toBe(true);
    await page.goBack();
    await page.waitForSelector("[data-testid='menu-grid']");
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-menu-entrance", "settled");
    await page.evaluate(() => window.scrollBy(0, 280));
    await page.waitForTimeout(400);
    const returned = await readPair(page);
    expect(Math.abs(axisOf(returned.timed?.transform ?? "none").x)).toBeLessThan(1.5);
    expect(Math.abs(axisOf(returned.geometric?.transform ?? "none").x)).toBeLessThan(1.5);
    expect(returned.timed?.photoOpacity).toBe("1");
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("con movimiento reducido la ternera nace en reposo", async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFresh(page);
    const initial = await readPair(page);
    expect(initial.timed?.photoOpacity).toBe("1");
    expect(initial.timed?.opacity).toBe("1");
    expect(Math.abs(axisOf(initial.timed?.transform ?? "none").x)).toBeLessThan(1.5);
    expect(Math.abs(axisOf(initial.timed?.transform ?? "none").y)).toBeLessThan(1.5);
    expect(initial.timed?.animations).toBe(0);
    expect(Object.values(initial.timed?.parts ?? {}).every((part) => part == null || part.opacity === "1")).toBe(true);
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(300);
    const later = await readPair(page);
    expect(Math.abs(axisOf(later.timed?.transform ?? "none").x)).toBeLessThan(1.5);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("en escritorio la ternera no usa el deslizamiento horizontal", async ({ page }) => {
    const errors = watchErrors(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width < 1024, "Este caso es el de dos columnas.");
    await openFresh(page);
    const cards = await readPair(page);
    expect(cards.timed).toBeTruthy();
    expect(Math.abs(axisOf(cards.timed!.transform).x)).toBeLessThan(1.5);
    expect(cards.timed!.animations).toBe(0);
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(500);
    const later = await readPair(page);
    expect(Math.abs(axisOf(later.timed!.transform).x)).toBeLessThan(1.5);
    expect(later.timed!.currentTime).toBeNull();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
