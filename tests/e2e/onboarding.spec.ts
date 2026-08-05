import { expect, test, type Page } from "@playwright/test";

type LandingBox = { x: number; y: number; width: number; height: number };
type LandingItem = {
  exists: boolean;
  box?: LandingBox;
  display?: string;
  visibility?: string;
  opacity?: string;
  transform?: string;
  width?: string;
  height?: string;
  position?: string;
  parentOverflow?: string | null;
  className?: string;
  hidden?: boolean;
  ariaHidden?: string | null;
};
type LandingState = {
  label: string;
  url: string;
  innerWidth: number;
  visualViewportWidth: number | null;
  reducedMotion: boolean;
  items: Record<string, LandingItem>;
  mutations: unknown[];
};

declare global {
  interface Window {
    __landingMutationLog?: unknown[];
  }
}

const evidenceDir = "artifacts/visual-comparison/work/hydration-version-skew";
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "625x795", width: 625, height: 795 },
  { name: "768x900", width: 768, height: 900 },
  { name: "1260x800", width: 1260, height: 800 },
  { name: "1440x1000", width: 1440, height: 1000 },
] as const;

const requiredElements = {
  brand: "landing-brand",
  userEntry: "landing-user-entry",
  imageContainer: "landing-image-container",
  image: "landing-image",
  title: "landing-title",
  divider: "landing-divider",
  subtitle: "landing-subtitle",
  cta: "landing-cta",
  tagline: "landing-tagline",
} as const;

test.use({ serviceWorkers: "block" });

function landing(page: Page) {
  const root = page.getByTestId("landing-page");
  return {
    root,
    brand: root.getByTestId(requiredElements.brand),
    userEntry: root.getByTestId(requiredElements.userEntry),
    imageContainer: root.getByTestId(requiredElements.imageContainer),
    image: root.getByTestId(requiredElements.image),
    title: root.getByTestId(requiredElements.title),
    divider: root.getByTestId(requiredElements.divider),
    subtitle: root.getByTestId(requiredElements.subtitle),
    cta: root.getByTestId(requiredElements.cta),
    tagline: root.getByTestId(requiredElements.tagline),
  };
}

async function captureState(page: Page, label: string): Promise<LandingState> {
  return page.evaluate((stateLabel): LandingState => {
    const selectors = {
      root: '[data-testid="landing-page"]',
      brand: '[data-testid="landing-brand"]',
      userEntry: '[data-testid="landing-user-entry"]',
      imageContainer: '[data-testid="landing-image-container"]',
      image: '[data-testid="landing-image"]',
      title: '[data-testid="landing-title"]',
      divider: '[data-testid="landing-divider"]',
      subtitle: '[data-testid="landing-subtitle"]',
      cta: '[data-testid="landing-cta"]',
      tagline: '[data-testid="landing-tagline"]',
    };

    const items = Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector<HTMLElement>(selector);
        const style = element ? getComputedStyle(element) : null;
        const box = element?.getBoundingClientRect();
        const parentStyle = element?.parentElement ? getComputedStyle(element.parentElement) : null;
        return [
          name,
          element && style && box
            ? {
                exists: true,
                box: { x: box.x, y: box.y, width: box.width, height: box.height },
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                transform: style.transform,
                width: style.width,
                height: style.height,
                position: style.position,
                parentOverflow: parentStyle?.overflow ?? null,
                className: element.className,
                hidden: element.hidden,
                ariaHidden: element.getAttribute("aria-hidden"),
              }
            : { exists: false },
        ];
      }),
    );

    return {
      label: stateLabel,
      url: location.href,
      innerWidth: window.innerWidth,
      visualViewportWidth: window.visualViewport?.width ?? null,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      items,
      mutations: window.__landingMutationLog?.splice(0) ?? [],
    };
  }, label);
}

async function expectLandingVisible(page: Page) {
  const view = landing(page);
  await expect(view.root).toBeVisible();
  for (const key of Object.keys(requiredElements) as Array<keyof typeof requiredElements>) {
    await expect(view[key]).toBeVisible();
  }
  await expect(view.image).toHaveAttribute("alt", /pescado frito/i);
  await expect.poll(() => view.image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(view.image).toHaveCSS("transform", "none");
  await expect(view.cta).toBeEnabled();
  await expect(view.userEntry).toHaveAttribute("aria-label", "Acceso de usuario");
  await expect(view.userEntry).toHaveAccessibleName(/acceso de usuario/i);
}

async function waitForLandingHydration(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="landing-cta"]');
    if (!button) return false;
    const propKey = Object.keys(button).find((key) => key.startsWith("__reactProps$"));
    if (!propKey) return false;
    const props = (button as unknown as Record<string, { onClick?: unknown }>)[propKey];
    return typeof props?.onClick === "function";
  });
}

