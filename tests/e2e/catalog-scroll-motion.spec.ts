import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { motionRowCatalogPath, skipOnboarding } from "./helpers";

/**
 * T8-B: una sola subida por tarjeta, perceptible mientras entra en pantalla,
 * sin repetirse al invertir el scroll ni al volver del detalle.
 */

const devNoise = /favicon|third-party cookie|ChunkLoadError|turbopack-hmr|__nextjs_original-stack-frames|Transition was aborted because of timeout/i;

test.use({ video: "on" });

function watchHydration(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!devNoise.test(error.message)) errors.push(error.message);
  });
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || /hydration|did not match/i.test(text)) {
      if (!devNoise.test(text)) errors.push(text);
    }
  });
  return errors;
}

function casesFor(project: string) {
  if (project === "desktop") return [{ id: "desktop", width: 1440, height: 1000 }];
  if (project === "mobile-webkit") {
    return [
      { id: "mobile", width: 390, height: 844 },
      { id: "desktop", width: 1280, height: 900 },
    ];
  }
  return [{ id: "mobile", width: 390, height: 844 }];
}

async function openMenu(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
  await skipOnboarding(page);
  await page.goto(motionRowCatalogPath(page));
  await page.waitForSelector("[data-testid='menu-card-rise']");
  await expect.poll(async () => page.getByTestId("menu-grid").getAttribute("data-menu-entrance")).not.toBe("off");
}

function matrixPart(transform: string, index: number) {
  if (!transform || transform === "none") return 0;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (!matrix?.[1]) return 0;
  const parts = matrix[1].split(",").map((part) => Number(part.trim()));
  return parts.length === 6 ? parts[index] ?? 0 : 0;
}

function translateX(transform: string) {
  return matrixPart(transform, 4);
}

function translateY(transform: string) {
  return matrixPart(transform, 5);
}

function scaleX(transform: string) {
  if (!transform || transform === "none") return 1;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (!matrix?.[1]) return 1;
  return Number(matrix[1].split(",")[0]);
}

async function readCard(page: Page, index: number) {
  return page.evaluate((cardIndex) => {
    const rise = document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']")[cardIndex];
    const article = rise?.closest("article");
    const image = rise?.querySelector("img");
    if (!rise || !article) return null;
    const rect = rise.getBoundingClientRect();
    const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    const ratio = rect.height > 0 ? Math.max(0, visible) / rect.height : 0;
    return {
      ratio,
      top: rect.top,
      riseTransform: getComputedStyle(rise).transform,
      articleTransform: getComputedStyle(article).transform,
      articleScale: getComputedStyle(article).scale,
      name: getComputedStyle(rise).animationName,
      rise: rise.dataset.rise ?? "",
      entrance: rise.closest("[data-menu-entrance]")?.getAttribute("data-menu-entrance") ?? "",
      opacity: image ? getComputedStyle(image).opacity : "",
    };
  }, index);
}

