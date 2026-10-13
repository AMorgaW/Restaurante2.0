import { describe, expect, it } from "vitest";
import { TIMED_PRICE_LEAD_PX, timedSlidePhase } from "@/lib/menu/horizontal-entrance";

const viewport = 844;

describe("timedSlidePhase", () => {
  it("arranca al quedar el corazon visible y el scroll quieto, con el precio aun abajo", () => {
    expect(
      timedSlidePhase({
        prepared: true,
        priceTop: viewport + TIMED_PRICE_LEAD_PX + 40,
        viewportHeight: viewport,
        cardTop: 700,
        cardBottom: 1100,
        heartTop: 790,
        heartBottom: 834,
        idle: true,
      }),
    ).toBe("play");
  });

  it("no adelanta la animacion si el dedo sigue scrolleando", () => {
    expect(
      timedSlidePhase({
        prepared: true,
        priceTop: viewport + 80,
        viewportHeight: viewport,
        cardTop: 700,
        cardBottom: 1100,
        heartTop: 790,
        heartBottom: 834,
        idle: false,
      }),
    ).toBe("hold");
  });

  it("queda en hold cuando la tarjeta todavia no entra", () => {
    expect(
      timedSlidePhase({
        prepared: false,
        priceTop: 1400,
        viewportHeight: viewport,
        cardTop: 1200,
        cardBottom: 1600,
        heartTop: 1240,
        heartBottom: 1284,
        idle: true,
      }),
    ).toBe("hold");
  });

  it("reposa si la tarjeta ya paso por encima", () => {
    expect(
      timedSlidePhase({
        prepared: true,
        priceTop: -40,
        viewportHeight: viewport,
        cardTop: -400,
        cardBottom: -20,
        heartTop: -80,
        heartBottom: -36,
        idle: false,
      }),
    ).toBe("rest");
  });
});
