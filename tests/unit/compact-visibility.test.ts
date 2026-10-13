import { describe, expect, it } from "vitest";
import { COMPACT_CARD_ENTER_RATIO, COMPACT_PEEK_PX, compactVisibilityDecision } from "@/lib/menu/compact-card-entrance";

describe("compactVisibilityDecision", () => {
  it("pasa a play con 67 px visibles aunque el ratio de area sea menor de 0.65", () => {
    const decision = compactVisibilityDecision({
      top: 776.3,
      bottom: 934.8,
      height: 158.5,
      boundsTop: 0,
      boundsBottom: 844,
      areaRatio: 0.31,
    });
    expect(decision).toBe("play");
    expect(0.31).toBeLessThan(COMPACT_CARD_ENTER_RATIO);
    expect(67.7).toBeGreaterThanOrEqual(COMPACT_PEEK_PX);
  });

  it("sigue en hold cuando la tarjeta esta fuera del viewport", () => {
    expect(
      compactVisibilityDecision({
        top: 903.6,
        bottom: 1062.1,
        height: 158.5,
        boundsTop: 0,
        boundsBottom: 568,
      }),
    ).toBe("hold");
  });

  it("da por terminada la entrada si la tarjeta ya quedo por encima", () => {
    expect(
      compactVisibilityDecision({
        top: -200,
        bottom: -20,
        height: 180,
        boundsTop: 0,
        boundsBottom: 844,
      }),
    ).toBe("done");
  });
});
