import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { PHOTO_REVEAL_PILOT_SLUG } from "@/lib/menu/photo-reveal-pilot";
import { expectNoHorizontalScroll, motionRowCatalogPath, skipOnboarding } from "./helpers";

/**
 * Entrada del catálogo. En móvil todas las tarjetas bajo el pliegue
 * recorren 64 px en X. Desde 1024 px se conserva la subida en Y.
 * El vídeo es la evidencia; las aserciones cuidan hidratación, un solo
 * eje y que el recorrido no se repita.
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
  if (parts.length !== 6) return { x: 0, y: 0 };
  return { x: parts[4] ?? 0, y: parts[5] ?? 0 };
}

async function openFreshCatalog(page: Page, path = motionRowCatalogPath(page)) {
  if (page.url() !== "about:blank") {
    await page.evaluate(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
  }
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
  await skipOnboarding(page);
  await page.goto(path);
  await page.waitForSelector("[data-testid='menu-card-rise']");
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

async function readCards(page: Page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']")].map((rise) => {
      const rect = rise.getBoundingClientRect();
      const image = rise.querySelector("img");
      const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      return {
        name: rise.closest("article")?.querySelector("h3")?.textContent ?? "",
        photo: rise.closest("article")?.getAttribute("data-photo-reveal") === "pilot",
        timed: rise.dataset.slideTimed === "pilot",
        rise: rise.dataset.rise ?? "",
        transform: getComputedStyle(rise).transform,
        opacity: image ? getComputedStyle(image).opacity : "",
        top: rect.top,
        ratio: rect.height > 0 ? Math.max(0, visible) / rect.height : 0,
        slug: rise.querySelector<HTMLElement>(".menu-dish-photo")?.style.viewTransitionName ?? "",
        viewport: window.innerHeight,
      };
    });
  });
}

function shot(info: TestInfo, name: string) {
  const dir = "artifacts/horizontal-entrance/frames";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${info.project.name}-${name}.png`;
}

test.describe("entrada horizontal del catálogo", () => {
  test("scroll lento recorre varias tarjetas y abre el plato", async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openFreshCatalog(page);
    const width = page.viewportSize()?.width ?? 0;
    const mobile = width < 1024;
    const distance = mobile ? 64 : 22;
    const along = (axis: { x: number; y: number }) => (mobile ? axis.x : axis.y);
    const across = (axis: { x: number; y: number }) => (mobile ? axis.y : axis.x);

    await expect(page.locator("[data-slide]")).toHaveCount(0);
    await expect(page.locator("[data-photo-reveal='pilot']")).toHaveCount(1);
    const initial = await readCards(page);
    expect(initial.filter((card) => card.photo)).toHaveLength(1);
    expect(initial.find((card) => card.photo)?.slug).toBe(`dish-${PHOTO_REVEAL_PILOT_SLUG}`);
    expect(initial.every((card) => card.opacity === "1")).toBe(true);

    const visibleAtMount = initial.filter((card) => card.top < card.viewport - 8 && card.ratio > 0.08);
    for (const card of visibleAtMount) {
      const axis = axisOf(card.transform);
      expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
      expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
      expect(card.rise, card.name).toBe("done");
    }

    const below = initial
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.top > card.viewport + 8);
    expect(below.length, "hace falta más de una tarjeta bajo el pliegue").toBeGreaterThan(2);
    for (const entry of below) {
      const prepared = axisOf(entry.card.transform);
      expect(along(prepared), entry.card.name).toBeGreaterThan(distance - 8);
      expect(Math.abs(across(prepared)), entry.card.name).toBeLessThan(1.5);
    }
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    const watched = below.slice(0, 3);
    const travel = new Map<number, Array<{ x: number; y: number; ratio: number }>>();
    const pictured = new Set<number>();
    let pressed = "";
    const clickTarget = watched[watched.length - 1]!;
    for (let step = 0; step < 280 && !pressed; step += 1) {
      const cards = await readCards(page);
      let approaching = false;
      const target = cards[clickTarget.index];
      // Una captura larga deja el scroll quieto más de 160 ms y la ternera,
      // si ya asoma el corazón, dispara su entrada de 360 ms antes de poder pulsarla.
      const timedTargetEntering = Boolean(target?.timed && target.top < target.viewport);
      for (const entry of watched) {
        const current = cards[entry.index];
        if (!current) continue;
        const axis = axisOf(current.transform);
        if (cards.some((card) => card.ratio > 0.08 && card.ratio < 0.96 && card.rise !== "done")) approaching = true;
        if (current.ratio >= 0.18 && current.ratio <= 0.94) {
          const bucket = travel.get(entry.index) ?? [];
          bucket.push({ ...axis, ratio: current.ratio });
          travel.set(entry.index, bucket);
        }
        const canPicture = !timedTargetEntering || pressed !== "";
        if (canPicture && current.ratio > 0.28 && along(axis) > (mobile ? 16 : 6) && !pictured.has(entry.index)) {
          pictured.add(entry.index);
          await page.screenshot({ path: shot(info, `lento-${pictured.size}`), caret: "initial" });
        }
      }
      const current = cards[clickTarget.index];
      const axis = axisOf(current?.transform ?? "none");
      const samples = travel.get(clickTarget.index) ?? [];
      const peak = samples.reduce((max, sample) => Math.max(max, along(sample)), 0);
      const value = along(axis);
      const midSlide = mobile
        ? Boolean(current && peak > distance - 10 && value < peak - 24 && value > 8 && current.ratio > 0.35 && current.ratio < 0.92)
        : Boolean(current && value > 4 && value < 20 && current.ratio > 0.25 && current.ratio < 0.9);
      if (midSlide && current) {
        const point = await page.evaluate((index) => {
          const rise = document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']")[index];
          if (!rise) return null;
          const rect = rise.getBoundingClientRect();
          const y = Math.min(Math.max(rect.top + 36, 88), rect.bottom - 20);
          if (y > window.innerHeight - 28) return null;
          return { x: rect.left + Math.min(rect.width * 0.35, rect.width - 28), y };
        }, clickTarget.index);
        if (point) {
          await page.mouse.move(point.x, point.y);
          await page.mouse.down();
          const held = await readCards(page);
          const heldAxis = axisOf(held[clickTarget.index]?.transform ?? "none");
          await page.mouse.move(8, 8);
          await page.mouse.up();
          pressed = JSON.stringify({
            x: heldAxis.x,
            y: heldAxis.y,
            ratio: held[clickTarget.index]?.ratio,
            peak,
            atPress: value,
          });
          // `value` es el frame que autoriza el toque. La ease-out de 360 ms
          // sigue durante el viaje del puntero, así que la lectura posterior
          // puede ser menor sin haber salido del eje.
          expect(value, pressed).toBeGreaterThan(mobile ? 8 : 4);
          expect(along(heldAxis), pressed).toBeGreaterThan(0.4);
          expect(Math.abs(across(heldAxis)), pressed).toBeLessThan(1.5);
          break;
        }
      }
      if (watched.every((entry) => (cards[entry.index]?.rise === "done") && (cards[entry.index]?.ratio ?? 0) > 0.8)) break;
      const playing = current?.timed && current.rise === "playing";
      await page.evaluate((delta) => window.scrollBy(0, delta), playing ? 0 : approaching ? 6 : 18);
      if (playing) {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
      } else {
        await page.waitForTimeout(approaching ? 36 : 20);
      }
    }

    for (const entry of watched) {
      const samples = travel.get(entry.index) ?? [];
      const values = samples.map((sample) => along(sample));
      expect(values.length, entry.card.name).toBeGreaterThan(3);
      if (mobile) {
        expect(Math.max(...values) - Math.min(...values), entry.card.name).toBeGreaterThanOrEqual(18);
      }
      expect(samples.every((sample) => Math.abs(across(sample)) < 1.5), entry.card.name).toBe(true);
    }
    expect(pressed, "la tarjeta no se pulsó durante el deslizamiento").not.toBe("");
    if (mobile) expect(pictured.size, "faltan fotogramas de varias tarjetas").toBeGreaterThanOrEqual(2);
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    const linkName = clickTarget.card.name;
    await expect(async () => {
      if (!/\/plato\//.test(page.url())) {
        await page.getByRole("link", { name: `Ver ${linkName}` }).click();
      }
      await expect(page).toHaveURL(/\/plato\//, { timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await page.waitForSelector("[data-testid='detail-image-container'] img");
    const detail = await page.getByTestId("detail-image-container").evaluate((element) => ({
      opacity: getComputedStyle(element.querySelector("img") ?? element).opacity,
      name: getComputedStyle(element).viewTransitionName,
    }));
    expect(detail.opacity).toBe("1");
    expect(detail.name.startsWith("dish-")).toBe(true);
    await page.screenshot({ path: shot(info, "detalle"), caret: "initial" });

    await expect(async () => {
      if (/\/plato\//.test(page.url())) await page.getByRole("button", { name: "Volver" }).click();
      await expect(page).toHaveURL(motionRowCatalogPath(page) === "/buscar" ? /\/buscar$/ : /\/menu$/, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-menu-entrance", "settled");
    const returned = await readCards(page);
    expect(returned.every((card) => card.opacity === "1")).toBe(true);
    expect(returned.every((card) => Math.abs(axisOf(card.transform).x) < 1.5 && Math.abs(axisOf(card.transform).y) < 1.5)).toBe(true);

    await page.evaluate(() => window.scrollBy(0, 240));
    await page.waitForTimeout(150);
    const replay = await readCards(page);
    expect(replay.every((card) => Math.abs(axisOf(card.transform).x) < 1.5 && Math.abs(axisOf(card.transform).y) < 1.5)).toBe(true);

    const category = page.locator("[aria-label='Filtrar por categoría'] button").nth(1);
    if (await category.count()) {
      await category.click();
      await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-menu-entrance", "settled");
      const filtered = await readCards(page);
      expect(filtered.every((card) => Math.abs(axisOf(card.transform).x) < 1.5 && Math.abs(axisOf(card.transform).y) < 1.5)).toBe(true);
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("scroll rápido deja las tarjetas en su sitio", async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openFreshCatalog(page);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(900);
    const cards = await readCards(page);
    await page.screenshot({ path: shot(info, "rapido"), caret: "initial" });
    expect(cards.every((card) => card.opacity === "1")).toBe(true);
    expect(cards.every((card) => Math.abs(axisOf(card.transform).x) < 2 && Math.abs(axisOf(card.transform).y) < 2)).toBe(true);
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    await expect(page.locator("[data-slide]")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("movimiento reducido nace en reposo", async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFreshCatalog(page);
    const cards = await readCards(page);
    expect(cards.every((card) => card.opacity === "1")).toBe(true);
    expect(cards.every((card) => Math.abs(axisOf(card.transform).x) < 1.5 && Math.abs(axisOf(card.transform).y) < 1.5)).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(250);
    const after = await readCards(page);
    expect(after.every((card) => Math.abs(axisOf(card.transform).x) < 1.5 && Math.abs(axisOf(card.transform).y) < 1.5)).toBe(true);
    await page.screenshot({ path: shot(info, "reducido"), caret: "initial" });
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("cruzar 1024 no mezcla ejes ni reanima lo ya visto", async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openFreshCatalog(page);
    const width = page.viewportSize()?.width ?? 0;
    const before = await readCards(page);
    for (const card of before.filter((entry) => entry.top < entry.viewport - 8 && entry.ratio > 0.08)) {
      const axis = axisOf(card.transform);
      expect(card.rise, card.name).toBe("done");
      expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
      expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
    }
    const done = new Set(before.filter((card) => card.rise === "done").map((card) => card.slug));
    const next = width < 1024 ? { width: 1280, height: 900 } : { width: 390, height: 844 };
    await page.setViewportSize(next);
    await page.waitForTimeout(300);
    const after = await readCards(page);
    await page.screenshot({ path: shot(info, "corte"), caret: "initial" });
    for (const card of after) {
      const axis = axisOf(card.transform);
      expect(Math.abs(axis.x) < 2 || Math.abs(axis.y) < 2, card.name).toBe(true);
      if (!done.has(card.slug)) continue;
      expect(card.rise, card.name).toBe("done");
      expect(Math.abs(axis.x), card.name).toBeLessThan(2);
      expect(Math.abs(axis.y), card.name).toBeLessThan(2);
    }
    const mobile = next.width < 1024;
    const prepared = after.filter((card) => card.top > card.viewport + 8 && card.rise !== "done");
    for (const card of prepared) {
      const axis = axisOf(card.transform);
      if (mobile) expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
      else expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
    }
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("buscar y favoritos usan la misma entrada", async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openFreshCatalog(page, "/buscar");
    const width = page.viewportSize()?.width ?? 0;
    const mobile = width < 1024;
    const searchCards = await readCards(page);
    expect(searchCards.length).toBeGreaterThan(2);
    expect(searchCards.filter((card) => card.photo)).toHaveLength(1);
    for (const card of searchCards.filter((entry) => entry.top < entry.viewport - 8 && entry.ratio > 0.08)) {
      const axis = axisOf(card.transform);
      expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
      expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
      expect(card.rise, card.name).toBe("done");
    }
    for (const card of searchCards.filter((entry) => entry.top > entry.viewport + 8).slice(0, 4)) {
      const axis = axisOf(card.transform);
      if (mobile) {
        expect(axis.x, card.name).toBeGreaterThan(56);
        expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
      } else {
        expect(axis.y, card.name).toBeGreaterThan(14);
        expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
      }
    }
    await page.screenshot({ path: shot(info, "buscar"), caret: "initial" });
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    const slugs = searchCards.map((card) => card.slug.replace(/^dish-/, "")).filter((slug) => slug.length > 0);
    await page.evaluate((list) => {
      localStorage.setItem("rb-favorites", JSON.stringify({ state: { slugs: list }, version: 1 }));
      sessionStorage.removeItem("rb-menu-grid-visited");
    }, slugs);
    await page.goto("/favoritos");
    await page.waitForSelector("[data-testid='menu-card-rise']");
    await expect.poll(async () => page.getByTestId("menu-grid").getAttribute("data-menu-entrance")).not.toBe("off");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
    const favorites = await readCards(page);
    expect(favorites.length).toBeGreaterThan(2);
    for (const card of favorites.filter((entry) => entry.top < entry.viewport - 8 && entry.ratio > 0.08)) {
      const axis = axisOf(card.transform);
      expect(card.opacity, card.name).toBe("1");
      expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
      expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
    }
    for (const card of favorites.filter((entry) => entry.top > entry.viewport + 8).slice(0, 3)) {
      const axis = axisOf(card.transform);
      if (mobile) {
        expect(axis.x, card.name).toBeGreaterThan(56);
        expect(Math.abs(axis.y), card.name).toBeLessThan(1.5);
      } else {
        expect(axis.y, card.name).toBeGreaterThan(14);
        expect(Math.abs(axis.x), card.name).toBeLessThan(1.5);
      }
    }
    await expect(page.getByRole("button", { name: /favoritos/i }).first()).toBeVisible();
    await page.screenshot({ path: shot(info, "favoritos"), caret: "initial" });
    expect(await expectNoHorizontalScroll(page)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
