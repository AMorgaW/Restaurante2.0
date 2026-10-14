import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuItem } from "@/types/menu";
import type { MenuRepository, OrderRepository } from "@/server/repositories/types";

const harness = vi.hoisted(() => {
  const menuRepo: { current: MenuRepository } = {
    current: {
      getMenuItems: async () => [],
      getMenuItemBySlug: async () => null,
      getCategories: async () => [],
    },
  };
  const orderRepo: { current: OrderRepository } = {
    current: {
      saveOrder: async (order) => order,
      getOrderById: async () => null,
      listOrders: async () => [],
      updateOrderStatus: async () => ({ ok: false, reason: "not-found" }),
    },
  };
  return { menuRepo, orderRepo };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getResolvedPaymentProvider: () => "demo",
  getResolvedDataMode: () => "local",
  getDataModeStatus: () => ({ mode: "local", configured: false, missing: [], invalid: [] }),
  getAuthModeStatus: () => ({ mode: "disabled", configured: false, missing: [], invalid: [] }),
  getServerEnv: () => ({}),
}));
vi.mock("@/server/repositories", () => ({
  getMenuRepository: () => harness.menuRepo.current,
  getOrderRepository: () => harness.orderRepo.current,
}));

import { OrderValidationError, placeOrder } from "@/server/services/orders";

const item: MenuItem = {
  id: "plato-test",
  slug: "plato-test",
  fullName: "Plato test",
  categorySlug: "carnes",
  shortDescription: "demo",
  price: 25000,
  isIndependentlyOrderable: true,
  available: true,
  featured: false,
  tags: [],
  displayOrder: 1,
  image: {
    originalFilename: "x",
    publicPath: "/icon.svg",
    width: 1,
    height: 1,
    aspectRatio: 1,
    hasAlpha: true,
    blurDataURL: "",
    bytes: 0,
  },
  modifierGroups: [
    {
      id: "g1",
      name: "Extra",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { id: "o1", name: "Guacamole", additionalPrice: 2000, available: true },
        { id: "o2", name: "Inactivo", additionalPrice: 1000, available: false },
      ],
    },
  ],
};

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    branchId: "branch-centro",
    fulfillmentType: "pickup" as const,
    customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
    items: [
      {
        slug: "plato-test",
        quantity: 1,
        notes: "",
        modifiers: [{ groupId: "g1", optionId: "o1" }],
      },
    ],
    tipPercent: 0,
    notes: "",
    ...overrides,
  };
}

describe("placeOrder catálogo autoritativo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00-05:00"));
    harness.menuRepo.current = {
      getMenuItems: async () => [item],
      getMenuItemBySlug: async (slug) => (slug === item.slug ? item : null),
      getCategories: async () => [],
    };
    harness.orderRepo.current = {
      saveOrder: async (order) => order,
      getOrderById: async () => null,
      listOrders: async () => [],
      updateOrderStatus: async () => ({ ok: false, reason: "not-found" }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recalcula precio servidor e ignora manipulación del cliente", async () => {
    const order = await placeOrder(baseInput());
    expect(order.items[0]?.unitPrice).toBe(25000);
    expect(order.items[0]?.modifiers[0]?.priceSnapshot).toBe(2000);
    expect(order.totals.subtotal).toBe(27000);
  });

  it("rechaza producto inexistente", async () => {
    harness.menuRepo.current.getMenuItemBySlug = async () => null;
    await expect(placeOrder(baseInput())).rejects.toMatchObject({ code: "item-missing" });
  });

  it("rechaza producto no disponible", async () => {
    harness.menuRepo.current.getMenuItemBySlug = async () => ({ ...item, available: false });
    await expect(placeOrder(baseInput())).rejects.toBeInstanceOf(OrderValidationError);
  });

  it("rechaza productos que no se venden de forma independiente", async () => {
    harness.menuRepo.current.getMenuItemBySlug = async () => ({
      ...item,
      categorySlug: "sopas",
      isIndependentlyOrderable: false,
    });
    await expect(placeOrder(baseInput())).rejects.toMatchObject({ code: "item-not-orderable" });
  });

  it("rechaza sopa incluida fuera de Almuerzo y en los límites cerrados", async () => {
    const soupGroup = {
      id: "included-lunch-soup",
      kind: "includedLunchSoup" as const,
      name: "Sopa incluida",
      required: false,
      minSelections: 0,
      maxSelections: 1,
      options: [{ id: "no-soup", name: "Sin sopa", additionalPrice: 0, available: true }],
    };
    harness.menuRepo.current.getMenuItemBySlug = async () => ({
      ...item,
      modifierGroups: [...item.modifierGroups, soupGroup],
    });
    const soupInput = baseInput({
      items: [{
        slug: "plato-test",
        quantity: 1,
        notes: "",
        modifiers: [
          { groupId: "g1", optionId: "o1" },
          { groupId: "included-lunch-soup", optionId: "no-soup" },
        ],
      }],
    });
    vi.setSystemTime(new Date("2026-07-21T18:00:00-05:00"));
    await expect(placeOrder(soupInput)).rejects.toMatchObject({ code: "included-soup-invalid" });
    vi.setSystemTime(new Date("2026-07-21T22:00:00-05:00"));
    await expect(placeOrder(baseInput())).rejects.toMatchObject({ code: "service-closed" });
  });

  it("rechaza opción inactiva y de otro grupo", async () => {
    await expect(
      placeOrder(baseInput({
        items: [{ slug: "plato-test", quantity: 1, notes: "", modifiers: [{ groupId: "g1", optionId: "o2" }] }],
      })),
    ).rejects.toMatchObject({ code: "modifier-invalid" });

    await expect(
      placeOrder(baseInput({
        items: [{ slug: "plato-test", quantity: 1, notes: "", modifiers: [{ groupId: "g-x", optionId: "o1" }] }],
      })),
    ).rejects.toMatchObject({ code: "modifier-invalid" });
  });

  it("exige modificador requerido y rechaza duplicados", async () => {
    await expect(
      placeOrder(baseInput({
        items: [{ slug: "plato-test", quantity: 1, notes: "", modifiers: [] }],
      })),
    ).rejects.toMatchObject({ code: "modifier-required" });

    await expect(
      placeOrder(baseInput({
        items: [{
          slug: "plato-test",
          quantity: 1,
          notes: "",
          modifiers: [
            { groupId: "g1", optionId: "o1" },
            { groupId: "g1", optionId: "o1" },
          ],
        }],
      })),
    ).rejects.toMatchObject({ code: "modifier-duplicate" });
  });

  it("usa precio actualizado del catálogo entre carrito y checkout", async () => {
    harness.menuRepo.current.getMenuItemBySlug = async () => ({ ...item, price: 30000 });
    const order = await placeOrder(baseInput());
    expect(order.items[0]?.unitPrice).toBe(30000);
    expect(order.totals.subtotal).toBe(32000);
  });

  it("propaga branchId al repositorio", async () => {
    const spy = vi.fn(async () => item);
    harness.menuRepo.current.getMenuItemBySlug = spy;
    await placeOrder(baseInput({ branchId: "branch-norte" }));
    expect(spy).toHaveBeenCalledWith("plato-test", { branchId: "branch-norte" });
  });
});
