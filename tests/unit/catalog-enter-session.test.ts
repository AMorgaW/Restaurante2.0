import { afterEach, describe, expect, it } from "vitest";
import { compactEntranceAllowed, releaseCompactEntranceDecision } from "@/lib/menu/catalog-enter-session";

afterEach(() => {
  releaseCompactEntranceDecision();
  window.sessionStorage.clear();
});

describe("compactEntranceAllowed", () => {
  it("recuerda la primera decisión aunque la visita se marque después", () => {
    expect(compactEntranceAllowed()).toBe(true);
    window.sessionStorage.setItem("rb-menu-grid-visited", "1");
    expect(compactEntranceAllowed()).toBe(true);
    releaseCompactEntranceDecision();
    expect(compactEntranceAllowed()).toBe(false);
  });
});
