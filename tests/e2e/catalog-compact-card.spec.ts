import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, LONG_DISH_NAME, skipOnboarding } from "./helpers";

const evidenceDir = "artifacts/compact-cards";
const VISIBLE_LONG_NAME = "Parrillada de ternera completa";

test.use({ video: "on", serviceWorkers: "block" });

async function openCompactLab(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/visual-lab");
  await page.locator("#lab-scene").selectOption("compactas");
  await page.getByRole("button", { name: String(width), exact: true }).click();
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  await page.getByTestId("lab-frame").evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  await page.waitForFunction(() => {
    const root = document.querySelector("[data-compact-scroll-root]");
    const cards = [...document.querySelectorAll("[data-testid='compact-state-list'] [data-testid='compact-dish-card']")];
    if (!root || cards.length < 4) return false;
    const view = root.getBoundingClientRect();
    return cards.every((card) => {
      const rect = card.getBoundingClientRect();
      const visible = Math.min(rect.bottom, view.bottom) - Math.max(rect.top, view.top);
      const phase = card.getAttribute("data-compact-phase");
      if (visible < rect.height * 0.65) return phase === "hold" || phase === "done" || phase === "rest";
      return phase === "done" || phase === "rest";
    });
  });
}

function slots(viewportHeight: number, cardHeight: number, gap = 12): number {
  if (cardHeight <= 0) return 0;
  return Math.floor((viewportHeight + gap) / (cardHeight + gap));
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
});

