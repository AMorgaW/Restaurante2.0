import { expect, test, type Locator, type Page } from "@playwright/test";
import { COMPACT_CARD_ENTER_RATIO } from "@/lib/menu/compact-card-entrance";
import { expectNoHorizontalScroll, LONG_DISH_NAME, skipOnboarding } from "./helpers";

test.use({ serviceWorkers: "block" });

const devNoise = /favicon|third-party cookie|ChunkLoadError|turbopack-hmr|webpack\.hot-update|hot-update\.json due to access control checks|__nextjs_original-stack-frames|Transition was aborted because of timeout/i;
const VISIBLE_LONG_NAME = "Parrillada de ternera completa";
const COMPACT_PEEK_PX = 48;
const CATEGORY_EVIDENCE_DIR = "artifacts/visual-comparison/work/menu-categories-compact";

type CompactGate = {
  phase: string | null;
  top: number;
  height: number;
  visible: number;
  ratio: number;
  inBand: boolean;
};

function formatCompactGate(gate: CompactGate) {
  return `fase=${gate.phase ?? "ausente"} top=${gate.top.toFixed(1)} alto=${gate.height.toFixed(1)} visible=${gate.visible.toFixed(1)} ratio=${gate.ratio.toFixed(3)} enBanda=${gate.inBand}`;
}

async function readCompactGate(page: Page): Promise<CompactGate> {
  return page.evaluate(
    ({ enterRatio, peekPx }) => {
      const card = document.querySelector<HTMLElement>(
        "[data-catalog-pane='compact'] [data-testid='compact-dish-card']",
      );
      if (!card) return { phase: null, top: 0, height: 0, visible: 0, ratio: 0, inBand: false };
      const rect = card.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const ratio = rect.height > 0 ? visible / rect.height : 0;
      const inBand = ratio >= enterRatio || (visible >= peekPx && rect.top < window.innerHeight);
      return {
        phase: card.getAttribute("data-compact-phase"),
        top: rect.top,
        height: rect.height,
        visible,
        ratio,
        inBand,
      };
    },
    { enterRatio: COMPACT_CARD_ENTER_RATIO, peekPx: COMPACT_PEEK_PX },
  );
}

async function bringFirstCompactIntoBand(page: Page) {
  const opening = await readCompactGate(page);
  if (opening.inBand || opening.phase === "done" || opening.phase === "rest") return opening;
  return page.evaluate(
    async ({ enterRatio, peekPx }) => {
      const card = document.querySelector<HTMLElement>(
        "[data-catalog-pane='compact'] [data-testid='compact-dish-card']",
      );
      const read = () => {
        if (!card) return { phase: null, top: 0, height: 0, visible: 0, ratio: 0, inBand: false };
        const rect = card.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const ratio = rect.height > 0 ? visible / rect.height : 0;
        const inBand = ratio >= enterRatio || (visible >= peekPx && rect.top < window.innerHeight);
        return {
          phase: card.getAttribute("data-compact-phase"),
          top: rect.top,
          height: rect.height,
          visible,
          ratio,
          inBand,
        };
      };
      for (let step = 0; step < 24; step += 1) {
        const gate = read();
        if (gate.inBand) return gate;
        const before = window.scrollY;
        const delta = gate.top >= window.innerHeight
          ? Math.max(peekPx, gate.top - window.innerHeight + peekPx + 8)
          : Math.max(peekPx, peekPx - gate.visible + 8);
        window.scrollTo({ top: before + delta, left: 0, behavior: "instant" });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (Math.abs(window.scrollY - before) < 1) return read();
      }
      return read();
    },
    { enterRatio: COMPACT_CARD_ENTER_RATIO, peekPx: COMPACT_PEEK_PX },
  );
}

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

async function freshMenu(page: Page, width: number, height: number) {
  await page.addInitScript(() => {
    const samples: number[] = [];
    const tick = () => {
      const card = document.querySelector<HTMLElement>(
        "[data-catalog-pane='compact'] [data-testid='compact-dish-card']",
      );
      if (card) {
        const transform = getComputedStyle(card).transform;
        const x = transform.startsWith("matrix(") ? Number(transform.split(",")[4]) : 0;
        samples.push(Number.isFinite(x) ? x : 0);
      }
      if (samples.length < 28) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    Object.assign(window, { __compactSamples: samples });
  });
  await page.setViewportSize({ width, height });
  if (page.url().startsWith("http")) {
    await page.evaluate(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
  }
  await page.goto("/menu");
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
}

/** WebKit puede pintar antes de que React atienda el primer controlado. */
async function selectSortWhenHydrated(page: Page, value: "recomendados" | "nombre") {
  await expect(async () => {
    await page.selectOption("#menu-sort", value);
    await expect(page.locator("#menu-sort")).toHaveValue(value);
  }).toPass({ timeout: 20_000 });
}

async function openCompactDetailWhenHydrated(page: Page, link: Locator) {
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/plato\//);
  await expect(async () => {
    await link.click();
    await expect(page).toHaveURL(new RegExp(href ?? "/plato/"));
  }).toPass({ timeout: 20_000 });
}

function jumpedRight(samples: number[]) {
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1] ?? 0;
    const current = samples[index] ?? 0;
    if (previous <= 8) continue;
    if (current > previous + 2) return { index, previous, current };
  }
  return null;
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
  await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
});

