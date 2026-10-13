import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { PHOTO_REVEAL_PILOT_SLUG } from "@/lib/menu/photo-reveal-pilot";
import { motionRowCatalogPath, skipOnboarding, visibleRowPhoto } from "./helpers";

/**
 * Piloto visual: una sola tarjeta cruza una banda cálida al entrar en pantalla.
 * El vídeo es la evidencia del efecto. Las aserciones cuidan hidratación,
 * el nodo del viaje y que el resto del catálogo no lo copie.
 */

test.use({ video: "on" });

const PILOT = "[data-photo-reveal='pilot']";
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

async function openMenu(page: Page) {
  await page.clock.setFixedTime(new Date("2026-07-21T19:00:00-05:00"));
  await skipOnboarding(page);
  await page.goto(motionRowCatalogPath(page));
  await expect(page.getByTestId("service-status")).toHaveAttribute("data-service-period", "dinner");
  await expect(visibleRowPhoto(page).first()).toBeVisible();
  await expect(page.locator(PILOT)).toHaveCount(1);
}

async function bandOpacity(page: Page) {
  return page.evaluate(() => {
    const band = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-photo-band");
    if (!band) return 0;
    const computed = Number(getComputedStyle(band).opacity);
    return Number.isFinite(computed) ? computed : 0;
  });
}