test("mide la comparación en 320×568 y 390×844", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  mkdirSync(evidenceDir, { recursive: true });
  const measures: Record<string, unknown> = {};

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ] as const) {
    await openCompactLab(page, viewport.width, viewport.height);
    const name = `${viewport.width}x${viewport.height}`;
    const shot = `${name}-${testInfo.project.name}`;
    const longCard = page.getByRole("heading", { name: VISIBLE_LONG_NAME }).locator("xpath=ancestor::*[@data-testid='compact-dish-card']");
    await longCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceDir}/${shot}-asentada.png` });

    const current = page.getByTestId("compact-current").getByTestId("menu-dish-row");
    const dinner = page.locator("[data-testid='compact-state-list'] [data-service-period='dinner']");
    const [currentBox, dinnerBox, longBox, photoBox, favoriteBox, addBox] = await Promise.all([
      current.boundingBox(),
      dinner.boundingBox(),
      longCard.boundingBox(),
      dinner.locator("[data-compact-photo]").boundingBox(),
      dinner.getByRole("button", { name: /favorito/i }).boundingBox(),
      dinner.getByRole("button", { name: /añadir .* al carrito/i }).boundingBox(),
    ]);
    expect(currentBox).not.toBeNull();
    expect(dinnerBox).not.toBeNull();
    expect(longBox).not.toBeNull();
    expect(photoBox).not.toBeNull();
    expect(favoriteBox).not.toBeNull();
    expect(addBox).not.toBeNull();

    expect(photoBox!.width).toBeGreaterThanOrEqual(96);
    expect(photoBox!.width).toBeLessThanOrEqual(104);
    expect(photoBox!.x).toBeLessThan(dinnerBox!.x + dinnerBox!.width / 2);
    expect(favoriteBox!.width).toBeGreaterThanOrEqual(44);
    expect(favoriteBox!.height).toBeGreaterThanOrEqual(44);
    expect(addBox!.width).toBeGreaterThanOrEqual(44);
    expect(addBox!.height).toBeGreaterThanOrEqual(44);
    expect(dinnerBox!.height).toBeGreaterThanOrEqual(150);
    expect(dinnerBox!.height).toBeLessThanOrEqual(185);
    expect(longBox!.height).toBeGreaterThanOrEqual(150);
    expect(longBox!.height).toBeLessThanOrEqual(185);
    expect(currentBox!.height).toBeGreaterThan(longBox!.height);
    expect(longBox!.x).toBeGreaterThanOrEqual(-1);
    expect(longBox!.x + longBox!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(longBox!.y + longBox!.height).toBeLessThanOrEqual(viewport.height + 1);

    const stateHeights = await page.locator("[data-testid='compact-state-list'] [data-testid='compact-dish-card']").evaluateAll((cards) => {
      return cards.map((card) => card.getBoundingClientRect().height);
    });
    for (const height of stateHeights) {
      expect(height).toBeGreaterThanOrEqual(150);
      expect(height).toBeLessThanOrEqual(185);
    }

    const photo = dinner.locator("[data-compact-photo] img");
    await expect(photo).toBeVisible();
    const photoOpacity = await photo.evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(photoOpacity).toBeGreaterThan(0.95);

    const longHeading = page.getByRole("heading", { name: VISIBLE_LONG_NAME });
    await expect(longHeading).toBeVisible();
    await expect(longCard.getByRole("link", { name: `Ver ${LONG_DISH_NAME}` })).toBeAttached();
    const nameFits = await longHeading.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        element.scrollHeight <= element.clientHeight + 1 &&
        element.scrollWidth <= element.clientWidth + 1 &&
        style.webkitLineClamp === "2"
      );
    });
    expect(nameFits).toBe(true);

    const soldOut = page.locator("[data-testid='compact-state-list'] [data-testid='compact-dish-card']").filter({ hasText: "Agotado" });
    await expect(soldOut).not.toContainText("Puede llevar sopa");
    await expect(page.getByTestId("compact-simulated-note")).toBeVisible();
    const soupCard = page.locator("[data-testid='compact-fill-list'] [data-testid='compact-dish-card']").filter({ hasText: "Sopas" }).first();
    await expect(soupCard).not.toContainText("Puede llevar sopa");

    const price = longCard.locator(".tabular-nums");
    const priceText = (await price.innerText()).trim();
    expect(priceText.length).toBeGreaterThan(4);
    expect(priceText).not.toMatch(/…|\.\.\./);
    const priceFits = await price.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(priceFits).toBe(true);

    const names = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll<HTMLElement>("[data-compact-photo], .menu-dish-photo")];
      return nodes.map((node) => getComputedStyle(node).viewTransitionName);
    });
    const transitions = names.filter((entry) => entry && entry !== "none");
    expect(new Set(transitions).size).toBe(transitions.length);
    expect(transitions.filter((entry) => entry.includes("carne-asada-plato-con-cebolleta"))).toHaveLength(1);

    expect(await expectNoHorizontalScroll(page)).toBe(true);
    const frameFits = await page.locator("[data-compact-scroll-root]").evaluate((element) => {
      return element.scrollWidth <= element.clientWidth + 1;
    });
    expect(frameFits).toBe(true);

    await page.getByTestId("compact-fill-list").evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
    await page.screenshot({ path: `${evidenceDir}/${name}-pantalla.png` });
    const visibleFill = await page.locator("[data-compact-scroll-root]").evaluate((element) => {
      const view = element.getBoundingClientRect();
      return [...element.querySelectorAll<HTMLElement>("[data-testid='compact-fill-list'] [data-testid='compact-dish-card']")].filter((card) => {
        const rect = card.getBoundingClientRect();
        const visible = Math.min(rect.bottom, view.bottom) - Math.max(rect.top, view.top);
        return visible > rect.height * 0.6;
      }).length;
    });

    measures[shot] = {
      viewport,
      currentHeight: Math.round(currentBox!.height),
      dinnerHeight: Math.round(dinnerBox!.height),
      longHeight: Math.round(longBox!.height),
      photoWidth: Math.round(photoBox!.width),
      photoHeight: Math.round(photoBox!.height),
      favorite: { width: Math.round(favoriteBox!.width), height: Math.round(favoriteBox!.height) },
      add: { width: Math.round(addBox!.width), height: Math.round(addBox!.height) },
      priceText,
      fitsIn568: {
        actual: slots(568, currentBox!.height),
        compactaCorta: slots(568, dinnerBox!.height),
        compactaLarga: slots(568, longBox!.height),
      },
      fitsIn844: {
        actual: slots(844, currentBox!.height),
        compactaCorta: slots(844, dinnerBox!.height),
        compactaLarga: slots(844, longBox!.height),
      },
      visibleFillInFrame: visibleFill,
    };
  }

  writeFileSync(`${evidenceDir}/measures.json`, JSON.stringify(measures, null, 2));
});

test("la tarjeta completa entra desde la derecha y el scroll se graba", async ({ page }) => {
  test.setTimeout(120_000);
  await openCompactLab(page, 390, 844);

  const trace = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>("[data-testid='lab-replay']");
    button?.click();
    return new Promise<{ samples: number[]; from: string; end: string; gapStable: boolean; cardMoved: boolean }>(
      (resolve) => {
        const samples: number[] = [];
        let from = "";
        let end = "";
        let gapStable = false;
        let cardMoved = false;
        let paused = false;
        const started = performance.now();
        const tick = () => {
          const card = document.querySelector<HTMLElement>(
            "[data-testid='compact-state-list'] [data-testid='compact-dish-card']",
          );
          if (card) {
            const transform = getComputedStyle(card).transform;
            const tx = transform.startsWith("matrix(")
              ? Number(transform.slice(7, -1).split(",")[4])
              : 0;
            samples.push(Number.isFinite(tx) ? tx : 0);
            const animation = card.getAnimations()[0];
            if (animation && !paused) {
              paused = true;
              animation.pause();
              animation.currentTime = 0;
              from = getComputedStyle(card).transform;
              const photo = card.querySelector("[data-compact-photo]")?.getBoundingClientRect();
              const title = card.querySelector("h3")?.getBoundingClientRect();
              animation.currentTime = 360;
              end = getComputedStyle(card).transform;
              const photoEnd = card.querySelector("[data-compact-photo]")?.getBoundingClientRect();
              const titleEnd = card.querySelector("h3")?.getBoundingClientRect();
              if (photo && title && photoEnd && titleEnd) {
                gapStable = Math.abs(title.left - photo.right - (titleEnd.left - photoEnd.right)) < 1.5;
                cardMoved = Math.abs(photoEnd.left - photo.left) > 40;
              }
              animation.play();
            }
          }
          if (performance.now() - started < 900) requestAnimationFrame(tick);
          else resolve({ samples, from, end, gapStable, cardMoved });
        };
        requestAnimationFrame(tick);
      },
    );
  });

  const translateX = (transform: string) => {
    if (!transform.startsWith("matrix(")) return 0;
    return Number(transform.slice(7, -1).split(",")[4]);
  };
  expect(Math.max(...trace.samples, translateX(trace.from))).toBeGreaterThan(40);
  expect(translateX(trace.from)).toBeGreaterThan(80);
  expect(Math.abs(translateX(trace.end))).toBeLessThan(1);
  expect(trace.gapStable).toBe(true);
  expect(trace.cardMoved).toBe(true);

  const sawEntranceWhileScrolling = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("[data-compact-scroll-root]");
    if (!root) return { saw: false, slowSteps: 0, fastDelta: 0, before: [], after: [] };
    const phases = () =>
      [...document.querySelectorAll<HTMLElement>("[data-testid='compact-fill-list'] [data-testid='compact-dish-card']")].map(
        (card) => card.dataset.compactPhase ?? "",
      );
    const before = phases();
    let saw = false;
    const max = Math.max(0, root.scrollHeight - root.clientHeight);
    const target = Math.min(max, root.scrollTop + 720);
    let steps = 0;
    while (root.scrollTop < target - 1 && steps < 40) {
      const previous = root.scrollTop;
      root.scrollTop = Math.min(target, previous + 36);
      if (root.scrollTop === previous) break;
      steps += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 90));
      if (document.querySelector("[data-testid='compact-fill-list'] [data-compact-phase='play']")) saw = true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const after = phases();
    if (before.some((phase, index) => phase === "hold" && (after[index] === "play" || after[index] === "done"))) {
      saw = true;
    }
    const fastBefore = root.scrollTop;
    root.scrollTop = Math.min(max, fastBefore + 520);
    return { saw, slowSteps: steps, fastDelta: root.scrollTop - fastBefore, before, after };
  });
  expect(sawEntranceWhileScrolling.slowSteps).toBeGreaterThan(3);
  expect(sawEntranceWhileScrolling.saw, JSON.stringify(sawEntranceWhileScrolling)).toBe(true);
  expect(await expectNoHorizontalScroll(page)).toBe(true);
});

test("a 320 px el texto, el precio y los botones quedan dentro al asentarse", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/visual-lab");
  await page.locator("#lab-scene").selectOption("compactas");
  await page.getByRole("button", { name: "320", exact: true }).click();
  const card = page.getByRole("heading", { name: VISIBLE_LONG_NAME }).locator("xpath=ancestor::*[@data-testid='compact-dish-card']");
  await expect(card).toBeVisible();

  const trace = await page.evaluate((title) => {
    const button = document.querySelector<HTMLButtonElement>("[data-testid='lab-replay']");
    button?.click();
    return new Promise<{ maxTx: number }>((resolve) => {
      let maxTx = 0;
      let measured = false;
      const started = performance.now();
      const tick = () => {
        const heading = [...document.querySelectorAll("h3")].find((node) => node.textContent?.includes(title));
        const shell = heading?.closest<HTMLElement>("[data-testid='compact-dish-card']");
        shell?.scrollIntoView({ block: "center" });
        const animation = shell?.getAnimations()[0];
        if (shell && animation && !measured) {
          measured = true;
          animation.pause();
          animation.currentTime = 0;
          const transform = getComputedStyle(shell).transform;
          if (transform.startsWith("matrix(")) {
            const tx = Number(transform.slice(7, -1).split(",")[4]);
            if (Number.isFinite(tx)) maxTx = tx;
          }
          animation.play();
        }
        if (performance.now() - started < 800) requestAnimationFrame(tick);
        else resolve({ maxTx });
      };
      requestAnimationFrame(tick);
    });
  }, VISIBLE_LONG_NAME);
  expect(trace.maxTx).toBeGreaterThan(80);

  await page.waitForFunction((title) => {
    const heading = [...document.querySelectorAll("h3")].find((node) => node.textContent?.includes(title));
    return heading?.closest("[data-testid='compact-dish-card']")?.getAttribute("data-compact-phase") === "done";
  }, VISIBLE_LONG_NAME);
  await card.scrollIntoViewIfNeeded();
  const settled = await card.evaluate((element) => {
    const view = { width: window.innerWidth, height: window.innerHeight };
    const nodes = [
      element.querySelector("h3"),
      element.querySelector(".tabular-nums"),
      element.querySelector(".menu-card-soup"),
      ...element.querySelectorAll("button, a"),
    ].filter((node): node is HTMLElement => node instanceof HTMLElement);
    const favorite = element.querySelector("button");
    const soup = element.querySelector(".menu-card-soup");
    let soupClear = true;
    if (soup && favorite) {
      const soupBox = soup.getBoundingClientRect();
      const favoriteBox = favorite.getBoundingClientRect();
      soupClear = soupBox.right <= favoriteBox.left + 1 || soupBox.bottom <= favoriteBox.top + 1;
    }
    return {
      soupClear,
      pieces: nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          label: node.getAttribute("aria-label") || node.textContent?.trim() || node.tagName,
          inside: rect.width > 0 && rect.left >= -1 && rect.right <= view.width + 1 && rect.bottom <= view.height + 1 && rect.top >= -1,
        };
      }),
    };
  });
  expect(settled.pieces.length).toBeGreaterThan(3);
  expect(settled.soupClear).toBe(true);
  for (const piece of settled.pieces) expect(piece.inside, JSON.stringify(piece)).toBe(true);
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/320x568-recorrido-${testInfo.project.name}.png` });
});

