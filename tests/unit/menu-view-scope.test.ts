import { describe, expect, it } from "vitest";
import {
  getMenuScrollStorageKey,
  getMenuViewStorageKey,
  menuViewScopeForPathname,
} from "@/lib/menu/view-scope";

describe("scope de vistas del catálogo", () => {
  it("aísla búsqueda y conserva las claves históricas del catálogo", () => {
    expect(getMenuViewStorageKey("catalog")).toBe("rb-menu-view");
    expect(getMenuViewStorageKey("search")).toBe("rb-search-view");
    expect(getMenuScrollStorageKey("catalog")).toBe("rb-menu-scroll-y");
    expect(getMenuScrollStorageKey("search")).toBe("rb-search-scroll-y");
  });

  it("resuelve solo /buscar como búsqueda aislada", () => {
    expect(menuViewScopeForPathname("/buscar")).toBe("search");
    expect(menuViewScopeForPathname("/buscar/")).toBe("search");
    expect(menuViewScopeForPathname("/menu")).toBe("catalog");
    expect(menuViewScopeForPathname("/menu/carnes")).toBe("catalog");
    expect(menuViewScopeForPathname("/favoritos")).toBe("catalog");
  });
});
