import { beforeEach, describe, expect, it } from "vitest";
import { consumeCartRepairNotice, useCartStore } from "@/stores/cart";
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

  it("reconcilia identidad, fotografía y opciones contra el catálogo vigente", () => {
    const current = makeMenuItem({
      fullName: "Carne asada renovada",
      price: 42000,
      image: {
        ...makeMenuItem().image,
        publicPath: "/generated/menu/carne-asada-renovada.jpg",
      },
      modifierGroups: [
        {
          id: "extras",
          name: "Extras",
          required: false,
          minSelections: 0,
          maxSelections: 1,
          options: [
            { id: "guac", name: "Guacamole", additionalPrice: 5000, available: true },
          ],
        },
      ],
    });
    useCartStore.setState({
      items: [
        {
          lineId: "carne-asada__extras:guac",
          itemId: current.id,
          slug: current.slug,
          nameSnapshot: "CasaBrasa carne antigua",
          unitPriceSnapshot: 1000,
          quantity: 1,
          notes: "",
          modifiers: [
            {
              groupId: "extras",
              groupName: "Extras antiguos",
              optionId: "guac",
              optionName: "Guacamole antiguo",
              priceSnapshot: 100,
            },
          ],
          imagePath: "/legacy/casa-brasa.jpg",
        },
      ],
    });

    const result = useCartStore.getState().reconcileWithMenu([current]);
    const [line] = useCartStore.getState().items;
    expect(result.updated).toEqual(["CasaBrasa carne antigua"]);
    expect(result.modified).toEqual(["CasaBrasa carne antigua"]);
    expect(result.priceChanged).toEqual(["CasaBrasa carne antigua"]);
    expect(line).toMatchObject({
      nameSnapshot: "Carne asada renovada",
      unitPriceSnapshot: 42000,
      imagePath: "/generated/menu/carne-asada-renovada.jpg",
    });
    expect(line?.modifiers[0]).toMatchObject({
      groupName: "Extras",
      optionName: "Guacamole",
      priceSnapshot: 5000,
    });
  });

  it("retira sopas guardadas como productos independientes", () => {
    const soup = makeMenuItem({
      id: "sopa-del-dia",
      slug: "sopa-del-dia",
      fullName: "Sopa del día",
      categorySlug: "sopas",
    });
    useCartStore.setState({
      items: [
        {
          lineId: soup.id,
          itemId: soup.id,
          slug: soup.slug,
          nameSnapshot: soup.fullName,
          unitPriceSnapshot: soup.price,
          quantity: 1,
          notes: "",
          modifiers: [],
          imagePath: soup.image.publicPath,
        },
      ],
    });

    const result = useCartStore.getState().reconcileWithMenu([soup]);
    expect(result.nonPurchasable).toEqual(["Sopa del día"]);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("conserva la sopa incluida a cero y cae a Sin sopa si deja de estar disponible", () => {
    const lunch = makeMenuItem({
      modifierGroups: [
        {
          id: "included-lunch-soup",
          kind: "includedLunchSoup",
          name: "Sopa incluida",
          required: false,
          minSelections: 0,
          maxSelections: 1,
          options: [
            { id: "sopa-1", name: "Sopa vieja", additionalPrice: 0, available: false },
            { id: "no-soup", name: "Sin sopa", additionalPrice: 0, available: true },
          ],
        },
      ],
    });
    useCartStore.setState({
      items: [
        {
          lineId: `${lunch.id}__included-lunch-soup:sopa-1`,
          itemId: lunch.id,
          slug: lunch.slug,
          nameSnapshot: lunch.fullName,
          unitPriceSnapshot: lunch.price,
          quantity: 1,
          notes: "",
          modifiers: [
            {
              groupId: "included-lunch-soup",
              groupName: "Sopa incluida",
              optionId: "sopa-1",
              optionName: "Sopa vieja",
              priceSnapshot: 5000,
            },
          ],
          imagePath: lunch.image.publicPath,
        },
      ],
    });

    const result = useCartStore.getState().reconcileWithMenu([lunch]);
    expect(result.modified).toEqual([lunch.fullName]);
    expect(useCartStore.getState().items[0]?.modifiers).toEqual([
      {
        groupId: "included-lunch-soup",
        groupName: "Sopa incluida",
        optionId: "no-soup",
        optionName: "Sin sopa",
        priceSnapshot: 0,
      },
    ]);
  });

  it("persiste el estado en localStorage y migra desde v0", async () => {
    useCartStore.getState().addItem(makeMenuItem());
    await Promise.resolve(); // flush del middleware persist
    const raw = window.localStorage.getItem("rb-cart");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw ?? "{}") as { state: { items: unknown[] }; version: number };
    expect(stored.version).toBe(2);
    expect(stored.state.items).toHaveLength(1);

    // Migración v0/v1 → v2: sin couponCode/tipPercent en el estado persistido.
    const persistOptions = useCartStore.persist.getOptions();
    const migrated = persistOptions.migrate?.({ items: [], branchId: "branch-centro" }, 0) as {
      couponCode: string | null;
      tipPercent: number;
    };
    expect(migrated.couponCode).toBeNull();
    expect(migrated.tipPercent).toBe(0);
  });

  it("descarta líneas corruptas y ajusta cantidades/notas antiguas al migrar", () => {
    consumeCartRepairNotice();
    const persistOptions = useCartStore.persist.getOptions();
    const migrated = persistOptions.migrate?.(
      {
        items: [
          {
            itemId: "carne-asada",
            slug: "carne-asada",
            nameSnapshot: "Carne asada",
            unitPriceSnapshot: 40000,
            quantity: 999,
            notes: "x".repeat(260),
            modifiers: [{ groupId: "broken" }],
            imagePath: "legacy.jpg",
          },
          { quantity: 0 },
        ],
      },
      1,
    ) as { items: Array<{ quantity: number; notes: string; imagePath: string }> };

    expect(migrated.items).toHaveLength(1);
    expect(migrated.items[0]).toMatchObject({
      quantity: 20,
      notes: "x".repeat(200),
      imagePath: "/icon.svg",
    });
    expect(consumeCartRepairNotice()).toEqual({
      removed: ["un producto"],
      adjusted: ["Carne asada"],
    });
  });

  it("valida sucursal y modalidad persistidas", () => {
    const persistOptions = useCartStore.persist.getOptions();
    const migrated = persistOptions.migrate?.(
      { items: [], branchId: "branch-norte", fulfillmentType: "delivery" },
      1,
    ) as { branchId: string; fulfillmentType: string };

    expect(migrated.branchId).toBe("branch-norte");
    expect(migrated.fulfillmentType).toBe("pickup");
  });
});