for (const viewport of viewports) {
  test(`landing remains stable after hydration at ${viewport.name}`, async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
      if (message.type() === "warning") consoleWarnings.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      window.__landingMutationLog = [];
      const describe = (node: Node) => {
        const element = node instanceof Element ? node : null;
        return {
          node: node.nodeName,
          testId: element?.getAttribute("data-testid") ?? "",
          className: element?.getAttribute("class") ?? "",
          style: element?.getAttribute("style") ?? "",
          hidden: element?.hasAttribute("hidden") ?? false,
          ariaHidden: element?.getAttribute("aria-hidden"),
        };
      };
      const start = performance.now();
      new MutationObserver((mutations) => {
        const root = document.querySelector('[data-testid="landing-page"]');
        for (const mutation of mutations) {
          const inLanding = (node: Node) => Boolean(root && (node === root || root.contains(node)));
          if (inLanding(mutation.target) || [...mutation.addedNodes, ...mutation.removedNodes].some(inLanding)) {
            window.__landingMutationLog?.push({
              atMs: Math.round(performance.now() - start),
              type: mutation.type,
              target: describe(mutation.target),
              attribute: mutation.attributeName,
              oldValue: mutation.oldValue,
              added: [...mutation.addedNodes].map(describe),
              removed: [...mutation.removedNodes].map(describe),
            });
          }
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden"],
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await expectLandingVisible(page);
    const t0 = await captureState(page, "DOMContentLoaded");
    if (testInfo.project.name === "mobile-chromium") {
      await page.screenshot({ path: `${evidenceDir}/landing-${viewport.name}-t0.png`, fullPage: false });
    }

    await page.waitForTimeout(2000);
    const t2 = await captureState(page, "t2");
    await expectLandingVisible(page);

    await page.waitForTimeout(3000);
    const t5 = await captureState(page, "t5");
    await expectLandingVisible(page);
    if (testInfo.project.name === "mobile-chromium") {
      await page.screenshot({ path: `${evidenceDir}/landing-${viewport.name}-t5.png`, fullPage: false });
    }

    await page.waitForTimeout(5000);
    const t10 = await captureState(page, "t10");
    await expectLandingVisible(page);
    if (testInfo.project.name === "mobile-chromium") {
      await page.screenshot({ path: `${evidenceDir}/landing-${viewport.name}-t10.png`, fullPage: false });
    }

    const states = [t0, t2, t5, t10];
    for (const state of states) {
      for (const [name, item] of Object.entries(state.items)) {
        expect(item.exists, `${viewport.name} ${state.label} ${name} missing`).toBe(true);
        if (item.exists) {
          expect(item.box, `${viewport.name} ${state.label} ${name} geometry`).toBeDefined();
          if (!item.box) continue;
          expect(item.box.width, `${viewport.name} ${state.label} ${name} width`).toBeGreaterThan(0);
          expect(item.box.height, `${viewport.name} ${state.label} ${name} height`).toBeGreaterThan(0);
          expect(item.display, `${viewport.name} ${state.label} ${name} display`).not.toBe("none");
          expect(item.visibility, `${viewport.name} ${state.label} ${name} visibility`).not.toBe("hidden");
          expect(item.opacity, `${viewport.name} ${state.label} ${name} opacity`).not.toBe("0");
        }
      }
    }
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    expect(testInfo.project.name).toBeTruthy();
    expect(consoleWarnings.filter((warning) => /hydration|typeerror/i.test(warning))).toEqual([]);
  });
}

test("landing CTA navigates once without runtime errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const view = landing(page);
  await expectLandingVisible(page);
  await waitForLandingHydration(page);
  await view.cta.click();
  await expect(page).toHaveURL(/\/menu$/);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
});

test("landing ignores historical onboarding persistence", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rb-onboarding", JSON.stringify({ state: { seen: true }, version: 1 }));
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expectLandingVisible(page);
  await expect(page).toHaveURL(/\/$/);
});

test("landing order remains stable in the mobile flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const view = landing(page);
  const boxes = await Promise.all([
    view.brand.boundingBox(),
    view.imageContainer.boundingBox(),
    view.title.boundingBox(),
    view.subtitle.boundingBox(),
    view.cta.boundingBox(),
    view.tagline.boundingBox(),
  ]);
  expect(boxes.every(Boolean)).toBe(true);
  if (!boxes.every(Boolean)) return;
  const [brand, image, title, subtitle, cta, tagline] = boxes as [
    LandingBox,
    LandingBox,
    LandingBox,
    LandingBox,
    LandingBox,
    LandingBox,
  ];
  expect(brand.y).toBeLessThan(image.y);
  expect(image.y).toBeLessThan(title.y);
  expect(title.y).toBeLessThan(subtitle.y);
  expect(subtitle.y).toBeLessThan(cta.y);
  expect(cta.y).toBeLessThan(tagline.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