test("la primera visita del menú real entra sin salto y aguanta el scroll", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await freshMenu(page, viewport.width, viewport.height);
    const cards = page.locator("[data-catalog-pane='compact'] [data-testid='compact-dish-card']");
    expect(await cards.count()).toBeGreaterThan(3);
    await expect(page.getByTestId("menu-dish-row").first()).toBeHidden();

    const photo = cards.first().locator("[data-compact-photo] img");
    await expect(photo).toBeVisible();
    const photoOpacity = await photo.evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(photoOpacity).toBeGreaterThan(0.95);

    const samples = await page.evaluate(() => {
      const value = (window as unknown as { __compactSamples?: number[] }).__compactSamples;
      return value ?? [];
    });
    expect(samples.length).toBeGreaterThan(8);
    expect(jumpedRight(samples), JSON.stringify(samples)).toBeNull();
    expect(Math.max(...samples)).toBeGreaterThan(40);

    const longCard = page.getByRole("heading", { name: VISIBLE_LONG_NAME }).locator("xpath=ancestor::*[@data-testid='compact-dish-card']");
    await longCard.scrollIntoViewIfNeeded();
    await expect(longCard.getByRole("link", { name: `Ver ${LONG_DISH_NAME}` })).toBeAttached();
    const favorite = await longCard.getByRole("button", { name: /favorito/i }).boundingBox();
    const add = await longCard.getByRole("link", { name: /elegir sopa/i }).boundingBox();
    const photoBox = await longCard.locator("[data-compact-photo]").boundingBox();
    const cardBox = await longCard.boundingBox();
    expect(Math.round(favorite?.width ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(favorite?.height ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(add?.width ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(add?.height ?? 0)).toBeGreaterThanOrEqual(44);
    expect(photoBox!.x).toBeLessThan((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2);
    expect(await expectNoHorizontalScroll(page)).toBe(true);

    await longCard.getByRole("link", { name: `Ver ${LONG_DISH_NAME}` }).focus();
    await page.keyboard.press("Tab");
    await expect(longCard.getByRole("button", { name: /favorito/i })).toBeFocused();
  }

  const slow = await page.evaluate(async () => {
    const pending = [...document.querySelectorAll<HTMLElement>("[data-catalog-pane='compact'] [data-compact-phase='hold']")];
    const card = pending[0];
    if (!card) return { tracked: false, samples: [] as number[] };
    const samples: number[] = [];
    const read = () => {
      const transform = getComputedStyle(card).transform;
      samples.push(transform.startsWith("matrix(") ? Number(transform.split(",")[4]) : 0);
    };
    read();
    for (let step = 0; step < 8; step += 1) {
      window.scrollBy({ top: 28, behavior: "instant" });
      await new Promise((resolve) => window.setTimeout(resolve, 70));
      read();
    }
    const before = window.scrollY;
    window.scrollBy({ top: 900, behavior: "instant" });
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    read();
    return { tracked: true, samples, moved: window.scrollY - before };
  });
  if (slow.tracked) {
    expect(jumpedRight(slow.samples), JSON.stringify(slow)).toBeNull();
    expect(slow.moved).toBeGreaterThan(200);
  }
  expect(await expectNoHorizontalScroll(page)).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("carnes respeta la visita compartida con /menu", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => window.sessionStorage.setItem("rb-menu-grid-visited", "1"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/carnes");
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  await expect(page.getByTestId("menu-dish-row").first()).toBeHidden();
  const categorySettled = await page.evaluate(() => {
    return [...document.querySelectorAll<HTMLElement>("[data-catalog-pane='compact'] [data-testid='compact-dish-card']")]
      .map((card) => ({ phase: card.dataset.compactPhase, transform: getComputedStyle(card).transform }));
  });
  expect(categorySettled.every((card) => card.phase !== "play" && card.phase !== "hold" && !/96/.test(card.transform)), JSON.stringify(categorySettled)).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("genera evidencia de carnes y sopas en 320 y 390 px", async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name !== "mobile-chromium", "La evidencia visual se conserva una sola vez.");
  test.setTimeout(120_000);
  for (const route of ["carnes", "sopas"] as const) {
    for (const viewport of [
      { name: "320x568", width: 320, height: 568 },
      { name: "390x844", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/menu/${route}`);
      if (route === "carnes") {
        await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
        await page.addStyleTag({ content: '[data-testid="compact-dish-card"] { animation: none !important; transform: none !important; }' });
      } else {
        await expect(page.getByTestId("lunch-soup-banner")).toBeVisible();
        await expect(page.getByRole("heading", { name: "No encontramos platos con esa búsqueda" })).toBeVisible();
      }
      expect(await expectNoHorizontalScroll(page)).toBe(true);
      await page.screenshot({ path: `${CATEGORY_EVIDENCE_DIR}/menu-${route}-${viewport.name}.png`, fullPage: false });
    }
  }
});

test("sopas conserva el estado vacío comercial y no habilita compra individual", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/sopas");
  await expect(page.getByTestId("lunch-soup-banner")).toBeVisible();
  await expect(page.getByTestId("separate-portions-note")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No encontramos platos con esa búsqueda" })).toBeVisible();
  await expect(page.getByTestId("compact-dish-card")).toHaveCount(0);
  await expect(page.getByTestId("menu-dish-row")).toHaveCount(0);
  await expect(page.locator("main a[aria-label^='Ver ']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /añadir.*carrito/i })).toHaveCount(0);
  expect(await expectNoHorizontalScroll(page)).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("carnes conserva filtros, scroll y la entrada asentada al volver del detalle", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.addInitScript(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/menu/carnes");
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  await selectSortWhenHydrated(page, "nombre");
  await page.getByRole("searchbox").fill("carne");
  await expect(page.getByRole("searchbox")).toHaveValue("carne");
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const yBefore = await page.evaluate(() => window.scrollY);

  const link = page.locator("[data-catalog-pane='compact'] a[aria-label^='Ver ']").first();
  await openCompactDetailWhenHydrated(page, link);
  await page.goBack();
  await expect(page).toHaveURL(/\/menu\/carnes$/);
  await expect(page.getByRole("searchbox")).toHaveValue("carne");
  await expect(page.locator("#menu-sort")).toHaveValue("nombre");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(Math.min(yBefore - 120, 80));
  const replay = await page.evaluate(() => {
    return [...document.querySelectorAll<HTMLElement>("[data-catalog-pane='compact'] [data-testid='compact-dish-card']")]
      .map((card) => ({ phase: card.dataset.compactPhase, transform: getComputedStyle(card).transform }));
  });
  expect(replay.every((card) => card.phase !== "play" && card.phase !== "hold"), JSON.stringify(replay)).toBe(true);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("filtros, orden y movimiento reducido dejan el menú en reposo", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await freshMenu(page, 390, 844);
  await bringFirstCompactIntoBand(page);
  await expect.poll(async () => {
    const gate = await readCompactGate(page);
    if (gate.phase === "done" || gate.phase === "rest") return "settled";
    return formatCompactGate(gate);
  }).toBe("settled");

  await page.getByRole("button", { name: "Carnes", exact: true }).click();
  await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-results-motion", "settle");
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  const afterFilter = await page.evaluate(() => {
    return {
      settled: document.getElementById("menu-compact-settle") ? "1" : "",
      shifts: [...document.querySelectorAll<HTMLElement>("[data-catalog-pane='compact'] [data-testid='compact-dish-card']")].slice(0, 4).map((card) => {
        const transform = getComputedStyle(card).transform;
        return transform.startsWith("matrix(") ? Number(transform.split(",")[4]) : 0;
      }),
      cards: [...document.querySelectorAll<HTMLElement>("[data-catalog-pane='compact'] [data-testid='compact-dish-card']")].map((card) => card.dataset.compactPhase),
    };
  });
  expect(afterFilter.settled).toBe("1");
  expect(afterFilter.shifts.every((value) => Math.abs(value) < 2), JSON.stringify(afterFilter.shifts)).toBe(true);
  expect(afterFilter.cards.every((phase) => phase === "rest" || phase === "done")).toBe(true);

  await page.selectOption("#menu-sort", "nombre");
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  await page.getByRole("searchbox").fill("carne");
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-menu-entrance", "settled");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/menu");
  const reduced = await page.locator("[data-catalog-pane='compact'] [data-testid='compact-dish-card']").first().evaluate((element) => ({
    phase: element.getAttribute("data-compact-phase"),
    transform: getComputedStyle(element).transform,
    opacity: getComputedStyle(element).opacity,
    photo: Number(getComputedStyle(element.querySelector("img") ?? element).opacity),
  }));
  expect(reduced.phase).toBe("rest");
  expect(reduced.transform, reduced.transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  expect(reduced.opacity).toBe("1");
  expect(reduced.photo).toBeGreaterThan(0.95);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("scroll lento y rápido sacan la tarjeta de hold al cruzar 48 px", async ({ page }) => {
  test.setTimeout(120_000);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    for (const speed of ["slow", "fast"] as const) {
      await freshMenu(page, viewport.width, viewport.height);
      const gate = await page.evaluate(async (mode) => {
        const peek = 48;
        const read = () => {
          const node = document.querySelector<HTMLElement>(
            "[data-catalog-pane='compact'] [data-testid='compact-dish-card']",
          );
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
          return { phase: node.dataset.compactPhase ?? "", top: rect.top, visible, innerHeight: window.innerHeight };
        };
        for (let step = 0; step < 90; step += 1) {
          const current = read();
          if (!current) return null;
          if (current.visible >= peek && current.top < window.innerHeight) return current;
          const before = window.scrollY;
          const delta = mode === "fast" ? Math.max(peek, current.top - window.innerHeight + peek + 8) : 12;
          window.scrollTo({ top: before + delta, left: 0, behavior: "instant" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (Math.abs(window.scrollY - before) < 1) return read();
        }
        return read();
      }, speed);
      expect(gate?.visible ?? 0, `${viewport.width} ${speed}`).toBeGreaterThanOrEqual(48);
      const card = page.locator("[data-catalog-pane='compact'] [data-testid='compact-dish-card']").first();
      await expect(card.locator("[data-compact-photo] img")).toBeVisible();
      await expect(card.getByRole("button", { name: /favorito/i })).toBeVisible();
    }
  }
});

test("escritorio carga la fila y el cambio de tamaño no duplica ni salta", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.addInitScript(() => window.sessionStorage.removeItem("rb-menu-grid-visited"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/menu");
  await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
  await expect(page.getByTestId("compact-dish-card").first()).toBeHidden();
  const [first, second] = await Promise.all([
    page.getByTestId("menu-dish-row").nth(0).boundingBox(),
    page.getByTestId("menu-dish-row").nth(1).boundingBox(),
  ]);
  expect(second!.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0) * 0.4);

  const names = await page.evaluate(() => {
    return [...document.querySelectorAll<HTMLElement>("[data-compact-photo], .menu-dish-photo")].map((node) => {
      return getComputedStyle(node).viewTransitionName;
    });
  });
  const active = names.filter((name) => name && name !== "none");
  expect(new Set(active).size).toBe(active.length);
  expect(active.length).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
  await expect(page.getByTestId("menu-dish-row").first()).toBeHidden();
  const resized = await page.evaluate(async () => {
    const samples: number[] = [];
    const card = document.querySelector<HTMLElement>("[data-catalog-pane='compact'] [data-testid='compact-dish-card']");
    const read = () => {
      if (!card) return;
      const transform = getComputedStyle(card).transform;
      samples.push(transform.startsWith("matrix(") ? Number(transform.split(",")[4]) : 0);
    };
    read();
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    read();
    return samples;
  });
  expect(Math.max(...resized.map((value) => Math.abs(value)))).toBeLessThan(2);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
  await expect(page.getByTestId("compact-dish-card").first()).toBeHidden();
  const namesAfter = await page.evaluate(() => {
    return [...document.querySelectorAll<HTMLElement>("[data-compact-photo], .menu-dish-photo")]
      .map((node) => getComputedStyle(node).viewTransitionName)
      .filter((name) => name && name !== "none");
  });
  expect(new Set(namesAfter).size).toBe(namesAfter.length);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("carnes conserva filas exclusivas en escritorio", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/menu/carnes");
  await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
  await expect(page.getByTestId("compact-dish-card").first()).toBeHidden();
  await expect.poll(() => page.evaluate(() => ({
    compactInert: document.querySelector("[data-catalog-pane='compact']")?.hasAttribute("inert"),
    rowInert: document.querySelector("[data-catalog-pane='row']")?.hasAttribute("inert"),
  }))).toEqual({ compactInert: true, rowInert: false });
});