test.describe("entrada del catálogo al hacer scroll", () => {
  test.beforeEach(({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1440) < 1024, "Piloto histórico de filas; /buscar móvil usa CompactDishCard.");
  });

  test("scroll lento, presión, regreso y vuelta sin repetir la subida", async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors = watchHydration(page);
    const evidence: unknown[] = [];

    for (const viewport of casesFor(info.project.name)) {
      if (page.url() !== "about:blank") {
        await page.evaluate(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
      }
      await openMenu(page, viewport);
      await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
      const entrance = await page.getByTestId("menu-grid").getAttribute("data-menu-entrance");
      const first = await readCard(page, 0);
      expect(first?.opacity).toBe("1");

      const target = await page.evaluate(() => {
        const cards = [...document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']")];
        return cards.findIndex((card) => card.getBoundingClientRect().top > window.innerHeight + 8);
      });
      expect(target, "hace falta una tarjeta normal completamente bajo el pliegue").toBeGreaterThanOrEqual(0);

      const samples: Array<NonNullable<Awaited<ReturnType<typeof readCard>>>> = [];
      let frameCount = 0;
      let pressedNote = "";
      let pressSkips = 0;
      for (let step = 0; step < 110; step += 1) {
        const sample = await readCard(page, target);
        if (sample) samples.push(sample);
        if (!pressedNote && sample && sample.ratio > 0.22 && sample.ratio < 0.9) {
          const point = await page.evaluate((index) => {
            const card = document.querySelectorAll<HTMLElement>("[data-testid='menu-dish-row']")[index];
            if (!card) return null;
            const rect = card.getBoundingClientRect();
            const visibleTop = Math.max(rect.top, 72);
            const visibleBottom = Math.min(rect.bottom, window.innerHeight - 24);
            const y = visibleTop + (visibleBottom - visibleTop) * 0.55;
            if (visibleBottom - visibleTop < 36 || y < rect.top + 8 || y > rect.bottom - 8) return null;
            return { x: rect.left + Math.min(rect.width * 0.42, rect.width - 28), y };
          }, target);
          if (!point) {
            pressSkips += 1;
          } else {
            await page.evaluate(() => {
              const guard = (event: Event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
              };
              document.addEventListener("click", guard, true);
              (window as Window & { __pressGuard?: (event: Event) => void }).__pressGuard = guard;
            });
            const hit = await page.evaluate(({ x, y }) => {
              const node = document.elementFromPoint(x, y);
              return node?.closest("[data-testid='menu-dish-row']") ? "menu-dish-row" : (node?.tagName ?? "none");
            }, point);
            await page.mouse.move(point.x, point.y);
            await page.mouse.down();
            await page.waitForTimeout(240);
            const pressed = await readCard(page, target);
            const active = await page.evaluate(() => Boolean(document.querySelector("[data-testid='menu-dish-row']:active")));
            await page.mouse.move(8, 8);
            await page.mouse.up();
            await page.evaluate(() => {
              const bag = window as Window & { __pressGuard?: (event: Event) => void };
              if (bag.__pressGuard) document.removeEventListener("click", bag.__pressGuard, true);
              bag.__pressGuard = undefined;
            });
            pressedNote = JSON.stringify({
              hit,
              active,
              article: pressed?.articleTransform,
              rise: pressed?.riseTransform,
              state: pressed?.rise,
              ratio: pressed?.ratio,
            });
            expect(hit, pressedNote).toBe("menu-dish-row");
            expect(pressed, pressedNote).not.toBeNull();
            if (pressed) {
              const horizontal = viewport.width < 1024;
              expect(active, pressedNote).toBe(true);
              expect(scaleX(pressed.riseTransform), pressedNote).toBeGreaterThan(0.99);
              expect(Math.abs(horizontal ? translateX(pressed.riseTransform) : translateY(pressed.riseTransform)), pressedNote).toBeGreaterThan(4);
              expect(Math.abs(horizontal ? translateY(pressed.riseTransform) : translateX(pressed.riseTransform)), pressedNote).toBeLessThan(1.5);
              if (info.project.name !== "mobile-webkit") {
                expect(Number(pressed.articleScale), pressedNote).toBeLessThan(0.995);
              }
            }
          }
        }
        if (sample && frameCount < 3) {
          const horizontal = viewport.width < 1024;
          const offset = Math.abs(horizontal ? translateX(sample.riseTransform) : translateY(sample.riseTransform));
          const ready = horizontal
            ? ((frameCount === 0 && sample.ratio > 0.18 && offset > 28) ||
              (frameCount === 1 && sample.ratio > 0.32 && offset > 12 && offset < 48) ||
              (frameCount === 2 && sample.ratio > 0.45 && offset > 1 && offset < 16))
            : ((frameCount === 0 && sample.ratio > 0.18 && offset > 10) ||
              (frameCount === 1 && sample.ratio > 0.32 && offset > 5 && offset < 16) ||
              (frameCount === 2 && sample.ratio > 0.45 && offset > 1 && offset < 8));
          if (ready) {
            frameCount += 1;
            const dir = "artifacts/t8b/frames";
            mkdirSync(dir, { recursive: true });
            await page.screenshot({
              path: `${dir}/${info.project.name}-${viewport.id}-entrada-${frameCount}.png`,
              caret: "initial",
            });
          }
        }
        if (sample?.rise === "done" && sample.ratio > 0.55) break;
        await page.evaluate(() => window.scrollBy(0, 16));
        await page.waitForTimeout(viewport.id === "mobile" ? 45 : 30);
      }

      const horizontal = viewport.width < 1024;
      const visibleMotion = samples.filter((sample) => sample.ratio >= 0.2 && sample.ratio <= 0.9);
      const travel = visibleMotion.map((sample) =>
        horizontal ? translateX(sample.riseTransform) : translateY(sample.riseTransform),
      );
      expect(visibleMotion.every((sample) => Math.abs(horizontal ? translateY(sample.riseTransform) : translateX(sample.riseTransform)) < 2)).toBe(true);
      const span = travel.length > 0 ? Math.max(...travel) - Math.min(...travel) : 0;
      const viewTimeline = await page.evaluate(() => {
        try {
          return typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");
        } catch {
          return false;
        }
      });
      evidence.push({ viewport, entrance, viewTimeline, span, pressSkips, samples });
      const evidenceDir = "artifacts/t8b";
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(`${evidenceDir}/${info.project.name}-lento.json`, JSON.stringify(evidence, null, 2));
      expect(pressedNote, `la tarjeta no se pulsó durante la entrada (omisiones ${pressSkips})`).not.toBe("");
      expect(span, `${viewport.id} ${entrance} recorrido visible`).toBeGreaterThanOrEqual(8);
      expect(samples.some((sample) => sample.opacity === "1")).toBe(true);

      const seen = await readCard(page, target);
      expect(Math.abs(translateY(seen?.riseTransform ?? "none"))).toBeLessThan(2);
      expect(Math.abs(translateX(seen?.riseTransform ?? "none"))).toBeLessThan(2);

      await page.evaluate(() => window.scrollBy(0, -520));
      await page.waitForTimeout(120);
      const replay: number[] = [];
      for (let step = 0; step < 24; step += 1) {
        const sample = await readCard(page, target);
        if (sample && sample.ratio > 0.2) {
          replay.push(Math.max(Math.abs(translateX(sample.riseTransform)), Math.abs(translateY(sample.riseTransform))));
        }
        await page.evaluate(() => window.scrollBy(0, 36));
        await page.waitForTimeout(30);
      }
      expect(replay.length).toBeGreaterThan(0);
      expect(Math.max(...replay.map((value) => Math.abs(value)))).toBeLessThan(2);

      await expect.poll(async () => (await readCard(page, target))?.rise).toBe("done");
      const linkName = await page.getByTestId("menu-dish-row").nth(target).locator("h3").innerText();
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

      await expect(async () => {
        if (/\/plato\//.test(page.url())) await page.getByRole("button", { name: "Volver" }).click();
        await expect(page).toHaveURL(motionRowCatalogPath(page) === "/buscar" ? /\/buscar$/ : /\/menu$/, { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-menu-entrance", "settled");
      const returned = await readCard(page, 0);
      expect(returned?.opacity).toBe("1");
      expect(Math.abs(translateY(returned?.riseTransform ?? "none"))).toBeLessThan(1.5);

      if (viewport.id === "desktop" && info.project.name === "desktop") {
        await page.evaluate(() => {
          document.documentElement.style.scrollBehavior = "auto";
          document.querySelector("[data-testid='menu-dish-row']")?.scrollIntoView({ block: "center", behavior: "instant" });
        });
        await page.getByTestId("menu-dish-row").first().hover({ position: { x: 48, y: 110 } });
        await page.waitForTimeout(280);
        const hovered = await readCard(page, 0);
        const hoverState = await page.evaluate(() => {
          const card = document.querySelector("[data-testid='menu-dish-row']");
          return {
            hover: Boolean(card?.matches(":hover")),
            fine: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
          };
        });
        expect(hoverState.fine, JSON.stringify(hoverState)).toBe(true);
        expect(hoverState.hover, JSON.stringify({ ...hoverState, article: hovered?.articleTransform })).toBe(true);
        expect(Math.abs(translateY(hovered?.articleTransform ?? "none")), JSON.stringify(hoverState)).toBeGreaterThan(1);
        expect(Math.abs(translateY(hovered?.riseTransform ?? "none"))).toBeLessThan(1.5);
      }
    }

    const dir = "artifacts/t8b";
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${info.project.name}-lento.json`, JSON.stringify(evidence, null, 2));
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("scroll rápido no deja tarjetas fuera de sitio", async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors = watchHydration(page);
    const viewport = casesFor(info.project.name)[0];
    if (!viewport) return;
    await openMenu(page, viewport);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(900);
    const stuck = await page.evaluate(() => {
      return [...document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']")].map((card) => {
        const image = card.querySelector("img");
        const rect = card.getBoundingClientRect();
        const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        return {
          transform: getComputedStyle(card).transform,
          opacity: image ? getComputedStyle(image).opacity : "",
          ratio: rect.height > 0 ? Math.max(0, visible) / rect.height : 0,
        };
      });
    });
    const dir = "artifacts/t8b/frames";
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${info.project.name}-rapido.png`, caret: "initial" });
    expect(stuck.every((card) => card.opacity === "1")).toBe(true);
    expect(stuck.every((card) => Math.abs(translateY(card.transform)) < 2 && Math.abs(translateX(card.transform)) < 2)).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("visita guardada y movimiento reducido nacen en reposo", async ({ page }, info) => {
    const errors = watchHydration(page);
    await page.addInitScript(() => {
      const bag = window as Window & { __riseTrace?: number[]; __riseError?: string };
      try {
        window.sessionStorage.setItem("rb-menu-grid-visited", "1");
        const trace: number[] = [];
        const read = (transform: string) => {
          const matrix = transform.match(/matrix\(([^)]+)\)/);
          if (!matrix?.[1]) return 0;
          const parts = matrix[1].split(",").map((part) => Number(part.trim()));
          if (parts.length !== 6) return 0;
          return Math.max(Math.abs(parts[4] ?? 0), Math.abs(parts[5] ?? 0));
        };
        const sample = () => {
          document.querySelectorAll<HTMLElement>("[data-testid='menu-card-rise']").forEach((card) => {
            trace.push(read(getComputedStyle(card).transform));
          });
          bag.__riseTrace = trace;
        };
        const timer = window.setInterval(sample, 16);
        window.setTimeout(() => window.clearInterval(timer), 2000);
      } catch (error) {
        bag.__riseError = error instanceof Error ? error.message : String(error);
      }
    });
    await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
    await skipOnboarding(page);
    await page.goto(motionRowCatalogPath(page));
    await page.waitForSelector("[data-testid='menu-card-rise']");
    await page.waitForTimeout(300);
    const trace = await page.evaluate(() => {
      const bag = window as Window & { __riseTrace?: number[]; __riseError?: string };
      return { values: bag.__riseTrace ?? [], error: bag.__riseError ?? "" };
    });
    expect(trace.values.length, trace.error).toBeGreaterThan(0);
    expect(Math.max(...trace.values.map((value) => Math.abs(value)))).toBeLessThan(1.5);
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-menu-entrance", "settled");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
    await page.reload();
    await page.waitForSelector("[data-testid='menu-card-rise']");
    const reduced = await readCard(page, 0);
    expect(reduced?.opacity).toBe("1");
    expect(Math.abs(translateY(reduced?.riseTransform ?? "none"))).toBeLessThan(1.5);
    expect(Math.abs(translateX(reduced?.riseTransform ?? "none"))).toBeLessThan(1.5);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(200);
    const after = await readCard(page, 0);
    expect(Math.abs(translateY(after?.riseTransform ?? "none"))).toBeLessThan(1.5);
    expect(Math.abs(translateX(after?.riseTransform ?? "none"))).toBeLessThan(1.5);
    expect(errors, errors.join("\n")).toEqual([]);
    const dir = "artifacts/t8b/frames";
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${info.project.name}-reducido.png`, caret: "initial" });
  });
});