test("con movimiento reducido el primer frame ya está en reposo", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCompactLab(page, 390, 844);
  await page.reload();
  await page.locator("#lab-scene").selectOption("compactas");
  await page.getByRole("button", { name: "390", exact: true }).click();
  const card = page.getByTestId("compact-dish-card").first();
  await expect(card).toBeVisible();
  const first = await card.evaluate((element) => ({
    phase: element.getAttribute("data-compact-phase"),
    transform: getComputedStyle(element).transform,
    opacity: getComputedStyle(element).opacity,
  }));
  expect(first.phase).toBe("rest");
  expect(first.transform).toBe("none");
  expect(first.opacity).toBe("1");
  const photoOpacity = await card.locator("[data-compact-photo] img").evaluate((element) => {
    return Number(getComputedStyle(element).opacity);
  });
  expect(photoOpacity).toBeGreaterThan(0.95);

  await page.locator("[data-compact-scroll-root]").evaluate((element) => {
    element.scrollTop += 500;
  });
  const phases = await page.locator("[data-testid='compact-dish-card']").evaluateAll((cards) => {
    return cards.map((element) => element.getAttribute("data-compact-phase"));
  });
  expect(phases.every((phase) => phase === "rest")).toBe(true);
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/390x844-reducido.png` });
});

test("en escritorio el marco de 390 no desborda la página", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "La grabación ancha solo corresponde al proyecto desktop.");
  await page.goto("/visual-lab");
  await page.locator("#lab-scene").selectOption("compactas");
  await page.getByRole("button", { name: "390", exact: true }).click();
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  expect(await expectNoHorizontalScroll(page)).toBe(true);
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/desktop-marco.png` });
});
