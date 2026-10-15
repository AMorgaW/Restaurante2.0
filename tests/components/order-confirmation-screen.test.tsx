import { renderWithProviders } from "./render";
import { OrderConfirmationScreen } from "@/components/checkout/order-confirmation-screen";
import { useOrdersStore } from "@/stores/orders";
import type { Order } from "@/types/order";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-confirmation-test",
    orderNumber: "CB-TEST-1234",
    branchId: "branch-centro",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "demo",
    fulfillmentType: "pickup",
    items: [
      {
        itemId: "dish-1",
        slug: "dish-1",
        nameSnapshot: "Arroz de coco con pescado",
        unitPrice: 42000,
        quantity: 2,
        modifiers: [
          {
            groupId: "included-lunch-soup",
            groupName: "Sopa incluida",
            optionId: "soup-1",
            optionName: "Sopa de pescado",
            priceSnapshot: 0,
          },
          {
            groupId: "side",
            groupName: "Acompañante",
            optionId: "patacon",
            optionName: "Patacón",
            priceSnapshot: 2500,
          },
        ],
        notes: "Sin cilantro",
        total: 84500,
      },
    ],
    totals: {
      subtotal: 84500,
      discount: 5000,
      tax: 6360,
      serviceFee: 0,
      deliveryFee: 0,
      tip: 0,
      total: 85860,
    },
    currency: "COP",
    customer: { name: "Ana Pérez", phone: "+57 300 123 4567", email: "ana@example.com" },
    notes: "Llamar al llegar",
    createdAt: "2026-10-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("OrderConfirmationScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useOrdersStore.setState({ orders: [] });
  });

  it("distingue un pedido pendiente y presenta todos los datos del recibo", async () => {
    useOrdersStore.getState().addOrder(createOrder());
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pedido recibido" })).toBeVisible());
    expect(screen.getByText("Pendiente")).toBeVisible();
    expect(screen.getByText("Demostración · sin cobro real")).toBeVisible();
    expect(screen.getByText(/se conserva solo en este navegador/i)).toBeVisible();
    expect(screen.queryByText("Pagado (demostración)")).not.toBeInTheDocument();
    expect(screen.getByText("2 ×")).toBeVisible();
    expect(screen.getByText("Arroz de coco con pescado")).toBeVisible();
    expect(screen.getByText("Sopa incluida: Sopa de pescado · COP 0")).toBeVisible();
    expect(screen.getByText("Acompañante: Patacón")).toBeVisible();
    expect(screen.getByText("“Sin cilantro”")).toBeVisible();
    expect(screen.getByText("Nota del pedido:")).toBeVisible();
    expect(screen.getByText("Total", { exact: true })).toBeVisible();
  });

  it("muestra el significado real de confirmado y la opción Sin sopa", async () => {
    useOrdersStore.getState().addOrder(
      createOrder({
        status: "confirmed",
        items: [
          {
            ...createOrder().items[0]!,
            modifiers: [
              {
                groupId: "included-lunch-soup",
                groupName: "Sopa incluida",
                optionId: "no-soup",
                optionName: "Sin sopa",
                priceSnapshot: 0,
              },
            ],
          },
        ],
      }),
    );
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible());
    expect(screen.getByText("Confirmado")).toBeVisible();
    expect(screen.getByText("Sin sopa · COP 0")).toBeVisible();
  });

  it("presenta domicilio y mesa QR sin exponer el token", async () => {
    useOrdersStore.getState().addOrder(
      createOrder({
        fulfillmentType: "delivery",
        address: { street: "Calle 10 # 5-51", details: "Apto 3", neighborhood: "Centro" },
        tableQrToken: "no-mostrar-este-token",
      }),
    );
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getAllByText("Domicilio", { exact: true })[0]).toBeVisible());
    expect(screen.getByText("Calle 10 # 5-51")).toBeVisible();
    expect(screen.queryByText("no-mostrar-este-token")).not.toBeInTheDocument();
  });

  it("etiqueta mesa mediante QR sin inventar un número de mesa", async () => {
    useOrdersStore.getState().addOrder(createOrder({ fulfillmentType: "local", tableSessionId: "session-1" }));
    renderWithProviders(<OrderConfirmationScreen orderId="order-confirmation-test" />);

    await waitFor(() => expect(screen.getByText("Mesa mediante QR", { exact: true })).toBeVisible());
    expect(screen.getByText("Pedido en mesa")).toBeVisible();
    expect(screen.queryByText(/Mesa\s+\d+/i)).not.toBeInTheDocument();
  });

  it("usa un estado neutral cuando no hay copia local y no consulta el servidor", async () => {
    renderWithProviders(<OrderConfirmationScreen orderId="missing-order" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "No hay un comprobante guardado en este navegador para este enlace",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByText(/no confirma ni descarta/i)).toBeVisible();
    expect(screen.queryByText("Pedido no encontrado")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver al menú" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Volver al inicio" })).toBeVisible();
  });

  it("elimina tokens QR heredados al guardar y al persistir el comprobante", () => {
    useOrdersStore.getState().addOrder({ ...createOrder(), tableQrToken: "no-persistir-este-token" });

    const stored = window.localStorage.getItem("rb-orders");
    expect(useOrdersStore.getState().orders[0]).not.toHaveProperty("tableQrToken");
    expect(stored).not.toContain("no-persistir-este-token");
    expect(stored).not.toContain("tableQrToken");
  });

  it("migra registros rb-orders v1 sin dejar el token QR en la copia local", async () => {
    window.localStorage.setItem(
      "rb-orders",
      JSON.stringify({
        state: { orders: [{ ...createOrder(), tableQrToken: "legacy-secret" }] },
        version: 1,
      }),
    );
    await useOrdersStore.persist.rehydrate();

    expect(useOrdersStore.getState().orders[0]).not.toHaveProperty("tableQrToken");
    expect(window.localStorage.getItem("rb-orders")).not.toContain("legacy-secret");
  });
});
