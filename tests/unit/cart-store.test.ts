import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "carne-asada",
    slug: "carne-asada",
    fullName: "Carne asada",
    categorySlug: "carnes",
    shortDescription: "",
    price: 40000,
    available: true,
    featured: false,
    tags: [],
    displayOrder: 0,
    image: {
      originalFilename: "carne.jpg",
      publicPath: "/generated/menu/carne-asada.jpg",
      width: 100,
      height: 100,
      aspectRatio: 1,
      hasAlpha: false,
      blurDataURL: "data:image/webp;base64,x",
      bytes: 1,
    },
    modifierGroups: [],
    ...overrides,
  };
}

function resetStore() {
  useCartStore.setState({
    items: [],
    branchId: "branch-centro",
    fulfillmentType: "pickup",
    couponCode: null,
    tipPercent: 0,
  });
}

describe("useCartStore", () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.clear();
  });

  it("añade platos y agrupa líneas idénticas", () => {
    const item = makeMenuItem();
    useCartStore.getState().addItem(item);
    useCartStore.getState().addItem(item, { quantity: 2 });
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);
  });

  it("separa líneas con modificadores distintos", () => {
    const item = makeMenuItem();
    useCartStore.getState().addItem(item);
    useCartStore.getState().addItem(item, {
      modifiers: [
        { groupId: "extras", groupName: "Extras", optionId: "guac", optionName: "Guacamole", priceSnapshot: 4000 },
      ],
    });
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it("no añade platos no disponibles", () => {
    useCartStore.getState().addItem(makeMenuItem({ available: false }));
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("sanea cantidades inválidas", () => {
    const item = makeMenuItem();
    useCartStore.getState().addItem(item, { quantity: 999 });
    expect(useCartStore.getState().items[0]?.quantity).toBe(20); // máximo configurado

    useCartStore.getState().updateQuantity(item.id, -3);
    expect(useCartStore.getState().items[0]?.quantity).toBe(1);
  });

  it("elimina líneas y vacía el carrito", () => {
    const item = makeMenuItem();
    useCartStore.getState().addItem(item);
    useCartStore.getState().removeItem(item.id);
    expect(useCartStore.getState().items).toHaveLength(0);

    useCartStore.getState().addItem(item);
    useCartStore.getState().setCoupon("BIENVENIDA10");
    useCartStore.getState().clear();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().couponCode).toBeNull();
  });

  it("solo acepta propinas de la lista configurada", () => {
    useCartStore.getState().setTip(10);
    expect(useCartStore.getState().tipPercent).toBe(10);
    useCartStore.getState().setTip(37);
    expect(useCartStore.getState().tipPercent).toBe(0);
  });

  it("al cambiar a una sucursal sin domicilio, fuerza recogida", () => {
    useCartStore.getState().setFulfillment("delivery");
    expect(useCartStore.getState().fulfillmentType).toBe("delivery");
    useCartStore.getState().setBranch("branch-norte"); // sin domicilio
    expect(useCartStore.getState().fulfillmentType).toBe("pickup");
  });

  it("no permite seleccionar domicilio en sucursales sin el servicio", () => {
    useCartStore.getState().setBranch("branch-norte");
    useCartStore.getState().setFulfillment("delivery");
    expect(useCartStore.getState().fulfillmentType).toBe("pickup");
  });

  it("reconcilia precios y elimina platos retirados del menú", () => {
    const item = makeMenuItem();
    const removed = makeMenuItem({ id: "sopa", slug: "sopa", fullName: "Sopa", price: 18000 });
    useCartStore.getState().addItem(item);
    useCartStore.getState().addItem(removed);

    const result = useCartStore.getState().reconcileWithMenu([
      makeMenuItem({ price: 42000 }), // precio cambió
      // "sopa" ya no existe
    ]);

    expect(result.priceChanged).toEqual(["Carne asada"]);
    expect(result.removed).toEqual(["Sopa"]);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0]?.unitPriceSnapshot).toBe(42000);
  });

  it("persiste el estado en localStorage y migra desde v0", async () => {
    useCartStore.getState().addItem(makeMenuItem());
    await Promise.resolve(); // flush del middleware persist
    const raw = window.localStorage.getItem("rb-cart");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw ?? "{}") as { state: { items: unknown[] }; version: number };
    expect(stored.version).toBe(1);
    expect(stored.state.items).toHaveLength(1);

    // Migración v0 → v1: sin couponCode/tipPercent en el estado persistido.
    const persistOptions = useCartStore.persist.getOptions();
    const migrated = persistOptions.migrate?.({ items: [], branchId: "branch-centro" }, 0) as {
      couponCode: string | null;
      tipPercent: number;
    };
    expect(migrated.couponCode).toBeNull();
    expect(migrated.tipPercent).toBe(0);
  });
});
