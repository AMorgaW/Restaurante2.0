import { describe, expect, it } from "vitest";
import {
  CALIBRATION_SLIDE_MAX,
  CALIBRATION_SLIDE_MIN,
  calibrationSlideDistance,
  ENTRANCE_BREAKPOINT,
  easeHoldSettle,
  easeOutSettle,
  entranceAxis,
  entranceOffset,
  resolveCardAxis,
  TIMED_PRICE_LEAD_PX,
  TIMED_SLIDE_MS,
  TIMED_SLIDE_PX,
  timedSlideFrom,
  timedSlidePhase,
} from "@/lib/menu/horizontal-entrance";

describe("eje de entrada del catálogo", () => {
  it("usa el deslizamiento de 64 px solo por debajo de 1024", () => {
    expect(entranceAxis(390)).toBe("x");
    expect(entranceAxis(ENTRANCE_BREAKPOINT - 1)).toBe("x");
    expect(entranceAxis(ENTRANCE_BREAKPOINT)).toBe("y");
    expect(entranceAxis(1440)).toBe("y");
  });

  it("una tarjeta empezada no cambia de eje y una sin progreso sí", () => {
    expect(resolveCardAxis("y", 0.4, "x")).toBe("x");
    expect(resolveCardAxis("x", 0.2, "y")).toBe("y");
    expect(resolveCardAxis("y", 0, "x")).toBe("y");
    expect(resolveCardAxis("x", 0.2, null)).toBe("x");
    expect(resolveCardAxis("y", 0, null)).toBe("y");
  });

  it("la ease-out sale de 0, llega a 1 y adelanta el recorrido", () => {
    expect(easeOutSettle(0)).toBe(0);
    expect(easeOutSettle(1)).toBe(1);
    expect(easeOutSettle(0.35)).toBeGreaterThan(0.7);
    let previous = 0;
    for (let step = 1; step <= 10; step += 1) {
      const value = easeOutSettle(step / 10);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("nunca escribe los dos ejes a la vez", () => {
    const horizontal = entranceOffset("x", 0.4, 64);
    const vertical = entranceOffset("y", 0.4, 22);
    expect(horizontal.y).toBe(0);
    expect(horizontal.x).toBeGreaterThan(0);
    expect(horizontal.x).toBeLessThan(64);
    expect(vertical.x).toBe(0);
    expect(vertical.y).toBeCloseTo(13.2, 5);
    expect(entranceOffset("x", 0, 64)).toEqual({ x: 64, y: 0 });
    expect(entranceOffset("x", 1, 64)).toEqual({ x: 0, y: 0 });
  });

  it("la calibración guarda recorrido cuando ya se leen el título y el precio", () => {
    expect(easeHoldSettle(0)).toBe(0);
    expect(easeHoldSettle(1)).toBe(1);
    expect(easeHoldSettle(0.36)).toBeLessThan(0.3);
    expect(easeHoldSettle(0.73)).toBeGreaterThan(0.55);
    expect(easeHoldSettle(0.73)).toBeLessThan(0.72);
    expect(easeHoldSettle(0.73)).toBeLessThan(easeOutSettle(0.73));
    let previous = 0;
    for (let step = 1; step <= 20; step += 1) {
      const value = easeHoldSettle(step / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(calibrationSlideDistance(358)).toBe(100);
    expect(calibrationSlideDistance(200)).toBe(CALIBRATION_SLIDE_MIN);
    expect(calibrationSlideDistance(520)).toBe(CALIBRATION_SLIDE_MAX);
    const atPrice = entranceOffset("x", 0.73, 100, "hold");
    expect(atPrice.y).toBe(0);
    expect(atPrice.x).toBeGreaterThan(28);
    expect(atPrice.x).toBeLessThan(48);
    expect(entranceOffset("y", 0.4, 22, "hold").x).toBe(0);
  });

  it("la entrada de 360 ms espera al precio y no al 52 % del título", () => {
    expect(TIMED_SLIDE_PX).toBe(100);
    expect(TIMED_SLIDE_MS).toBe(360);
    expect(timedSlideFrom()).toBe("translateX(100px)");
    const cardTop = 620;
    const height = 400;
    const viewport = 844;
    const titleTop = cardTop + height * 0.55;
    const priceTop = cardTop + height * 0.89;
    expect(titleTop).toBeLessThan(viewport);
    expect(priceTop).toBeGreaterThan(viewport + TIMED_PRICE_LEAD_PX);
    const shared = {
      prepared: true,
      priceTop,
      viewportHeight: viewport,
      cardTop,
      cardBottom: cardTop + height,
      heartTop: cardTop + 16,
      heartBottom: cardTop + 60,
      idle: false,
    };
    expect(timedSlidePhase(shared)).toBe("hold");
    expect(timedSlidePhase({ ...shared, priceTop: viewport + TIMED_PRICE_LEAD_PX })).toBe("play");
    expect(timedSlidePhase({ ...shared, idle: true })).toBe("play");
    expect(
      timedSlidePhase({
        ...shared,
        prepared: false,
        priceTop: viewport - 180,
        cardTop: 80,
        cardBottom: 480,
        heartTop: 96,
        heartBottom: 140,
      }),
    ).toBe("rest");
    expect(timedSlidePhase({ ...shared, cardTop: -500, cardBottom: -40, heartTop: -480, heartBottom: -430 })).toBe(
      "rest",
    );
  });
});
