import { expect, test, type Page } from "@playwright/test";

const landingUrl = "http://localhost:3000/";
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
const ids = [
  "landing-page",
  "landing-brand",
  "landing-image-container",
  "landing-image",
  "landing-title",
  "landing-divider",
  "landing-subtitle",
  "landing-cta",
  "landing-tagline",
] as const;

type LandingSnapshot = {
  landingCount: number;
  onboardingCount: number;
  elements: Record<string, { exists: boolean; width: number; height: number; display: string; visibility: string; opacity: string }>;
  controller: string | null;
  registrations: number;
  caches: string[];
};

async function snapshot(page: Page): Promise<LandingSnapshot> {
  const value = await page.evaluate((testIds) => {
    const elements = Object.fromEntries(
      testIds.map((id) => {
        const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!element) return [id, { exists: false, width: 0, height: 0, display: "", visibility: "", opacity: "" }];
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [id, { exists: true, width: rect.width, height: rect.height, display: style.display, visibility: style.visibility, opacity: style.opacity }];
      }),
    );
    return {
      landingCount: document.querySelectorAll('[data-testid="landing-page"]').length,
      onboardingCount: document.querySelectorAll(`[data-testid="${"onboarding" + "-page"}"]`).length,
      elements,
      controller: navigator.serviceWorker?.controller?.scriptURL || null,
    };
  }, ids);
  const registrations = await page.evaluate(async () => ("serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0));
  const caches = await page.evaluate(async () => ("caches" in window ? await window.caches.keys() : []));
  return { ...value, registrations, caches };
}

async function assertStable(page: Page, state: LandingSnapshot) {
  expect(state.landingCount).toBe(1);
  expect(state.onboardingCount).toBe(0);
  for (const id of ids) {
    const element = state.elements[id]!;
    expect(element.exists, `${id} must remain in the DOM`).toBe(true);
    expect(element.width, `${id} width`).toBeGreaterThan(0);
    expect(element.height, `${id} height`).toBeGreaterThan(0);
    expect(element.display, `${id} display`).not.toBe("none");
    expect(element.visibility, `${id} visibility`).not.toBe("hidden");
    expect(Number(element.opacity), `${id} opacity`).toBeGreaterThan(0);
  }
  await expect(page.getByTestId("landing-page")).toBeVisible();
}

for (const serviceWorkers of ["block", "allow"] as const) {
  test.describe(`landing hydration with service workers ${serviceWorkers}`, () => {
    test.use({ serviceWorkers });
    for (const viewport of viewports) {
      test(`stays identical through ten seconds at ${viewport.name}`, async ({ page }, testInfo) => {
        const consoleErrors: string[] = [];
        const hydrationWarnings: string[] = [];
        const pageErrors: string[] = [];
        const requestFailures: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
          if (message.type() === "warning" && /hydration|mismatch|chunk|typeerror/i.test(message.text())) hydrationWarnings.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("requestfailed", (request) => requestFailures.push(`${request.url()} ${request.failure()?.errorText || "failed"}`));

        await page.setViewportSize(viewport);
        await page.goto(landingUrl, { waitUntil: "domcontentloaded" });
        const t0 = await snapshot(page);
        await assertStable(page, t0);
        if (viewport.name === "390x844" || viewport.name === "1440x1000") {
          await page.screenshot({ path: `${evidenceDir}/landing-${viewport.name}-${serviceWorkers}-${testInfo.project.name}-t0.png`, fullPage: false });
        }

        await page.waitForTimeout(2000);
        const t2 = await snapshot(page);
        await assertStable(page, t2);

        await page.waitForTimeout(3000);
        const t5 = await snapshot(page);
        await assertStable(page, t5);
        if (viewport.name === "390x844" || viewport.name === "1440x1000") {
          await page.screenshot({ path: `${evidenceDir}/landing-${viewport.name}-${serviceWorkers}-${testInfo.project.name}-t5.png`, fullPage: false });
        }

        await page.waitForTimeout(5000);
        const t10 = await snapshot(page);
        await assertStable(page, t10);
        if (viewport.name === "390x844" || viewport.name === "1440x1000") {
          await page.screenshot({ path: `${evidenceDir}/landing-${viewport.name}-${serviceWorkers}-${testInfo.project.name}-t10.png`, fullPage: false });
        }

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
        expect(hydrationWarnings, hydrationWarnings.join("\n")).toEqual([]);
        expect(pageErrors, pageErrors.join("\n")).toEqual([]);
        expect(requestFailures, requestFailures.join("\n")).toEqual([]);
        await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        expect([t0, t2, t5, t10].every((item) => item.landingCount === 1 && item.onboardingCount === 0)).toBe(true);
      });
    }
  });
}