async function armRevealWatch(page: Page) {
  await page.evaluate(() => {
    const host = window as Window & { __revealPeak?: number; __revealFrozen?: boolean };
    const read = () => {
      try {
        const band = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-photo-band");
        if (!band) return 0;
        const computed = Number(getComputedStyle(band).opacity);
        return Number.isFinite(computed) ? computed : 0;
      } catch {
        return 0;
      }
    };
    host.__revealPeak = 0;
    host.__revealFrozen = false;
    const tick = () => {
      if (host.__revealFrozen) return;
      const opacity = read();
      if (opacity > (host.__revealPeak ?? 0)) host.__revealPeak = opacity;
      if (opacity >= 0.88) host.__revealFrozen = true;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function revealPeak(page: Page) {
  return page.evaluate(() => (window as Window & { __revealPeak?: number }).__revealPeak ?? 0);
}

type RevealStep = {
  scrollY: number;
  top: number | null;
  ratio: number;
  opacity: number;
  animations: number;
  playState: string;
  target: number;
  progressed: boolean;
};

const REVEAL_STEP_PX = 36;
const REVEAL_AMOUNT = 0.72;
const REVEAL_BOTTOM_MARGIN = 0.12;

function revealDiagnostic(step: RevealStep) {
  return `scrollY=${step.scrollY} top=${step.top ?? "sin velo"} ratio=${step.ratio.toFixed(3)} animaciones=${step.animations} estado=${step.playState}`;
}

async function applyRevealStep(page: Page): Promise<RevealStep> {
  return page.evaluate(
    async ({ stepPx, margin }) => {
      const read = () => {
        const veil = document.querySelector<HTMLElement>(
          "[data-photo-reveal='pilot'] [data-testid='menu-photo-veil']",
        );
        const band = veil?.querySelector<HTMLElement>(".menu-photo-band");
        const animation = band?.getAnimations()[0];
        const opacity = band ? Number(getComputedStyle(band).opacity) : 0;
        const value = Number.isFinite(opacity) ? opacity : 0;
        const host = window as Window & { __revealPeak?: number; __revealFrozen?: boolean };
        if (value > (host.__revealPeak ?? 0)) host.__revealPeak = value;
        if (value >= 0.88) host.__revealFrozen = true;
        const rect = veil?.getBoundingClientRect();
        const limit = window.innerHeight * (1 - margin);
        const visible = rect ? Math.min(rect.bottom, limit) - Math.max(rect.top, 0) : 0;
        const ratio = rect && rect.height > 0 ? Math.max(0, visible) / rect.height : 0;
        return {
          scrollY: window.scrollY,
          top: rect ? rect.top : null,
          ratio,
          opacity: value,
          animations: band ? band.getAnimations().length : 0,
          playState: animation?.playState ?? "none",
        };
      };
      const framesUntilApplied = async (target: number) => {
        for (let frame = 0; frame < 6; frame += 1) {
          read();
          if (Math.abs(window.scrollY - target) <= 1) return;
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        read();
      };
      const start = window.scrollY;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.min(maxScroll, start + stepPx);
      const apply = async () => {
        window.scrollTo({ top: target, left: 0, behavior: "instant" });
        await framesUntilApplied(target);
      };
      await apply();
      if (Math.abs(window.scrollY - target) > 1) await apply();
      const sample = read();
      return {
        ...sample,
        target,
        progressed: target > start + 0.5 && Math.abs(sample.scrollY - target) <= 1,
      };
    },
    { stepPx: REVEAL_STEP_PX, margin: REVEAL_BOTTOM_MARGIN },
  );
}

async function saveMissedBand(page: Page, info: TestInfo, label: string) {
  const frozen = await page.evaluate(
    () => Boolean((window as Window & { __revealFrozen?: boolean }).__revealFrozen),
  );
  if (frozen) return;
  mkdirSync("artifacts/photo-reveal", { recursive: true });
  await page.screenshot({
    path: `artifacts/photo-reveal/${info.project.name}-${label}-sin-pico.png`,
  });
}

test.describe("piloto de revelado fotográfico", () => {
  test("scroll lento y rápido distinguen la tarjeta piloto de una normal", async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      history.scrollRestoration = "manual";
    });
    await openMenu(page);
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(1);
    await expect(page.getByTestId("menu-dish-row").first()).not.toHaveAttribute("data-photo-reveal", "pilot");

    const resting = await page.evaluate(() => {
      const photo = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-dish-photo");
      const image = photo?.querySelector("img");
      const visual = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-dish-visual");
      const card = document.querySelector<HTMLElement>("[data-photo-reveal='pilot']");
      return {
        top: card?.getBoundingClientRect().top ?? 0,
        height: window.innerHeight,
        opacity: image ? getComputedStyle(image).opacity : "missing",
        transitionName: photo?.style.viewTransitionName ?? "",
        veilInsidePhoto: Boolean(photo?.querySelector("[data-testid='menu-photo-veil']")),
        visualTransform: visual ? getComputedStyle(visual).transform : "missing",
        reflect: Boolean(document.querySelector("[data-photo-reveal='pilot'] .menu-card-reflect-once")),
      };
    });
    expect(resting.top).toBeGreaterThan(resting.height * 0.45);
    expect(resting.opacity).toBe("1");
    expect(resting.transitionName).toBe(`dish-${PHOTO_REVEAL_PILOT_SLUG}`);
    expect(resting.veilInsidePhoto).toBe(false);
    expect(resting.visualTransform).toBe("none");
    expect(resting.reflect).toBe(false);
    expect(await bandOpacity(page)).toBeLessThan(0.05);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
    });
    await armRevealWatch(page);
    // 36 px por paso, medidos desde el velo. El paso solo cuenta cuando
    // WebKit ya dejó ese scrollY aplicado; si no avanza, se diagnostica.
    let slowStep: RevealStep | undefined;
    let crossed = false;
    let room = await page.evaluate((stepPx) => {
      return Math.ceil(document.documentElement.scrollHeight / stepPx) + 8;
    }, REVEAL_STEP_PX);
    for (let step = 0; step < room && !crossed; step += 1) {
      slowStep = await applyRevealStep(page);
      if (slowStep.opacity >= 0.88 || slowStep.ratio >= REVEAL_AMOUNT) {
        crossed = true;
        break;
      }
      expect(slowStep.progressed, `el paso de ${REVEAL_STEP_PX} px no se aplicó (${revealDiagnostic(slowStep)})`).toBe(true);
      const grown = await page.evaluate((stepPx) => {
        return Math.ceil(document.documentElement.scrollHeight / stepPx) + 8;
      }, REVEAL_STEP_PX);
      if (grown > room) room = grown;
    }
    expect(crossed, `el velo no cruzó el umbral (${slowStep ? revealDiagnostic(slowStep) : "sin muestra"})`).toBe(true);
    await page.evaluate(async () => {
      const host = window as Window & { __revealPeak?: number; __revealFrozen?: boolean };
      for (let frame = 0; frame < 24 && (host.__revealPeak ?? 0) < 0.88; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const band = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-photo-band");
        const opacity = band ? Number(getComputedStyle(band).opacity) : 0;
        const value = Number.isFinite(opacity) ? opacity : 0;
        if (value > (host.__revealPeak ?? 0)) host.__revealPeak = value;
        if (value >= 0.88) host.__revealFrozen = true;
      }
    });
    const slowPeak = await revealPeak(page);
    await saveMissedBand(page, info, "lento");
    const slowWhere = slowStep ? revealDiagnostic(slowStep) : "sin muestra";
    expect(slowPeak, `la banda no llegó a verse en el scroll lento (${slowWhere})`).toBeGreaterThan(0.8);
    await expect.poll(() => bandOpacity(page), { timeout: 1_500 }).toBeLessThan(0.05);
    await expect(page.locator(`${PILOT} .menu-dish-photo img`)).toHaveCSS("opacity", "1");

    const hitDuringRest = await page.evaluate(() => {
      const photo = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-dish-photo");
      const rect = photo?.getBoundingClientRect();
      if (!rect) return "sin foto";
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit?.closest("[data-testid='menu-photo-veil'], [data-testid='menu-photo-band']") ? "velo" : "libre";
    });
    expect(hitDuringRest).toBe("libre");

    await page.evaluate(() => {
      window.sessionStorage.removeItem("rb-menu-grid-visited");
    });
    await page.goto(motionRowCatalogPath(page));
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(1);
    const parked = await page.evaluate(() => {
      const photo = document.querySelector("[data-photo-reveal='pilot'] .menu-dish-photo");
      return {
        scrollY: window.scrollY,
        photoTop: photo ? photo.getBoundingClientRect().top : 0,
        height: window.innerHeight,
      };
    });
    expect(parked.scrollY, "la segunda visita debe empezar arriba").toBeLessThan(8);
    expect(parked.photoTop, "la foto piloto debe seguir bajo el pliegue").toBeGreaterThan(parked.height * 0.85);
    expect(await bandOpacity(page)).toBeLessThan(0.05);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
    });
    await armRevealWatch(page);
    const fastStart = await page.evaluate(() => window.scrollY);
    for (let step = 0; step < 16; step += 1) {
      await page.evaluate(async (top) => {
        window.scrollTo({ top, left: 0, behavior: "instant" });
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        const band = document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-photo-band");
        const opacity = band ? Number(getComputedStyle(band).opacity) : 0;
        const host = window as Window & { __revealPeak?: number };
        const value = Number.isFinite(opacity) ? opacity : 0;
        if (value > (host.__revealPeak ?? 0)) host.__revealPeak = value;
      }, fastStart + (step + 1) * 220);
    }
    await page
      .waitForFunction(
        () => ((window as Window & { __revealPeak?: number }).__revealPeak ?? 0) > 0.2,
        { timeout: 1_500 },
      )
      .catch(() => undefined);
    const fastWhere = await page.evaluate(() => {
      const photo = document.querySelector("[data-photo-reveal='pilot'] .menu-dish-photo");
      return {
        scrollY: Math.round(window.scrollY),
        photoTop: Math.round(photo?.getBoundingClientRect().top ?? -1),
      };
    });
    const fastPeak = await revealPeak(page);
    await saveMissedBand(page, info, "rapido");
    expect(fastPeak, `la banda no llegó a verse en el scroll rápido ${JSON.stringify(fastWhere)}`).toBeGreaterThan(0.8);
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("la ficha, el regreso y los filtros dejan el velo en una sola tarjeta", async ({ page }) => {
    const errors = watchErrors(page);
    await openMenu(page);
    await page.locator(PILOT).evaluate((node) => {
      const top = node.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
      window.scrollTo({ top, left: 0, behavior: "instant" });
    });
    const visiblePilot = page.locator("[data-testid='menu-dish-row'][data-photo-reveal='pilot']:visible");
    await expect(visiblePilot.getByRole("button", { name: "Añadir Plato de carne asada al carrito" })).toBeVisible();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(
          "[data-testid='menu-dish-row'][data-photo-reveal='pilot']",
        );
        const probe = (selector: string) => {
          const node = card?.querySelector<HTMLElement>(selector);
          const rect = node?.getBoundingClientRect();
          if (!node || !rect || rect.width < 1 || rect.height < 1) return "ausente";
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          if (x < 1 || y < 1 || x > window.innerWidth - 1 || y > window.innerHeight - 1) return "fuera";
          const hit = document.elementFromPoint(x, y);
          if (!hit) return "sin-hit";
          if (hit.closest("[data-testid='menu-photo-veil'], .menu-photo-band")) return "velo";
          return node.contains(hit) ? "control" : hit.tagName;
        };
        return {
          favorite: probe("[aria-label='Añadir Plato de carne asada a favoritos']"),
          add: probe("[aria-label='Añadir Plato de carne asada al carrito']"),
        };
      });
    }).toEqual({ favorite: "control", add: "control" });

    await visiblePilot.getByRole("link", { name: "Ver Plato de carne asada" }).click();
    await expect(page).toHaveURL(new RegExp(`/plato/${PHOTO_REVEAL_PILOT_SLUG}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Plato de carne asada" })).toBeVisible();
    const detail = await page.getByTestId("detail-image-container").evaluate((node) => ({
      name: (node as HTMLElement).style.viewTransitionName,
      opacity: getComputedStyle(node.querySelector("img") as HTMLElement).opacity,
    }));
    expect(detail.name).toBe(`dish-${PHOTO_REVEAL_PILOT_SLUG}`);
    expect(detail.opacity).toBe("1");

    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).toHaveURL(motionRowCatalogPath(page) === "/buscar" ? /\/buscar$/ : /\/menu$/);
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(0);

    await page.getByRole("button", { name: "Carnes" }).click();
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-results-motion", "settle");
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(0);
    await expect(page.locator(`${PILOT} .menu-dish-photo img`)).toHaveCSS("opacity", "1");

    await page.getByRole("button", { name: "Todas" }).click();
    await page.getByRole("searchbox", { name: "Buscar en el menú" }).fill("f");
    await expect(page.getByTestId("menu-grid")).toHaveAttribute("data-results-motion", "instant");
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("con movimiento reducido la foto sigue visible y el velo no está en el HTML", async ({ page }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-07-21T19:00:00-05:00"));
    await skipOnboarding(page);
    await page.goto(motionRowCatalogPath(page), { waitUntil: "domcontentloaded" });
    const first = await page.evaluate(() => {
      const image = document.querySelector<HTMLImageElement>("[data-photo-reveal='pilot'] .menu-dish-photo img");
      return {
        veil: document.querySelectorAll("[data-testid='menu-photo-veil']").length,
        opacity: image ? getComputedStyle(image).opacity : "missing",
        name: document.querySelector<HTMLElement>("[data-photo-reveal='pilot'] .menu-dish-photo")?.style.viewTransitionName ?? "",
      };
    });
    expect(first.veil).toBe(0);
    expect(first.opacity).toBe("1");
    expect(first.name).toBe(`dish-${PHOTO_REVEAL_PILOT_SLUG}`);

    await page.reload();
    await expect(visibleRowPhoto(page).first()).toBeVisible();
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(0);
    await expect(page.locator(`${PILOT} .menu-dish-photo img`)).toHaveCSS("opacity", "1");
    await page.locator(PILOT).evaluate((node) => {
      const top = node.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
      window.scrollTo({ top, left: 0, behavior: "instant" });
    });
    await page.waitForTimeout(500);
    await expect(page.getByTestId("menu-photo-veil")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
