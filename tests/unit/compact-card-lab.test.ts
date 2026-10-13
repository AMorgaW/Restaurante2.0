import { describe, expect, it } from "vitest";
import { menuItems } from "@/data/menu";
import {
  COMPACT_CARD_MIN_HEIGHT_PX,
  COMPACT_CARD_SLIDE_MS,
  COMPACT_CARD_SLIDE_PX,
  COMPACT_PHOTO_NARROW_PX,
  COMPACT_PHOTO_WIDE_PX,
  compactSlideTransform,
} from "@/lib/menu/compact-card-entrance";
import { buildCompactCardLab, compactLabSlugs } from "@/lib/menu/compact-card-lab";
import { GEOMETRIC_SLIDE_PILOT_SLUG } from "@/lib/menu/slide-calibration-pilot";

describe("entrada de la tarjeta compacta", () => {
  it("mantiene el recorrido y la duración dentro de las bandas del catálogo", () => {
    expect(COMPACT_CARD_SLIDE_PX).toBeGreaterThanOrEqual(90);
    expect(COMPACT_CARD_SLIDE_PX).toBeLessThanOrEqual(110);
    expect(COMPACT_CARD_SLIDE_MS).toBeGreaterThanOrEqual(250);
    expect(COMPACT_CARD_SLIDE_MS).toBeLessThanOrEqual(400);
    expect(compactSlideTransform()).toBe("translateX(96px)");
    expect(COMPACT_CARD_MIN_HEIGHT_PX).toBe(152);
    expect(COMPACT_PHOTO_NARROW_PX).toBe(96);
    expect(COMPACT_PHOTO_WIDE_PX).toBe(104);
  });
});

describe("buildCompactCardLab", () => {
  it("usa platos reales y un solo view-transition por slug", () => {
    const lab = buildCompactCardLab(menuItems);
    const slugs = compactLabSlugs(lab);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.filter((slug) => slug === GEOMETRIC_SLIDE_PILOT_SLUG)).toEqual([
      GEOMETRIC_SLIDE_PILOT_SLUG,
    ]);
    expect(lab.current.slug).not.toBe(GEOMETRIC_SLIDE_PILOT_SLUG);
    expect(lab.states.find((card) => card.key === "cena")?.item.slug).toBe(GEOMETRIC_SLIDE_PILOT_SLUG);
    expect(lab.states.find((card) => card.key === "agotado")?.item.available).toBe(false);
    expect(lab.fill.length).toBeGreaterThan(0);
  });
});
